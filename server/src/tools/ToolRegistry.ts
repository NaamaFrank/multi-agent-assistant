import { Tool, ToolSchema, ToolResult, Json } from "@/types";

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  getSchemas(): ToolSchema[] {
    return [...this.tools.values()].map(t => t.schema());
  }

  async execute(call: { id: string; name: string; input: Json }): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return { tool_use_id: call.id, content: { error: `Unknown tool: ${call.name}` }, isError: true };
    }
    try {
      const res = await tool.execute(call.input);
      // Ensure the tool_use_id is preserved
      return { ...res, tool_use_id: call.id };
    } catch (err: any) {
      return { tool_use_id: call.id, content: { error: String(err) }, isError: true };
    }
  }
}
