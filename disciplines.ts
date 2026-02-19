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
  { id: 'ep', name: 'Engine Programmer', defaultCost: 7500 },
  { id: 'rp', name: 'Rendering Programmer', defaultCost: 8000 },
  { id: 'np', name: 'Network Programmer', defaultCost: 8000 },
  { id: 'gp', name: 'Gameplay Programmer', defaultCost: 6500 },
  { id: 'ui', name: 'UI Artist', defaultCost: 5500 },
  { id: 'ta', name: 'Technical Artist', defaultCost: 7000 },
  { id: 'ld', name: 'Level Designer', defaultCost: 5000 },
  { id: 'pm', name: 'Producer', defaultCost: 6000 },
  { id: 'qa', name: 'QA Tester', defaultCost: 4000 },
  { id: 'gd', name: 'Game Designer', defaultCost: 5500 },
  { id: 'ad', name: 'Art Director', defaultCost: 8500 },
];
