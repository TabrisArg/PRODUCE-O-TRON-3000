export enum ToolType {
  FILE_LIST = 'FILE_LIST',
  HOME = 'HOME'
}

export interface ToolConfig {
  id: ToolType;
  name: string;
  icon: string;
  description: string;
}