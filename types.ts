export enum ToolType {
  FILE_LIST = 'FILE_LIST',
  DRAFTER = 'DRAFTER',
  NOTES = 'NOTES',
  IMAGE_LAB = 'IMAGE_LAB',
  HOME = 'HOME'
}

export interface ToolConfig {
  id: ToolType;
  name: string;
  icon: string;
  description: string;
}