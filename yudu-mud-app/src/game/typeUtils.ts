/**
 * Utility module for Pokémon type-related calculations.
 * Handles type effectiveness, STAB calculations, and other type-related functions.
 */

// Type effectiveness chart
// Represents the matchups between attacking types and defending types
// Values: 0 = Immune, 0.5 = Not very effective, 1 = Normal, 2 = Super effective
export const TypeChart: { [attackingType: string]: { [defendingType: string]: number } } = {
  // 普通系
  一般: {
    一般: 1, 格斗: 1, 飞行: 1, 毒: 1, 地面: 1, 岩石: 0.5, 虫: 1, 幽灵: 0, 钢: 0.5, 火: 1, 水: 1, 草: 1, 电: 1, 超能力: 1, 冰: 1, 龙: 1, 恶: 1, 妖精: 1
  },
  // 格斗系
  格斗: {
    一般: 2, 格斗: 1, 飞行: 0.5, 毒: 0.5, 地面: 1, 岩石: 2, 虫: 0.5, 幽灵: 0, 钢: 2, 火: 1, 水: 1, 草: 1, 电: 1, 超能力: 0.5, 冰: 2, 龙: 1, 恶: 2, 妖精: 0.5
  },
  // 飞行系
  飞行: {
    一般: 1, 格斗: 2, 飞行: 1, 毒: 1, 地面: 1, 岩石: 0.5, 虫: 2, 幽灵: 1, 钢: 0.5, 火: 1, 水: 1, 草: 2, 电: 0.5, 超能力: 1, 冰: 1, 龙: 1, 恶: 1, 妖精: 1
  },
  // 毒系
  毒: {
    一般: 1, 格斗: 1, 飞行: 1, 毒: 0.5, 地面: 0.5, 岩石: 0.5, 虫: 1, 幽灵: 0.5, 钢: 0, 火: 1, 水: 1, 草: 2, 电: 1, 超能力: 1, 冰: 1, 龙: 1, 恶: 1, 妖精: 2
  },
  // 地面系
  地面: {
    一般: 1, 格斗: 1, 飞行: 0, 毒: 2, 地面: 1, 岩石: 2, 虫: 0.5, 幽灵: 1, 钢: 2, 火: 2, 水: 1, 草: 0.5, 电: 2, 超能力: 1, 冰: 1, 龙: 1, 恶: 1, 妖精: 1
  },
  // 岩石系
  岩石: {
    一般: 1, 格斗: 0.5, 飞行: 2, 毒: 1, 地面: 0.5, 岩石: 1, 虫: 2, 幽灵: 1, 钢: 0.5, 火: 2, 水: 1, 草: 1, 电: 1, 超能力: 1, 冰: 2, 龙: 1, 恶: 1, 妖精: 1
  },
  // 虫系
  虫: {
    一般: 1, 格斗: 0.5, 飞行: 0.5, 毒: 0.5, 地面: 1, 岩石: 1, 虫: 1, 幽灵: 0.5, 钢: 0.5, 火: 0.5, 水: 1, 草: 2, 电: 1, 超能力: 2, 冰: 1, 龙: 1, 恶: 2, 妖精: 0.5
  },
  // 幽灵系
  幽灵: {
    一般: 0, 格斗: 1, 飞行: 1, 毒: 1, 地面: 1, 岩石: 1, 虫: 1, 幽灵: 2, 钢: 1, 火: 1, 水: 1, 草: 1, 电: 1, 超能力: 2, 冰: 1, 龙: 1, 恶: 0.5, 妖精: 1
  },
  // 钢系
  钢: {
    一般: 1, 格斗: 1, 飞行: 1, 毒: 1, 地面: 1, 岩石: 2, 虫: 1, 幽灵: 1, 钢: 0.5, 火: 0.5, 水: 0.5, 草: 1, 电: 0.5, 超能力: 1, 冰: 2, 龙: 1, 恶: 1, 妖精: 2
  },
  // 火系
  火: {
    一般: 1, 格斗: 1, 飞行: 1, 毒: 1, 地面: 1, 岩石: 0.5, 虫: 2, 幽灵: 1, 钢: 2, 火: 0.5, 水: 0.5, 草: 2, 电: 1, 超能力: 1, 冰: 2, 龙: 0.5, 恶: 1, 妖精: 1
  },
  // 水系
  水: {
    一般: 1, 格斗: 1, 飞行: 1, 毒: 1, 地面: 2, 岩石: 2, 虫: 1, 幽灵: 1, 钢: 1, 火: 2, 水: 0.5, 草: 0.5, 电: 1, 超能力: 1, 冰: 1, 龙: 0.5, 恶: 1, 妖精: 1
  },
  // 草系
  草: {
    一般: 1, 格斗: 1, 飞行: 0.5, 毒: 0.5, 地面: 2, 岩石: 2, 虫: 0.5, 幽灵: 1, 钢: 0.5, 火: 0.5, 水: 2, 草: 0.5, 电: 1, 超能力: 1, 冰: 1, 龙: 0.5, 恶: 1, 妖精: 1
  },
  // 电系
  电: {
    一般: 1, 格斗: 1, 飞行: 2, 毒: 1, 地面: 0, 岩石: 1, 虫: 1, 幽灵: 1, 钢: 1, 火: 1, 水: 2, 草: 0.5, 电: 0.5, 超能力: 1, 冰: 1, 龙: 0.5, 恶: 1, 妖精: 1
  },
  // 超能力系
  超能力: {
    一般: 1, 格斗: 2, 飞行: 1, 毒: 2, 地面: 1, 岩石: 1, 虫: 1, 幽灵: 1, 钢: 0.5, 火: 1, 水: 1, 草: 1, 电: 1, 超能力: 0.5, 冰: 1, 龙: 1, 恶: 0, 妖精: 1
  },
  // 冰系
  冰: {
    一般: 1, 格斗: 1, 飞行: 2, 毒: 1, 地面: 2, 岩石: 1, 虫: 1, 幽灵: 1, 钢: 0.5, 火: 0.5, 水: 0.5, 草: 2, 电: 1, 超能力: 1, 冰: 0.5, 龙: 2, 恶: 1, 妖精: 1
  },
  // 龙系
  龙: {
    一般: 1, 格斗: 1, 飞行: 1, 毒: 1, 地面: 1, 岩石: 1, 虫: 1, 幽灵: 1, 钢: 0.5, 火: 1, 水: 1, 草: 1, 电: 1, 超能力: 1, 冰: 1, 龙: 2, 恶: 1, 妖精: 0
  },
  // 恶系
  恶: {
    一般: 1, 格斗: 0.5, 飞行: 1, 毒: 1, 地面: 1, 岩石: 1, 虫: 1, 幽灵: 2, 钢: 1, 火: 1, 水: 1, 草: 1, 电: 1, 超能力: 2, 冰: 1, 龙: 1, 恶: 0.5, 妖精: 0.5
  },
  // 妖精系 
  妖精: {
    一般: 1, 格斗: 2, 飞行: 1, 毒: 0.5, 地面: 1, 岩石: 1, 虫: 1, 幽灵: 1, 钢: 0.5, 火: 0.5, 水: 1, 草: 1, 电: 1, 超能力: 1, 冰: 1, 龙: 2, 恶: 2, 妖精: 1
  },
  
  // 英文类型映射
  Normal: {
    Normal: 1, Fighting: 1, Flying: 1, Poison: 1, Ground: 1, Rock: 0.5, Bug: 1, Ghost: 0, Steel: 0.5, Fire: 1, Water: 1, Grass: 1, Electric: 1, Psychic: 1, Ice: 1, Dragon: 1, Dark: 1, Fairy: 1
  },
  Fighting: {
    Normal: 2, Fighting: 1, Flying: 0.5, Poison: 0.5, Ground: 1, Rock: 2, Bug: 0.5, Ghost: 0, Steel: 2, Fire: 1, Water: 1, Grass: 1, Electric: 1, Psychic: 0.5, Ice: 2, Dragon: 1, Dark: 2, Fairy: 0.5
  },
  Flying: {
    Normal: 1, Fighting: 2, Flying: 1, Poison: 1, Ground: 1, Rock: 0.5, Bug: 2, Ghost: 1, Steel: 0.5, Fire: 1, Water: 1, Grass: 2, Electric: 0.5, Psychic: 1, Ice: 1, Dragon: 1, Dark: 1, Fairy: 1
  },
  Poison: {
    Normal: 1, Fighting: 1, Flying: 1, Poison: 0.5, Ground: 0.5, Rock: 0.5, Bug: 1, Ghost: 0.5, Steel: 0, Fire: 1, Water: 1, Grass: 2, Electric: 1, Psychic: 1, Ice: 1, Dragon: 1, Dark: 1, Fairy: 2
  },
  Ground: {
    Normal: 1, Fighting: 1, Flying: 0, Poison: 2, Ground: 1, Rock: 2, Bug: 0.5, Ghost: 1, Steel: 2, Fire: 2, Water: 1, Grass: 0.5, Electric: 2, Psychic: 1, Ice: 1, Dragon: 1, Dark: 1, Fairy: 1
  }
  // 其他类型... (简化起见，这里只列出部分英文映射)
};

