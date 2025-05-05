import { PokedexEntry, Move, Ability } from '@/lib/gameData'; // 假设 gameData.ts 在 src/lib 下
import { PokemonInstance } from './pokemon'; // Import the Pokemon instance type

// --- 玩家状态定义 ---

/**
 * 玩家携带的物品
 */
export interface InventoryItem {
  itemId: string; // 对应 items.json 中的物品 ID
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
  seen: string[]; // 见过的宝可梦 yudex_id 列表
  caught: string[]; // 捕捉过的宝可梦 yudex_id 列表
}

/**
 * 玩家主体数据结构
 */
export interface Player {
  id: string; // 玩家唯一 ID (例如用户认证 ID)
  name: string; // 玩家角色名
  locationId: string; // 当前所在地点 ID (对应 locations.json)
  currentHp: number; // 玩家自身HP (如果玩家也有HP的话，根据游戏设计)
  maxHp: number;
  badges: string[]; // 获得的徽章列表
  money: number; // 金钱
  creditStatus: number; // 信用状态 (可以用数字表示等级或具体分数)
  inventory: InventoryItem[]; // 物品栏
  team: PokemonInstance[]; // 宝可梦队伍 (最多 6 只)
  pcBox: PokemonInstance[]; // Pokemon stored in the PC boxes
  pokedex: PokedexStatus; // 图鉴状态
  questFlags: { [flagName: string]: boolean | number | string }; // 任务/事件标志 (键值对形式)
  relationshipFlags: { [npcId: string]: number | string }; // 与 NPC 的关系状态 (键值对形式，值可以是数字表示好感度或字符串表示状态)
  statusConditions?: string[]; // 玩家自身异常状态 (可选)
} 