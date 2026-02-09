
export enum ToolType {
  FILE_LIST = 'FILE_LIST',
  HOME = 'HOME',
  DRAFTER = 'DRAFTER',
  NOTES = 'NOTES'
}

export interface ToolConfig {
  id: ToolType;
  name: string;
  icon: string;
  description: string;
}
