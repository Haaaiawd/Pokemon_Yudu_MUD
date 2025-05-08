import { PokemonInstance } from '@/interfaces/pokemon';
import { createPokemonInstance } from './pokemonManager';
import fs from 'fs/promises';
import path from 'path';

// 定义遭遇配置的接口
export interface WildPokemonData {
  pokedexId: string;
  levelRange: [number, number]; // [最小等级, 最大等级]
  weight: number; // 权重，用于决定出现概率
}

export interface LocationEncounter {
  locationId: string;
  encounterRate: number; // 0-1之间的遭遇率
  wildPokemon: WildPokemonData[];
}

// 全局遭遇数据
let encounterData: LocationEncounter[] = [];

// 加载遭遇数据
export async function loadEncounterData(): Promise<void> {
  try {
    // 从JSON文件加载数据
    const fullPath = path.join(process.cwd(), '..', 'data', 'encounters.json');
    console.log(`Attempting to load encounter data from: ${fullPath}`);
    
    const fileContent = await fs.readFile(fullPath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    // 确保数据格式正确
    if (data && data.encounter_locations && Array.isArray(data.encounter_locations)) {
      encounterData = data.encounter_locations;
      console.log(`Successfully loaded encounter data: ${encounterData.length} locations`);
    } else {
      console.warn("Encounter data format is invalid, using default data");
      // 使用默认硬编码数据
      encounterData = [
        {
          locationId: "route_yr01_start",
          encounterRate: 0.15,
          wildPokemon: [
            { pokedexId: "Y0004", levelRange: [3, 5], weight: 45 },
            { pokedexId: "Y0007", levelRange: [2, 4], weight: 35 }
          ]
        }
      ];
    }
  } catch (error) {
    console.error("Failed to load encounter data:", error);
    // 设置默认数据
    encounterData = [
      {
        locationId: "route_yr01_start",
        encounterRate: 0.15,
        wildPokemon: [
          { pokedexId: "Y0004", levelRange: [3, 5], weight: 45 },
          { pokedexId: "Y0007", levelRange: [2, 4], weight: 35 }
        ]
      }
    ];
  }
}

// 获取地点的遭遇配置
export function getLocationEncounter(locationId: string): LocationEncounter | undefined {
  return encounterData.find(entry => entry.locationId === locationId);
}

// 查看地点可能出现的宝可梦
export function getPotentialWildPokemon(locationId: string): WildPokemonData[] {
  const encounter = getLocationEncounter(locationId);
  return encounter?.wildPokemon || [];
}

// 决定是否触发遭遇
export function shouldEncounterWildPokemon(locationId: string): boolean {
  const encounter = getLocationEncounter(locationId);
  if (!encounter) return false;
  
  // 基于遭遇率进行随机判断
  return Math.random() < encounter.encounterRate;
}

// 选择一个野生宝可梦基于权重
export function selectWildPokemon(locationId: string): WildPokemonData | null {
  const encounter = getLocationEncounter(locationId);
  if (!encounter || !encounter.wildPokemon.length) return null;
  
  // 计算权重总和
  const totalWeight = encounter.wildPokemon.reduce((sum, pokemon) => sum + pokemon.weight, 0);
  let randomValue = Math.random() * totalWeight;
  
  // 基于权重选择
  for (const pokemon of encounter.wildPokemon) {
    randomValue -= pokemon.weight;
    if (randomValue <= 0) {
      return pokemon;
    }
  }
  
  // 默认返回第一个（应该不会到这里）
  return encounter.wildPokemon[0];
}

// 生成一个野生宝可梦实例
export async function generateWildPokemon(locationId: string): Promise<PokemonInstance | null> {
  const selectedPokemon = selectWildPokemon(locationId);
  if (!selectedPokemon) return null;
  
  // 在等级范围内随机选择等级
  const [minLevel, maxLevel] = selectedPokemon.levelRange;
  const level = Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
  
  // 创建宝可梦实例
  return await createPokemonInstance(selectedPokemon.pokedexId, level);
} 