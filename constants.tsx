import { ToolType, ToolConfig } from './types.ts';

export const TOOLS: ToolConfig[] = [
  {
    id: ToolType.FILE_LIST,
    name: "Files to Docs",
    icon: "📂",
    description: "Organize messy filenames into a clean document inventory."
  },
  {
    id: ToolType.COST_SIMULATOR,
    name: "Cost Simulator",
    icon: "💰",
    description: "Calculate project budgets with custom margins and contingency."
  }
];