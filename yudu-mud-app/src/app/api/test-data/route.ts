import { NextResponse } from 'next/server';
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

/**
 * 测试文件是否存在于指定路径
 */
async function checkFileExists(relativePath: string): Promise<boolean> {
  // 在 App Router 中，process.cwd() 仍然是项目根目录
  // 但为了保险起见，我们优先检查相对于 src/app 的路径，然后再是项目根目录下的 data
  const possiblePaths = [
    path.join(process.cwd(), 'data', relativePath),           // 项目根目录/data
    path.join(process.cwd(), '..', 'data', relativePath),     // 如果在 src/app/api/test-data 下，则 ../../data
                                                              // 但 gameData.ts 已经是 ../data, ../../data, ../../../data
                                                              // 为了与 gameData.ts 的逻辑保持一致，我们直接使用它的方式
    path.join(process.cwd(), '..', 'data', relativePath), 
    path.join(process.cwd(), '..', '..', 'data', relativePath)
  ];
  
  // 优先使用 gameData.ts 中的 getDataPath 逻辑来定位文件，因为它更健壮
  // 这里为了简化，暂时保留原有 checkFileExists，但理想情况下应统一
  // 或者直接依赖 gameData.ts 内部的文件检查

  for (const fullPath of possiblePaths) {
    try {
      await fs.access(fullPath);
      console.log(`File exists at: ${fullPath} (checked by route handler)`);
      return true;
    } catch (error) {
      // 此路径不存在，继续尝试下一个
    }
  }
  
  console.log(`File not found: ${relativePath} (checked by route handler)`);
  return false;
}

export async function GET(request: Request) {
  console.log('Received GET request for /api/test-data (App Router)');
  try {
    const processInfo = {
      cwd: process.cwd(),
      env: process.env.NODE_ENV
    };
    console.log('Process info (App Router):', processInfo);

    const fileExistsResults = {
      'yudu_pokedex.json': await checkFileExists('yudu_pokedex.json'),
      'move_list.json': await checkFileExists('move_list.json'),
      'ability_list.json': await checkFileExists('ability_list.json'),
      'move目录': await checkFileExists('move')
    };
    console.log('File existence check results (App Router):', fileExistsResults);

    console.log('Attempting to load game data (App Router)...');
    
    const pokedex = await getPokedexSummary();
    const moves = await getMoves();
    const abilities = await getAbilities();
    
    console.log('Game data loaded successfully (App Router)');

    const movesArray = moves instanceof Map ? Array.from(moves.values()) : [];

    const responseData: Data = {
      message: 'Data loaded successfully! (App Router)',
      pokedexCount: Array.isArray(pokedex) ? pokedex.length : 0,
      moveCount: moves instanceof Map ? moves.size : 0,
      abilityCount: Array.isArray(abilities) ? abilities.length : 0,
      samplePokedex: Array.isArray(pokedex) ? pokedex.slice(0, 2) : [],
      sampleMoves: movesArray.slice(0, 2),
      sampleAbilities: Array.isArray(abilities) ? abilities.slice(0, 2) : [],
      paths: processInfo,
      fileExists: fileExistsResults
    };
    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('API Error loading game data in /api/test-data (App Router):', error);
    const errorResponse: Data = { 
      message: 'Failed to load game data (App Router)', 
      error: error.message,
      paths: {
        cwd: process.cwd(),
        env: process.env.NODE_ENV || 'unknown'
      }
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
