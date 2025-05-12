import { PokemonInstance } from '@/interfaces/pokemon';

// 确保导出 calculateDamage 函数，解决导入错误
export interface DamageResult {
  damage: number;
  effectiveness: number;
  isCritical: boolean;
}

/**
 * 计算伤害
 * @param attacker 攻击方宝可梦
 * @param defender 防御方宝可梦
 * @param move 使用的招式
 * @returns 伤害数值、效果倍率和是否暴击
 */
export function calculateDamage(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: any
): DamageResult {
  // 简化的伤害计算
  let power = typeof move === 'string' ? 50 : (move.power || 50); // 默认威力50
  let attackStat = 0;
  let defenseStat = 0;
  
  // 根据招式类别选择攻击和防御属性
  const category = typeof move === 'string' ? 'Physical' : (move.category || 'Physical');
  
  if (category === 'Physical') {
    attackStat = attacker.stats.attack;
    defenseStat = defender.stats.defense;
  } else if (category === 'Special') {
    attackStat = attacker.stats.specialAttack;
    defenseStat = defender.stats.specialDefense;
  } else {
    // 变化类招式不造成伤害
    return { damage: 0, effectiveness: 1, isCritical: false };
  }
  
  // 计算暴击
  const criticalChance = 1/16; // 基础暴击率为1/16
  const isCritical = Math.random() < criticalChance;
  const criticalMultiplier = isCritical ? 1.5 : 1;
  
  // 简化的属性相克系统
  // 在实际实现中，应基于招式类型和防御者属性计算
  const effectiveness = calculateTypeEffectiveness(
    typeof move === 'string' ? 'Normal' : (move.type || 'Normal'),
    defender.speciesDetails?.types || ['Normal']
  );
  
  // 随机因素 (0.85到1.0之间的随机数)
  const randomFactor = 0.85 + (Math.random() * 0.15);
  
  // 伤害公式: ((2 * 攻击方等级 / 5 + 2) * 招式威力 * 攻击/防御) / 50) + 2) * 修正
  let damage = Math.floor(
    (((2 * attacker.level / 5 + 2) * power * (attackStat / defenseStat)) / 50 + 2) * 
    effectiveness * criticalMultiplier * randomFactor
  );
  
  // 确保伤害至少为1
  damage = Math.max(1, damage);
  
  return { damage, effectiveness, isCritical };
}

/**
 * 计算属性相克效果倍率
 * @param moveType 招式属性
 * @param defenderTypes 防御者属性
 * @returns 效果倍率
 */