/**
 * Calculates the type effectiveness of an attack against a Pokemon with one or more types.
 * 
 * @param attackType The type of the attacking move
 * @param defenderTypes An array of the defending Pokemon's types
 * @returns A number representing the effectiveness multiplier (0, 0.25, 0.5, 1, 2, or 4)
 */
export function getTypeEffectiveness(attackType: string, defenderTypes: string[]): number {
  if (!defenderTypes || defenderTypes.length === 0) {
    console.warn(`No defender types provided for effectiveness calculation against ${attackType}.`);
    return 1; // Default to normal effectiveness
  }

  // Look up each type effectiveness and multiply them together
  let effectiveness = 1;
  
  for (const defenderType of defenderTypes) {
    // Check if the type matchup exists in our chart
    if (TypeChart[attackType] && TypeChart[attackType][defenderType] !== undefined) {
      effectiveness *= TypeChart[attackType][defenderType];
    } else {
      console.warn(`Type matchup not found for ${attackType} vs ${defenderType}, using neutral effectiveness.`);
    }
  }
  
  return effectiveness;
}

/**
 * Determines if a move gets Same Type Attack Bonus (STAB).
 * 
 * @param moveType The type of the move
 * @param pokemonTypes The types of the Pokemon using the move
 * @returns true if the move gets STAB, false otherwise
 */
