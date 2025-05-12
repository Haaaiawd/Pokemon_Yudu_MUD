import { BattleState, BattleParticipant } from '@/interfaces/battle';
import { PokemonInstance, Move } from '@/interfaces/pokemon';
import { calculateDamage } from './battleCalculations';

/**
 * 执行攻击
 * @param battle 当前战斗状态
 * @param attackerIndex 攻击者索引
 * @param moveId 招式ID或名称
 * @returns 更新后的战斗状态和消息
 */
export async function executeAttack(
  battle: BattleState,
  attackerIndex: number,
  moveId: string
): Promise<{ updatedBattle: BattleState; messages: string[] }> {
  const messages: string[] = [];
  const updatedBattle = { ...battle };
  
  // 获取攻击者和防御者
  const attacker = updatedBattle.participants[attackerIndex];
  const defenderIndex = attackerIndex === 0 ? 1 : 0;
  const defender = updatedBattle.participants[defenderIndex];
  
  if (!attacker || !defender) {
    messages.push('无效的战斗参与者。');
    updatedBattle.status = 'WAITING_FOR_INPUT';
    return { updatedBattle, messages };
  }
  
  // 查找招式
  const attackerPokemon = attacker.activePokemon;
  // 修复类型问题：明确声明move的类型为string | Move
  const move = attackerPokemon.moves.find(m => 
    typeof m === 'string' ? m === moveId : (m as Move).name === moveId
  );
  
  if (!move) {
    messages.push(`${attackerPokemon.nickname || attackerPokemon.speciesName || attackerPokemon.pokedexId} 没有 ${moveId} 招式。`);
    updatedBattle.status = 'WAITING_FOR_INPUT';
    return { updatedBattle, messages };
  }
  
  // 获取招式详情，使用类型断言解决never类型错误
  const moveName = typeof move === 'string' ? move : (move as Move).name;
  
  // 执行攻击
  messages.push(`${attackerPokemon.nickname || attackerPokemon.speciesName || attackerPokemon.pokedexId} 使用了 ${moveName}！`);
  
  // 计算伤害
  const defenderPokemon = defender.activePokemon;
  const damage = calculateDamage(attackerPokemon, defenderPokemon, move);
  
  // 应用伤害
  const updatedDefenderPokemon = { 
    ...defenderPokemon,
    currentHp: Math.max(0, defenderPokemon.currentHp - damage.damage)
  };
  
  // 更新防御者宝可梦状态
  if (defenderIndex === 0) {
    updatedBattle.participants[0] = {
      ...defender,
      activePokemon: updatedDefenderPokemon,
      party: defender.party.map((p, idx) => 
        idx === 0 ? updatedDefenderPokemon : p
      )
    };
  } else {
    updatedBattle.participants[1] = {
      ...defender,
      activePokemon: updatedDefenderPokemon,
      party: defender.party.map((p, idx) => 
        idx === 0 ? updatedDefenderPokemon : p
      )
    };
  }
  
  // 显示伤害信息
  messages.push(`造成了 ${damage.damage} 点伤害！`);
  if (damage.effectiveness > 1) {
    messages.push('效果拔群！');
  } else if (damage.effectiveness < 1 && damage.effectiveness > 0) {
    messages.push('效果不是很好...');
  } else if (damage.effectiveness === 0) {
    messages.push('没有效果...');
  }
  
  // 检查防御者是否失去战斗能力
  if (updatedDefenderPokemon.currentHp <= 0) {
    messages.push(`${updatedDefenderPokemon.nickname || updatedDefenderPokemon.speciesName || updatedDefenderPokemon.pokedexId} 失去了战斗能力！`);
    
    // 如果是野生宝可梦，战斗结束
    if (defenderIndex === 1 && updatedBattle.participants[1].party.length === 1) {
      updatedBattle.status = 'PLAYER_WIN';
      messages.push('你赢得了战斗！');
    } 
    // 如果是玩家宝可梦，检查是否还有其他宝可梦可以战斗
    else if (defenderIndex === 0) {
      const remainingPokemon = updatedBattle.participants[0].party.filter(p => p.currentHp > 0);
      
      if (remainingPokemon.length === 0) {
        updatedBattle.status = 'OPPONENT_WIN';
        messages.push('你输掉了战斗...');
      } else {
        messages.push('请选择下一只宝可梦上场！');
        updatedBattle.status = 'WAITING_FOR_INPUT';
      }
    }
  } else {
    // 战斗继续
    updatedBattle.turn += 1;
    updatedBattle.status = 'WAITING_FOR_INPUT';
  }
  
  updatedBattle.log = [...updatedBattle.log, ...messages];
  
  return { updatedBattle, messages };
}

/**
 * 使用物品
 * @param battle 当前战斗状态
 * @param userIndex 使用者索引
 * @param itemId 物品ID
 * @param targetPokemonIndex 目标宝可梦索引
 * @returns 更新后的战斗状态和消息
 */
