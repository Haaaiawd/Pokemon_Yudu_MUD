import { PokemonInstance, Nature, StatusCondition } from "@/interfaces/pokemon";
import { PokedexEntry, getPokemonSpeciesDetails, getPokedexSummary } from "@/lib/gameData";
import { v4 as uuidv4 } from 'uuid';

// --- Type Definitions for Clarity ---

// BaseStats interface matching PokedexEntry
interface BaseStats {
    hp: number;
    attack: number;
    defense: number;
    spAttack: number;
    spDefense: number;
    speed: number;
}

// Interface for the calculated stats object
interface CalculatedStats {
    hp: number;
    attack: number;
    defense: number;
    spAttack: number;
    spDefense: number;
    speed: number;
}

// --- Nature Data (Simplified) ---
// TODO: Load this from a dedicated data file or constants module
const NATURES: { [key: string]: Omit<Nature, 'id' | 'name'> } = {
    //               Increased      Decreased
    adamant:  { increasedStat: 'attack',   decreasedStat: 'spAttack' },
    modest:   { increasedStat: 'spAttack', decreasedStat: 'attack'   },
    jolly:    { increasedStat: 'speed',    decreasedStat: 'spAttack' },
    timid:    { increasedStat: 'speed',    decreasedStat: 'attack'   },
    bold:     { increasedStat: 'defense',  decreasedStat: 'attack'   },
    impish:   { increasedStat: 'defense',  decreasedStat: 'spAttack' },
    calm:     { increasedStat: 'spDefense',decreasedStat: 'attack'   },
    careful:  { increasedStat: 'spDefense',decreasedStat: 'spAttack' },
    // Neutral Natures (no effect)
    hardy:    { increasedStat: null,       decreasedStat: null       },
    docile:   { increasedStat: null,       decreasedStat: null       },
    serious:  { increasedStat: null,       decreasedStat: null       },
    bashful:  { increasedStat: null,       decreasedStat: null       },
    quirky:   { increasedStat: null,       decreasedStat: null       },
    // Add other 15 natures if needed
};

const natureIds = Object.keys(NATURES);

const DEFAULT_IVS = { hp: 15, attack: 15, defense: 15, spAttack: 15, spDefense: 15, speed: 15 };
const DEFAULT_EVS = { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 };
const DEFAULT_BASE_STATS: BaseStats = { hp: 50, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 };

// --- Stat Calculation Functions (Full Implementation) ---

/**
 * Calculates the Maximum HP for a Pokemon instance using the standard formula.
 * Formula: Floor(((2 * BaseStat + IV + Floor(EV / 4)) * Level) / 100) + Level + 10
 */