export function getStabBonus(moveType: string, pokemonTypes: string[]): boolean {
  return pokemonTypes.includes(moveType);
}

/**
 * Converts a Chinese type name to its English equivalent.
 * Useful for compatibility with different data sources.
 */
export function convertTypeNameToEnglish(chineseType: string): string {
  const typeMap: {[key: string]: string} = {
    '一般': 'Normal',
    '格斗': 'Fighting',
    '飞行': 'Flying',
    '毒': 'Poison',
    '地面': 'Ground',
    '岩石': 'Rock',
    '虫': 'Bug',
    '幽灵': 'Ghost',
    '钢': 'Steel',
    '火': 'Fire',
    '水': 'Water',
    '草': 'Grass',
    '电': 'Electric',
    '超能力': 'Psychic',
    '冰': 'Ice',
    '龙': 'Dragon',
    '恶': 'Dark',
    '妖精': 'Fairy'
  };
  
  return typeMap[chineseType] || chineseType; // Fall back to original if not found
}

/**
 * Converts an English type name to its Chinese equivalent.
 */
export function convertTypeNameToChinese(englishType: string): string {
  const typeMap: {[key: string]: string} = {
    'Normal': '一般',
    'Fighting': '格斗',
    'Flying': '飞行',
    'Poison': '毒',
    'Ground': '地面',
    'Rock': '岩石',
    'Bug': '虫',
    'Ghost': '幽灵',
    'Steel': '钢',
    'Fire': '火',
    'Water': '水',
    'Grass': '草',
    'Electric': '电',
    'Psychic': '超能力',
    'Ice': '冰',
    'Dragon': '龙',
    'Dark': '恶',
    'Fairy': '妖精'
  };
  
  return typeMap[englishType] || englishType; // Fall back to original if not found
} 