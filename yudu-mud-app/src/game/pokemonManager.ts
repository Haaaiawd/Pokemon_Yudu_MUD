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
    // --- 获取基础属性 --- 
    const baseStatsData = speciesData.stats?.find(s => s.form === '一般')?.data;

    if (!baseStatsData) {
        console.error(`Error: Base stats data for form '一般' missing for Pokedex ID: ${speciesData.yudex_id}`);
        return { hp: 1, attack: 1, defense: 1, spAttack: 1, spDefense: 1, speed: 1 };
    }

    // --- HP Calculation --- (Convert base stat from string to number)
    const hpIV = ivs.hp || 0;
    const hpEV = evs.hp || 0;
    const hpBase = parseInt(baseStatsData.hp, 10) || 1; // Convert string to number
    const calculatedHp = Math.floor(((2 * hpBase + hpIV + Math.floor(hpEV / 4)) * level) / 100) + level + 10;

    // --- Other Stats Calculation ---
    // Define mapping for stat keys used in IVs/EVs/Nature vs keys in baseStatsData
    const statKeyMapping: { [key in Exclude<StatName, 'hp'>]: keyof typeof baseStatsData } = {
        attack: 'attack',
        defense: 'defense',
        spAttack: 'sp_attack', // Map to underscore version
        spDefense: 'sp_defense', // Map to underscore version
        speed: 'speed'
    };

    const calculateOtherStat = (statKey: Exclude<StatName, 'hp'>) => {
        const baseStatKey = statKeyMapping[statKey]; // Get the key for the base stats data
        if (!baseStatKey) return 1; // Should not happen with current mapping

        const base = parseInt(baseStatsData[baseStatKey], 10) || 1; // Convert string to number
        const iv = ivs[statKey] || 0;
        const ev = evs[statKey] || 0;
        
        const natureMultiplier = getNatureModifier(natureId, statKey);

        const statValue = Math.floor((Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5) * natureMultiplier);
        return Math.max(1, statValue); // Ensure stat is at least 1
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

    // --- Build Base Instance --- 
    const instanceBase: Omit<PokemonInstance, 'calculatedStats' | 'maxHp' | 'currentHp'> = {
        instanceId: options.instanceId || `inst_${pokedexId}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        pokedexId: pokedexId,
        speciesName: speciesData.name, // Add species name for convenience
        speciesDetails: speciesData, // Store the full details for easy access later
        nickname: options.nickname || null,
        level: level,
        moves: initialMoves, // Assign the determined moves
        abilityId: options.abilityId || speciesData.ability?.find((a: any) => !a.is_hidden)?.name || '', // TODO: Improve ability selection
        // Calculate XP for current level based on experience group
        xp: options.xp !== undefined ? options.xp : getTotalExperienceForLevel(getExperienceGroupFromString(speciesData.experienceGroup), level),
        xpToNextLevel: getTotalExperienceForLevel(getExperienceGroupFromString(speciesData.experienceGroup), level + 1),
        statusCondition: options.statusCondition || null, // Default to null (healthy)
        ivs: options.ivs || defaultIVs,
        evs: options.evs || defaultEVs,
        natureId: options.natureId || randomNatureId,
        // Determine gender based on species ratio
        gender: options.gender || (() => { 
            const ratio = speciesData.gender_ratio; 
            if (!ratio || typeof ratio.male !== 'number' || typeof ratio.female !== 'number') return 'genderless';
            if (ratio.male === 0) return 'female';
            if (ratio.female === 0) return 'male';
            return Math.random() < ratio.male ? 'male' : 'female'; 
        })(),
        shiny: options.shiny || (Math.random() < 1 / 4096), // Example shiny chance
        heldItemId: options.heldItemId || null,
    };

    // --- Calculate Stats and Finalize Instance --- 
    const tempInstanceForCalc = { ...instanceBase, calculatedStats: { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }, maxHp: 0, currentHp: 0 };
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
    if (!groupName) return 'medium_fast';
    
    switch(groupName.toLowerCase()) {
        case 'fast': return 'fast';
        case 'medium_fast': return 'medium_fast';
        case 'medium_slow': return 'medium_slow';
        case 'slow': return 'slow';
        default:
            console.warn(`Unknown experience group "${groupName}", defaulting to "medium_fast"`);
            return 'medium_fast';
    }
}

/**
 * Adds experience points to a Pokemon instance and handles level ups.
 * 
 * @param instance The Pokemon instance to modify (will be mutated).
 * @param speciesData The detailed species data for the Pokemon (needed for stats and exp group).
 * @param amount The amount of experience points gained.
 * @returns An object containing messages about level ups and potentially learned moves/evolutions in the future.
 */
export function addExperience(instance: PokemonInstance, speciesData: PokedexEntry, amount: number): { messages: string[] } {
    if (instance.level >= 100) {
        return { messages: [] }; // Already max level
    }

    instance.xp += amount;
    const messages: string[] = [`${instance.nickname || speciesData.name} 获得了 ${amount} 点经验值！`];

    // Determine experience group (using placeholder function for now)
    // TODO: Load actual experienceGroup from speciesData when available
    const expGroup = speciesData.experienceGroup ? 
        getExperienceGroupFromString(speciesData.experienceGroup) : 
        getExperienceGroupForPokemon(instance.pokedexId);
    
    let leveledUp = false;
    let xpForNextLevel = getTotalExperienceForLevel(expGroup, instance.level + 1);

    // Level up loop
    while (instance.xp >= xpForNextLevel && instance.level < 100) {
        instance.level++;
        leveledUp = true;
        messages.push(`**${instance.nickname || speciesData.name} 升到了 ${instance.level} 级！**`);

        // Recalculate stats
        const newStats = calculateStats(instance, speciesData);
        instance.calculatedStats = newStats;
        instance.maxHp = newStats.hp;
        // Heal fully on level up (common game mechanic)
        instance.currentHp = instance.maxHp; 

        messages.push(`HP: ${instance.maxHp}, 攻击: ${newStats.attack}, 防御: ${newStats.defense}, 特攻: ${newStats.spAttack}, 特防: ${newStats.spDefense}, 速度: ${newStats.speed}`);

        // TODO: Check for move learning at this new level
        // const learnedMoves = checkMoveLearning(instance, speciesData);
        // messages.push(...learnedMoves.map(move => `${instance.nickname || speciesData.name} 学会了 ${move}!`));

        // TODO: Check for evolution at this new level
        // const evolutionResult = checkEvolution(instance, speciesData);
        // if (evolutionResult) { messages.push(evolutionResult.message); }

        // Update xp needed for the *next* potential level up
        if (instance.level < 100) {
            xpForNextLevel = getTotalExperienceForLevel(expGroup, instance.level + 1);
        } else {
            break; // Reached max level
        }
    }

    // Update the xpToNextLevel field on the instance (optional, but can be useful display)
    instance.xpToNextLevel = xpForNextLevel;

    return { messages };
}

// --- Other Pokemon related functions can be added here --- 
// e.g., calculateXpNeeded, getLevelUpMoves, handleEvolution, etc. 