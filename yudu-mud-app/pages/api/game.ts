import type { NextApiRequest, NextApiResponse } from 'next';
import worldManager from '@/game/worldManager';
import { Player } from '@/interfaces/database'; // 导入 Player 接口
import { Location, getPokedexSummary, getItems, Item, PokedexEntry } from '@/lib/gameData';
import { PokemonInstance } from '@/interfaces/pokemon'; // Import PokemonInstance
import OpenAI from 'openai'; // Import OpenAI library
import { initiateTrainingSession } from '@/game/trainingManager'; // Import the new function
import { getPotentialWildPokemon, loadEncounterData, shouldEncounterWildPokemon, generateWildPokemon } from '@/game/encounterManager'; // 导入遭遇系统功能
import { startBattle, processTurn } from '@/game/battleManager'; // 导入战斗系统功能
import { BattleAction, BattleState } from '@/interfaces/battle'; // 导入战斗接口
import { addExperience } from '@/game/pokemonManager'; // 导入经验值处理函数

interface GameRequest {
  command: string;
  // 实际应用中，玩家状态应从会话或数据库获取，这里暂时从请求传递
  playerState: Partial<Player> & { locationId: string; team?: PokemonInstance[] }; // Ensure team is optional in input
}

interface GameResponse {
  output: string; // 发送给玩家看的消息
  updatedPlayerState: Partial<Player>; // 更新后的玩家状态片段
  error?: string; // 如果处理出错
}

// 简单的方向命令映射 (可以根据需要扩展)
const directionMap: { [key: string]: string } = {
  north: 'north', n: 'north',
  south: 'south', s: 'south',
  east: 'east', e: 'east',
  west: 'west', w: 'west',
  up: 'up', u: 'up',
  down: 'down', d: 'down',
  // 'enter' 和 'exit' 可能需要特殊处理，取决于 locations.json 中 exits 的键
};

// Move Type Mapping (English/Chinese to Chinese Filename - add more as needed)
const moveTypeToFileMap: { [key: string]: string } = {
    '一般': '一般', 'normal': '一般',
    '火': '火', 'fire': '火',
    '水': '水', 'water': '水',
    '电': '电', 'electric': '电',
    '草': '草', 'grass': '草',
    '冰': '冰', 'ice': '冰',
    '格斗': '格斗', 'fighting': '格斗',
    '毒': '毒', 'poison': '毒',
    '地面': '地面', 'ground': '地面',
    '飞行': '飞行', 'flying': '飞行',
    '超能力': '超能力', 'psychic': '超能力',
    '虫': '虫', 'bug': '虫',
    '岩石': '岩石', 'rock': '岩石',
    '幽灵': '幽灵', 'ghost': '幽灵',
    '龙': '龙', 'dragon': '龙',
    '恶': '恶', 'dark': '恶',
    '钢': '钢', 'steel': '钢',
    '妖精': '妖精', 'fairy': '妖精',
};

