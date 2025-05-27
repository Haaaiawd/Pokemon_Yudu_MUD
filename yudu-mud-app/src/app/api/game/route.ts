import { NextResponse, NextRequest } from 'next/server';
import worldManager from '@/game/worldManager';
import { Player } from '@/interfaces/database';
// Import Item and PokedexEntry from gameData specifically for richer types if they differ
import { Location, getPokedexSummary, getItems, Item as GameDataItem, PokedexEntry as GameDataPokedexEntry, Move as GameDataMove, getMoves } from '@/lib/gameData';
import { PokemonInstance, Move as PokemonInterfaceMove } from '@/interfaces/pokemon';
import OpenAI from 'openai';
import { initiateTrainingSession } from '@/game/trainingManager';
import { getPotentialWildPokemon, loadEncounterData, shouldEncounterWildPokemon, generateWildPokemon } from '@/game/encounterManager';
import { startBattle, processTurn } from '@/game/battleManager';
import { BattleAction, BattleState } from '@/interfaces/battle';
import { addExperience } from '@/game/pokemonManager';
import { getLocationMapOverview } from '@/lib/mapUtils';  // 新增导入

interface GameRequestPayload {
  command: string;
  playerState: Partial<Player> & { locationId: string; team?: PokemonInstance[]; currentBattle?: BattleState }; // Added currentBattle
}

interface GameResponseData {
  output: string;
  updatedPlayerState: Player;
  error?: string;
}

const directionMap: { [key: string]: string } = {
  north: 'north', n: 'north',
  south: 'south', s: 'south',
  east: 'east', e: 'east',
  west: 'west', w: 'west',
  up: 'up', u: 'up',
  down: 'down', d: 'down',
};

let grokClient: OpenAI | null = null;
if (process.env.GROK_API_KEY) {
    grokClient = new OpenAI({
        baseURL: "https://api.x.ai/v1",
        apiKey: process.env.GROK_API_KEY,
    });
} else {
    console.warn('GROK_API_KEY environment variable not set. AI features will be disabled.');
}

// Helper function to resolve Pokemon moves to full GameDataMove objects
async function resolvePokemonMovesArray(
    movesArray: (string | PokemonInterfaceMove)[],
    allMovesMap: Map<string, GameDataMove>
): Promise<GameDataMove[]> {
    const resolvedMoves: GameDataMove[] = [];
    if (!movesArray) return resolvedMoves;

    for (const moveOrId of movesArray) {
        let moveDetail: GameDataMove | undefined = undefined;
        if (typeof moveOrId === 'string') { // It's an ID
            moveDetail = allMovesMap.get(moveOrId);
        } else if (typeof moveOrId === 'object' && moveOrId !== null && moveOrId.name) { // It's a PokemonInterfaceMove object
            // Attempt to get the full GameDataMove using the name as a key
            moveDetail = allMovesMap.get(moveOrId.name);
        }

        if (moveDetail) {
            resolvedMoves.push(moveDetail);
        } else {
            const identifier = typeof moveOrId === 'string' ? moveOrId : (moveOrId as PokemonInterfaceMove)?.name;
            console.warn(`resolvePokemonMovesArray: Could not find GameDataMove for identifier: ${identifier}`);
        }
    }
    return resolvedMoves;
}


