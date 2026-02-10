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
    name: "Doc Drafter",
    icon: "✍️",
    description: "AI-powered corporate drafting tool for memos and emails."
  },
  {
    id: ToolType.NOTES,
    name: "Quick Notes",
    icon: "📝",
    description: "Local scratchpad for your thoughts and snippets."
  },
  {
    id: ToolType.IMAGE_LAB,
    name: "Retro Image Lab",
    icon: "🎨",
    description: "Generate 90s style digital illustrations."
  }
];