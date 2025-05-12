import { NextResponse, NextRequest } from 'next/server';
import { createPokemonInstance } from '@/game/pokemonManager';
import { PokemonInstance } from '@/interfaces/pokemon';

interface TestResponse {
  message: string;
  pokemon?: PokemonInstance | null;
  error?: string;
}

export async function GET(req: NextRequest): Promise<NextResponse<TestResponse>> {
  // Example: /api/debug/pokemon-data?pokedexId=Y0001&level=5
  const searchParams = req.nextUrl.searchParams;
  const pokedexIdParam = searchParams.get('pokedexId');
  const levelParam = searchParams.get('level');

  const pokedexId = pokedexIdParam || 'Y0001'; // Default to Bulbasaur if not provided
  const level = levelParam ? parseInt(levelParam) : 5; // Default to level 5

  if (isNaN(level) || level <= 0) {
    return NextResponse.json({ message: 'Invalid level parameter', error: 'Level must be a positive number.' }, { status: 400 });
  }

  console.log(`[api/debug/pokemon-data] Attempting to create level ${level} ${pokedexId}...`);

  try {
    const pokemonInstance = await createPokemonInstance(pokedexId, level, {
        // Optional: Override defaults if needed for specific tests
        // natureId: 'adamant', 
        // ivs: { hp: 31, attack: 31, defense: 31, spAttack: 31, spDefense: 31, speed: 31 },
    });

    if (pokemonInstance) {
      console.log(`[api/debug/pokemon-data] Successfully created:`, pokemonInstance);
      return NextResponse.json({ 
        message: `Successfully created level ${level} ${pokemonInstance.pokedexId} (${pokemonInstance.natureId} nature).`, 
        pokemon: pokemonInstance 
      });
    } else {
      console.error(`[api/debug/pokemon-data] Failed to create Pokemon instance for ${pokedexId}.`);
      return NextResponse.json({ message: `Failed to create Pokemon instance for ${pokedexId}.`, error: 'Instance creation returned null.' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[api/debug/pokemon-data] Error during instance creation:', error);
    return NextResponse.json({ message: 'Error creating Pokemon instance.', error: error.message }, { status: 500 });
  }
}
