export interface Discipline {
  id: string;
  name: string;
  defaultCost: number;
}

/**
 * Game Development Discipline Registry
 * Updated to reflect common industry roles found in production backlogs.
 */
export const GAME_DEV_DISCIPLINES: Discipline[] = [
  { id: 'pm', name: 'Production', defaultCost: 1000 },
  { id: 'ep', name: 'Engine Programmer', defaultCost: 1000 },
  { id: 'rp', name: 'Rendering Programmer', defaultCost: 1000 },
  { id: 'vfx', name: 'VFX Artist', defaultCost: 1000 },
  { id: 'uiux', name: 'UI/UX Designer', defaultCost: 1000 },
  { id: 'ua', name: 'UI Artist', defaultCost: 1000 },
  { id: 'qa', name: 'QA Tester', defaultCost: 1000 },
  { id: 'np', name: 'Network Programmer', defaultCost: 1000 },
  { id: 'gp', name: 'Gameplay Programmer', defaultCost: 1000 },
  { id: 'ta', name: 'Technical Artist', defaultCost: 1000 },
  { id: 'ld', name: 'Level Designer', defaultCost: 1000 },
  { id: 'gd', name: 'Game Designer', defaultCost: 1000 },
  { id: 'ad', name: 'Art Director', defaultCost: 1000 },
  { id: 'audio', name: 'Audio Programmer', defaultCost: 1000 },
  { id: 'producer', name: 'Producer', defaultCost: 1000 },
];