async function handler(req: NextRequest): Promise<NextResponse<GameResponseData>> {
  let output = 'Unknown command';
  let playerState: Player = {
    id: 'temp_player',
    name: 'Trainer',
    locationId: 'beginville_square',
    team: [],
    pcBox: [],
    inventory: [],
    pokedex: { seen: [], caught: [] },
    badges: [],
    money: 0,
    creditStatus: 0,
    questFlags: {},
    relationshipFlags: {},
    currentHp: 0,
    maxHp: 0,
    // currentBattle: undefined, // Ensure currentBattle is part of the Player type if used directly
  };

  if (req.method !== 'POST') {
    output = 'Method Not Allowed';
    return NextResponse.json({ output, updatedPlayerState: playerState, error: 'Method Not Allowed' }, { status: 405 });
  }

  try {
    if (!(worldManager as any).isInitialized) {
        console.log('Initializing WorldManager for API request...');
        await worldManager.initialize();
        await loadEncounterData();
    }
    worldManager.ensureInitialized();

    const body = await req.json() as GameRequestPayload;
    const { command, playerState: requestPlayerState } = body;

    if (!command || !requestPlayerState || !requestPlayerState.locationId) {
      output = 'Invalid request body. Missing command or playerState.locationId.';
      return NextResponse.json({ output, updatedPlayerState: playerState, error: output }, { status: 400 });
    }

    playerState = {
        ...playerState,
        ...requestPlayerState,
        team: Array.isArray(requestPlayerState.team) ? [...requestPlayerState.team] : [],
        pcBox: Array.isArray(requestPlayerState.pcBox) ? [...requestPlayerState.pcBox] : [],
        inventory: Array.isArray(requestPlayerState.inventory) ? [...requestPlayerState.inventory] : [],
        badges: Array.isArray(requestPlayerState.badges) ? [...requestPlayerState.badges] : [],
        money: requestPlayerState.money ?? playerState.money,
        creditStatus: requestPlayerState.creditStatus ?? playerState.creditStatus,
        currentHp: requestPlayerState.currentHp ?? playerState.currentHp,
        maxHp: requestPlayerState.maxHp ?? playerState.maxHp,
        currentBattle: requestPlayerState.currentBattle ?? playerState.currentBattle,
    };
    output = `Unknown command: ${command}`; 

    const commandClean = command.trim().toLowerCase();
    const parts = commandClean.split(' ');
    const verb = parts[0];
    const argument = parts.slice(1).join(' '); 

    const allItems: GameDataItem[] = await getItems();
    const allMovesMap: Map<string, GameDataMove> = await getMoves();

    let targetDirection: string | undefined = undefined;
    if (directionMap[verb]) {
        targetDirection = directionMap[verb];
    } else if (verb === 'go' && argument && directionMap[argument.split(' ')[0]]) {
        targetDirection = directionMap[argument.split(' ')[0]];
    } else if (verb === 'enter' || verb === 'in') {
        targetDirection = 'enter';
    } else if (verb === 'exit' || verb === 'out' || verb === 'leave') {
        targetDirection = 'out';
    }

    if (targetDirection) {
        const currentLocation = worldManager.getLocationById(playerState.locationId);
        if (!currentLocation) {
            output = `Error: Cannot find current location with ID: ${playerState.locationId}`;
            return NextResponse.json({ output, updatedPlayerState: playerState, error: output }, { status: 500 });
        }

        const targetLocationId = currentLocation.exits[targetDirection];
        if (targetLocationId) {
            const nextLocation = worldManager.getLocationById(targetLocationId);
            if (nextLocation) {                playerState.locationId = targetLocationId;
                output = `You move ${targetDirection}.\n\n`;
                output += `**${nextLocation.name.zh} (${nextLocation.name.en || ''})**\n`;
                output += `${nextLocation.description}\n`;

                // 添加地图信息 - 使用位置ID构建一个临时Map
                const locationsMap = new Map();
                worldManager.getAllLocationIds().forEach(id => {
                  const loc = worldManager.getLocationById(id);
                  if (loc) locationsMap.set(id, loc);
                });
                
                const mapOverview = getLocationMapOverview(nextLocation, locationsMap);
                if (mapOverview) {
                    output += `\n${mapOverview}\n`;
                }

                if (shouldEncounterWildPokemon(targetLocationId) && playerState.team && playerState.team.length > 0) {
                    const wildPokemon = await generateWildPokemon(targetLocationId);
                    if (wildPokemon) {
                        const playerActivePokemon = playerState.team.find(p => p.currentHp > 0);
                        if (playerActivePokemon) {
                            const battleState = await startBattle(
                                playerState.id,
                                playerState.name,
                                playerState.team,
                                wildPokemon
                            );
                            output += `\n**遭遇野生宝可梦！**\n`;
                            output += `一只野生的${wildPokemon.speciesName} (Lv.${wildPokemon.level})出现了！\n`;
                            output += `你派出了${playerActivePokemon.nickname || playerActivePokemon.speciesName}！\n`;
                            output += "请选择: fight (战斗), run (逃跑), item (使用物品), switch (更换宝可梦)\n";
                            playerState.currentBattle = battleState;
                        }
                    }
                }
                const availableExits = Object.keys(nextLocation.exits).join(', ');
                output += `\nExits: ${availableExits || 'None'}`;
            } else {
                output = `Error: Destination location with ID ${targetLocationId} not found!`;
            }
        } else {
            output = `You cannot go ${targetDirection} from here.`;
        }
    } else if (verb === 'look' || verb === 'l' || verb === 'examine' || verb === 'ex') {
        const currentLocation = worldManager.getLocationById(playerState.locationId);
        if (!currentLocation) {
            output = `Error: Cannot find current location with ID: ${playerState.locationId}`;
        } else {
            const target = argument;            if (!target || target === currentLocation.id || target === currentLocation.name.zh.toLowerCase() || target === (currentLocation.name.en || '').toLowerCase()) {
                output = `**${currentLocation.name.zh} (${currentLocation.name.en || ''})**\n`;
                output += `${currentLocation.description}\n`;
                if (currentLocation.items && currentLocation.items.length > 0) {
                    output += "地上可以看到：";
                    const itemNames = currentLocation.items.map(itemId => {
                        const itemData = allItems.find(i => i.id === itemId);
                        return itemData ? `${itemData.name.zh}(${itemData.name.en || itemData.id})` : itemId;
                    });
                    output += itemNames.join(', ') + '\n';
                }
                const potentialPokemon = getPotentialWildPokemon(currentLocation.id);
                if (potentialPokemon.length > 0) {
                    const pokedexSummary = await getPokedexSummary(); // This returns Pick<PokedexEntry, ...>[]
                    output += "\n你注意到这个区域可能会遇到：\n";
                    const pokemonNames = potentialPokemon.map(pokemon => {
                        const details = pokedexSummary.find(entry => entry.yudex_id === pokemon.pokedexId);
                        return details ? `${details.name}(Lv.${pokemon.levelRange[0]}-${pokemon.levelRange[1]})` : `未知宝可梦#${pokemon.pokedexId}`;
                    });
                    output += pokemonNames.join('、') + '\n';
                }
                
                // 添加地图信息
                const locationsMap = new Map();
                worldManager.getAllLocationIds().forEach(id => {
                  const loc = worldManager.getLocationById(id);
                  if (loc) locationsMap.set(id, loc);
                });
                
                const mapOverview = getLocationMapOverview(currentLocation, locationsMap);
                if (mapOverview) {
                    output += `\n${mapOverview}\n`;
                } else {
                    const availableExits = Object.keys(currentLocation.exits).join(', ');
                    output += `\nExits: ${availableExits || 'None'}`;
                }
            } else if (target === 'pokemon' || target === 'wild' || target === '宝可梦') {
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
                const direction = directionMap[target];
                const exitId = currentLocation.exits[direction];
                if (exitId) {
                    const exitLocation = worldManager.getLocationById(exitId);
                    output = `向 ${direction} (${target}) 看去，那边是 ${exitLocation ? `${exitLocation.name.zh} (${exitLocation.name.en || ''})` : '未知区域'}。`;
                } else {
                    output = `那个方向 (${target}) 没有出口。`;
                }
            } else {
                 output = `你仔细看了看 ${target}，但没有发现什么特别之处。`; 
            }
        }
    } else if (verb === 'pokemon' || verb === 'team') {
        const team = playerState.team;
        if (!team || team.length === 0) { // Added !team check
            output = "你的队伍里目前没有宝可梦。";
        } else {
            output = "当前队伍:\n";
            output += "--------------------\n";
            const pokedexSummaryArray = await getPokedexSummary();
            team.forEach((pokemon, index) => {
                const speciesSummary = pokedexSummaryArray.find((entry) => entry.yudex_id === pokemon.pokedexId);
                const name = pokemon.nickname || (speciesSummary ? speciesSummary.name : `宝可梦 #${pokemon.pokedexId}`);
                const status = pokemon.statusCondition === null || !pokemon.statusCondition ? '' : ` [${pokemon.statusCondition.toUpperCase()}]`;
                output += `${index + 1}. ${name} (Lv. ${pokemon.level}) HP: ${pokemon.currentHp}/${pokemon.maxHp}${status}\n`;
            });
             output += "--------------------";
        }
    } else if (verb === 'train') {
        // ... (train logic - assuming no errors here for now, but may need similar PokedexEntry handling)
        const targetPokemonIdentifier = parts[1];
        let targetType: string | undefined = undefined;
        let usingItem: string | undefined = undefined;
        let focusDescription: string | undefined = undefined;
        const focusParts: string[] = [];
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

        if (!targetPokemonIdentifier) {
            output = "请指定要训练的宝可梦 (格式: train <宝可梦序号/名称> type <属性> focus \"...\")";
        } else if (!targetType) {
             output = "请指定目标招式属性 (格式: train ... type <属性> focus \"...\")";
        } else if (!focusDescription) {
             output = "请提供训练重点 (格式: train ... type <属性> focus \"...\")";
        } else {
            const pokedexSummaryArray = await getPokedexSummary();
            let targetPokemonIndex = playerState.team.findIndex((p, index) => {
                const speciesSummary = pokedexSummaryArray.find((entry) => entry.yudex_id === p.pokedexId);
                const speciesName = speciesSummary?.name.toLowerCase();
                return (index + 1).toString() === targetPokemonIdentifier ||
                       p.nickname?.toLowerCase() === targetPokemonIdentifier.toLowerCase() ||
                       (speciesName && speciesName === targetPokemonIdentifier.toLowerCase()); // Added speciesName check
            });

            if (targetPokemonIndex === -1) {
               output = `在你的队伍中找不到 '${targetPokemonIdentifier}'。`;
            } else {
                output = await initiateTrainingSession(
                    playerState,
                    targetPokemonIndex,
                    targetType,
                    focusDescription,
                    usingItem,
                    grokClient
                );
            }
        }
    } else if (verb === 'get' || verb === 'take') {
        const targetItemName = argument;
        if (!targetItemName) {
            output = "你要捡起什么？ (格式: get <物品名称>)";
        } else {
            const currentLocation = worldManager.getLocationById(playerState.locationId);
            if (!currentLocation || !currentLocation.items || currentLocation.items.length === 0) {
                output = "这里地上什么也没有。";
            } else {
                const targetItemNameLower = targetItemName.toLowerCase();
                let itemInLocationToTake: GameDataItem | undefined = undefined;
                let itemIdInLocation: string | undefined = undefined;

                for (const currentItemId of currentLocation.items) {
                    const itemData = allItems.find(i => i.id === currentItemId);
                    if (itemData) {
                        if (itemData.id.toLowerCase() === targetItemNameLower ||
                            itemData.name.zh.toLowerCase() === targetItemNameLower ||
                            (itemData.name.en && itemData.name.en.toLowerCase() === targetItemNameLower)) {
                            itemInLocationToTake = itemData;
                            itemIdInLocation = currentItemId;
                            break;
                        }
                    }
                }

                if (itemInLocationToTake && itemIdInLocation) {
                    const existingInventoryItemIndex = playerState.inventory.findIndex(invItem => invItem.itemId === itemIdInLocation);
                    if (existingInventoryItemIndex !== -1) {
                        playerState.inventory[existingInventoryItemIndex].quantity += 1;
                    } else {
                        playerState.inventory.push({ itemId: itemIdInLocation, quantity: 1 });
                    }
                    // Consider removing from location.items if persistence is handled
                    // Example: currentLocation.items.splice(currentLocation.items.indexOf(itemIdInLocation), 1);
                    output = `你捡起了 ${itemInLocationToTake.name.zh}(${itemInLocationToTake.name.en || itemInLocationToTake.id})。`;
                } else {
                    output = `地上没有找到 '${targetItemName}'。`;
                }
            }
        }
    } else if (verb === 'drop') {
        const targetItemName = argument;
        if (!targetItemName) {
            output = "你要丢弃什么？ (格式: drop <物品名称>)";
        } else {
            const targetItemNameLower = targetItemName.toLowerCase();
            let itemInInventoryToDrop: { invItemIndex: number, itemDetails: GameDataItem } | undefined = undefined;

            for (let i = 0; i < playerState.inventory.length; i++) {
                const invItem = playerState.inventory[i];
                const itemData = allItems.find(item => item.id === invItem.itemId);
                if (itemData) {
                    if (itemData.id.toLowerCase() === targetItemNameLower ||
                        itemData.name.zh.toLowerCase() === targetItemNameLower ||
                        (itemData.name.en && itemData.name.en.toLowerCase() === targetItemNameLower)) {
                        itemInInventoryToDrop = { invItemIndex: i, itemDetails: itemData };
                        break;
                    }
                }
            }

            if (itemInInventoryToDrop) {
                const { invItemIndex, itemDetails } = itemInInventoryToDrop;
                const itemToDrop = playerState.inventory[invItemIndex];
                if (itemToDrop.quantity > 1) {
                    itemToDrop.quantity -= 1;
                } else {
                    playerState.inventory.splice(invItemIndex, 1);
                }
                output = `你丢下了 ${itemDetails.name.zh}(${itemDetails.name.en || itemDetails.id})。`;
            } else {
                output = `你的背包里没有 '${targetItemName}'。`;
            }
        }
    } else if (verb === 'inventory' || verb === 'inv' || verb === 'i') {
        if (!playerState.inventory || playerState.inventory.length === 0) { // Added !playerState.inventory check
            output = "你的背包是空的。";
        } else {
            output = "背包物品:\n";
            output += "--------------------\n";
            playerState.inventory.forEach(invItem => {
                const itemData = allItems.find(i => i.id === invItem.itemId);
                const name = itemData ? `${itemData.name.zh}(${itemData.name.en || itemData.id})` : invItem.itemId;
                output += `- ${name} x${invItem.quantity}\n`;
            });
            output += "--------------------";
        }
    } else if (verb === 'battle' || verb === 'fight' || verb === 'run' || verb === 'item' || verb === 'switch') {
        if (!playerState.currentBattle) {
            output = "你当前不在战斗中。";
        } else {
            const battleState = playerState.currentBattle;
            if (battleState.status === 'WAITING_FOR_INPUT') {
                const playerParticipant = battleState.participants[0];
                const opponentParticipant = battleState.participants[1];
                let playerAction: BattleAction | null = null;

                // Resolve moves for the player's active Pokemon
                const playerActivePokemonResolvedMoves = await resolvePokemonMovesArray(playerParticipant.activePokemon.moves, allMovesMap);

                if (verb === 'fight') {
                    if (!argument) {
                        output = "请选择要使用的招式:\n";
                        playerActivePokemonResolvedMoves.forEach((move, index) => {
                            output += `${index + 1}. ${move.name} (PP: ${move.pp}/${move.pp})\n`;
                        });
                        return NextResponse.json({ output, updatedPlayerState: playerState });
                    }
                    let moveIndex = -1;
                    const moveNumber = parseInt(argument);
                    if (!isNaN(moveNumber) && moveNumber > 0 && moveNumber <= playerActivePokemonResolvedMoves.length) {
                        moveIndex = moveNumber - 1;
                    } else {
                        moveIndex = playerActivePokemonResolvedMoves.findIndex(move => move.name.toLowerCase() === argument.toLowerCase());
                    }

                    if (moveIndex === -1 || !playerActivePokemonResolvedMoves[moveIndex]) {
                        output = `找不到招式 "${argument}"。请使用有效的招式名称或序号。`;
                        return NextResponse.json({ output, updatedPlayerState: playerState });
                    }
                    if (playerActivePokemonResolvedMoves[moveIndex].pp <= 0) {
                        output = `${playerActivePokemonResolvedMoves[moveIndex].name}的PP不足！请选择其他招式。`;
                        return NextResponse.json({ output, updatedPlayerState: playerState });
                    }
                    playerAction = { type: 'FIGHT', moveId: playerActivePokemonResolvedMoves[moveIndex].name };
                } else if (verb === 'run') {
                    playerAction = { type: 'RUN' };
                } else if (verb === 'switch') {
                    const teamPokemon = playerParticipant.party; // This is PokemonInstance[]
                    if (!argument) {
                        output = "请选择要切换的宝可梦:\n";
                        teamPokemon.forEach((pokemon, index) => {
                            if (pokemon.instanceId !== playerParticipant.activePokemon.instanceId) {
                                const status = pokemon.currentHp <= 0 ? "（已失去战斗能力）" : `HP: ${pokemon.currentHp}/${pokemon.maxHp}`;
                                output += `${index + 1}. ${pokemon.nickname || pokemon.speciesName} Lv.${pokemon.level} ${status}\n`;
                            }
                        });
                        return NextResponse.json({ output, updatedPlayerState: playerState });
                    }
                    let pokemonIndex = -1;
                    const pokemonNumber = parseInt(argument);
                    const argumentLower = argument.toLowerCase();
                    if (!isNaN(pokemonNumber) && pokemonNumber > 0 && pokemonNumber <= teamPokemon.length) {
                        pokemonIndex = pokemonNumber - 1;
                    } else {
                        pokemonIndex = teamPokemon.findIndex(pokemon =>
                            (pokemon.nickname && pokemon.nickname.toLowerCase() === argumentLower) ||
                            (pokemon.speciesName && pokemon.speciesName.toLowerCase() === argumentLower) // Added check for speciesName
                        );
                    }
                    if (pokemonIndex === -1 || !teamPokemon[pokemonIndex]) {
                        output = `找不到宝可梦 "${argument}"。请使用有效的宝可梦名称或序号。`;
                        return NextResponse.json({ output, updatedPlayerState: playerState });
                    }
                    if (teamPokemon[pokemonIndex].instanceId === playerParticipant.activePokemon.instanceId) {
                        output = `${teamPokemon[pokemonIndex].nickname || teamPokemon[pokemonIndex].speciesName} 已经在战斗中！`;
                        return NextResponse.json({ output, updatedPlayerState: playerState });
                    }
                    if (teamPokemon[pokemonIndex].currentHp <= 0) {
                        output = `${teamPokemon[pokemonIndex].nickname || teamPokemon[pokemonIndex].speciesName} 已经失去战斗能力，无法参战！`;
                        return NextResponse.json({ output, updatedPlayerState: playerState });
                    }
                    playerAction = { type: 'SWITCH', switchToPokemonIndex: pokemonIndex };
                } else if (verb === 'item') {
                    output = "使用物品功能正在开发中。请尝试其他命令。";
                    return NextResponse.json({ output, updatedPlayerState: playerState });
                }

                if (playerAction) {
                    try {
                        const opponentActivePokemonResolvedMoves = await resolvePokemonMovesArray(opponentParticipant.activePokemon.moves, allMovesMap);
                        const opponentMoveName = opponentActivePokemonResolvedMoves.length > 0 && opponentActivePokemonResolvedMoves[0] ? opponentActivePokemonResolvedMoves[0].name : 'struggle'; // Fallback to struggle or similar
                        const opponentAction: BattleAction = { type: 'FIGHT', moveId: opponentMoveName };

                        const updatedBattleState = await processTurn(battleState, playerAction, opponentAction);
                        playerState.currentBattle = updatedBattleState;

                        if (updatedBattleState.status === 'PLAYER_WIN') {
                            output = "战斗胜利！\n\n" + updatedBattleState.log.slice(-5).join("\n");
                            const defeatedPokemon = opponentParticipant.activePokemon;
                            const expMessages: string[] = [];
                            const expGained = defeatedPokemon.level * 5; // Example calculation
                            const activePokemon = playerParticipant.activePokemon; // This is PokemonInstance

                            if (activePokemon.speciesDetails) { // Guard for speciesDetails
                                const result = await addExperience(activePokemon, activePokemon.speciesDetails as GameDataPokedexEntry, expGained); // Cast to GameDataPokedexEntry if addExperience expects it
                                expMessages.push(...result.messages);
                            } else {
                                expMessages.push(`无法为 ${activePokemon.nickname || activePokemon.speciesName || '宝可梦'} 计算经验值，缺少物种详情。`);
                                console.warn(`Missing speciesDetails for ${activePokemon.instanceId} during addExperience`);
                            }
                            output += "\n\n" + expMessages.join("\n");
                            const pokemonIndexInTeam = playerState.team.findIndex(p => p.instanceId === activePokemon.instanceId);
                            if (pokemonIndexInTeam !== -1) {
                                playerState.team[pokemonIndexInTeam] = activePokemon; // Ensure activePokemon reflects changes from addExperience
                            }
                            playerState.currentBattle = undefined;
                        } else if (updatedBattleState.status === 'OPPONENT_WIN') {
                            output = "战斗失败！\n\n" + updatedBattleState.log.slice(-5).join("\n");
                            playerState.currentBattle = undefined;
                        } else if (updatedBattleState.status === 'FLED') {
                            output = "成功逃跑！\n\n" + updatedBattleState.log.slice(-3).join("\n");
                            playerState.currentBattle = undefined;
                        } else {
                            output = updatedBattleState.log.slice(-5).join("\n");
                            output += "\n\n你可以：\n- fight [招式名/序号]\n- run\n- switch [宝可梦名/序号]\n- item [物品名] (开发中)";
                        }
                    } catch (error: any) {
                        console.error("Battle processing error:", error);
                        output = `战斗处理出错: ${error.message}`;
                    }
                } else {
                    // This case should ideally be handled by specific command checks returning early
                    // output = "无效的战斗命令。";
                }
            } else {
                output = battleState.status === 'PROCESSING' ? "战斗回合正在处理中..." : `战斗状态错误: ${battleState.status}`;
            }
        }
    } else {
        if (!targetDirection && !['look', 'l', 'examine', 'ex', 'pokemon', 'team', 'train', 'get', 'take', 'drop', 'inventory', 'inv', 'i', 'battle', 'fight', 'run', 'item', 'switch'].includes(verb)) {
            output = `Unknown command: ${commandClean}`;
        }
    }

    return NextResponse.json({ output, updatedPlayerState: playerState });

  } catch (error: any) {
    console.error('API Error processing game command:', error);
    // Ensure playerState is defined even in this catch block for the response
    const finalPlayerState = playerState || { /* provide a default minimal Player state */
        id: 'error_player', name: 'ErrorState', locationId: 'unknown', team: [], pcBox: [], inventory: [],
        pokedex: { seen: [], caught: [] }, badges: [], money: 0, creditStatus: 0, questFlags: {},
        relationshipFlags: {}, currentHp: 0, maxHp: 0,
    };
    return NextResponse.json({
        output: 'An internal error occurred.',
        updatedPlayerState: finalPlayerState,
        error: error.message
    }, { status: 500 });
  }
}

export { handler as POST };
