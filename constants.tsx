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
    description: "Simple tool for monthly resource cost simulation."
  },
  {
    id: ToolType.PROJECT_ARCHITECT,
    name: "Project Architect",
    icon: "📅",
    description: "Simulate costs, import backlogs, and forecast resource timelines."
  }
];