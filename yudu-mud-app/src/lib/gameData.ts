import fs from 'fs/promises';
import path from 'path';
import { readdir } from 'fs/promises';

// --- 类型定义 (初步，需要根据实际 JSON 结构调整) ---

export interface PokedexEntry {
  yudex_id: string; // 根据文件，ID 是 Y 开头的字符串
  name: string;
  name_en: string;
  name_jp: string;
  world_gen: string; // 似乎是自定义字段
  types?: string[]; // 属性 (可能在详细文件中)
  abilities?: string[]; // 特性 (可能在详细文件中)
  stats?: Array<{ // Array of stats for different forms
    form: string; // e.g., "一般", "Mega", etc.
    data: {       // The actual stats data for that form
      hp: string;        // Note: Values are strings in the file!
      attack: string;
      defense: string;
      sp_attack: string; // Note: Underscore naming convention
      sp_defense: string;
      speed: string;
    };
  }>;
  // 其他信息也可能在详细文件中
  height_m?: number;
  weight_kg?: number;
  description?: string; // 可以从详细文件获取更详细的描述
  evolution_chain_id?: string;
  level_up_moves?: { level: number; moveId: string }[];
  tm_hm_moves?: string[];
  egg_moves?: string[];
  tutor_moves?: string[];
  gender_ratio?: { male: number; female: number }; // e.g., { male: 0.875, female: 0.125 }
  catchRate?: number;
  egg_groups?: string[];
  hatch_steps?: number;
  experienceGroup?: string; // Add optional experience group (e.g., 'medium_fast')
  // 允许其他未知属性
  [key: string]: any; 
}

export interface Move {
  index: string; // ID 是字符串
  generation: string;
  name: string; // 中文名，用作主要标识符
  name_jp: string;
  name_en: string;
  type: string; // 属性
  category: string; // 物理 (Physical), 特殊 (Special), 变化 (Status)
  power: number | null; // 威力 (改为 number 或 null)
  accuracy: number | null; // 命中 (改为 number 或 null, null for '—')
  pp: number; // PP (改为 number)
  text: string; // 描述
  effect?: string; // 效果文本 (可选)
  info?: string[]; // 附加信息 (可选)
  range?: string; // 作用范围 (可选)
  priority?: number; // 优先度 (可选, 默认为 0)
  // 允许其他未知属性, 比如 learnset
  [key: string]: any; 
}

export interface Ability {
  index: string; // ID 是字符串
  generation: string;
  name: string;
  name_jp: string;
  name_en: string;
  text: string; // 描述
  common_count?: number; // 普通特性持有数 (可选)
  hidden_count?: number; // 隐藏特性持有数 (可选)
  [key: string]: any; // 允许其他未知属性
}

// --- 新增：物品类型定义 ---
interface ItemEffect {
  target: string; // e.g., 'pokemon', 'wild_pokemon', 'player'
  action: string; // e.g., 'heal_hp', 'catch', 'display_map'
  value?: number | string | boolean; // Effect value (e.g., amount healed, modifier)
  catchRateModifier?: number; // Specific for Poke Balls
}

export interface Item {
  id: string;
  name: LocalizedName;
  description: string;
  type: 'medicine' | 'ball' | 'key_item' | 'battle_item' | 'general'; // Add more types as needed
  effect: ItemEffect | null;
  buyPrice: number | null; // null if not buyable
  sellPrice: number | null; // null if not sellable
  ballBonus?: number; // Added: Modifier for catch rate formula (e.g., 1.0 for PokeBall, 1.5 for GreatBall)
}

// --- 新增：地点和路线类型定义 ---
interface LocalizedName {
  zh: string;
  en?: string; // 英文名在路线中可选
}

export interface Location {
  id: string;
  type: 'location';
  name: LocalizedName;
  description: string;
  inspired_by?: string;
  environment?: string;
  architecture?: string;
  features?: string;
  exits: { [exitId: string]: string }; // key: route/special ID, value: destination location ID
  npcIds?: string[]; // Optional array of NPC IDs present in this location
  items?: string[]; // Optional array of Item IDs initially present in this location
}

export interface Route {
  id: string;
  type: 'route';
  name: LocalizedName;
  connects: [string, string]; // 连接的两个地点 ID
  length_km?: number;
  features?: string;
  difficulty?: number;
  best_season?: string;
}

// 地点或路线的联合类型
export type WorldPlace = Location | Route;