// Initialize Grok API Client (only once if possible, but in serverless might re-init)
let grokClient: OpenAI | null = null;
if (process.env.GROK_API_KEY) {
    grokClient = new OpenAI({
        baseURL: "https://api.x.ai/v1",
        apiKey: process.env.GROK_API_KEY,
    });
} else {
    console.warn('GROK_API_KEY environment variable not set. AI features will be disabled.');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GameResponse>
) {
  // Initialize updatedPlayerState outside the try block to fix scope issue
  // Ensure playerState.team exists and is an array
  // Provide defaults for all required fields in Player interface
  let updatedPlayerState: Player = {
    id: req.body.playerState?.id || 'temp_player', 
    name: req.body.playerState?.name || 'Trainer',
    locationId: req.body.playerState?.locationId || 'beginville_square',
    team: Array.isArray(req.body.playerState?.team) ? [...req.body.playerState.team] : [],
    pcBox: Array.isArray(req.body.playerState?.pcBox) ? [...req.body.playerState.pcBox] : [],
    inventory: Array.isArray(req.body.playerState?.inventory) ? [...req.body.playerState.inventory] : [],
    pokedex: req.body.playerState?.pokedex || { seen: [], caught: [] },
    badges: Array.isArray(req.body.playerState?.badges) ? [...req.body.playerState.badges] : [],
    money: req.body.playerState?.money ?? 0, // Use nullish coalescing for numbers
    creditStatus: req.body.playerState?.creditStatus ?? 0, // Use nullish coalescing
    questFlags: req.body.playerState?.questFlags || {},
    relationshipFlags: req.body.playerState?.relationshipFlags || {},
    // --- Fix Linter Error: Provide defaults for required number fields --- 
    currentHp: req.body.playerState?.currentHp ?? 0, // Default to 0 if missing
    maxHp: req.body.playerState?.maxHp ?? 0,       // Default to 0 if missing
    // Spread remaining optional fields from playerState
    ...(req.body.playerState as Partial<Player>),
  };
  let output = 'Unknown command'; // Default output

  if (req.method !== 'POST') {
    // Fix Linter Error: Provide full GameResponse structure
    output = 'Method Not Allowed';
    return res.status(405).json({ output, updatedPlayerState, error: 'Method Not Allowed' });
  }

  try {
    // 1. 确保 WorldManager 已初始化
    if (!(worldManager as any).isInitialized) {
        console.log('Initializing WorldManager for API request...');
        await worldManager.initialize();
        await loadEncounterData(); // 加载遭遇数据
    }
    worldManager.ensureInitialized(); // 确保初始化成功

    // 2. 解析请求体
    const { command, playerState: requestPlayerState }: GameRequest = req.body;

    if (!command || !requestPlayerState || !requestPlayerState.locationId) {
      // Fix Linter Error: Provide full GameResponse structure
      output = 'Invalid request body. Missing command or playerState.locationId.';
      // Use the initialized updatedPlayerState for the response
      return res.status(400).json({ output, updatedPlayerState, error: output });
    }

    // Update the initial state based on request AFTER validation
    updatedPlayerState = { ...updatedPlayerState, ...requestPlayerState, team: [...(requestPlayerState.team || [])] };
    output = `Unknown command: ${command}`; // Reset output after validation

    const commandClean = command.trim().toLowerCase();
    const parts = commandClean.split(' ');
    const verb = parts[0];
    const argument = parts[1]; // Get the second part too

    // --- 加载所有物品数据以便后续使用 ---
    const allItems = await getItems(); // Pre-load items for look, get, drop

    // --- Determine target direction ---
    let targetDirection: string | undefined = undefined;

    // Case 1: The verb itself is a direction (e.g., "north", "n")
    if (directionMap[verb]) {
        targetDirection = directionMap[verb];
    } 
    // Case 2: The verb is "go" and the argument is a direction (e.g., "go east")
    else if (verb === 'go' && argument && directionMap[argument]) {
        targetDirection = directionMap[argument];
    }
    // Case 3: Check common synonyms for 'enter' and 'out' if not a standard direction
    else if (verb === 'enter' || verb === 'in') {
        targetDirection = 'enter'; // Assuming 'enter' is used as a key in exits
    } else if (verb === 'exit' || verb === 'out' || verb === 'leave') {
        targetDirection = 'out'; // Assuming 'out' is used as a key in exits
    }

    // --- Process Movement if targetDirection is determined ---
    if (targetDirection) {
        const currentLocation = worldManager.getLocationById(updatedPlayerState.locationId);

        if (!currentLocation) {
            output = `Error: Cannot find current location with ID: ${updatedPlayerState.locationId}`;
            return res.status(500).json({ output, updatedPlayerState, error: output });
        }

        // Check if the exit exists for the target direction
        const targetLocationId = currentLocation.exits[targetDirection];

        if (targetLocationId) {
            const nextLocation = worldManager.getLocationById(targetLocationId);
            if (nextLocation) {
                updatedPlayerState.locationId = targetLocationId; // Update player location
                
                // 基本移动信息
                output = `You move ${targetDirection}.\n\n`;
                output += `**${nextLocation.name.zh} (${nextLocation.name.en || ''})**\n`;
                output += `${nextLocation.description}\n`;
                
                // 检查是否触发宝可梦遭遇
                if (shouldEncounterWildPokemon(targetLocationId) && updatedPlayerState.team && updatedPlayerState.team.length > 0) {
                    // 有队伍且触发遭遇，生成野生宝可梦
                    const wildPokemon = await generateWildPokemon(targetLocationId);
                    
                    if (wildPokemon) {
                        // 找到玩家队伍中第一个可战斗的宝可梦（HP大于0）
                        const playerActivePokemon = updatedPlayerState.team.find(p => p.currentHp > 0);
                        
                        if (playerActivePokemon) {
                            // 创建战斗状态
                            const battleState = await startBattle(
                                updatedPlayerState.id,
                                updatedPlayerState.name,
                                updatedPlayerState.team,
                                wildPokemon
                            );
                            
                            // 添加遭遇信息
                            output += `\n**遭遇野生宝可梦！**\n`;
                            output += `一只野生的${wildPokemon.speciesName} (Lv.${wildPokemon.level})出现了！\n`;
                            output += `你派出了${playerActivePokemon.nickname || playerActivePokemon.speciesName}！\n`;
                            output += "请选择: fight (战斗), run (逃跑), item (使用物品), switch (更换宝可梦)\n";
                            
                            // 保存战斗状态
                            updatedPlayerState.currentBattle = battleState;
                        }
                    }
                }
                
                // 显示出口
                const availableExits = Object.keys(nextLocation.exits).join(', ');
                output += `\nExits: ${availableExits || 'None'}`;
            } else {
                output = `Error: Destination location with ID ${targetLocationId} not found! Data inconsistency?`;
                // Stay in the current location
            }
        } else {
            // Target direction determined, but no exit in that direction
            output = `You cannot go ${targetDirection} from here.`;
        }
    } 
    // --- Handle other commands (if targetDirection was not determined) ---
    else {
        // --- Look/Examine Command (Combined) ---
        if (verb === 'look' || verb === 'l' || verb === 'examine' || verb === 'ex') {
            const currentLocation = worldManager.getLocationById(updatedPlayerState.locationId);
            if (!currentLocation) {
                output = `Error: Cannot find current location with ID: ${updatedPlayerState.locationId}`;
            } else {
                const target = argument;
                
                if (!target || target === currentLocation.id || target === currentLocation.name.zh.toLowerCase() || target === (currentLocation.name.en || '').toLowerCase()) {
                    // 没有目标或目标是当前地点本身
                    output = `**${currentLocation.name.zh} (${currentLocation.name.en || ''})**\n`;
                    output += `${currentLocation.description}\n`;
                    
                    // --- 新增：显示地点物品 ---
                    if (currentLocation.items && currentLocation.items.length > 0) {
                        output += "地上可以看到：";
                        const itemNames = currentLocation.items.map(itemId => {
                            const itemData = allItems.find(i => i.id === itemId);
                            return itemData ? `${itemData.name.zh}(${itemData.name.en || itemData.id})` : itemId; // 显示中文名(英文名) 或 ID
                        });
                        output += itemNames.join(', ') + '\n';
                    }
                    
                    // --- 新增：查看附近的宝可梦 ---
                    const potentialPokemon = getPotentialWildPokemon(currentLocation.id);
                    if (potentialPokemon.length > 0) {
                        // 获取宝可梦名称信息
                        const pokedexSummary = await getPokedexSummary();
                        
                        output += "\n你注意到这个区域可能会遇到：\n";
                        const pokemonNames = potentialPokemon.map(pokemon => {
                            const details = pokedexSummary.find(entry => entry.yudex_id === pokemon.pokedexId);
                            return details ? `${details.name}(Lv.${pokemon.levelRange[0]}-${pokemon.levelRange[1]})` : `未知宝可梦#${pokemon.pokedexId}`;
                        });
                        output += pokemonNames.join('、') + '\n';
                    }

                    const availableExits = Object.keys(currentLocation.exits).join(', ');
                    output += `\nExits: ${availableExits || 'None'}`;
                } else if (target === 'pokemon' || target === 'wild' || target === '宝可梦') {
                    // 专门查看野生宝可梦
                    const potentialPokemon = getPotentialWildPokemon(currentLocation.id);
                    if (potentialPokemon.length > 0) {
                        const pokedexSummary = await getPokedexSummary();
                        
                        output = `**${currentLocation.name.zh}的野生宝可梦**\n`;
                        output += "这个区域可能会遇到：\n";
                        
                        const pokemonNames = potentialPokemon.map(pokemon => {
                            const details = pokedexSummary.find(entry => entry.yudex_id === pokemon.pokedexId);
                            return details ? `${details.name}(Lv.${pokemon.levelRange[0]}-${pokemon.levelRange[1]})` : `未知宝可梦#${pokemon.pokedexId}`;
                        });
                        output += pokemonNames.join('、');
                    } else {
                        output = "这个区域似乎没有野生宝可梦出没。";
                    }
                } else if (directionMap[target]) {
                    // 目标是方向
                    const direction = directionMap[target];
                    const exitId = currentLocation.exits[direction];
                    if (exitId) {
                        const exitLocation = worldManager.getLocationById(exitId);
                        output = `向 ${direction} (${target}) 看去，那边是 ${exitLocation ? `${exitLocation.name.zh} (${exitLocation.name.en || ''})` : '未知区域'}。`;
                    } else {
                        output = `那个方向 (${target}) 没有出口。`;
                    }
                } else {
                    // 目标是其他东西 (未来可以扩展检查物品、NPC等)
                     output = `你仔细看了看 ${target}，但没有发现什么特别之处。`; 
                }
            }
        } 
        // --- Pokemon/Team Command ---
        else if (verb === 'pokemon' || verb === 'team') {
            // Ensure playerState has a team (even if empty)
            const team = updatedPlayerState.team; // Use the ensured array
            
            if (team.length === 0) {
                output = "你的队伍里目前没有宝可梦。";
            } else {
                output = "当前队伍:\n";
                output += "--------------------\n";
                
                // Load Pokedex Summary data
                const pokedexSummaryArray = await getPokedexSummary(); 
                
                team.forEach((pokemon, index) => {
                    // Find the species summary data
                    // Add explicit type for entry
                    const speciesSummary = pokedexSummaryArray.find((entry: Pick<PokedexEntry, 'yudex_id' | 'name'>) => entry.yudex_id === pokemon.pokedexId);
                    
                    // Use species name (or nickname) if found, otherwise fallback
                    const name = pokemon.nickname || (speciesSummary ? speciesSummary.name : `宝可梦 #${pokemon.pokedexId}`); 
                    const status = pokemon.statusCondition === null || !pokemon.statusCondition ? '' : ` [${pokemon.statusCondition.toUpperCase()}]`;
                    
                    output += `${index + 1}. ${name} (Lv. ${pokemon.level}) HP: ${pokemon.currentHp}/${pokemon.maxHp}${status}\n`;
                    // TODO: Maybe add moves later?
                });
                 output += "--------------------";
            }
        }
        // --- Train Command (Refactored) ---
        else if (verb === 'train') {
            const targetPokemonIdentifier = argument; 
            let targetType: string | undefined = undefined;
            let usingItem: string | undefined = undefined;
            let focusDescription: string | undefined = undefined;

            // Parsing logic (remains the same)
            const parts = commandClean.split(' ');
            let focusParts: string[] = [];
            let currentKeyword: string | null = null;
            for (let i = 2; i < parts.length; i++) { 
                const part = parts[i];
                if (part === 'type') { currentKeyword = 'type'; continue; }
                else if (part === 'using') { currentKeyword = 'using'; continue; }
                else if (part === 'focus') { currentKeyword = 'focus'; continue; }
                if (currentKeyword === 'type') { targetType = part.toLowerCase(); currentKeyword = null; }
                else if (currentKeyword === 'using') { usingItem = part; currentKeyword = null; }
                else if (currentKeyword === 'focus') { focusParts.push(part); }
            }
            focusDescription = focusParts.join(' ').replace(/^["']|["']$/g, '');

            // Validation (remains the same)
            if (!targetPokemonIdentifier) {
                output = "请指定要训练的宝可梦 (格式: train <宝可梦序号/名称> type <属性> focus \"...\")";
            } else if (!targetType) {
                 output = "请指定目标招式属性 (格式: train ... type <属性> focus \"...\")";
            } else if (!focusDescription) {
                 output = "请提供训练重点 (格式: train ... type <属性> focus \"...\")";
            } else {
                // Find Pokemon Index
                const pokedexSummaryArray = await getPokedexSummary(); 
                let targetPokemonIndex = updatedPlayerState.team.findIndex((p, index) => {
                    // Add explicit type for entry
                    const speciesSummary = pokedexSummaryArray.find((entry: Pick<PokedexEntry, 'yudex_id' | 'name'>) => entry.yudex_id === p.pokedexId);
                    const speciesName = speciesSummary?.name.toLowerCase();
                    return (index + 1).toString() === targetPokemonIdentifier || 
                           p.nickname?.toLowerCase() === targetPokemonIdentifier.toLowerCase() || 
                           speciesName === targetPokemonIdentifier.toLowerCase();
                });

                if (targetPokemonIndex === -1) {
                   output = `在你的队伍中找不到 '${targetPokemonIdentifier}'。`;
                } else {
                    // Call the training manager function
                    output = await initiateTrainingSession(
                        updatedPlayerState, // Pass the full player state
                        targetPokemonIndex, 
                        targetType, 
                        focusDescription, 
                        usingItem, 
                        grokClient // Pass the initialized client
                    );
                    // TODO: If initiateTrainingSession modifies state or returns updated pokemon,
                    // apply those changes to updatedPlayerState here.
                    // For now, it only returns the output string.
                }
            }
        }
        // --- Get/Take Command ---
        else if (verb === 'get' || verb === 'take') {
            const targetItemName = argument;
             if (!targetItemName) {
                 output = "你要捡起什么？ (格式: get <物品名称>)";
             } else {
                const currentLocation = worldManager.getLocationById(updatedPlayerState.locationId);
                if (!currentLocation || !currentLocation.items || currentLocation.items.length === 0) {
                    output = "这里地上什么也没有。";
                } else {
                    // 尝试查找物品
                    // 简单匹配: 先按 ID 找，再按中文名找，再按英文名找 (忽略大小写)
                    let foundItemIndex = -1;
                    let foundItemData: Item | undefined = undefined;

                    foundItemIndex = currentLocation.items.findIndex(itemId => {
                         const itemData = allItems.find(i => i.id === itemId);
                         if (!itemData) return false;
                         if (itemData.id.toLowerCase() === targetItemName || 
                             itemData.name.zh.toLowerCase() === targetItemName || 
                             (itemData.name.en && itemData.name.en.toLowerCase() === targetItemName)) {
                             foundItemData = itemData;
                             return true;
                         }
                         return false;
                     });

                    if (foundItemIndex !== -1 && foundItemData) {
                        // 找到了物品
                        const itemIdToGet = currentLocation.items[foundItemIndex];
                        
                        // **重要:** 在无状态 API 中直接修改 currentLocation.items 是无效的
                        // 下次请求时它会重新加载。我们需要一种方法来持久化地点的状态
                        // 或者暂时只在玩家背包中反映变化。
                        // 暂时我们只模拟从地点移除的逻辑，并更新玩家背包。
                        // currentLocation.items.splice(foundItemIndex, 1); // 模拟从地点移除

                        // 添加到玩家背包
                        const existingInventoryItemIndex = updatedPlayerState.inventory.findIndex(invItem => invItem.itemId === itemIdToGet);
                        if (existingInventoryItemIndex !== -1) {
                            updatedPlayerState.inventory[existingInventoryItemIndex].quantity += 1;
                        } else {
                            updatedPlayerState.inventory.push({ itemId: itemIdToGet, quantity: 1 });
                        }
                        
                        // 使用类型断言告诉 TS 我们确定这里的类型
                        output = `你捡起了 ${(foundItemData as Item).name.zh}(${(foundItemData as Item).name.en || (foundItemData as Item).id})。`;
                    } else {
                        output = `地上没有找到 '${targetItemName}'。`;
                    }
                }
            }
        }
        // --- Drop Command ---
        else if (verb === 'drop') {
            const targetItemName = argument;
             if (!targetItemName) {
                 output = "你要丢弃什么？ (格式: drop <物品名称>)";
             } else {
                 // 查找玩家背包中的物品
                 let foundInventoryItemIndex = -1;
                 let foundInventoryItemData: Item | undefined = undefined;
                 
                 foundInventoryItemIndex = updatedPlayerState.inventory.findIndex(invItem => {
                     const itemData = allItems.find(i => i.id === invItem.itemId);
                     if (!itemData) return false;
                      if (itemData.id.toLowerCase() === targetItemName || 
                          itemData.name.zh.toLowerCase() === targetItemName || 
                          (itemData.name.en && itemData.name.en.toLowerCase() === targetItemName)) {
                          foundInventoryItemData = itemData;
                          return true;
                      }
                      return false;
                 });

                 if (foundInventoryItemIndex !== -1 && foundInventoryItemData) {
                    // 找到了物品
                    const itemToDrop = updatedPlayerState.inventory[foundInventoryItemIndex];
                    
                    // 从玩家背包移除
                    if (itemToDrop.quantity > 1) {
                        itemToDrop.quantity -= 1;
                    } else {
                        updatedPlayerState.inventory.splice(foundInventoryItemIndex, 1);
                    }

                    // **重要:** 将物品添加到地点同样面临无状态问题
                    // 暂时模拟逻辑
                    // const currentLocation = worldManager.getLocationById(updatedPlayerState.locationId);
                    // if (currentLocation) {
                    //     if (!currentLocation.items) { currentLocation.items = []; }
                    //     currentLocation.items.push(itemToDrop.itemId);
                    // }

                    // 使用类型断言
                    output = `你丢下了 ${(foundInventoryItemData as Item).name.zh}(${(foundInventoryItemData as Item).name.en || (foundInventoryItemData as Item).id})。`;
                 } else {
                     output = `你的背包里没有 '${targetItemName}'。`;
                 }
             }
        }
        // --- Inventory Command ---
        else if (verb === 'inventory' || verb === 'inv' || verb === 'i') {
            if (updatedPlayerState.inventory.length === 0) {
                output = "你的背包是空的。";
            } else {
                output = "背包物品:\n";
                 output += "--------------------\n";
                 updatedPlayerState.inventory.forEach(invItem => {
                     const itemData = allItems.find(i => i.id === invItem.itemId);
                     const name = itemData ? `${itemData.name.zh}(${itemData.name.en || itemData.id})` : invItem.itemId;
                     output += `- ${name} x${invItem.quantity}\n`;
                 });
                 output += "--------------------";
            }
        }
        // --- Battle Command ---
        else if (verb === 'battle' || verb === 'fight' || verb === 'run' || verb === 'item' || verb === 'switch') {
            // 检查玩家是否在战斗中
            if (!updatedPlayerState.currentBattle) {
                output = "你当前不在战斗中。";
            } else {
                // 获取当前战斗状态
                const battleState = updatedPlayerState.currentBattle;
                
                // 只有当战斗状态为等待输入时才处理命令
                if (battleState.status === 'WAITING_FOR_INPUT') {
                    // 获取战斗参与者信息
                    const playerParticipant = battleState.participants[0];
                    const opponentParticipant = battleState.participants[1];
                    
                    // 准备玩家行动
                    let playerAction: BattleAction | null = null;
                    
                    // 处理不同的命令
                    if (verb === 'fight') {
                        // 获取当前可用的招式
                        const availableMoves = playerParticipant.activePokemon.moves;
                        
                        // 检查是否提供了招式参数
                        if (!argument) {
                            // 如果没有提供招式，显示可用招式列表
                            output = "请选择要使用的招式:\n";
                            availableMoves.forEach((move, index) => {
                                output += `${index + 1}. ${move.name} (PP: ${move.pp}/${move.pp})\n`;
                            });
                            return res.status(200).json({ output, updatedPlayerState });
                        } else {
                            // 尝试找到对应的招式
                            let moveIndex = -1;
                            
                            // 首先尝试将参数解析为数字索引
                            const moveNumber = parseInt(argument);
                            if (!isNaN(moveNumber) && moveNumber > 0 && moveNumber <= availableMoves.length) {
                                moveIndex = moveNumber - 1;
                            } else {
                                // 然后尝试通过名称匹配
                                moveIndex = availableMoves.findIndex(move => 
                                    move.name.toLowerCase() === argument.toLowerCase()
                                );
                            }
                            
                            // 检查是否找到了招式
                            if (moveIndex === -1) {
                                output = `找不到招式 "${argument}"。请使用有效的招式名称或序号。`;
                                return res.status(200).json({ output, updatedPlayerState });
                            }
                            
                            // 检查PP是否足够
                            if (availableMoves[moveIndex].pp <= 0) {
                                output = `${availableMoves[moveIndex].name}的PP不足！请选择其他招式。`;
                                return res.status(200).json({ output, updatedPlayerState });
                            }
                            
                            // 创建战斗行动
                            playerAction = {
                                type: 'FIGHT',
                                moveId: availableMoves[moveIndex].name
                            };
                        }
                    } else if (verb === 'run') {
                        // 创建逃跑行动
                        playerAction = {
                            type: 'RUN'
                        };
                    } else if (verb === 'switch') {
                        // 获取队伍中的宝可梦
                        const teamPokemon = playerParticipant.party;
                        
                        // 检查是否提供了宝可梦参数
                        if (!argument) {
                            // 如果没有提供宝可梦，显示队伍列表
                            output = "请选择要切换的宝可梦:\n";
                            teamPokemon.forEach((pokemon, index) => {
                                if (pokemon.instanceId !== playerParticipant.activePokemon.instanceId) {
                                    const status = pokemon.currentHp <= 0 ? "（已失去战斗能力）" : 
                                        `HP: ${pokemon.currentHp}/${pokemon.maxHp}`;
                                    output += `${index + 1}. ${pokemon.nickname || pokemon.speciesName} Lv.${pokemon.level} ${status}\n`;
                                }
                            });
                            return res.status(200).json({ output, updatedPlayerState });
                        } else {
                            // 尝试找到对应的宝可梦
                            let pokemonIndex = -1;
                            
                            // 首先尝试将参数解析为数字索引
                            const pokemonNumber = parseInt(argument);
                            if (!isNaN(pokemonNumber) && pokemonNumber > 0 && pokemonNumber <= teamPokemon.length) {
                                pokemonIndex = pokemonNumber - 1;
                            } else {
                                // 然后尝试通过名称匹配
                                pokemonIndex = teamPokemon.findIndex(pokemon => 
                                    (pokemon.nickname && pokemon.nickname.toLowerCase() === argument.toLowerCase()) ||
                                    pokemon.speciesName.toLowerCase() === argument.toLowerCase()
                                );
                            }
                            
                            // 检查是否找到了宝可梦
                            if (pokemonIndex === -1) {
                                output = `找不到宝可梦 "${argument}"。请使用有效的宝可梦名称或序号。`;
                                return res.status(200).json({ output, updatedPlayerState });
                            }
                            
                            // 检查是否是当前出战的宝可梦
                            if (teamPokemon[pokemonIndex].instanceId === playerParticipant.activePokemon.instanceId) {
                                output = `${teamPokemon[pokemonIndex].nickname || teamPokemon[pokemonIndex].speciesName} 已经在战斗中！`;
                                return res.status(200).json({ output, updatedPlayerState });
                            }
                            
                            // 检查宝可梦是否已经失去战斗能力
                            if (teamPokemon[pokemonIndex].currentHp <= 0) {
                                output = `${teamPokemon[pokemonIndex].nickname || teamPokemon[pokemonIndex].speciesName} 已经失去战斗能力，无法参战！`;
                                return res.status(200).json({ output, updatedPlayerState });
                            }
                            
                            // 创建切换行动
                            playerAction = {
                                type: 'SWITCH',
                                switchToPokemonIndex: pokemonIndex
                            };
                        }
                    } else if (verb === 'item') {
                        // TODO: 实现物品使用逻辑
                        output = "使用物品功能正在开发中。请尝试其他命令。";
                        return res.status(200).json({ output, updatedPlayerState });
                    }
                    
                    // 如果成功创建了玩家行动
                    if (playerAction) {
                        try {
                            // 简化的对手行动（总是选择第一个技能攻击）
                            const opponentAction: BattleAction = {
                                type: 'FIGHT',
                                moveId: opponentParticipant.activePokemon.moves[0]?.name || ''
                            };
                            
                            // 处理回合
                            const updatedBattleState = await processTurn(battleState, playerAction, opponentAction);
                            
                            // 更新玩家状态中的战斗状态
                            updatedPlayerState.currentBattle = updatedBattleState;
                            
                            // 处理战斗结束逻辑
                            if (updatedBattleState.status === 'PLAYER_WIN') {
                                output = "战斗胜利！\n\n";
                                output += updatedBattleState.log.slice(-5).join("\n");
                                
                                // 计算并添加经验值
                                const defeatedPokemon = opponentParticipant.activePokemon;
                                const expMessages: string[] = [];
                                
                                // 简化的经验值计算方式：对手等级 * 5
                                const expGained = defeatedPokemon.level * 5;
                                
                                // 给参与战斗的宝可梦添加经验
                                const activePokemon = playerParticipant.activePokemon;
                                
                                // 添加经验并获取消息（如升级）
                                const result = addExperience(activePokemon, activePokemon.speciesDetails, expGained);
                                expMessages.push(...result.messages);
                                
                                // 添加经验值消息到输出
                                output += "\n\n" + expMessages.join("\n");
                                
                                // 更新玩家队伍中的宝可梦
                                const pokemonIndex = updatedPlayerState.team.findIndex(p => p.instanceId === activePokemon.instanceId);
                                if (pokemonIndex !== -1) {
                                    updatedPlayerState.team[pokemonIndex] = activePokemon;
                                }
                                
                                // 清除战斗状态
                                updatedPlayerState.currentBattle = undefined;
                            } else if (updatedBattleState.status === 'OPPONENT_WIN') {
                                output = "战斗失败！\n\n";
                                output += updatedBattleState.log.slice(-5).join("\n");
                                
                                // 清除战斗状态
                                updatedPlayerState.currentBattle = undefined;
                            } else if (updatedBattleState.status === 'FLED') {
                                output = "成功逃跑！\n\n";
                                output += updatedBattleState.log.slice(-3).join("\n");
                                
                                // 清除战斗状态
                                updatedPlayerState.currentBattle = undefined;
                            } else {
                                // 战斗继续，显示最近的几条战斗日志
                                output = updatedBattleState.log.slice(-5).join("\n");
                                
                                // 添加当前回合状态和可用选项
                                output += "\n\n你可以：";
                                output += "\n- fight [招式名/序号] - 使用招式攻击";
                                output += "\n- run - 尝试逃跑";
                                output += "\n- switch [宝可梦名/序号] - 切换宝可梦";
                                output += "\n- item [物品名] - 使用物品（开发中）";
                            }
                        } catch (error: any) {
                            console.error("Battle processing error:", error);
                            output = `战斗处理出错: ${error.message}`;
                        }
                    } else {
                        output = "无效的战斗命令。请使用 fight、run、switch 或 item。";
                    }
                } else {
                    // 处理非WAITING_FOR_INPUT状态
                    if (battleState.status === 'PROCESSING') {
                        output = "战斗回合正在处理中，请稍候...";
                    } else {
                        output = `战斗状态错误: ${battleState.status}`;
                    }
                }
            }
        }
        // --- Default for other unknown commands ---
        else { 
            // Keep the default "Unknown command" message initialized earlier
            // 如果verb不是已知命令且不是移动方向，则重置为 Unknown command
            if (!targetDirection && ['look', 'l', 'examine', 'ex', 'pokemon', 'team', 'train', 'get', 'take', 'drop', 'inventory', 'inv', 'i', 'battle', 'fight', 'run', 'item', 'switch'].indexOf(verb) === -1) {
                output = `Unknown command: ${commandClean}`;
            }
        } 
    }

    // 4. 返回响应
    res.status(200).json({ output, updatedPlayerState });

  } catch (error: any) {
    console.error('API Error processing game command:', error);
    // Fix Linter Error: updatedPlayerState is now defined outside try
    res.status(500).json({ 
        output: 'An internal error occurred.', 
        updatedPlayerState: updatedPlayerState, // Use the state defined outside try
        error: error.message 
    });
  }
} 