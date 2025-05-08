import { NextApiRequest, NextApiResponse } from 'next';
import { startBattle, processTurn } from '../../src/game/battleManager';
import { createPokemonInstance } from '../../src/game/pokemonManager';
import { getPokemonSpeciesDetails } from '../../src/lib/gameData';

/**
 * Simple API route to test the battle system
 * Example usage: GET /api/test-battle
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Step 1: Create a player Pokemon
    const playerPokemon = await createPokemonInstance('Y0001', 5); // Assuming Y0001 is a valid ID
    if (!playerPokemon) {
      return res.status(500).json({ error: 'Failed to create player Pokemon' });
    }
    
    // Step 2: Create a wild Pokemon
    const wildPokemon = await createPokemonInstance('Y0004', 3); // Assuming Y0004 is another valid ID
    if (!wildPokemon) {
      return res.status(500).json({ error: 'Failed to create wild Pokemon' });
    }
    
    // Step 3: Start a battle
    const battleState = await startBattle(
      'player123', // Player ID
      'Trainer Red', // Player name
      [playerPokemon], // Player party
      wildPokemon // Wild Pokemon
    );
    
    // Step 4: Simulate one turn with a FIGHT action
    const updatedState = await processTurn(
      battleState,
      { type: 'FIGHT', moveId: playerPokemon.moves[0]?.name || '' }, // Player uses first move
      { type: 'FIGHT', moveId: wildPokemon.moves[0]?.name || '' } // Wild Pokemon uses first move
    );
    
    // Return the results
    return res.status(200).json({
      initialState: battleState,
      afterOneTurn: updatedState,
      playerPokemon: {
        id: playerPokemon.pokedexId,
        name: playerPokemon.speciesName,
        level: playerPokemon.level,
        hp: `${playerPokemon.currentHp}/${playerPokemon.maxHp}`,
        moves: playerPokemon.moves.map(m => m.name)
      },
      wildPokemon: {
        id: wildPokemon.pokedexId,
        name: wildPokemon.speciesName,
        level: wildPokemon.level,
        hp: `${wildPokemon.currentHp}/${wildPokemon.maxHp}`,
        moves: wildPokemon.moves.map(m => m.name)
      }
    });
    
  } catch (error) {
    console.error('Error in battle test:', error);
    return res.status(500).json({ 
      error: 'An error occurred during the battle test',
      details: error instanceof Error ? error.message : String(error)
    });
  }
} 