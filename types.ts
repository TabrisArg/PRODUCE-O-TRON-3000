import React from 'react';

export enum ToolType {
  HOME = 'HOME',
  FILE_LIST = 'FILE_LIST',
  COST_SIMULATOR = 'COST_SIMULATOR',
  PROJECT_ARCHITECT = 'PROJECT_ARCHITECT',
  DISCIPLINE_CALCULATOR = 'DISCIPLINE_CALCULATOR'
}

export interface ToolConfig {
  id: ToolType;
  name: string;
  icon: React.ReactNode;
  description: string;
}
