import { ToolType, ToolConfig } from './types.ts';
import { ICONS } from './src/icons.ts';

export const TOOLS: ToolConfig[] = [
  {
    id: ToolType.FILE_LIST,
    name: "Files to Docs",
    icon: ICONS.FOLDER,
    description: "Organize messy filenames into a clean document inventory."
  },
  {
    id: ToolType.COST_SIMULATOR,
    name: "Cost Simulator",
    icon: ICONS.MONEY,
    description: "Simple tool for monthly resource cost simulation."
  },
  {
    id: ToolType.PROJECT_ARCHITECT,
    name: "Project Architect",
    icon: ICONS.CALENDAR,
    description: "Simulate costs, import backlogs, and forecast resource timelines."
  }
];