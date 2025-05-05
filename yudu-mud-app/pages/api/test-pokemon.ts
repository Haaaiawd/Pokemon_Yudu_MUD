import type { NextApiRequest, NextApiResponse } from 'next';
import { createPokemonInstance } from '@/game/pokemonManager';
import { PokemonInstance } from '@/interfaces/pokemon';

interface TestResponse {
  message: string;
  pokemon?: PokemonInstance | null;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TestResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const pokedexId = 'Y0001'; // Corrected ID for Bulbasaur
  const level = 5;

  console.log(`[test-pokemon] Attempting to create level ${level} ${pokedexId}...`);

  try {
    const pokemonInstance = await createPokemonInstance(pokedexId, level, {
        // Optional: Override defaults if needed for specific tests
        // natureId: 'adamant', 
        // ivs: { hp: 31, attack: 31, defense: 31, spAttack: 31, spDefense: 31, speed: 31 },
    });

    if (pokemonInstance) {
      console.log(`[test-pokemon] Successfully created:`, pokemonInstance);
      res.status(200).json({ 
        message: `Successfully created level ${level} ${pokemonInstance.pokedexId} (${pokemonInstance.natureId} nature).`, 
        pokemon: pokemonInstance 
      });
    } else {
      console.error(`[test-pokemon] Failed to create Pokemon instance.`);
      res.status(500).json({ message: `Failed to create Pokemon instance for ${pokedexId}.`, error: 'Instance creation returned null.' });
    }
  } catch (error: any) {
    console.error('[test-pokemon] Error during instance creation:', error);
    res.status(500).json({ message: 'Error creating Pokemon instance.', error: error.message });
  }
} 