function calculateTypeEffectiveness(moveType: string, defenderTypes: string[]): number {
  // 简化的属性相克系统
  // 实际实现中应使用完整的属性相克表
  
  // 属性相克关系映射
  const typeEffectiveness: Record<string, Record<string, number>> = {
    Normal: {
      Rock: 0.5,
      Steel: 0.5,
      Ghost: 0,
    },
    Fire: {
      Fire: 0.5,
      Water: 0.5,
      Grass: 2,
      Ice: 2,
      Bug: 2,
      Rock: 0.5,
      Dragon: 0.5,
      Steel: 2,
    },
    Water: {
      Fire: 2,
      Water: 0.5,
      Grass: 0.5,
      Ground: 2,
      Rock: 2,
      Dragon: 0.5,
    },
    Electric: {
      Water: 2,
      Electric: 0.5,
      Grass: 0.5,
      Ground: 0,
      Flying: 2,
      Dragon: 0.5,
    },
    Grass: {
      Fire: 0.5,
      Water: 2,
      Grass: 0.5,
      Poison: 0.5,
      Ground: 2,
      Flying: 0.5,
      Bug: 0.5,
      Rock: 2,
      Dragon: 0.5,
      Steel: 0.5,
    },
    Ice: {
      Fire: 0.5,
      Water: 0.5,
      Grass: 2,
      Ice: 0.5,
      Ground: 2,
      Flying: 2,
      Dragon: 2,
      Steel: 0.5,
    },
    Fighting: {
      Normal: 2,
      Ice: 2,
      Poison: 0.5,
      Flying: 0.5,
      Psychic: 0.5,
      Bug: 0.5,
      Rock: 2,
      Ghost: 0,
      Dark: 2,
      Steel: 2,
      Fairy: 0.5,
    },
    Poison: {
      Grass: 2,
      Poison: 0.5,
      Ground: 0.5,
      Rock: 0.5,
      Ghost: 0.5,
      Steel: 0,
      Fairy: 2,
    },
    Ground: {
      Fire: 2,
      Electric: 2,
      Grass: 0.5,
      Poison: 2,
      Flying: 0,
      Bug: 0.5,
      Rock: 2,
      Steel: 2,
    },
    Flying: {
      Electric: 0.5,
      Grass: 2,
      Fighting: 2,
      Bug: 2,
      Rock: 0.5,
      Steel: 0.5,
    },
    Psychic: {
      Fighting: 2,
      Poison: 2,
      Psychic: 0.5,
      Dark: 0,
      Steel: 0.5,
    },
    Bug: {
      Fire: 0.5,
      Grass: 2,
      Fighting: 0.5,
      Poison: 0.5,
      Flying: 0.5,
      Psychic: 2,
      Ghost: 0.5,
      Dark: 2,
      Steel: 0.5,
      Fairy: 0.5,
    },
    Rock: {
      Fire: 2,
      Ice: 2,
      Fighting: 0.5,
      Ground: 0.5,
      Flying: 2,
      Bug: 2,
      Steel: 0.5,
    },
    Ghost: {
      Normal: 0,
      Psychic: 2,
      Ghost: 2,
      Dark: 0.5,
    },
    Dragon: {
      Dragon: 2,
      Steel: 0.5,
      Fairy: 0,
    },
    Dark: {
      Fighting: 0.5,
      Psychic: 2,
      Ghost: 2,
      Dark: 0.5,
      Fairy: 0.5,
    },
    Steel: {
      Fire: 0.5,
      Water: 0.5,
      Electric: 0.5,
      Ice: 2,
      Rock: 2,
      Steel: 0.5,
      Fairy: 2,
    },
    Fairy: {
      Fire: 0.5,
      Fighting: 2,
      Poison: 0.5,
      Dragon: 2,
      Dark: 2,
      Steel: 0.5,
    },
  };
  
  // 计算总体效果
  let totalEffectiveness = 1.0;
  
  // 遍历防御者的所有属性，累乘效果倍率
  for (const defenderType of defenderTypes) {
    const effectiveness = typeEffectiveness[moveType]?.[defenderType] || 1.0;
    totalEffectiveness *= effectiveness;
  }
  
  return totalEffectiveness;
}

/**
 * 计算战斗胜利后获得的经验值
 * @param winnerPokemon 获胜的宝可梦
 * @param defeatedPokemon 失败的宝可梦
 * @returns 获得的经验值
 */
export function calculateExperienceGain(
  winnerPokemon: PokemonInstance,
  defeatedPokemon: PokemonInstance
): number {
  // 基础经验值公式：（击败的宝可梦基础经验值 * 击败的宝可梦等级） / 7
  // 这里使用简化的公式
  return Math.floor((defeatedPokemon.level * 8) + 20);
}

/**
 * 计算宝可梦捕获率
 * @param pokemon 要捕获的宝可梦
 * @param ballBonus 精灵球加成
 * @param statusBonus 状态加成
 * @returns 捕获成功概率 (0-1)
 */
export function calculateCaptureRate(
  pokemon: PokemonInstance,
  ballBonus: number = 1.0,
  statusBonus: number = 1.0
): number {
  // 基础捕获率（根据宝可梦种类不同）
  const baseCaptureRate = pokemon.speciesDetails?.catchRate || 45; // 默认中等难度捕获率
  
  // 最大HP和当前HP
  const maxHP = pokemon.maxHp;
  const currentHP = pokemon.currentHp;
  
  // 捕获公式: ((3 * maxHP - 2 * currentHP) * baseCaptureRate * ballBonus * statusBonus) / (3 * maxHP)
  const a = ((3 * maxHP - 2 * currentHP) * baseCaptureRate * ballBonus * statusBonus) / (3 * maxHP);
  
  // 捕获概率 (最大255)
  const captureRate = Math.min(255, Math.floor(a));
  
  // 转换为0-1范围的概率
  return captureRate / 255;
}