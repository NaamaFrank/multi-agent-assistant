// src/tools/index.ts
import { ToolRegistry } from "./ToolRegistry";
// import { TimeNowTool } from "./TimeNowTool";
import { WebSearchTool } from "./WebSearchTool";

export function buildDefaultToolRegistry(): ToolRegistry {
  return new ToolRegistry().register(new WebSearchTool());
}
