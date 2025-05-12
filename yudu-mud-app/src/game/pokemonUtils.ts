import { PokemonInstance, StatusCondition } from "@/interfaces/pokemon";
import { Nature, NATURES, StatName } from "../constants/natures"; // Corrected import path
import { PokedexEntry, getPokemonSpeciesDetails } from "@/lib/gameData"; // Removed getPokedexSummary as it's not used here
import { v4 as uuidv4 } from 'uuid'; // Added missing import

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
    const bs = baseStats || DEFAULT_BASE_STATS; 
    const iv = instance.ivs?.hp ?? DEFAULT_IVS.hp;
    const ev = instance.evs?.hp ?? DEFAULT_EVS.hp;
    const level = instance.level;

    const calculatedHp = Math.floor(((2 * bs.hp + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
    return Math.max(1, calculatedHp); 
}

export function calculateStats(
    instance: Pick<PokemonInstance, 'level' | 'ivs' | 'evs' | 'natureId'>,
    baseStats: BaseStats | undefined
): CalculatedStats {
    const bs = baseStats || DEFAULT_BASE_STATS;
    const ivs = instance.ivs || DEFAULT_IVS;
    const evs = instance.evs || DEFAULT_EVS;
    const level = instance.level;
    const currentNatureId = instance.natureId ? instance.natureId.toLowerCase() : 'hardy';
    const natureInfo = NATURES[currentNatureId] || NATURES.hardy;


    const calculateSingleStat = (statName: keyof CalculatedStats): number => {
        if (statName === "hp") {
            // Use calculateMaxHp for HP calculation
            return calculateMaxHp({ level, ivs, evs }, bs);
        }

        const validStatName = statName as Exclude<StatName, 'hp'>;
        // Ensure bs, ivs, evs have the validStatName property before accessing
        const base = bs[validStatName] ?? 0;
        const iv = ivs[validStatName] ?? 0;
        const ev = evs[validStatName] ?? 0;

        let natureMultiplier = 1.0;
        if (natureInfo.increased === validStatName) {
            natureMultiplier = 1.1;
        } else if (natureInfo.decreased === validStatName) {
            natureMultiplier = 0.9;
        }

        const calculatedStat = Math.floor(
            (Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5) *
            natureMultiplier
        );
        return Math.max(1, calculatedStat);
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

// Placeholder for determineGender - implement actual logic based on gender_ratio
function determineGender(genderRatio?: { male: number; female: number }): 'male' | 'female' | 'genderless' {
    if (!genderRatio || (genderRatio.male === 0 && genderRatio.female === 0)) {
        return 'genderless';
    }
    if (genderRatio.male === 1) return 'male';
    if (genderRatio.female === 1) return 'female';

    return Math.random() < (genderRatio.male / (genderRatio.male + genderRatio.female)) ? 'male' : 'female';
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
    const speciesData = await getPokemonSpeciesDetails(pokedexId);
    if (!speciesData) {
        console.error(`Pokedex data not found for ID: ${pokedexId}`);
        return null;
    }
    const statsEntry = speciesData.stats?.find((s) => s.form === "一般") ?? speciesData.stats?.[0];
    const baseStatsRaw = statsEntry?.data;

    if (!baseStatsRaw) {
        console.error(`Base stats data missing for Pokedex ID: ${speciesData.yudex_id}`);
        return null;
    }

    const baseStats: BaseStats = {
        hp: parseInt(baseStatsRaw.hp || "50", 10),
        attack: parseInt(baseStatsRaw.attack || "50", 10),
        defense: parseInt(baseStatsRaw.defense || "50", 10),
        // spAttack: parseInt(baseStatsRaw.spAttack || "50", 10), // Corrected property name
        // spDefense: parseInt(baseStatsRaw.spDefense || "50", 10), // Corrected property name
        spAttack: parseInt(baseStatsRaw.sp_attack || "50", 10),
        spDefense: parseInt(baseStatsRaw.sp_defense || "50", 10),
        speed: parseInt(baseStatsRaw.speed || "50", 10),
    };

    const ivs = generateRandomIVs();
    const natureKeys = Object.keys(NATURES);
    const randomNatureId = natureKeys[Math.floor(Math.random() * natureKeys.length)];

    // const initialInstance: Omit<PokemonInstance, 'calculatedStats' | 'currentHp' | 'xpToNextLevel' | 'speciesDetails'> & { speciesDetails?: PokedexEntry } = {
    const initialInstancePartial: Omit<PokemonInstance, 'name' | 'calculatedStats' | 'currentHp' | 'maxHp' | 'xpToNextLevel' | 'speciesDetails' | 'stats' | 'experience'> = {
        instanceId: uuidv4(),
        pokedexId: speciesData.yudex_id,
        // name: speciesData.name_cn || speciesData.name_en, // Removed 'name', use nickname or speciesName
        level,
        ivs,
        evs: { ...DEFAULT_EVS }, 
        natureId: randomNatureId,
        nickname: undefined,
        // ability: speciesData.abilities?.[0]?.name_cn || speciesData.abilities?.[0]?.name_en || "Unknown Ability", 
        ability: speciesData.abilities?.[0] || "Unknown Ability", // Abilities is string[]
        moves: [], 
        xp: 0, 
        statusCondition: undefined,
        heldItemId: undefined,
        shiny: Math.random() < 1 / 4096, 
        gender: determineGender(speciesData.gender_ratio),
    };
    
    const calculatedStats = calculateStats(initialInstancePartial, baseStats);
    const maxHp = calculatedStats.hp; // Max HP is the calculated HP stat
    const xpToNextLevel = calculateXpToNextLevel(level);

    const newInstance: PokemonInstance = {
        ...initialInstancePartial,
        // Add properties that were Omitted or need to be derived
        speciesName: speciesData.name_cn || speciesData.name_en, // Add speciesName
        stats: { // Map from BaseStats to PokemonInstance['stats']
            attack: baseStats.attack,
            defense: baseStats.defense,
            specialAttack: baseStats.spAttack, // Ensure mapping from sp_attack if needed elsewhere
            specialDefense: baseStats.spDefense, // Ensure mapping from sp_defense
            speed: baseStats.speed,
        },
        experience: initialInstancePartial.xp ?? 0, // Ensure experience is set
        calculatedStats,
        currentHp: maxHp, 
        maxHp, // Set maxHp
        xpToNextLevel,
        speciesDetails: speciesData,
    };

    return newInstance;
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

    // Ensure speciesDetails exists before proceeding
    if (!newInstance.speciesDetails?.stats?.length) {
        console.error(`Species details or stats missing for Pokedex ID: ${newInstance.pokedexId} during level up. Cannot process level up.`);
        return instance; // Return original instance
    }

    // Use speciesDetails stored in the instance
    // const statsEntry = newInstance.speciesDetails.stats?.find((s: any) => s.form === "一般") ?? newInstance.speciesDetails.stats?.[0];
    // Ensure s and s.data exist before accessing them
    const statsEntry = newInstance.speciesDetails.stats.find(s => s && s.form === "一般" && s.data) ?? newInstance.speciesDetails.stats.find(s => s && s.data); // Fallback to first available form with data

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

    // Initialize xp and xpToNextLevel if they are undefined
    newInstance.xp = newInstance.xp ?? 0;
    newInstance.experience = newInstance.xp; // Sync with experience
    if (newInstance.xpToNextLevel === undefined || newInstance.xpToNextLevel <= 0) {
        newInstance.xpToNextLevel = calculateXpToNextLevel(newInstance.level);
    }

    // Check for level up possibility (loop in case of multiple level ups)
    // while (newInstance.level < 100 && newInstance.xp >= newInstance.xpToNextLevel) {
    while (newInstance.level < 100 && (newInstance.xp ?? 0) >= (newInstance.xpToNextLevel ?? Infinity) && (newInstance.xpToNextLevel ?? 0) > 0) {
        didLevelUp = true;
        // newInstance.xp -= newInstance.xpToNextLevel; // Subtract threshold
        newInstance.xp = (newInstance.xp ?? 0) - (newInstance.xpToNextLevel ?? 0); 
        newInstance.experience = newInstance.xp; // Sync with experience
        newInstance.level += 1;
        newInstance.xpToNextLevel = calculateXpToNextLevel(newInstance.level);
        console.log(
            `${newInstance.nickname || newInstance.speciesName || `Pokemon ${newInstance.pokedexId}`} leveled up to ${newInstance.level}!`
        );
    }

    // If a level up occurred, recalculate stats and HP
    if (didLevelUp) {
        const oldMaxHp = newInstance.maxHp ?? 0;
        newInstance.calculatedStats = calculateStats(newInstance, baseStats);
        newInstance.maxHp = newInstance.calculatedStats.hp;
        
        const hpIncrease = newInstance.maxHp - oldMaxHp;
        if ((newInstance.currentHp ?? 0) > 0) {
            newInstance.currentHp = Math.min(
                newInstance.maxHp,
                (newInstance.currentHp ?? 0) + hpIncrease
            );
        } else if (newInstance.maxHp > 0 && oldMaxHp === 0) { // If it was fainted and now has HP
             newInstance.currentHp = newInstance.maxHp; // Revive to full HP (or adjust as per game logic)
        }
        newInstance.currentHp = Math.max(0, newInstance.currentHp ?? 0); // Ensure currentHp is not negative

        // TODO: Check for new moves learned at this level
        // TODO: Check for evolution triggers
    }

    return newInstance; // Return the potentially modified instance
}

/**
 * Recalculates the stats and HP of a Pokemon instance.
 * @param instance The Pokemon instance.
 * @returns The updated Pokemon instance.
 */
export function recalculateStatsAndHp(instance: PokemonInstance): PokemonInstance {
    if (!instance.speciesDetails?.stats || !instance.speciesDetails.stats.length) {
        console.warn("Cannot recalculate stats: speciesDetails or stats missing/empty for", instance.pokedexId);
        return instance;
    }
    // Ensure s.form and s.data exist before accessing them
    const baseStatsEntry = instance.speciesDetails.stats.find(s => s && s.form === "一般" && s.data) ?? instance.speciesDetails.stats[0];

    if (!baseStatsEntry?.data) {
        console.warn("Cannot recalculate stats: base stat data missing for form in", instance.pokedexId);
        return instance;
    }
    const baseStats: BaseStats = {
        hp: parseInt(baseStatsEntry.data.hp || "50", 10),
        attack: parseInt(baseStatsEntry.data.attack || "50", 10),
        defense: parseInt(baseStatsEntry.data.defense || "50", 10),
        spAttack: parseInt(baseStatsEntry.data.sp_attack || "50", 10),
        spDefense: parseInt(baseStatsEntry.data.sp_defense || "50", 10),
        speed: parseInt(baseStatsEntry.data.speed || "50", 10),
    };

    const oldMaxHp = instance.calculatedStats?.hp ?? instance.currentHp ?? 0;
    instance.calculatedStats = calculateStats(instance, baseStats);
    instance.maxHp = instance.calculatedStats.hp;

    if (instance.calculatedStats.hp !== oldMaxHp && oldMaxHp > 0) {
        const hpRatio = (instance.currentHp ?? 0) / oldMaxHp;
        instance.currentHp = Math.round(instance.calculatedStats.hp * hpRatio);
    } else if (oldMaxHp === 0 && instance.calculatedStats.hp > 0) {
        instance.currentHp = instance.calculatedStats.hp;
    } else if (instance.currentHp === undefined || instance.currentHp > instance.calculatedStats.hp) {
        // If currentHp was undefined or somehow greater than new max, set to max
        instance.currentHp = instance.calculatedStats.hp;
    }
    instance.currentHp = Math.max(0, Math.min(instance.currentHp ?? 0, instance.calculatedStats.hp));
    instance.xpToNextLevel = calculateXpToNextLevel(instance.level);
    return instance;
}

/**
 * Adds experience points to a Pokemon instance and handles level-ups.
 * @param instance The Pokemon instance.
 * @param amount The amount of XP to add.
 * @returns The updated Pokemon instance.
 */
export function addExperience(instance: PokemonInstance, amount: number): PokemonInstance {
    if (instance.level >= 100) return instance;

    instance.xp = (instance.xp ?? 0) + amount;
    instance.experience = instance.xp; // Sync experience and xp

    // Ensure xpToNextLevel is initialized before the loop
    if (instance.xpToNextLevel === undefined) {
        instance.xpToNextLevel = calculateXpToNextLevel(instance.level);
    }

    let leveledUp = false;
    // Loop for level-ups
    // Condition: level < 100 AND current XP is sufficient for next level AND xpToNextLevel is a valid number > 0
    while (
        instance.level < 100 && 
        instance.xpToNextLevel != null && // Ensure it's not null/undefined
        instance.xpToNextLevel > 0 &&    // Ensure it's a positive number to avoid infinite loop if 0
        (instance.xp ?? 0) >= instance.xpToNextLevel
    ) {
        instance.xp = (instance.xp ?? 0) - instance.xpToNextLevel; // Subtract threshold
        instance.experience = instance.xp; // Sync
        instance.level++;
        leveledUp = true;
        // Immediately recalculate xpToNextLevel for the new level for the next iteration
        instance.xpToNextLevel = calculateXpToNextLevel(instance.level);
    }

    if (leveledUp) {
        if (instance.speciesDetails) {
            // Recalculate stats and HP. xpToNextLevel is already updated for the current new level.
            return recalculateStatsAndHp(instance);
        } else {
            console.warn("Cannot recalculate stats after level up: speciesDetails missing for", instance.pokedexId);
            // xpToNextLevel is already set for the new level from the loop
        }
    } else if (instance.xpToNextLevel === undefined || instance.xpToNextLevel <= 0) {
        // If no level up, but xpToNextLevel was invalid or not set, recalculate it.
        // This can happen if initial xpToNextLevel was 0 (e.g. for level 100) or became invalid.
        instance.xpToNextLevel = calculateXpToNextLevel(instance.level);
    }

    return instance;
}