// --- 玩家状态定义 ---
// ... (InventoryItem, OwnedPokemon, PokedexStatus, Player 接口保持不变) ...
export interface InventoryItem { itemId: string; quantity: number; }
export interface OwnedPokemon { /* ... 保留之前的定义 ... */ instanceId: string; pokedexId: string; nickname?: string; level: number; experience: number; currentHp: number; maxHp: number; moves: string[]; heldItemId?: string; ability: string; stats: { attack: number; defense: number; specialAttack: number; specialDefense: number; speed: number; }; statusCondition?: string; }
export interface PokedexStatus { seen: string[]; caught: string[]; }
export interface Player { /* ... 保留之前的定义 ... */ id: string; name: string; locationId: string; currentHp: number; maxHp: number; badges: string[]; money: number; creditStatus: number; inventory: InventoryItem[]; team: OwnedPokemon[]; pokedex: PokedexStatus; questFlags: { [flagName: string]: boolean | number | string }; relationshipFlags: { [npcId: string]: number | string }; statusConditions?: string[]; }


// --- 缓存 ---
let cachedPokedexSummary: Pick<PokedexEntry, 'yudex_id' | 'name' | 'name_en' | 'name_jp' | 'world_gen'>[] | null = null; // Cache only summary
let cachedPokemonDetails: { [key: string]: PokedexEntry } = {}; // Cache for detailed data, indexed by yudex_id
let cachedMoves: Map<string, Move> | null = null;
let cachedAbilities: Ability[] | null = null;
let cachedLocations: WorldPlace[] | null = null; 
let cachedItems: Item[] | null = null; 


// --- 数据加载函数 ---

/**
 * 获取数据文件或目录的绝对路径
 * @param relativePath data目录内的相对路径
 * @returns 可访问的绝对路径
 */
export async function getDataPath(relativePath: string): Promise<string> {
  const currentWorkingDirectory = process.cwd();
  console.log(`[Debug getDataPath] process.cwd(): ${currentWorkingDirectory}`);

  const dataDirName = 'data';
  // 调整路径，使其查找当前工作目录（在Vercel上是应用根目录）的上一级目录中的 'data' 文件夹
  const projectDataRoot = path.resolve(currentWorkingDirectory, '..', dataDirName);
  const fullPath = path.join(projectDataRoot, relativePath);

  console.log(`[Debug getDataPath] Attempting to access: ${fullPath}`);
  console.log(`[Debug getDataPath] Relative path provided: ${relativePath}`);
  console.log(`[Debug getDataPath] Calculated projectDataRoot (using path.resolve with '..'): ${projectDataRoot}`);

  try {
    // Log contents of CWD
    const cwdContents = await fs.readdir(currentWorkingDirectory);
    console.log(`[Debug getDataPath] Contents of ${currentWorkingDirectory} (project root):`, cwdContents.join(', '));
  } catch (e: any) {
    console.warn(`[Debug getDataPath] Could not list contents of ${currentWorkingDirectory}: ${e.message}`);
  }

  try {
    // Log contents of projectDataRoot (e.g., yudu-mud-app/data)
    const dataRootContents = await fs.readdir(projectDataRoot);
    console.log(`[Debug getDataPath] Contents of ${projectDataRoot} ('data' directory):`, dataRootContents.join(', '));
  } catch (e: any) {
    console.warn(`[Debug getDataPath] Could not list contents of ${projectDataRoot}: ${e.message}. This directory might not exist or is not accessible.`);
  }

  try {
    await fs.access(fullPath);
    console.log(`[Debug getDataPath] Successfully accessed: ${fullPath}`);
    return fullPath;
  } catch (error) {
    console.error(`[Debug getDataPath] Data file not accessible at: ${fullPath}. Error: ${error}`);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        console.error(`[Debug getDataPath] ENOENT error: The file or directory at ${fullPath} was not found.`);
    }
    throw new Error(`Data file not found: ${relativePath} (resolved to ${fullPath})`);
  }
}

/**
 * 泛型函数：加载并解析指定路径的 JSON 文件
 * @param filePath 相对于项目根目录的 data 文件夹内的文件路径 (e.g., 'yudu_pokedex.json')
 * @returns 解析后的 JSON 数据
 */
async function loadJsonData<T>(filePath: string): Promise<T> {
  // 获取数据文件的绝对路径
  const fullPath = await getDataPath(filePath);
  console.log(`Attempting to load data from: ${fullPath}`);

  try {
    const fileContent = await fs.readFile(fullPath, 'utf-8');
    const data = JSON.parse(fileContent);
    console.log(`Successfully loaded data from: ${filePath}`);
    return data as T;
  } catch (error) {
    console.error(`Error loading or parsing JSON file at ${fullPath}:`, error);
    // 根据需要可以抛出错误或返回默认值/空值
    throw new Error(`Failed to load game data: ${filePath}`);
  }
}

// --- 数据获取接口 (带缓存) ---

