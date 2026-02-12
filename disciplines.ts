export interface Discipline {
  id: string;
  name: string;
  defaultCost: number;
}

/**
 * Game Development Discipline Registry
 * Edit this file manually to add, remove, or update roles and their monthly costs.
 */
export const GAME_DEV_DISCIPLINES: Discipline[] = [
  { id: 'gp', name: 'Gameplay Programmer', defaultCost: 6500 },
  { id: 'ui', name: 'UI/UX Artist', defaultCost: 5500 },
  { id: 'ta', name: 'Technical Artist', defaultCost: 7000 },
  { id: 'ld', name: 'Level Designer', defaultCost: 5000 },
  { id: 'pm', name: 'Producer / PM', defaultCost: 6000 },
  { id: 'qa', name: 'QA Analyst', defaultCost: 4000 },
  { id: 'gd', name: 'Game Designer', defaultCost: 5500 },
  { id: 'ad', name: 'Art Director', defaultCost: 8500 },
  { id: 'se', name: 'Sound Engineer', defaultCost: 5200 },
  { id: 'vo', name: 'Voice Coordinator', defaultCost: 4800 },
];
