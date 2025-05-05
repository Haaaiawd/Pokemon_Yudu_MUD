// Defines different experience growth rates for Pokemon
export type ExperienceGroup = 
    | 'fast' 
    | 'medium_fast' 
    | 'medium_slow' 
    | 'slow'
    // | 'erratic' // More complex, add later if needed
    // | 'fluctuating' // More complex, add later if needed

/**
 * Calculates the total experience points required to reach a specific level 
 * for a given experience group.
 * Formulas based on Bulbapedia: https://bulbapedia.bulbagarden.net/wiki/Experience
 *
 * @param group The experience group of the Pokemon.
 * @param level The target level (1-100).
 * @returns The total experience points needed to reach that level.
 */
export function getTotalExperienceForLevel(group: ExperienceGroup, level: number): number {
    if (level <= 1) {
        return 0; // Level 1 requires 0 total XP
    }
    if (level > 100) {
        level = 100; // Cap at level 100
    }

    const n = level;
    let totalXp = 0;

    switch (group) {
        case 'fast':
            totalXp = Math.floor((4 * Math.pow(n, 3)) / 5);
            break;
        case 'medium_fast':
            totalXp = Math.floor(Math.pow(n, 3));
            break;
        case 'medium_slow':
            // Formula: (6/5)n^3 - 15n^2 + 100n - 140
            totalXp = Math.floor((6/5 * Math.pow(n, 3)) - (15 * Math.pow(n, 2)) + (100 * n) - 140);
            break;
        case 'slow':
            totalXp = Math.floor((5 * Math.pow(n, 3)) / 4);
            break;
        // Add Erratic and Fluctuating later if needed
        default:
            console.warn(`Unknown experience group: ${group}. Defaulting to medium_fast.`);
            totalXp = Math.floor(Math.pow(n, 3)); // Default to Medium Fast
            break;
    }

    // Ensure XP is not negative, especially for Medium Slow at low levels
    return Math.max(0, totalXp);
}

/**
 * Gets the name of the experience group associated with a Pokedex ID.
 * TODO: This information should ideally be part of the PokedexEntry data loaded from files.
 * For now, provides some examples or defaults to medium_fast.
 *
 * @param pokedexId The Yudex ID (e.g., "Y0001").
 * @returns The experience group name.
 */
export function getExperienceGroupForPokemon(pokedexId: string): ExperienceGroup {
    // Placeholder - Replace with actual data loading logic
    // Example based on common Pokemon:
    if (['Y0001', 'Y0004', 'Y0007'].includes(pokedexId)) return 'medium_slow'; // Starters often Medium Slow
    if (['Y0010'].includes(pokedexId)) return 'medium_fast'; // Pikachu often Medium Fast
    if (['Y0018'].includes(pokedexId)) return 'slow'; // Magikarp often Slow
    // Add more specific cases or load from data

    return 'medium_fast'; // Default group if not specified
} 