// Renamed to reflect it only loads summary data now
export async function getPokedexSummary(): Promise<Pick<PokedexEntry, 'yudex_id' | 'name' | 'name_en' | 'name_jp' | 'world_gen'>[]> {
  if (cachedPokedexSummary) {
    return cachedPokedexSummary;
  }
  console.log('Loading Pokedex summary data from file...');
  // Load only the summary fields needed to find the detail file
  const summaryData = await loadJsonData<PokedexEntry[]>('yudu_pokedex.json');
  // Select only the necessary fields for the summary cache
  cachedPokedexSummary = summaryData.map(entry => ({
      yudex_id: entry.yudex_id,
      name: entry.name,
      name_en: entry.name_en,
      name_jp: entry.name_jp,
      world_gen: entry.world_gen
  }));
  return cachedPokedexSummary;
}

// New function to get detailed data for a specific Pokemon
export async function getPokemonSpeciesDetails(pokedexId: string): Promise<PokedexEntry | null> {
    // Check cache first
    if (cachedPokemonDetails[pokedexId]) {
        // console.log(`Returning cached details for ${pokedexId}`);
        return cachedPokemonDetails[pokedexId];
    }

    console.log(`Loading details for Pokemon ${pokedexId}...`);
    const summaryList = await getPokedexSummary(); // Get the summary list
    const summary = summaryList.find(entry => entry.yudex_id === pokedexId);

    if (!summary) {
        console.error(`Pokedex summary entry not found for ID: ${pokedexId}`);
        return null;
    }

    // Construct the filename based on the pattern observed (0001-妙蛙种子.json)
    const numberPart = pokedexId.replace(/^Y/, ''); // Remove leading 'Y'
    const fileName = `${numberPart}-${summary.name}.json`;
    const filePath = `pokemon/${fileName}`;

    try {
        // Load the detailed data - Assuming the detailed file contains the FULL PokedexEntry structure now
        const detailedData = await loadJsonData<PokedexEntry>(filePath);
        
        // Add potentially missing summary fields if detail file doesn't have them (optional safety)
        const completeData: PokedexEntry = {
            ...summary,      // Start with summary info
            ...detailedData, // Override with detailed info (most fields)
            yudex_id: pokedexId // Ensure the correct ID is kept
        };

        // Validate if baseStats exist after loading
        if (!completeData.stats) {
             console.warn(`Warning: Base stats missing in detail file ${filePath} for ${pokedexId}`);
             // Decide how to handle: return null, return incomplete data, or throw error?
             // For now, returning the incomplete data but logging a warning.
        }

        cachedPokemonDetails[pokedexId] = completeData; // Cache the result
        return completeData;
    } catch (error) {
        console.error(`Failed to load or parse detailed Pokemon data from ${filePath} for ID ${pokedexId}:`, error);
        return null; // Return null if the detail file fails to load
    }
}

