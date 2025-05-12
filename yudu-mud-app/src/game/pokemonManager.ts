import { PokemonInstance, Move as PokemonMove } from '@/interfaces/pokemon';
import { PokedexEntry, getPokemonSpeciesDetails, getMoves, Move as GameDataMove } from '@/lib/gameData';
import { getNatureModifier, StatName, NATURES } from '@/constants/natures'; // Import from constants
import { ExperienceGroup, getTotalExperienceForLevel, getExperienceGroupForPokemon } from '@/constants/experience'; // Import experience functions
import { v4 as uuidv4 } from 'uuid'; // Assuming uuid is installed

/**
 * Calculates the final stats for a Pokemon instance.
 * Formula based on Bulbapedia/standard Pokemon games.
 * https://bulbapedia.bulbagarden.net/wiki/Stat#Generation_III_onward
 *
 * @param instance The Pokemon instance data.
 * @param speciesData The static Pokedex data for the species.
 * @returns The calculated stats (HP, Attack, Defense, Sp. Attack, Sp. Defense, Speed).
 */
function calculateStats(instance: PokemonInstance, speciesData: PokedexEntry): {
    hp: number; 
    attack: number; 
    defense: number; 
    spAttack: number; 
    spDefense: number; 
    speed: number; 
} {
    const { level, ivs, evs, natureId } = instance;
    const baseStatsData = speciesData.stats?.find(s => s.form === '一般')?.data;

    if (!baseStatsData) {
        console.error(`Error: Base stats data for form '一般' missing for Pokedex ID: ${speciesData.yudex_id}`);
        return { hp: 1, attack: 1, defense: 1, spAttack: 1, spDefense: 1, speed: 1 };
    }

    const hpIV = ivs.hp || 0;
    const hpEV = evs.hp || 0;
    const hpBase = parseInt(baseStatsData.hp, 10) || 1;
    const calculatedHp = Math.floor(((2 * hpBase + hpIV + Math.floor(hpEV / 4)) * level) / 100) + level + 10;

    // Corrected type for statKeyMapping keys to match PokedexEntry base stats keys
    const statKeyMapping: { [key in Exclude<StatName, 'hp'>]: keyof Omit<typeof baseStatsData, 'hp'> } = {
        attack: 'attack',
        defense: 'defense',
        spAttack: 'sp_attack', 
        spDefense: 'sp_defense', 
        speed: 'speed'
    };

    const calculateOtherStat = (statKey: Exclude<StatName, 'hp'>) => {
        const baseStatKey = statKeyMapping[statKey]; 
        if (!baseStatKey || !baseStatsData[baseStatKey]) return 1; 

        const base = parseInt(baseStatsData[baseStatKey]!, 10) || 1; // Added non-null assertion for baseStatsData[baseStatKey]
        const iv = ivs[statKey] || 0;
        const ev = evs[statKey] || 0;
        
        const natureMultiplier = getNatureModifier(natureId || 'hardy', statKey);

        const statValue = Math.floor((Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5) * natureMultiplier);
        return Math.max(1, statValue); 
    };

    const calculatedAttack = calculateOtherStat('attack');
    const calculatedDefense = calculateOtherStat('defense');
    const calculatedSpAttack = calculateOtherStat('spAttack');
    const calculatedSpDefense = calculateOtherStat('spDefense');
    const calculatedSpeed = calculateOtherStat('speed');

    return {
        hp: calculatedHp,
        attack: calculatedAttack,
        defense: calculatedDefense,
        spAttack: calculatedSpAttack,
        spDefense: calculatedSpDefense,
        speed: calculatedSpeed,
    };
}

/**
 * Creates a new Pokemon instance, populating its initial moves based on level.
 *
 * @param pokedexId The Yudex ID of the Pokemon species.
 * @param level The level of the Pokemon.
 * @param options Optional overrides for instance properties (IVs, EVs, Nature, etc.).
 * @returns A new PokemonInstance object or null if species data is not found.
 */
