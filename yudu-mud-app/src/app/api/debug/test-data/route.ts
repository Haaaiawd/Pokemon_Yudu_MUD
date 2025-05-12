import { NextResponse, NextRequest } from 'next/server';
import { getPokedexSummary, getMoves, getAbilities } from '@/lib/gameData';
import fs from 'fs/promises';
import path from 'path';

type Data = {
  message?: string;
  error?: string;
  pokedexCount?: number;
  moveCount?: number;
  abilityCount?: number;
  samplePokedex?: any[];
  sampleMoves?: any[];
  sampleAbilities?: any[];
  paths?: { cwd: string, env: string | undefined };
  fileExists?: { [key: string]: boolean };
};

async function checkFileExists(relativePath: string): Promise<boolean> {
  const possiblePaths = [
    path.join(process.cwd(), 'data', relativePath), // For Vercel deployment and local `next dev` from project root
    path.join(process.cwd(), '../data', relativePath), // Potentially for local, if CWD is `yudu-mud-app`
    path.join(process.cwd(), '../../data', relativePath) // Less likely, but for deeper CWD
  ];

  for (const fullPath of possiblePaths) {
    try {
      await fs.access(fullPath);
      console.log(`File exists at: ${fullPath}`);
      return true;
    } catch (error) {
      // Not found at this path
    }
  }
  
  console.log(`File not found: ${relativePath} (checked paths: ${possiblePaths.join(', ')})`);
  return false;
}

export async function GET(req: NextRequest): Promise<NextResponse<Data>> {
  console.log('Received request for /api/debug/test-data');
  try {
    const processInfo = {
      cwd: process.cwd(),
      env: process.env.NODE_ENV
    };
    console.log('Process info:', processInfo);

    const fileExistsResults = {
      'yudu_pokedex.json': await checkFileExists('yudu_pokedex.json'),
      'move_list.json': await checkFileExists('move_list.json'),
      'ability_list.json': await checkFileExists('ability_list.json'),
      'move目录': await checkFileExists('move') // Check for the directory itself
    };
    console.log('File existence check results:', fileExistsResults);

    console.log('Attempting to load game data...');
    
    console.log('Loading Pokedex summary...');
    const pokedex = await getPokedexSummary();
    console.log('Pokedex summary loaded:', Array.isArray(pokedex) ? `Array of ${pokedex.length} items` : typeof pokedex);
    
    console.log('Loading Moves...');
    const moves = await getMoves(); // Returns a Map
    console.log('Moves loaded:', moves instanceof Map ? `Map with ${moves.size} items` : typeof moves);
    
    console.log('Loading Abilities...');
    const abilities = await getAbilities(); // Returns an Array
    console.log('Abilities loaded:', Array.isArray(abilities) ? `Array of ${abilities.length} items` : typeof abilities);
    
    console.log('Game data loaded successfully');

    const movesArray = moves instanceof Map ? Array.from(moves.values()) : [];

    return NextResponse.json({
      message: 'Data loaded successfully!',
      pokedexCount: Array.isArray(pokedex) ? pokedex.length : 0,
      moveCount: moves instanceof Map ? moves.size : 0,
      abilityCount: Array.isArray(abilities) ? abilities.length : 0,
      samplePokedex: Array.isArray(pokedex) ? pokedex.slice(0, 2) : [],
      sampleMoves: movesArray.slice(0, 2),
      sampleAbilities: Array.isArray(abilities) ? abilities.slice(0, 2) : [],
      paths: processInfo,
      fileExists: fileExistsResults
    });
  } catch (error: any) {
    console.error('API Error loading game data in /api/debug/test-data:', error);
    return NextResponse.json({ 
      message: 'Failed to load game data', 
      error: error.message,
      paths: {
        cwd: process.cwd(),
        env: process.env.NODE_ENV
      }
    }, { status: 500 });
  }
}
