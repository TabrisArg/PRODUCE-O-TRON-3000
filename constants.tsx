
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
    description: "Compose professional 90s corporate memos and emails."
  },
  {
    id: ToolType.NOTES,
    name: "Quick Notes",
    icon: "📝",
    description: "A local scratchpad for your thoughts and snippets."
  }
];