export async function createPokemonInstance(
    pokedexId: string,
    level: number,
    options: Partial<PokemonInstance> = {}
): Promise<PokemonInstance | null> {
    const speciesData = await getPokemonSpeciesDetails(pokedexId);
    if (!speciesData) return null;

    const normalStats = speciesData.stats?.find(s => s.form === '一般')?.data;
    if (!normalStats) {
        console.error(`Cannot create Pokemon instance: Base stats for '一般' form are missing for ${pokedexId}.`);
        return null;
    }

    // --- Load all moves into cache (if not already loaded) ---
    const allMovesMap = await getMoves(); 
    if (!allMovesMap) {
        console.error("Failed to load moves data, cannot assign moves to instance.");
        return null; // Or handle differently, maybe return instance without moves?
    }

    // --- Determine initial moves based on level-up learnset --- 
    const initialMoves: PokemonMove[] = [];
    const levelUpMoves = speciesData.moves?.learned?.find((m: any) => m.form === '一般')?.data || [];

    // Filter moves learned at or before the current level
    const learnedMoveEntries = levelUpMoves
        .filter((entry: any) => entry.method === '提升等级' && entry.level_learned_at <= level)
        // Sort by level descending to handle potential multiple moves at same level (take latest defined? Or handle 4-move limit)
        .sort((a: any, b: any) => b.level_learned_at - a.level_learned_at);
    
    console.log(`Potential level-up moves for ${speciesData.name} at level ${level}:`, learnedMoveEntries.map((m:any) => m.name));

    // Add moves, respecting the 4-move limit (taking the most recently learned)
    const moveNamesAdded = new Set<string>();
    for (const learnEntry of learnedMoveEntries) {
        if (initialMoves.length >= 4) break; // Stop if we have 4 moves

        const moveName = learnEntry.name;
        if (moveNamesAdded.has(moveName)) continue; // Skip if already added (e.g., learned at earlier level too)

        const moveData = allMovesMap.get(moveName); // Find the full move data by name

        if (moveData) {
            // Create a copy of the move data for the instance, setting current PP
            const instanceMove: PokemonMove = {
                ...moveData,
                // Ensure category is one of the valid types
                category: validateMoveCategory(moveData.category),
                // Ensure PP is set correctly from the base PP
                pp: moveData.pp, // Base PP
                // We might want a currentPp field later, but for now, pp is the max
            };
            initialMoves.push(instanceMove);
            moveNamesAdded.add(moveName);
        } else {
            console.warn(`Move data not found in cache for: ${moveName} (learned by ${speciesData.name})`);
        }
    }
    // Ensure the oldest moves are first if we took more than 4 initially due to sorting (optional refinement)
    // initialMoves.reverse(); // If needed
    console.log(`Assigned moves to ${speciesData.name}:`, initialMoves.map(m => m.name));

    // --- Generate Defaults (IVs, EVs, Nature) --- 
    const defaultIVs = { hp: Math.floor(Math.random() * 32), attack: Math.floor(Math.random() * 32), defense: Math.floor(Math.random() * 32), spAttack: Math.floor(Math.random() * 32), spDefense: Math.floor(Math.random() * 32), speed: Math.floor(Math.random() * 32) };
    const defaultEVs = { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 };
    const natureIds = Object.keys(NATURES);
    const randomNatureId = natureIds[Math.floor(Math.random() * natureIds.length)] || 'hardy';

    // Assuming speciesData.experienceGroup is the correct field for experience group string
    const experienceGroupString = speciesData.experienceGroup;
    const experienceGroup = getExperienceGroupFromString(experienceGroupString);

    // Initialize stats for instanceBase according to PokemonInstance type
    const initialInstanceStats: PokemonInstance['stats'] = {
        attack: parseInt(normalStats.attack, 10) || 1,
        defense: parseInt(normalStats.defense, 10) || 1,
        specialAttack: parseInt(normalStats.sp_attack, 10) || 1, // map sp_attack to specialAttack
        specialDefense: parseInt(normalStats.sp_defense, 10) || 1, // map sp_defense to specialDefense
        speed: parseInt(normalStats.speed, 10) || 1,
    };

    const instanceBase: Omit<PokemonInstance, 'calculatedStats' | 'maxHp' | 'currentHp'> = {
        instanceId: options.instanceId || uuidv4(), // Use uuidv4 for unique ID
        pokedexId: pokedexId,
        speciesName: speciesData.name, 
        speciesDetails: speciesData, 
        nickname: options.nickname || undefined, 
        level: level,
        moves: initialMoves, 
        ability: options.ability || speciesData.ability?.find((a: any) => !a.is_hidden)?.name || '', 
        experience: getTotalExperienceForLevel(experienceGroup, level), // Store total XP for current level
        xp: options.xp ?? getTotalExperienceForLevel(experienceGroup, level), // xp alias for experience
        xpToNextLevel: getTotalExperienceForLevel(experienceGroup, level + 1),
        statusCondition: options.statusCondition || undefined, 
        ivs: options.ivs || defaultIVs,
        evs: options.evs || defaultEVs,
        natureId: options.natureId || randomNatureId,
        gender: options.gender || (() => { 
            const ratio = speciesData.gender_ratio; 
            if (!ratio || typeof ratio.male !== 'number' || typeof ratio.female !== 'number') return 'genderless';
            if (ratio.male === 0) return 'female';
            if (ratio.female === 0) return 'male';
            return Math.random() < ratio.male ? 'male' : 'female'; 
        })(),
        shiny: options.shiny || (Math.random() < 1 / 4096), 
        heldItemId: options.heldItemId || undefined, 
        stats: initialInstanceStats, // Assign the correctly typed stats object
    };

    // --- Calculate Stats and Finalize Instance --- 
    const tempInstanceForCalc = { ...instanceBase, calculatedStats: { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }, maxHp: 0, currentHp: 0, /* ensure all PokemonInstance props are here if needed by calculateStats */ };
    const calculatedStats = calculateStats(tempInstanceForCalc, speciesData);

    const finalInstance: PokemonInstance = {
        ...instanceBase,
        calculatedStats: calculatedStats,
        maxHp: calculatedStats.hp,
        currentHp: options.currentHp ?? calculatedStats.hp,
    };

    finalInstance.currentHp = Math.min(finalInstance.maxHp, Math.max(0, finalInstance.currentHp)); // Ensure HP is within bounds

    console.log(`Created instance: ${finalInstance.speciesName} (Lvl ${finalInstance.level})`, finalInstance);
    return finalInstance;
}

