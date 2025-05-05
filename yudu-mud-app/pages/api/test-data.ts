import type { NextApiRequest, NextApiResponse } from 'next';
import { getPokedex, getMoves, getAbilities } from '@/lib/gameData'; // 确认 @/ 指向 src 目录，否则调整路径，例如 ../../src/lib/gameData

type Data = {
  message?: string;
  error?: string;
  pokedexCount?: number;
  movesLoaded?: boolean;
  abilitiesLoaded?: boolean;
  samplePokedex?: any[];
  sampleMoves?: any[];
  sampleAbilities?: any[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  console.log('Received request for /api/test-data');
  try {
    // 同时加载所有数据
    console.log('Attempting to load game data...');
    const [pokedex, moves, abilities] = await Promise.all([
      getPokedex(),
      getMoves(),
      getAbilities(),
    ]);
    console.log('Game data loaded successfully via Promise.all');

    // 简单检查数据是否是数组且有内容 (可以根据需要添加更严格的检查)
    const isPokedexArray = Array.isArray(pokedex);
    const isMovesArray = Array.isArray(moves);
    const isAbilitiesArray = Array.isArray(abilities);

    // 返回加载的数据量或少量样本数据进行验证
    res.status(200).json({
      message: 'Data loaded successfully!',
      pokedexCount: isPokedexArray ? pokedex.length : undefined,
      movesLoaded: isMovesArray && moves.length > 0,
      abilitiesLoaded: isAbilitiesArray && abilities.length > 0,
      // samplePokedex: isPokedexArray ? pokedex.slice(0, 3) : [], // 取消注释以查看样本
      // sampleMoves: isMovesArray ? moves.slice(0, 3) : [],       // 取消注释以查看样本
      // sampleAbilities: isAbilitiesArray ? abilities.slice(0, 3) : [], // 取消注释以查看样本
    });
  } catch (error: any) {
    console.error('API Error loading game data in /api/test-data:', error);
    res.status(500).json({ message: 'Failed to load game data', error: error.message });
  }
} 