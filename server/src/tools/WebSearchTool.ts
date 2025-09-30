import { Tool, ToolSchema, ToolResult, Json } from "@/types";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

type SearchInput = {
  query: string;
  topK?: number;
  siteFilter?: string;
  includeAnswer?: boolean;
  lang?: string; // e.g., "en", "he"
};

// --- Secrets util---
async function getTavilyApiKey(): Promise<string | null> {
  if (process.env.TAVILY_API_KEY) return process.env.TAVILY_API_KEY;

  const secretArn = process.env.TAVILY_SECRET_ARN;
  if (!secretArn) return null;

  const region = process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-east-1";
  const client = new SecretsManagerClient({ region });
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!res.SecretString) return null;

  // If JSON, try common shapes; otherwise return raw string.
  try {
    const parsed = JSON.parse(res.SecretString);
    if (typeof parsed?.key === "string") return parsed.key;
    const vals = Object.values(parsed);
    if (vals.length === 1 && typeof vals[0] === "string") return vals[0] as string;
  } catch {
    /* not JSON */
  }
  return res.SecretString;
}

// --- Small fetch helper with timeout & one retry on AbortError ---
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(t);
  }
}

async function callTavily(body: any): Promise<Response> {
  const tavilyEndpoint = "https://api.tavily.com/search";
  try {
    return await fetchWithTimeout(
      tavilyEndpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      },
      6000
    );
  } catch (e: any) {
    if (String(e).includes("AbortError")) {
      // Single retry with a bit more time
      return await fetchWithTimeout(
        tavilyEndpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body),
        },
        10000
      );
    }
    throw e;
  }
}

export class WebSearchTool implements Tool {
  name = "web_search";

  private validateInput(input: any): string | null {
    if (!input || typeof input !== "object") return "Input must be an object";
    if (!("query" in input)) return "Missing required parameter: 'query'";
    if (typeof input.query !== "string") return "Parameter 'query' must be a string";
    if (input.query.trim().length === 0) return "Parameter 'query' cannot be empty";
    return null;
  }

  schema(): ToolSchema {
    return {
      name: this.name,
      description:
        "Search the web for relevant results via Tavily. Returns result titles, urls and snippets.",
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["query"],
        properties: {
          query: {
            type: "string",
            description:
              "REQUIRED. The search query string (e.g. 'current weather in Tel Aviv').",
          },
          topK: {
            type: "number",
            minimum: 1,
            maximum: 10,
            default: 5,
            description: "Number of results to return (1-10)",
          },
          siteFilter: {
            type: "string",
            description: "Optional site/domain filter (e.g., example.com)",
          },
          includeAnswer: {
            type: "boolean",
            description: "Ask provider to produce a quick answer summary",
          },
          lang: {
            type: "string",
            description: "Two-letter language, e.g. 'en', 'he'",
          },
        },
      },
    };
  }

  async execute(input: Json): Promise<ToolResult> {
    // Basic validation
    const err = this.validateInput(input);
    if (err) {
      return {
        tool_use_id: "",
        content: {
          error: err,
          correctUsage: `{ "query": "your search terms", "topK": 5, "siteFilter": "example.com", "includeAnswer": true, "lang": "en" }`,
        },
        isError: true,
      };
    }

    const { query, topK = 5, siteFilter, includeAnswer = false, lang } = input as SearchInput;

    // Resolve API key
    const apiKey = await getTavilyApiKey();
    if (!apiKey) {
      return {
        tool_use_id: "",
        content: {
          error: "Missing Tavily API key. Set TAVILY_API_KEY or TAVILY_SECRET_ARN.",
        },
        isError: true,
      };
    }

    // Build request
    const body: any = {
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: Math.max(1, Math.min(topK, 10)),
      include_answer: !!includeAnswer,
    };
    if (siteFilter) body.include_domains = [siteFilter];
    if (lang) body.language = lang;

    try {
      const resp = await callTavily(body);
      const ct = resp.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        return {
          tool_use_id: "",
          content: { status: resp.status, error: "Non-JSON response from Tavily" },
          isError: true,
        };
      }

      const json = (await resp.json()) as {
        results?: Array<{ title: string; url: string; content?: string; snippet?: string; score?: number }>;
        answer?: string;
      };

      const results =
        Array.isArray(json.results)
          ? json.results.slice(0, topK).map((r, i) => ({
              rank: i + 1,
              title: r.title,
              url: r.url,
              snippet: r.content ?? r.snippet ?? "",
              ...(r.score !== undefined ? { score: r.score } : {}),
            }))
          : [];

      return {
        tool_use_id: "",
        content: {
          provider: "tavily",
          query,
          results,
          answer: json.answer ?? null,
        },
      };
    } catch (e: any) {
      return {
        tool_use_id: "",
        content: { error: String(e) },
        isError: true,
      };
    }
  }
}