/**
 * Helper function to ensure move category is one of the valid types
 */
function validateMoveCategory(category: string): 'Physical' | 'Special' | 'Status' {
    if (category === 'Physical' || category === 'Special' || category === 'Status') {
        return category;
    }
    // Map common variants
    if (category.toLowerCase() === 'physical') return 'Physical';
    if (category.toLowerCase() === 'special') return 'Special';
    if (category.toLowerCase() === 'status') return 'Status';
    
    // Default fallback based on common patterns
    if (category === '物理' || category.toLowerCase().includes('phys')) return 'Physical';
    if (category === '特殊' || category.toLowerCase().includes('spec')) return 'Special';
    if (category === '变化' || category.toLowerCase().includes('stat')) return 'Status';
    
    // Final fallback
    console.warn(`Unknown move category "${category}", defaulting to "Status"`);
    return 'Status';
}

/**
 * Helper function to convert string to ExperienceGroup
 */
function getExperienceGroupFromString(groupName?: string): ExperienceGroup {
    if (!groupName) return 'medium_fast'; // Default if no group name provided
    
    const lowerGroupName = groupName.toLowerCase();
    // Only include cases that are valid ExperienceGroup types
    if (lowerGroupName === 'fast') return 'fast';
    if (lowerGroupName === 'medium_fast') return 'medium_fast';
    if (lowerGroupName === 'medium_slow') return 'medium_slow';
    if (lowerGroupName === 'slow') return 'slow';
    // 'erratic' and 'fluctuating' are not in ExperienceGroup type based on experience.ts
    
    console.warn(`Unknown experience group "${groupName}", defaulting to "medium_fast"`);
    return 'medium_fast'; // Fallback for unknown groups
}

/**
 * Adds experience points to a Pokemon instance and handles level ups.
 * 
 * @param instance The Pokemon instance to modify (will be mutated).
 * @param speciesData The detailed species data for the Pokemon (needed for stats and exp group).
 * @param amount The amount of experience points gained.
 * @returns An object containing messages about level ups and potentially learned moves/evolutions in the future.
 */
export async function addExperience(instance: PokemonInstance, speciesData: PokedexEntry, amount: number): Promise<{ messages: string[] }> { // 添加 async 和 Promise 返回类型
    if (instance.level >= 100) {
        return { messages: [] }; 
    }

    instance.xp = (instance.xp || 0) + amount; // Ensure instance.xp is not undefined
    const messages: string[] = [`${instance.nickname || speciesData.name} 获得了 ${amount} 点经验值！`];

    const expGroup = speciesData.experienceGroup ? 
        getExperienceGroupFromString(speciesData.experienceGroup) : 
        getExperienceGroupForPokemon(instance.pokedexId);
    
    let leveledUp = false;
    let xpForNextLevel = getTotalExperienceForLevel(expGroup, instance.level + 1);

    while ((instance.xp || 0) >= xpForNextLevel && instance.level < 100) { // Ensure instance.xp is not undefined
        instance.level++;
        leveledUp = true;
        messages.push(`**${instance.nickname || speciesData.name} 升到了 ${instance.level} 级！**`);

        const newStats = calculateStats(instance, speciesData);
        instance.calculatedStats = newStats;
        instance.maxHp = newStats.hp;
        instance.currentHp = instance.maxHp; 

        messages.push(`HP: ${instance.maxHp}, 攻击: ${newStats.attack}, 防御: ${newStats.defense}, 特攻: ${newStats.spAttack}, 特防: ${newStats.spDefense}, 速度: ${newStats.speed}`);

        const learnedMovesMessages = await checkMoveLearning(instance, speciesData, instance.level); // 使用 await
        if (learnedMovesMessages && learnedMovesMessages.length > 0) {
            messages.push(...learnedMovesMessages.map(move => `${instance.nickname || speciesData.name} 学会了 ${move}!`));
        }

        const evolutionResult = checkEvolution(instance, speciesData);
        if (evolutionResult) { 
            messages.push(evolutionResult.message); 
        }

        if (instance.level < 100) {
            xpForNextLevel = getTotalExperienceForLevel(expGroup, instance.level + 1);
        } else {
            break; 
        }
    }

    instance.xpToNextLevel = xpForNextLevel;

    return { messages };
}

