/**
 * Represents the possible non-volatile status conditions a Pokemon can have.
 */
export type StatusCondition = 
  | 'healthy' 
  | 'poisoned' 
  | 'paralyzed' 
  | 'burned' 
  | 'frozen' 
  | 'asleep'
  | null; // null or 'healthy' indicates no major status condition

/**
 * Represents an individual Pokemon instance owned by a player or encountered.
 * This is distinct from the static Pokedex data.
 */
export interface PokemonInstance {
  /** Unique identifier for this specific instance (e.g., database ID) */
  instanceId: string; 

  /** Identifier linking to the static Pokedex data (e.g., Yudex ID like "Y001") */
  pokedexId: string;

  /** Optional nickname given by the player */
  nickname?: string | null;

  /** Current level */
  level: number;

  /** Current HP */
  currentHp: number;

  /** Maximum HP (calculated based on base stats, level, IVs, EVs) */
  maxHp: number; // Note: Calculation logic will be separate

  /** Learned moves (IDs or names, max 4 usually) */
  moves: string[]; 

  /** The Pokemon's ability (ID or name) */
  abilityId: string;

  /** Current experience points */
  xp: number;

  /** Experience points needed for the next level */
  xpToNextLevel: number; // Note: Calculation logic will be separate

  /** Current non-volatile status condition */
  statusCondition: StatusCondition;

  // --- Optional Advanced Stats (Now enabled) ---
  /** Individual Values (0-31 for each stat) */
  ivs: { hp: number; attack: number; defense: number; spAttack: number; spDefense: number; speed: number };
  
  /** Effort Values (0-252 for each, max 510 total) */
  evs: { hp: number; attack: number; defense: number; spAttack: number; spDefense: number; speed: number };

  /** Nature ID (e.g., 'adamant', 'modest') */
  natureId: string; // Assuming we'll have a mapping for nature effects

  /** Gender */
  gender: 'male' | 'female' | 'genderless';

  /** Is this Pokemon shiny? */
  shiny: boolean;

  /** ID of the item the Pokemon is holding */
  heldItemId?: string | null;
  
  /** Calculated stats based on level, IVs, EVs, nature */
  calculatedStats: { attack: number; defense: number; spAttack: number; spDefense: number; speed: number };
}

// --- Natures --- (Can be moved to a constants file later)
// Simplified example, only showing a few
export interface Nature {
    id: string;
    name: string;
    increasedStat: keyof PokemonInstance['calculatedStats'] | null;
    decreasedStat: keyof PokemonInstance['calculatedStats'] | null;
}

// We won't define all natures here, just the structure
// Actual nature data would be loaded or defined elsewhere
// const NATURES: { [key: string]: Nature } = {
//     adamant: { id: 'adamant', name: 'Adamant', increasedStat: 'attack', decreasedStat: 'spAttack' },
//     modest: { id: 'modest', name: 'Modest', increasedStat: 'spAttack', decreasedStat: 'attack' },
//     jolly: { id: 'jolly', name: 'Jolly', increasedStat: 'speed', decreasedStat: 'spAttack' },
//     timid: { id: 'timid', name: 'Timid', increasedStat: 'speed', decreasedStat: 'attack' },
//     // ... neutral natures and others
// }; 