import React from 'react';
import { ToolType, ToolConfig } from './types.ts';
import { ICONS } from './src/icons.ts';

export const TOOLS: ToolConfig[] = [
  {
    id: ToolType.FILE_LIST,
    name: "Files to Docs",
    icon: <img src={ICONS.FOLDER} alt="folder" className="w-5 h-5" />,
    description: "Organize messy filenames into a clean document inventory."
  },
  {
    id: ToolType.COST_SIMULATOR,
    name: "Cost Simulator",
    icon: <img src={ICONS.MONEY} alt="money" className="w-5 h-5" />,
    description: "Simple tool for monthly resource cost simulation."
  },
  {
    id: ToolType.PROJECT_ARCHITECT,
    name: "Project Architect",
    icon: <img src={ICONS.CALENDAR} alt="calendar" className="w-5 h-5" />,
    description: "Simulate costs, import backlogs, and forecast resource timelines."
  }
];
