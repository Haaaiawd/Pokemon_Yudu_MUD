import { PokedexEntry, Move, Ability } from '@/lib/gameData'; // 假设 gameData.ts 在 src/lib 下
import { PokemonInstance } from './pokemon'; // Import the Pokemon instance type
import { BattleState } from './battle'; // Import BattleState interface

// --- 玩家状态定义 ---

/**
 * 本地化名称
 */
export interface LocalizedName {
  zh: string;
  en?: string;
}

/**
 * 地点类型
 */
export interface Location {
  id: string;
  type: 'location';
  name: LocalizedName;
  description: string;
  inspired_by?: string;
  environment?: string;
  architecture?: string;
  features?: string;
  exits: { [exitId: string]: string }; // 出口ID -> 目标地点ID的映射
  npcIds?: string[]; // 该位置上的NPC ID数组
  items?: string[]; // 该位置上的物品ID数组
}

/**
 * 路线类型
 */
export interface Route {
  id: string;
  type: 'route';
  name: LocalizedName;
  connects: [string, string]; // 连接的两个地点ID
  length_km?: number;
  features?: string;
  difficulty?: number;
  best_season?: string;
}

/**
 * 背包物品
 */
export interface InventoryItem {
  itemId: string;
  quantity: number;
}

/**
 * 玩家拥有的宝可梦实例的详细状态
 */
export interface OwnedPokemon {
  instanceId: string; // 唯一实例 ID (例如 UUID)
  pokedexId: string; // 对应 PokedexEntry 的 yudex_id
  nickname?: string; // 昵称 (可选)
  level: number;
  experience: number;
  currentHp: number;
  maxHp: number;
  // 招式列表 (存储招式 ID 或更详细信息)
  moves: string[]; // 例如存储 Move 的 index 或 name
  // 可以考虑存储更详细的招式信息，如当前 PP
  // moves: { moveId: string; currentPp: number; maxPp: number }[];
  heldItemId?: string; // 持有的物品 ID (可选)
  ability: string; // 当前生效的特性 ID 或 name
  stats: {
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
    // 可能还需要存储 IVs, EVs 等用于计算
  };
  statusCondition?: string; // 异常状态 (例如 'poisoned', 'paralyzed', 'burned', 'frozen', 'asleep')
  // 可以添加更多字段，如性格(Nature), 个体值(IVs), 努力值(EVs) 等
}

/**
 * 玩家图鉴状态
 */
export interface PokedexStatus {
  seen: string[]; // 已见过的宝可梦ID
  caught: string[]; // 已捕获的宝可梦ID
}

/**
 * 玩家主体数据结构
 */
export interface Player {
  id: string; // 玩家唯一ID
  name: string; // 玩家名称
  locationId: string; // 当前位置ID
  currentHp: number; // 当前HP (用于某些剧情)
  maxHp: number; // 最大HP
  badges: string[]; // 已获得的徽章
  money: number; // 金钱
  creditStatus: number; // 信用状态 (用于某些NPC互动)
  inventory: InventoryItem[]; // 背包物品
  team: PokemonInstance[]; // 当前队伍
  pcBox?: PokemonInstance[]; // PC存储的宝可梦
  pokedex: PokedexStatus; // 图鉴状态
  questFlags: { [flagName: string]: boolean | number | string }; // 任务标记
  relationshipFlags: { [npcId: string]: number | string }; // NPC关系标记
  statusConditions?: string[]; // 状态条件 (例如: 中毒, 睡眠)
  currentBattle?: BattleState; // 当前战斗状态
} 