// --- Other Pokemon related functions can be added here --- 
// e.g., calculateXpNeeded, getLevelUpMoves, handleEvolution, etc.

/**
 * 检查宝可梦升级后是否可以学习新技能
 * 
 * @param instance 宝可梦实例
 * @param speciesData 宝可梦种类数据
 * @param newLevel 新等级
 * @returns 学习的新技能名称数组
 */
async function checkMoveLearning( // 添加 async 关键字
    instance: PokemonInstance, 
    speciesData: PokedexEntry, 
    newLevel: number
): Promise<string[]> { // 返回值需要是 Promise<string[]>
    const learnedMoves: string[] = [];
    
    // 获取等级提升学习技能列表
    const levelUpMoves = speciesData.moves?.learned?.find((m: any) => m.form === '一般')?.data || [];
    
    // 筛选当前等级可学习的技能
    const newLevelMoves = levelUpMoves
        .filter((entry: any) => entry.method === '提升等级' && entry.level_learned_at === newLevel)
        .map((entry: any) => entry.name);
    
    if (newLevelMoves.length === 0) {
        return learnedMoves;
    }

    // 获取所有技能数据
    const allMovesMap = await getMoves();
    if (!allMovesMap) {
        console.error("Failed to load moves data, cannot assign moves to instance.");
        return learnedMoves;
    }

    // 添加新技能到实例
    for (const moveName of newLevelMoves) {
        const moveData = allMovesMap.get(moveName);
        if (moveData) {
            const instanceMove: PokemonMove = {
                ...moveData,
                category: validateMoveCategory(moveData.category),
                pp: moveData.pp,
            };
            instance.moves.push(instanceMove);
            learnedMoves.push(moveName);
        } else {
            console.warn(`Move data not found in cache for: ${moveName} (learned by ${speciesData.name})`);
        }
    }

    // 确保技能数量不超过4个
    if (instance.moves.length > 4) {
        instance.moves = instance.moves.slice(-4);
    }

    return learnedMoves;
}

/**
 * 检查宝可梦是否满足进化条件
 * 
 * @param instance 宝可梦实例
 * @param speciesData 宝可梦种类数据
 * @returns 进化结果对象，包含进化信息和消息
 */
function checkEvolution(instance: PokemonInstance, speciesData: PokedexEntry): { evolved: boolean, message: string } | null {
    // TODO: 实现进化逻辑
    return null;
}

/**
 * 计算升到指定等级所需的经验值
 * 
 * @param level 等级
 * @param group 经验组
 * @returns 所需经验值
 */
export function calculateXpNeededForLevel(level: number, group: ExperienceGroup): number {
    if (level <= 1) return 0;
    if (level > 100) level = 100; // Cap at level 100 for calculation

    switch (group) {
        case 'fast':
            return Math.floor(4 * Math.pow(level, 3) / 5);
        case 'medium_fast':
            return Math.floor(Math.pow(level, 3));
        case 'medium_slow':
            return Math.floor(6 / 5 * Math.pow(level, 3) - 15 * Math.pow(level, 2) + 100 * level - 140);
        case 'slow':
            return Math.floor(5 * Math.pow(level, 3) / 4);
        // Removed 'erratic' and 'fluctuating' cases as they are not in the ExperienceGroup type
        default:
            // This default should ideally not be reached if groupName in getExperienceGroupFromString is handled correctly
            console.warn(`calculateXpNeededForLevel called with unhandled group: ${group}. Defaulting to medium_fast logic.`);
            return Math.floor(Math.pow(level, 3)); // Default to MediumFast if group is unknown
    }
}