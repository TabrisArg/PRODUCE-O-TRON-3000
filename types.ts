export enum ToolType {
  HOME = 'HOME',
  FILE_LIST = 'FILE_LIST',
  DRAFTER = 'DRAFTER',
  NOTES = 'NOTES',
  IMAGE_LAB = 'IMAGE_LAB'
}

export interface ToolConfig {
  id: ToolType;
  name: string;
  icon: string;
  description: string;
}