export function calculateMaxHp(
    instance: Pick<PokemonInstance, 'level' | 'ivs' | 'evs'>,
    baseStats: BaseStats | undefined // Base stats from PokedexEntry
): number {
    const bs = baseStats || DEFAULT_BASE_STATS; // Use default if not provided
    const iv = instance.ivs?.hp ?? DEFAULT_IVS.hp;
    const ev = instance.evs?.hp ?? DEFAULT_EVS.hp;
    const level = instance.level;

    // Shedinja case (always 1 HP) - requires pokedexId access if implemented
    // if (pokedexId === 'YXXX') return 1; 

    const calculatedHp = Math.floor(((2 * bs.hp + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
    return Math.max(1, calculatedHp); // Ensure HP is at least 1
}

/**
 * Calculates the battle stats (Attack, Defense, Sp. Attack, Sp. Defense, Speed)
 * for a Pokemon instance using the standard formula.
 * Formula: Floor((Floor(((2 * BaseStat + IV + Floor(EV / 4)) * Level) / 100) + 5) * NatureModifier)
 */
export function calculateStats(
    instance: Pick<PokemonInstance, 'level' | 'ivs' | 'evs' | 'natureId'>,
    baseStats: BaseStats | undefined // Base stats from PokedexEntry
): CalculatedStats {
    const bs = baseStats || DEFAULT_BASE_STATS;
    const ivs = instance.ivs || DEFAULT_IVS;
    const evs = instance.evs || DEFAULT_EVS;
    const level = instance.level;
    const natureInfo = NATURES[instance.natureId] || NATURES.hardy; // Default to neutral if nature not found

    const calculateSingleStat = (statName: keyof CalculatedStats): number => {
        // Special handling for HP as it uses a different formula and no nature modifier
        if (statName === "hp") {
            const calculatedHp = Math.floor(((2 * bs.hp + ivs.hp + Math.floor(evs.hp / 4)) * level) / 100) + level + 10;
            return Math.max(1, calculatedHp);
        }

        // Type assertion to ensure statName is a valid key for BaseStats, IVs, EVs
        const validStatName = statName as keyof Omit<CalculatedStats, 'hp'>; 
        const base = bs[validStatName];
        const iv = ivs[validStatName];
        const ev = evs[validStatName];

        let natureMultiplier = 1.0;
        // Type assertion for natureInfo properties
        if ((natureInfo.increasedStat as keyof CalculatedStats | null) === statName) {
            natureMultiplier = 1.1;
        } else if ((natureInfo.decreasedStat as keyof CalculatedStats | null) === statName) {
            natureMultiplier = 0.9;
        }

        const calculatedStat = Math.floor(
            (Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5) *
            natureMultiplier
        );
        return Math.max(1, calculatedStat); // Ensure stats are at least 1
    };

    return {
        hp: calculateSingleStat("hp"),
        attack: calculateSingleStat("attack"),
        defense: calculateSingleStat("defense"),
        spAttack: calculateSingleStat("spAttack"),
        spDefense: calculateSingleStat("spDefense"),
        speed: calculateSingleStat("speed"),
    };
}

/**
 * Calculates the experience needed for the next level.
 * NOTE: This still uses a placeholder formula (medium-fast growth).
 * TODO: Implement different experience growth curves based on Pokemon species.
 */
export function calculateXpToNextLevel(level: number): number {
    if (level >= 100) return 0; // Max level reached
    if (level <= 1) return 10; // Example base case
    // Using a simplified cubic formula similar to medium-fast group
    // Replace with actual lookup or more accurate formulas later
    // Formula: 0.8 * n^3 for medium fast
    const currentTotalXp = Math.floor(Math.pow(level, 3) * 0.8);
    const nextTotalXp = Math.floor(Math.pow(level + 1, 3) * 0.8);
    // Ensure xp needed is at least a minimum value
    return Math.max(10, nextTotalXp - currentTotalXp); 
}

// --- Instance Creation ---

const MIN_TOTAL_IV_SUM = 112; // 186 * 0.6 rounded up
const MAX_TOTAL_IV_SUM = 186; // 31 * 6

/** Generates random IVs (0-31) ensuring the total sum is within a specific range. */
function generateRandomIVs(): PokemonInstance['ivs'] {
    let ivs: PokemonInstance['ivs'];
    let sum = 0;
    const rand = () => Math.floor(Math.random() * 32);

    do {
        ivs = {
            hp: rand(),
            attack: rand(),
            defense: rand(),
            spAttack: rand(),
            spDefense: rand(),
            speed: rand()
        };
        sum = ivs.hp + ivs.attack + ivs.defense + ivs.spAttack + ivs.spDefense + ivs.speed;
    } while (sum < MIN_TOTAL_IV_SUM || sum > MAX_TOTAL_IV_SUM);

    return ivs;
}

/**
 * Creates a new Pokemon instance with randomized IVs (within sum constraints) and Nature.
 * Assumes default EVs (all 0).
 * Calculates initial stats and HP.
 * NOTE: This function is async because it needs to fetch Pokedex data.
 * @param pokedexId The Yudex ID of the Pokemon species.
 * @param level The desired level for the new instance.
 * @returns A Promise resolving to the newly created PokemonInstance or null if species data not found.
 */
export async function createPokemonInstance(
    pokedexId: string,
    level: number
): Promise<PokemonInstance | null> {
    // 1. Fetch Pokedex data to get base stats (and potentially ability, gender ratio later)
    const speciesData = await getPokemonSpeciesDetails(pokedexId);
    if (!speciesData) {
        console.error(`Pokedex data not found for ID: ${pokedexId}`);
        return null;
    }
    // Use the first form's stats as default if '一般' is missing or structure is different
    const statsEntry = speciesData.stats?.find((s) => s.form === "一般") ?? speciesData.stats?.[0];
    const baseStatsRaw = statsEntry?.data;

    if (!baseStatsRaw) {
        console.error(`Base stats data missing for Pokedex ID: ${speciesData.yudex_id}`);
        return null; // Cannot proceed without base stats
    }

    // Convert base stats from string to number
    const baseStats: BaseStats = {
        hp: parseInt(baseStatsRaw.hp, 10) || DEFAULT_BASE_STATS.hp,
        attack: parseInt(baseStatsRaw.attack, 10) || DEFAULT_BASE_STATS.attack,
        defense: parseInt(baseStatsRaw.defense, 10) || DEFAULT_BASE_STATS.defense,
        spAttack: parseInt(baseStatsRaw.sp_attack, 10) || DEFAULT_BASE_STATS.spAttack, // Use sp_attack
        spDefense: parseInt(baseStatsRaw.sp_defense, 10) || DEFAULT_BASE_STATS.spDefense, // Use sp_defense
        speed: parseInt(baseStatsRaw.speed, 10) || DEFAULT_BASE_STATS.speed,
    };

    // TODO: Get ability from speciesData when available
    const abilityId = "placeholder_ability"; // Placeholder
    // TODO: Determine gender based on speciesData.genderRatio when available
    const gender: PokemonInstance['gender'] = 'genderless'; // Placeholder

    // 2. Generate random elements
    const ivs = generateRandomIVs();
    const natureId = natureIds[Math.floor(Math.random() * natureIds.length)];
    const shiny = Math.random() < 1 / 4096; // Standard shiny rate

    // 3. Initialize instance skeleton
    let instance: Partial<PokemonInstance> & Pick<PokemonInstance, 'pokedexId' | 'level' | 'natureId' | 'ivs' | 'evs' | 'speciesName' | 'speciesDetails'> = {
        instanceId: uuidv4(), // Generate a unique ID
        pokedexId,
        speciesName: speciesData.name, // Add species name for convenience
        speciesDetails: speciesData, // Store full details
        nickname: null,
        level,
        ivs,
        evs: { ...DEFAULT_EVS }, // Start with 0 EVs
        natureId,
        moves: [], // No initial moves as requested, will be added later if needed
        abilityId,
        xp: 0, // TODO: Calculate minimum XP for the given level based on growth curve
        statusCondition: null, // Changed default to null
        gender,
        shiny,
        heldItemId: null,
    };

    // 4. Calculate stats based on the skeleton
    const calculatedStats = calculateStats(instance, baseStats);
    instance.calculatedStats = calculatedStats;
    instance.maxHp = calculatedStats.hp; // HP is now part of calculatedStats
    instance.currentHp = instance.maxHp; // Start with full HP
    instance.xpToNextLevel = calculateXpToNextLevel(instance.level as number);

    // 5. Return the complete instance (cast carefully)
    return instance as PokemonInstance;
}

// --- Level Up Logic ---

/**
 * Handles the logic when a Pokemon gains enough experience to level up.
 * @param instance The Pokemon instance that might level up.
 * @returns The updated Pokemon instance (or the original if no level up).
 *          The caller is responsible for updating the instance state.
 */
export function handleLevelUp(
    instance: PokemonInstance
): PokemonInstance {
    let didLevelUp = false;
    let newInstance = { ...instance }; // Create a mutable copy

    // Use speciesDetails stored in the instance
    const statsEntry = newInstance.speciesDetails.stats?.find((s: any) => s.form === "一般") ?? newInstance.speciesDetails.stats?.[0];
    const baseStatsRaw = statsEntry?.data;

    if (!baseStatsRaw) {
        console.error(`Base stats data missing for Pokedex ID: ${newInstance.pokedexId} during level up.`);
        return instance; // Return original instance if stats are missing
    }

    const baseStats: BaseStats = {
        hp: parseInt(baseStatsRaw.hp, 10) || DEFAULT_BASE_STATS.hp,
        attack: parseInt(baseStatsRaw.attack, 10) || DEFAULT_BASE_STATS.attack,
        defense: parseInt(baseStatsRaw.defense, 10) || DEFAULT_BASE_STATS.defense,
        spAttack: parseInt(baseStatsRaw.sp_attack, 10) || DEFAULT_BASE_STATS.spAttack,
        spDefense: parseInt(baseStatsRaw.sp_defense, 10) || DEFAULT_BASE_STATS.spDefense,
        speed: parseInt(baseStatsRaw.speed, 10) || DEFAULT_BASE_STATS.speed,
    };

    // Check for level up possibility (loop in case of multiple level ups)
    while (newInstance.level < 100 && newInstance.xp >= newInstance.xpToNextLevel) {
        didLevelUp = true;
        newInstance.xp -= newInstance.xpToNextLevel; // Subtract threshold
        newInstance.level += 1;
        newInstance.xpToNextLevel = calculateXpToNextLevel(newInstance.level);
        console.log(
            `${newInstance.nickname || `Pokemon ${newInstance.pokedexId}`} leveled up to ${newInstance.level}!`
        );
    }

    // If a level up occurred, recalculate stats and HP
    if (didLevelUp) {
        const oldMaxHp = newInstance.maxHp;
        newInstance.calculatedStats = calculateStats(newInstance, baseStats);
        newInstance.maxHp = newInstance.calculatedStats.hp; // HP is part of calculated stats
        // Increase current HP proportionally to max HP increase (common mechanic)
        const hpIncrease = newInstance.maxHp - oldMaxHp;
        if (newInstance.currentHp > 0) {
            // Don't revive fainted Pokemon
            newInstance.currentHp = Math.min(
                newInstance.maxHp,
                newInstance.currentHp + hpIncrease
            );
        }

        // TODO: Check for new moves learned at this level
        // TODO: Check for evolution triggers
    }

    return newInstance; // Return the potentially modified instance
} 