import { PokemonInstance } from '@/interfaces/pokemon';
import { PokedexEntry, getPokemonSpeciesDetails } from '@/lib/gameData';
import { getNatureModifier, StatName, NATURES } from '@/constants/natures'; // Import from constants
import { ExperienceGroup, getTotalExperienceForLevel, getExperienceGroupForPokemon } from '@/constants/experience'; // Import experience functions
// import { NATURES } from '@/constants/natures'; // Assuming natures are defined elsewhere

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
    const statKeyMapping: { [key in StatName]: keyof typeof baseStatsData } = {
        attack: 'attack',
        defense: 'defense',
        spAttack: 'sp_attack', // Map to underscore version
        spDefense: 'sp_defense', // Map to underscore version
        speed: 'speed'
    };

    const calculateOtherStat = (statKey: StatName) => {
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
 * Creates a new Pokemon instance, potentially with random IVs/EVs/Nature if not provided.
 * Calculates initial stats.
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
    // Use the new function to get detailed species data
    const speciesData = await getPokemonSpeciesDetails(pokedexId);

    if (!speciesData) {
        // Error message already logged in getPokemonSpeciesDetails
        return null;
    }
    
    // Check if the stats array exists and has the '一般' form data
    const normalStats = speciesData.stats?.find(s => s.form === '一般')?.data;
    if (!normalStats) {
        console.error(`Cannot create Pokemon instance: Base stats for '一般' form are missing for ${pokedexId}.`);
        return null;
    }

    // --- Generate Defaults (can be customized) ---
    const defaultIVs = {
        hp: Math.floor(Math.random() * 32), attack: Math.floor(Math.random() * 32),
        defense: Math.floor(Math.random() * 32), spAttack: Math.floor(Math.random() * 32),
        spDefense: Math.floor(Math.random() * 32), speed: Math.floor(Math.random() * 32)
    };
    const defaultEVs = { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 };
    
    // Select a random nature from the imported NATURES object
    const natureIds = Object.keys(NATURES);
    const randomNatureId = natureIds[Math.floor(Math.random() * natureIds.length)] || 'hardy'; 

    const instanceBase: Omit<PokemonInstance, 'calculatedStats' | 'maxHp' | 'currentHp'> = {
        instanceId: `inst_${pokedexId}_${Date.now()}_${Math.random().toString(16).slice(2)}`, // Basic unique ID
        pokedexId: pokedexId,
        nickname: options.nickname || null,
        level: level,
        moves: options.moves || [], // TODO: Populate with level-up moves later
        abilityId: options.abilityId || '', // TODO: Determine default ability later
        xp: options.xp || 0, // TODO: Calculate XP for level later
        xpToNextLevel: options.xpToNextLevel || 100, // TODO: Calculate based on growth rate later
        statusCondition: options.statusCondition || 'healthy',
        ivs: options.ivs || defaultIVs,
        evs: options.evs || defaultEVs,
        natureId: options.natureId || randomNatureId,
        gender: options.gender || 'genderless', // TODO: Determine based on species later
        shiny: options.shiny || false, // TODO: Add shiny chance later
        heldItemId: options.heldItemId || null,
        // Omitting calculatedStats, maxHp, currentHp as they are derived
    };

    // Create a temporary instance to pass to calculateStats
    // We need calculatedStats to set maxHp initially
    // This feels a bit circular, might need refinement
    const tempInstanceForCalc = { ...instanceBase, calculatedStats: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }, maxHp: 0, currentHp: 0 }; 
    const calculatedStats = calculateStats(tempInstanceForCalc, speciesData);

    const finalInstance: PokemonInstance = {
        ...instanceBase,
        calculatedStats: calculatedStats, // Assign the calculated stats
        maxHp: calculatedStats.hp,      // Set maxHp from calculated stats
        currentHp: options.currentHp ?? calculatedStats.hp, // Set currentHp (full HP by default)
    };

    // Ensure currentHp doesn't exceed maxHp
    finalInstance.currentHp = Math.min(finalInstance.maxHp, finalInstance.currentHp);

    return finalInstance;
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
    const expGroup = getExperienceGroupForPokemon(instance.pokedexId);
    
    let leveledUp = false;
    let xpForNextLevel = getTotalExperienceForLevel(expGroup, instance.level + 1);

    // Level up loop
    while (instance.xp >= xpForNextLevel && instance.level < 100) {
        instance.level++;
        leveledUp = true;
        messages.push(`**${instance.nickname || speciesData.name} 升到了 ${instance.level} 级！**`);

        // Recalculate stats
        const newStats = calculateStats(instance, speciesData);
        instance.calculatedStats = {
            attack: newStats.attack,
            defense: newStats.defense,
            spAttack: newStats.spAttack,
            spDefense: newStats.spDefense,
            speed: newStats.speed
        };
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