export async function useItem(
  battle: BattleState,
  userIndex: number,
  itemId: string,
  targetPokemonIndex: number
): Promise<{ updatedBattle: BattleState; messages: string[] }> {
  // TODO: 实现使用物品逻辑
  const messages = ['使用物品功能尚未实现。'];
  return { 
    updatedBattle: { ...battle, status: 'WAITING_FOR_INPUT' }, 
    messages 
  };
}

/**
 * 切换宝可梦
 * @param battle 当前战斗状态
 * @param participantIndex 参与者索引
 * @param pokemonIndex 新宝可梦索引
 * @returns 更新后的战斗状态和消息
 */
export async function switchPokemon(
  battle: BattleState,
  participantIndex: number,
  pokemonIndex: number
): Promise<{ updatedBattle: BattleState; messages: string[] }> {
  const messages: string[] = [];
  const updatedBattle = { ...battle };
  
  // 获取参与者
  const participant = updatedBattle.participants[participantIndex];
  if (!participant) {
    messages.push('无效的参与者索引。');
    updatedBattle.status = 'WAITING_FOR_INPUT';
    return { updatedBattle, messages };
  }
  
  // 检查索引是否有效
  if (pokemonIndex < 0 || pokemonIndex >= participant.party.length) {
    messages.push('无效的宝可梦索引。');
    updatedBattle.status = 'WAITING_FOR_INPUT';
    return { updatedBattle, messages };
  }
  
  // 检查选择的宝可梦是否已经在场
  if (participant.activePokemon === participant.party[pokemonIndex]) {
    messages.push(`${participant.party[pokemonIndex].nickname || participant.party[pokemonIndex].speciesName || participant.party[pokemonIndex].pokedexId} 已经在场上了！`);
    updatedBattle.status = 'WAITING_FOR_INPUT';
    return { updatedBattle, messages };
  }
  
  // 检查选择的宝可梦是否有战斗能力
  if (participant.party[pokemonIndex].currentHp <= 0) {
    messages.push(`${participant.party[pokemonIndex].nickname || participant.party[pokemonIndex].speciesName || participant.party[pokemonIndex].pokedexId} 已经失去战斗能力，无法上场！`);
    updatedBattle.status = 'WAITING_FOR_INPUT';
    return { updatedBattle, messages };
  }
  
  // 记录当前宝可梦
  const currentPokemon = participant.activePokemon;
  
  // 切换宝可梦
  const newActivePokemon = participant.party[pokemonIndex];
  
  // 更新参与者状态
  updatedBattle.participants[participantIndex] = {
    ...participant,
    activePokemon: newActivePokemon
  };
  
  messages.push(`${participant.name} 将 ${currentPokemon.nickname || currentPokemon.speciesName || currentPokemon.pokedexId} 收回，换上了 ${newActivePokemon.nickname || newActivePokemon.speciesName || newActivePokemon.pokedexId}！`);
  
  // 更新战斗状态
  updatedBattle.turn += 1;
  updatedBattle.status = 'WAITING_FOR_INPUT';
  updatedBattle.log = [...updatedBattle.log, ...messages];
  
  return { updatedBattle, messages };
}

/**
 * 尝试逃跑
 * @param battle 当前战斗状态
 * @param participantIndex 参与者索引
 * @returns 更新后的战斗状态和消息
 */
export async function attemptToRun(
  battle: BattleState,
  participantIndex: number
): Promise<{ updatedBattle: BattleState; messages: string[] }> {
  const messages: string[] = [];
  let updatedBattle = { ...battle };
  
  // 只有玩家可以逃跑
  if (participantIndex !== 0) {
    messages.push('只有玩家可以尝试逃跑。');
    updatedBattle.status = 'WAITING_FOR_INPUT';
    return { updatedBattle, messages };
  }
  
  // 只能从野生宝可梦战斗中逃跑
  if (updatedBattle.participants.length !== 2 || updatedBattle.participants[1].party.length > 1) {
    messages.push('你不能从训练家战斗中逃跑！');
    updatedBattle.status = 'WAITING_FOR_INPUT';
    return { updatedBattle, messages };
  }
  
  // 计算逃跑几率
  const playerPokemon = updatedBattle.participants[0].activePokemon;
  const wildPokemon = updatedBattle.participants[1].activePokemon;
  
  const playerSpeed = playerPokemon.stats.speed;
  const wildSpeed = wildPokemon.stats.speed;
  
  // 逃跑公式: f = ((playerSpeed * 128) / wildSpeed + 30) % 256
  // 如果 f >= 200，则成功
  const escapeOdds = Math.floor((playerSpeed * 128) / wildSpeed + 30) % 256;
  const randomValue = Math.floor(Math.random() * 256);
  
  if (randomValue < escapeOdds) {
    // 逃跑成功
    messages.push('成功逃跑了！');
    updatedBattle.status = 'FLED';
  } else {
    // 逃跑失败
    messages.push('逃跑失败！');
    updatedBattle.turn += 1;
    updatedBattle.status = 'WAITING_FOR_INPUT';
  }
  
  updatedBattle.log = [...updatedBattle.log, ...messages];
  
  return { updatedBattle, messages };
}