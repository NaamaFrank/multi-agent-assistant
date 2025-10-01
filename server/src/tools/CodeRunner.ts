// src/tools/CodeRunTool.ts
import type { Tool, ToolSchema, ToolResult, Json } from "@/types";
import vm from "node:vm";

/**
 * CodeRunTool (JS-only)
 * - Executes short JavaScript snippets in a sandbox.
 * - Tries `isolated-vm` (if installed) with a memory limit.
 * - Falls back to Node's `vm` if `isolated-vm` isn't available.
 *
 * Input:
 *   {
 *     code: string,          // required
 *     timeoutMs?: number     // optional; default 4000, min 50, max 10000
 *   }
 *
 * Output content:
 *   {
 *     language: "javascript",
 *     stdout: string,
 *     stderr: string,
 *     timedOut?: boolean
 *   }
 */

// ---------- optional isolated-vm loader ----------
let ivmModule: any | null = null;
let ivmTried = false;

async function loadIsolatedVmOnce(): Promise<any | null> {
  if (ivmTried) return ivmModule;
  ivmTried = true;
  try {
    // Use dynamic import with require for better compatibility with bundlers
    const isLambdaEnvironment = Boolean(
      process.env.AWS_LAMBDA_FUNCTION_NAME || // Standard Lambda environment variable
      process.env.AWS_EXECUTION_ENV?.startsWith('AWS_Lambda_') // Alternative check
    );
    
    ivmModule = isLambdaEnvironment
      ? null // Skip isolated-vm in Lambda environment
      : await new Promise(resolve => {
          try {
            const mod = require('isolated-vm');
            resolve(mod);
          } catch (error: any) {
            console.warn('isolated-vm not available:', error?.message || 'Unknown error');
            resolve(null);
          }
        });
  } catch (error: any) {
    console.warn('Failed to load isolated-vm:', error?.message || 'Unknown error');
    ivmModule = null;
  }
  return ivmModule;
}

// ---------- helpers ----------
const MAX_STD_CHARS = 16_000;

function clip(s: string) {
  return s.length > MAX_STD_CHARS ? s.slice(0, MAX_STD_CHARS) + "\n…[truncated]" : s;
}

/** Strong isolation path (if isolated-vm is available) */
async function runWithIsolatedVm(code: string, timeoutMs: number) {
  const ivm = await loadIsolatedVmOnce();
  if (!ivm) return null;

  const isolate = new ivm.Isolate({ memoryLimit: 64 }); // ~64MB
  const context = await isolate.createContext();
  const jail = context.global;

  let stdout = "";
  let stderr = "";
  let timedOut = false;

  await jail.set(
    "print",
    (...args: any[]) => {
      stdout += args.map(String).join(" ") + "\n";
    },
    { copy: true }
  );
  await jail.set(
    "console",
    { log: (...a: any[]) => (stdout += a.map(String).join(" ") + "\n") },
    { copy: true }
  );

  const wrapped = `(function(){ "use strict"; ${code}\n})()`;

  try {
    const script = await isolate.compileScript(wrapped);
    await script.run(context, { timeout: Math.max(1, timeoutMs) });
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (/Script execution timed out/i.test(msg)) timedOut = true;
    stderr += msg + "\n";
  }

  return { stdout: clip(stdout), stderr: clip(stderr), timedOut };
}

/** Fallback using Node's vm */
async function runWithNodeVm(code: string, timeoutMs: number) {
  let stdout = "";
  let stderr = "";
  let timedOut = false;

  const sandbox: Record<string, any> = Object.create(null);
  sandbox.print = (...a: any[]) => {
    stdout += a.map(String).join(" ") + "\n";
  };
  sandbox.console = {
    log: (...a: any[]) => {
      stdout += a.map(String).join(" ") + "\n";
  }};

  const context = vm.createContext(sandbox, { name: "code_run_sandbox" });
  const wrapped = `(function(){ "use strict"; ${code}\n})()`;

  try {
    const script = new vm.Script(wrapped, { filename: "snippet.js" });
    script.runInContext(context, { timeout: Math.max(1, timeoutMs) });
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (/Script execution timed out/i.test(msg)) timedOut = true;
    stderr += msg + "\n";
  }

  return { stdout: clip(stdout), stderr: clip(stderr), timedOut };
}

async function runJsIsolatedOrVm(code: string, timeoutMs: number) {
  const ivmResult = await runWithIsolatedVm(code, timeoutMs);
  if (ivmResult) return ivmResult;
  return runWithNodeVm(code, timeoutMs);
}

// ---------- Tool ----------
type CodeRunInput = {
  code: string;
  timeoutMs?: number;
};

export class CodeRunTool implements Tool {
  name = "code_run";

  schema(): ToolSchema {
    return {
      name: this.name,
      description:
        "Execute a short JavaScript snippet in a sandbox. Use for quick calculations or verifying tiny code. Print results using `print()` or `console.log()`.",
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["code"],
        properties: {
          code: {
            type: "string",
            description:
              "JavaScript code to execute. Keep it short; print your result with print() or console.log().",
          },
          timeoutMs: {
            type: "number",
            minimum: 50,
            maximum: 10_000,
            default: 4000,
            description: "Max execution time in milliseconds (default 4000).",
          },
        },
      },
    };
  }

  async execute(input: Json): Promise<ToolResult> {
    try {
      const { code, timeoutMs } = input as CodeRunInput;

      if (typeof code !== "string" || code.trim().length === 0) {
        return {
          tool_use_id: "",
          isError: true,
          content: { error: "Missing or empty 'code' string." },
        };
      }

      const t = Math.min(Math.max(Number(timeoutMs) || 4000, 50), 10_000);
      const { stdout, stderr, timedOut } = await runJsIsolatedOrVm(code, t);

      return {
        tool_use_id: "",
        content: {
          language: "javascript",
          stdout,
          stderr,
          ...(timedOut ? { timedOut: true } : {}),
        },
      };
    } catch (err: any) {
      return {
        tool_use_id: "",
        isError: true,
        content: { error: err?.message || String(err) },
      };
    }
  }
}
