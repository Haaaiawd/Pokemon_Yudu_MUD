import { NextResponse, NextRequest } from 'next/server';
import { startBattle, processTurn } from '@/game/battleManager';
import { createPokemonInstance } from '@/game/pokemonManager';
// getPokemonSpeciesDetails is not directly used here, but createPokemonInstance might use it or similar functions from gameData
// import { getPokemonSpeciesDetails } from '@/lib/gameData';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Step 1: Create a player Pokemon
    const playerPokemon = await createPokemonInstance('Y0001', 5); // Assuming Y0001 is a valid ID
    if (!playerPokemon) {
      return NextResponse.json({ error: 'Failed to create player Pokemon' }, { status: 500 });
    }

    // Step 2: Create a wild Pokemon
    const wildPokemon = await createPokemonInstance('Y0004', 3); // Assuming Y0004 is another valid ID
    if (!wildPokemon) {
      return NextResponse.json({ error: 'Failed to create wild Pokemon' }, { status: 500 });
    }

    // Step 3: Start a battle
    const battleState = await startBattle(
      'player123', // Player ID
      'Trainer Red', // Player name
      [playerPokemon], // Player party
      wildPokemon // Wild Pokemon
    );

    // Step 4: Simulate one turn with a FIGHT action
    const playerMoveItem = playerPokemon.moves[0];
    const playerMoveName = playerMoveItem ? (typeof playerMoveItem === 'string' ? playerMoveItem : playerMoveItem.name) : undefined;

    const wildMoveItem = wildPokemon.moves[0];
    const wildPokemonMoveName = wildMoveItem ? (typeof wildMoveItem === 'string' ? wildMoveItem : wildMoveItem.name) : undefined;

    if (!playerMoveName) {
      return NextResponse.json({ error: 'Player Pokemon has no moves to use!' }, { status: 500 });
    }
    if (!wildPokemonMoveName) {
      // Wild Pokemon might not always have a move if generation is flawed, or it could be intentional (e.g. Splash)
      // For a test, we might want to ensure it has a usable move or handle this case gracefully.
      console.warn('Wild Pokemon has no moves or first move is undefined. Battle might not proceed as expected.');
      // Depending on strictness, you might return an error or let the battle proceed (processTurn should handle it)
    }

    const updatedState = await processTurn(
      battleState,
      { type: 'FIGHT', moveId: playerMoveName }, // Player uses first move
      { type: 'FIGHT', moveId: wildPokemonMoveName || 'Struggle' } // Wild Pokemon uses first move, or Struggle if no move
    );

    // Return the results
    return NextResponse.json({
      initialState: battleState,
      afterOneTurn: updatedState,
      playerPokemon: {
        id: playerPokemon.pokedexId,
        name: playerPokemon.speciesName,
        level: playerPokemon.level,
        hp: `${playerPokemon.currentHp}/${playerPokemon.maxHp}`,
        moves: playerPokemon.moves.map(m => typeof m === 'string' ? m : m.name)
      },
      wildPokemon: {
        id: wildPokemon.pokedexId,
        name: wildPokemon.speciesName,
        level: wildPokemon.level,
        hp: `${wildPokemon.currentHp}/${wildPokemon.maxHp}`,
        moves: wildPokemon.moves.map(m => typeof m === 'string' ? m : m.name)
      }
    });

  } catch (error) {
    console.error('Error in battle test API route:', error);
    return NextResponse.json({
      error: 'An error occurred during the battle test',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
