import { PokemonInstance } from '@/interfaces/pokemon';

// Type definition for stat keys affected by natures
export type StatName = keyof PokemonInstance['calculatedStats']; // 'attack' | 'defense' | 'spAttack' | 'spDefense' | 'speed'

export interface Nature {
    id: string;             // Lowercase ID, e.g., 'adamant'
    name: string;           // Display name, e.g., 'Adamant'
    increased: StatName | null; // Stat that gets +10%
    decreased: StatName | null; // Stat that gets -10%
}

// Complete list of Natures and their effects
export const NATURES: { [key: string]: Nature } = {
    // Stat Increasing Natures
    lonely:   { id: 'lonely',   name: 'Lonely',   increased: 'attack',    decreased: 'defense' },
    adamant:  { id: 'adamant',  name: 'Adamant',  increased: 'attack',    decreased: 'spAttack' },
    naughty:  { id: 'naughty',  name: 'Naughty',  increased: 'attack',    decreased: 'spDefense' },
    brave:    { id: 'brave',    name: 'Brave',    increased: 'attack',    decreased: 'speed' },

    bold:     { id: 'bold',     name: 'Bold',     increased: 'defense',   decreased: 'attack' },
    impish:   { id: 'impish',   name: 'Impish',   increased: 'defense',   decreased: 'spAttack' },
    lax:      { id: 'lax',      name: 'Lax',      increased: 'defense',   decreased: 'spDefense' },
    relaxed:  { id: 'relaxed',  name: 'Relaxed',  increased: 'defense',   decreased: 'speed' },

    modest:   { id: 'modest',   name: 'Modest',   increased: 'spAttack',  decreased: 'attack' },
    mild:     { id: 'mild',     name: 'Mild',     increased: 'spAttack',  decreased: 'defense' },
    rash:     { id: 'rash',     name: 'Rash',     increased: 'spAttack',  decreased: 'spDefense' },
    quiet:    { id: 'quiet',    name: 'Quiet',    increased: 'spAttack',  decreased: 'speed' },

    calm:     { id: 'calm',     name: 'Calm',     increased: 'spDefense', decreased: 'attack' },
    gentle:   { id: 'gentle',   name: 'Gentle',   increased: 'spDefense', decreased: 'defense' },
    careful:  { id: 'careful',  name: 'Careful',  increased: 'spDefense', decreased: 'spAttack' },
    sassy:    { id: 'sassy',    name: 'Sassy',    increased: 'spDefense', decreased: 'speed' },

    timid:    { id: 'timid',    name: 'Timid',    increased: 'speed',     decreased: 'attack' },
    hasty:    { id: 'hasty',    name: 'Hasty',    increased: 'speed',     decreased: 'defense' },
    jolly:    { id: 'jolly',    name: 'Jolly',    increased: 'speed',     decreased: 'spAttack' },
    naive:    { id: 'naive',    name: 'Naive',    increased: 'speed',     decreased: 'spDefense' },

    // Neutral Natures
    hardy:    { id: 'hardy',    name: 'Hardy',    increased: null, decreased: null },
    docile:   { id: 'docile',   name: 'Docile',   increased: null, decreased: null },
    serious:  { id: 'serious',  name: 'Serious',  increased: null, decreased: null },
    bashful:  { id: 'bashful',  name: 'Bashful',  increased: null, decreased: null },
    quirky:   { id: 'quirky',   name: 'Quirky',   increased: null, decreased: null },
};

/**
 * Gets the nature modifier for a specific stat based on the nature ID.
 * @param natureId The ID of the nature (e.g., 'adamant').
 * @param stat The stat to check ('attack', 'defense', 'spAttack', 'spDefense', 'speed').
 * @returns 1.1 if increased, 0.9 if decreased, 1.0 otherwise.
 */
export function getNatureModifier(natureId: string, stat: StatName): number {
    const nature = NATURES[natureId.toLowerCase()];
    if (!nature) return 1.0; // Unknown nature, assume neutral
    if (nature.increased === stat) return 1.1;
    if (nature.decreased === stat) return 0.9;
    return 1.0;
} 