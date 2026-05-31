export type CharacterStats = {
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
  tempHp: number;
  speed: number;
  hitDice: string;
  proficiencyBonus: number;
  characterAlignment: string;
  saves: Partial<Record<string, boolean>>;
  skillProfs: Partial<Record<string, boolean>>;
  conditions: string[];
  resources: Array<{ name: string; current: number; max: number }>;
  spellSlots: Array<{ level: number; current: number; max: number }>;
  currency: { pp: number; gp: number; sp: number; cp: number };
  equippedSlots: Record<string, { name: string; attackBonus?: string; damage?: string; damageType?: string } | null>;
  inventory: Array<{ id: number; name: string; qty: number }>;
  questItems: Array<{ id: number; name: string }>;
  reputation: Array<{ faction: string; value: number }>;
  relationships: Array<{ name: string; attitude: string }>;
  storyFlags: Array<{ label: string; done: boolean }>;
  alignmentTrack: { good: number; evil: number; lawful: number; chaotic: number };
};

const DEFAULT_STATS: CharacterStats = {
  str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
  tempHp: 0, speed: 30, hitDice: "1d8", proficiencyBonus: 2, characterAlignment: "中立",
  saves: {}, skillProfs: {}, conditions: [], resources: [], spellSlots: [],
  currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
  equippedSlots: {}, inventory: [], questItems: [],
  reputation: [], relationships: [], storyFlags: [],
  alignmentTrack: { good: 50, evil: 50, lawful: 50, chaotic: 50 },
};

export function parseStats(statsStr: string): CharacterStats {
  try {
    return { ...DEFAULT_STATS, ...JSON.parse(statsStr) as Partial<CharacterStats> };
  } catch {
    return { ...DEFAULT_STATS };
  }
}
