export enum ToolType {
  HOME = 'HOME',
  FILE_LIST = 'FILE_LIST'
}

export interface ToolConfig {
  id: ToolType;
  name: string;
  icon: string;
  description: string;
}