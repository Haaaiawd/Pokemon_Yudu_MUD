/**
 * Represents the possible non-volatile status conditions a Pokemon can have.
 */
export type StatusCondition = 
  | 'PAR' // Paralyzed
  | 'PSN' // Poisoned 
  | 'BRN' // Burned
  | 'SLP' // Asleep
  | 'FRZ' // Frozen
  | null; // null indicates no major status condition

// Forward import from gameData.ts to avoid circular imports
export interface PokedexEntry {
  yudex_id: string;
  name: string;
  name_en: string;
  name_jp: string;
  world_gen: string;
  types?: string[];
  stats?: Array<{
    form: string;
    data: {
      hp: string;
      attack: string;
      defense: string; 
      sp_attack: string;
      sp_defense: string;
      speed: string;
    };
  }>;
  // Other fields that might be needed
  catchRate?: number;
  experienceGroup?: string;
  gender_ratio?: { male: number; female: number };
  [key: string]: any;
}

// Forward import for Move to avoid circular imports
export interface Move {
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  power: number | null;
  accuracy: number | null;
  pp: number;
  priority?: number;
  [key: string]: any;
}

/**
 * 宝可梦实例 - 表示玩家拥有的一只宝可梦
 */
export interface PokemonInstance {
  instanceId: string; // 实例唯一ID
  pokedexId: string; // 图鉴ID (对应yudu_pokedex.json中的yudex_id)
  nickname?: string; // 昵称
  level: number; // 等级
  experience: number; // 经验值
  currentHp: number; // 当前HP
  maxHp: number; // 最大HP
  moves: string[]; // 已学会的招式ID
  heldItemId?: string; // 持有物品
  ability: string; // 特性
  stats: { // 能力值
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
  statusCondition?: string; // 异常状态
  speciesName?: string; // 种族名称 (方便显示)
}

/**
 * 战斗中的宝可梦状态
 */
export interface BattlePokemon extends PokemonInstance {
  // 战斗中的临时数据
  temporaryStats?: {
    attackModifier: number; // 攻击等级修正
    defenseModifier: number; // 防御等级修正
    specialAttackModifier: number; // 特攻等级修正
    specialDefenseModifier: number; // 特防等级修正
    speedModifier: number; // 速度等级修正
    accuracyModifier: number; // 命中率等级修正
    evasionModifier: number; // 回避率等级修正
  };
  temporaryConditions: string[]; // 临时状态(混乱、着迷、束缚等)
  lastMoveUsed?: string; // 上一回合使用的招式
  movePP: { [moveId: string]: number }; // 招式剩余PP
}

/**
 * 战斗状态
 */
export interface BattleState {
  id: string; // 战斗唯一ID
  type: 'wild' | 'trainer' | 'leader'; // 战斗类型：野生、普通训练家、道馆馆主
  playerTeam: BattlePokemon[]; // 玩家队伍
  opponentTeam: BattlePokemon[]; // 对手队伍
  currentPlayerPokemonIndex: number; // 当前玩家出场宝可梦索引
  currentOpponentPokemonIndex: number; // 当前对手出场宝可梦索引
  turn: number; // 当前回合数
  weather?: string; // 天气状态
  terrain?: string; // 场地状态
  playerSwitching: boolean; // 玩家是否在换宝可梦
  opponentId?: string; // 对手ID (如果是训练家战)
  log: string[]; // 战斗日志
  status: 'active' | 'playerWon' | 'playerLost' | 'fled' | 'draw'; // 战斗状态
}

// --- Natures --- (Can be moved to a constants file later)
// Simplified example, only showing a few
export interface Nature {
    id: string;
    name: string;
    increasedStat: keyof Omit<PokemonInstance['calculatedStats'], 'hp'> | null; // Exclude HP from nature effects
    decreasedStat: keyof Omit<PokemonInstance['calculatedStats'], 'hp'> | null; // Exclude HP from nature effects
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