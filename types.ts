export enum ToolType {
  HOME = 'HOME',
  FILE_LIST = 'FILE_LIST',
  COST_SIMULATOR = 'COST_SIMULATOR',
  PROJECT_ARCHITECT = 'PROJECT_ARCHITECT'
}

export interface ToolConfig {
  id: ToolType;
  name: string;
  icon: string;
  description: string;
}