// Updated getMoves function to first check for move_list.json, then fallback to directory
export async function getMoves(): Promise<Map<string, Move>> {
  if (cachedMoves) {
    // console.log('Returning cached Moves data.');
    return cachedMoves;
  }
  
  console.log('Loading Moves data...');
  cachedMoves = new Map<string, Move>();
  
  // 尝试先从move_list.json加载
  try {
    // 检查move_list.json是否存在
    const moveListPath = await getDataPath('move_list.json');
    try {
      await fs.access(moveListPath);
      console.log('Move list file exists, loading from move_list.json');
      
      // 从move_list.json加载所有技能
      const moveListData = await loadJsonData<any>('move_list.json');
      
      if (Array.isArray(moveListData)) {
        console.log(`Found ${moveListData.length} moves in move_list.json`);
        
        // 处理每个技能数据
        for (const moveData of moveListData) {
          // --- Data Cleaning and Type Conversion ---
          const power = parseInt(moveData.power, 10);
          const accuracy = parseInt(moveData.accuracy, 10);
          const pp = parseInt(moveData.pp, 10);
  
          const parsedMove: Move = {
            index: moveData.index,
            generation: moveData.generation,
            name: moveData.name, // Use Chinese name as key
            name_jp: moveData.name_jp,
            name_en: moveData.name_en,
            type: moveData.type,
            category: moveData.category,
            power: isNaN(power) ? null : power, // Set to null if parsing fails (e.g., "—")
            accuracy: isNaN(accuracy) ? null : accuracy, // Set to null if parsing fails (e.g., "—")
            pp: isNaN(pp) ? 0 : pp, // Default to 0 if PP parsing fails (shouldn't happen ideally)
            text: moveData.text,
            effect: moveData.effect,
            info: moveData.info,
            range: moveData.range,
            // Infer priority based on text for common cases (needs improvement)
            priority: moveData.text?.includes('必定能够先制攻击') ? 1 : (moveData.text?.includes('必定后出') ? -1 : 0),
            // Keep other fields if they exist
            ...moveData 
          };
          
          // Cleanup redundant fields after spreading if necessary (optional)
          delete parsedMove.pokemon; // Remove the large pokemon list from the cached move object
  
          if (parsedMove.name) {
               cachedMoves.set(parsedMove.name, parsedMove);
          } else {
              console.warn(`Move missing 'name' property.`);
          }
        }
        
        console.log(`Successfully loaded and cached ${cachedMoves.size} moves from move_list.json.`);
        return cachedMoves;
      } else {
        console.warn('move_list.json exists but does not contain an array, falling back to directory loading');
      }
    } catch (error) {
      console.warn('Error loading move_list.json, falling back to loading from directory:', error);
    }
  } catch (error) {
    console.warn('move_list.json not found, falling back to loading from directory');
  }
  
  // 如果move_list.json不存在或加载失败，则从move目录加载
  const moveDirPath = await getDataPath('move');
  console.log(`Reading moves from directory: ${moveDirPath}`);

  try {
    const files = await readdir(moveDirPath);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    console.log(`Found ${jsonFiles.length} potential move files.`);

    for (const fileName of jsonFiles) {
      const filePath = `move/${fileName}`; // Relative path for loadJsonData
      try {
        const moveData = await loadJsonData<any>(filePath); // Load as any first for parsing

        // --- Data Cleaning and Type Conversion ---
        const power = parseInt(moveData.power, 10);
        const accuracy = parseInt(moveData.accuracy, 10);
        const pp = parseInt(moveData.pp, 10);

        const parsedMove: Move = {
          index: moveData.index,
          generation: moveData.generation,
          name: moveData.name, // Use Chinese name as key
          name_jp: moveData.name_jp,
          name_en: moveData.name_en,
          type: moveData.type,
          category: moveData.category,
          power: isNaN(power) ? null : power, // Set to null if parsing fails (e.g., "—")
          accuracy: isNaN(accuracy) ? null : accuracy, // Set to null if parsing fails (e.g., "—")
          pp: isNaN(pp) ? 0 : pp, // Default to 0 if PP parsing fails (shouldn't happen ideally)
          text: moveData.text,
          effect: moveData.effect,
          info: moveData.info,
          range: moveData.range,
          // Infer priority based on text for common cases (needs improvement)
          priority: moveData.text?.includes('必定能够先制攻击') ? 1 : (moveData.text?.includes('必定后出') ? -1 : 0),
          // Keep other fields if they exist
          ...moveData 
        };
        
        // Cleanup redundant fields after spreading if necessary (optional)
        delete parsedMove.pokemon; // Remove the large pokemon list from the cached move object

        if (parsedMove.name) {
             cachedMoves.set(parsedMove.name, parsedMove);
        } else {
            console.warn(`Move file ${fileName} loaded but missing 'name' property.`);
        }

      } catch (fileError) {
        console.error(`Error loading or parsing individual move file ${fileName}:`, fileError);
        // Decide whether to skip the file or stop the whole process
      }
    }
    console.log(`Successfully loaded and cached ${cachedMoves.size} moves from directory.`);

  } catch (dirError) {
    console.error(`Error reading move directory ${moveDirPath}:`, dirError);
    cachedMoves = null; // Reset cache on error
    throw new Error('Failed to read move directory.');
  }

  return cachedMoves;
}

export async function getAbilities(): Promise<Ability[]> {
  if (cachedAbilities) {
    // console.log('Returning cached Abilities data.');
    return cachedAbilities;
  }
  console.log('Loading Abilities data from file...');
  // 确认 ability_list.json 的根是一个数组
  cachedAbilities = await loadJsonData<Ability[]>('ability_list.json');
  return cachedAbilities;
}

// 新增：获取地点/路线数据
export async function getLocations(): Promise<WorldPlace[]> {
  if (cachedLocations) {
    // console.log('Returning cached Locations data.');
    return cachedLocations;
  }
  console.log('Loading Locations data from file...');
  // 确认 locations.json 的根是一个数组
  cachedLocations = await loadJsonData<WorldPlace[]>('locations.json');
  return cachedLocations;
}

// 新增：获取物品数据
export async function getItems(): Promise<Item[]> {
  if (cachedItems) {
    // console.log('Returning cached Items data.');
    return cachedItems;
  }
  console.log('Loading Items data from file...');
  // 确认 items.json 的根是一个数组
  cachedItems = await loadJsonData<Item[]>('items.json');
  return cachedItems;
}


// --- (可选) 预加载函数 ---
// 可以在服务器启动时调用此函数来预热缓存
export async function preloadGameData() {
  try {
    console.log('Preloading game data...');
    await Promise.all([
      getPokedexSummary(), // Preload only summary now
      getMoves(),
      getAbilities(),
      getLocations(), 
      getItems() 
    ]);
    console.log('Game data preloaded successfully.');
  } catch (error) {
    console.error('Failed to preload game data:', error);
    // 根据需要处理预加载失败的情况
  }
}


