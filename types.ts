export enum ToolType {
  HOME = 'HOME',
  FILE_LIST = 'FILE_LIST',
  COST_SIMULATOR = 'COST_SIMULATOR'
}

export interface ToolConfig {
  id: ToolType;
  name: string;
  icon: string;
  description: string;
}