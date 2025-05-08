import type { NextApiRequest, NextApiResponse } from 'next';
import { getPokedexSummary, getMoves, getAbilities } from '@/lib/gameData'; // 确认 @/ 指向 src 目录，否则调整路径，例如 ../../src/lib/gameData
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
  paths?: { cwd: string, env: string };
  fileExists?: { [key: string]: boolean };
};

/**
 * 测试文件是否存在于指定路径
 */
async function checkFileExists(relativePath: string): Promise<boolean> {
  const possiblePaths = [
    path.join(process.cwd(), '..', 'data', relativePath),     // 上级目录
    path.join(process.cwd(), 'data', relativePath),           // 当前目录
    path.join(process.cwd(), '..', '..', 'data', relativePath) // 上两级目录
  ];

  for (const fullPath of possiblePaths) {
    try {
      await fs.access(fullPath);
      console.log(`File exists at: ${fullPath}`);
      return true;
    } catch (error) {
      // 此路径不存在，继续尝试下一个
    }
  }
  
  console.log(`File not found: ${relativePath}`);
  return false;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  console.log('Received request for /api/test-data');
  try {
    // 添加一些调试信息
    const processInfo = {
      cwd: process.cwd(),
      env: process.env.NODE_ENV
    };
    console.log('Process info:', processInfo);

    // 检查关键文件是否存在
    const fileExistsResults = {
      'yudu_pokedex.json': await checkFileExists('yudu_pokedex.json'),
      'move_list.json': await checkFileExists('move_list.json'),
      'ability_list.json': await checkFileExists('ability_list.json'),
      'move目录': await checkFileExists('move')
    };
    console.log('File existence check results:', fileExistsResults);

    // 同时加载所有数据
    console.log('Attempting to load game data...');
    
    // 分别加载数据以便于调试
    console.log('Loading Pokedex summary...');
    const pokedex = await getPokedexSummary();
    console.log('Pokedex summary loaded:', Array.isArray(pokedex) ? `Array of ${pokedex.length} items` : typeof pokedex);
    
    console.log('Loading Moves...');
    const moves = await getMoves();
    console.log('Moves loaded:', moves instanceof Map ? `Map with ${moves.size} items` : typeof moves);
    
    console.log('Loading Abilities...');
    const abilities = await getAbilities();
    console.log('Abilities loaded:', Array.isArray(abilities) ? `Array of ${abilities.length} items` : typeof abilities);
    
    console.log('Game data loaded successfully');

    // 将 Map 对象转换为数组以便于序列化
    const movesArray = moves instanceof Map ? Array.from(moves.values()) : [];

    // 返回加载的数据量和样本数据进行验证
    res.status(200).json({
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
    console.error('API Error loading game data in /api/test-data:', error);
    res.status(500).json({ 
      message: 'Failed to load game data', 
      error: error.message,
      paths: {
        cwd: process.cwd(),
        env: process.env.NODE_ENV || 'unknown'
      }
    });
  }
} 