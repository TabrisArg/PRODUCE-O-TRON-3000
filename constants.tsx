import { ToolType, ToolConfig } from './types.ts';

export const TOOLS: ToolConfig[] = [
  {
    id: ToolType.FILE_LIST,
    name: "Files to Docs",
    icon: "📂",
    description: "Organize messy filenames into a clean document inventory."
  },
  {
    id: ToolType.DRAFTER,
    name: "AI Drafter",
    icon: "✍️",
    description: "Draft professional memos and emails using 90s corporate logic."
  },
  {
    id: ToolType.NOTES,
    name: "Quick Notes",
    icon: "📝",
    description: "A simple scratchpad that saves to your local browser storage."
  }
];