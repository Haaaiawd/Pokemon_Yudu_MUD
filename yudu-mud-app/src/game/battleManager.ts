import { BattleAction, BattleState, BattleParticipant } from '@/interfaces/battle';
import { PokemonInstance } from '@/interfaces/pokemon';
import { v4 as uuidv4 } from 'uuid';
import { Player } from '@/interfaces/database';
import { generateWildPokemon } from './encounterManager';
import { executeAttack, useItem, switchPokemon, attemptToRun } from './battleActions';
import { calculateExperienceGain } from './battleCalculations';
import { addExperience } from './pokemonManager';

/**
 * 创建野生宝可梦战斗
 * @param playerState 玩家状态
 * @param locationId 地点ID
 * @returns 创建的战斗状态，如果无法生成宝可梦则返回null
 */
export async function createWildBattle(playerState: Player, locationId: string): Promise<BattleState | null> {
  // 生成野生宝可梦
  const wildPokemon = await generateWildPokemon(locationId);
  if (!wildPokemon) return null;
  
  // 确保玩家队伍中有宝可梦
  if (!playerState.team || playerState.team.length === 0) {
    console.error("尝试创建战斗，但玩家队伍为空");
    return null;
  }
  
  // 创建玩家参与者
  const playerParticipant: BattleParticipant = {
    id: playerState.id,
    name: playerState.name,
    activePokemon: playerState.team[0], // 默认使用队伍中的第一个宝可梦
    party: [...playerState.team],
    availableActions: ['FIGHT', 'ITEM', 'SWITCH', 'RUN']
  };
  
  // 创建野生宝可梦参与者
  const wildParticipant: BattleParticipant = {
    id: `wild_${wildPokemon.instanceId}`,
    name: `野生的${wildPokemon.speciesName || wildPokemon.pokedexId}`,
    activePokemon: wildPokemon,
    party: [wildPokemon],
    availableActions: ['FIGHT']
  };
  
  // 创建战斗状态
  const battle: BattleState = {
    id: uuidv4(),
    participants: [playerParticipant, wildParticipant],
    turn: 1,
    log: [`一只野生的 ${wildPokemon.speciesName || wildPokemon.pokedexId} (Lv.${wildPokemon.level}) 出现了！`],
    status: 'WAITING_FOR_INPUT'
  };
  
  return battle;
}

/**
 * 创建标准战斗
 * @param playerId 玩家ID
 * @param playerName 玩家名称
 * @param playerParty 玩家队伍
 * @param opponentPokemon 对手宝可梦
 */
export async function startBattle(
  playerId: string,
  playerName: string,
  playerParty: PokemonInstance[],
  opponentPokemon: PokemonInstance
): Promise<BattleState> {
  console.log(`开始战斗：${playerName} vs 野生的 ${opponentPokemon.speciesName || "未知宝可梦"}`);
  
  if (!playerParty || playerParty.length === 0) {
    throw new Error("玩家没有宝可梦！");
  }
  
  const playerActivePokemon = playerParty.find(p => p.currentHp > 0);
  if (!playerActivePokemon) {
    throw new Error("玩家所有宝可梦都失去战斗能力！");
  }

  // 创建玩家参与者
  const playerParticipant: BattleParticipant = {
    id: playerId,
    name: playerName,
    activePokemon: playerActivePokemon,
    party: playerParty,
    availableActions: ['FIGHT', 'ITEM', 'SWITCH', 'RUN']
  };
  
  // 创建对手参与者
  const opponentParticipant: BattleParticipant = {
    id: opponentPokemon.instanceId,
    name: `野生的 ${opponentPokemon.speciesName || "未知宝可梦"}`,
    activePokemon: opponentPokemon,
    party: [opponentPokemon],
    availableActions: ['FIGHT']
  };
  
  // 创建初始战斗状态
  const initialState: BattleState = {
    id: uuidv4(),
    participants: [playerParticipant, opponentParticipant],
    turn: 1,
    log: [
      `一只野生的 ${opponentPokemon.speciesName || "未知宝可梦"} 出现了！`,
      `${playerName} 派出了 ${playerActivePokemon.nickname || playerActivePokemon.speciesName || "宝可梦"}！`,
      `${playerName} 要做什么？`
    ],
    status: 'WAITING_FOR_INPUT'
  };
  
  console.log("初始战斗状态:", initialState);
  return initialState;
}

/**
 * 执行战斗行动
 * @param battle 当前战斗状态
 * @param participantIndex 参与者索引
 * @param action 战斗行动
 * @returns 更新后的战斗状态和消息
 */
export async function executeBattleAction(
  battle: BattleState, 
  participantIndex: number,
  action: BattleAction
): Promise<{ updatedBattle: BattleState; messages: string[] }> {
  const messages: string[] = [];
  
  // 检查战斗是否已经结束
  if (battle.status !== 'WAITING_FOR_INPUT' && battle.status !== 'PROCESSING') {
    messages.push('战斗已经结束，无法执行行动。');
    return { updatedBattle: battle, messages };
  }
  
  // 获取执行行动的参与者
  const participant = battle.participants[participantIndex];
  if (!participant) {
    messages.push('无效的参与者索引。');
    return { updatedBattle: battle, messages };
  }
  
  // 检查行动类型是否可用
  if (!participant.availableActions.includes(action.type)) {
    messages.push(`${participant.name} 无法执行 ${action.type} 行动。`);
    return { updatedBattle: battle, messages };
  }
  
  // 标记战斗为处理中
  let updatedBattle = { ...battle, status: 'PROCESSING' as const };
  
  // 根据行动类型执行不同的操作
  switch (action.type) {
    case 'FIGHT':
      return executeAttack(updatedBattle, participantIndex, action.moveId || '');
    case 'ITEM':
      return useItem(updatedBattle, participantIndex, action.itemId || '', action.targetPokemonIndex || 0);
    case 'SWITCH':
      return switchPokemon(updatedBattle, participantIndex, action.switchToPokemonIndex || 0);
    case 'RUN':
      return attemptToRun(updatedBattle, participantIndex);
    default:
      messages.push('无效的行动类型。');
      return { updatedBattle: battle, messages };
  }
}

/**
 * 处理回合
 * @param currentBattleState 当前战斗状态
 * @param playerAction 玩家行动
 * @param opponentAction 对手行动
 * @returns 更新后的战斗状态
 */
export async function processTurn(
  currentBattleState: BattleState,
  playerAction: BattleAction,
  opponentAction: BattleAction
): Promise<BattleState> {
  let nextState = { ...currentBattleState };
  const playerParticipant = nextState.participants[0];
  const opponentParticipant = nextState.participants[1];
  
  // 计算行动顺序
  const actionsInOrder: { participantIndex: number; action: BattleAction }[] = [];
  
  // 简化的速度判断，实际应考虑更多因素（如优先级、速度提升等）
  const playerSpeed = playerParticipant.activePokemon.stats.speed;
  const opponentSpeed = opponentParticipant.activePokemon.stats.speed;
  
  if (playerSpeed >= opponentSpeed) {
    actionsInOrder.push({ participantIndex: 0, action: playerAction });
    actionsInOrder.push({ participantIndex: 1, action: opponentAction });
  } else {
    actionsInOrder.push({ participantIndex: 1, action: opponentAction });
    actionsInOrder.push({ participantIndex: 0, action: playerAction });
  }
  
  // 记录回合开始
  nextState.log.push(`--- 回合 ${nextState.turn} ---`);
  const currentTurnNumber = nextState.turn;
  nextState.turn++;
  
  // 按顺序处理行动
  for (const { participantIndex, action } of actionsInOrder) {
    // 执行行动
    const result = await executeBattleAction(nextState, participantIndex, action);
    nextState = result.updatedBattle;
    
    // 如果战斗已结束，终止处理
    if (nextState.status !== 'WAITING_FOR_INPUT' && nextState.status !== 'PROCESSING') {
      break;
    }
  }
  
  // 处理回合结束效果
  if (nextState.status === 'PROCESSING' || nextState.status === 'WAITING_FOR_INPUT') {
    // TODO: 处理中毒、灼伤等状态伤害
    
    // 更新战斗状态
    if (nextState.status === 'PROCESSING') {
      nextState.status = 'WAITING_FOR_INPUT';
      nextState.log.push("等待下一个指令...");
    }
  }
  
  return nextState;
}

/**
 * 结束战斗并更新玩家状态
 * @param battle 战斗状态
 * @param playerState 玩家状态
 * @returns 更新后的玩家状态和消息
 */
export async function endBattle(
  battle: BattleState,
  playerState: Player
): Promise<{ updatedPlayerState: Partial<Player>; messages: string[] }> {
  const messages: string[] = [];
  const updatedPlayerState: Partial<Player> = {};
  
  // 战斗胜利
  if (battle.status === 'PLAYER_WIN') {
    messages.push('你赢得了战斗！');
    
    // 获取经验值
    if (battle.participants.length >= 2 && battle.participants[1].party.length > 0) {
      const defeatedPokemon = battle.participants[1].party[0];
      const winnerPokemon = battle.participants[0].activePokemon;
      
      // 为所有参与战斗的宝可梦分配经验值
      const expGained = calculateExperienceGain(winnerPokemon, defeatedPokemon);
      
      // 更新队伍中宝可梦的经验值和等级
      const updatedTeam = [...playerState.team];
      
      // 这里简化处理，只给参与战斗的宝可梦增加经验值
      const battlePokemonIndex = updatedTeam.findIndex(p => 
        p.instanceId === winnerPokemon.instanceId
      );
      
      if (battlePokemonIndex >= 0) {
        // 获取宝可梦详细信息
        const speciesDetails = updatedTeam[battlePokemonIndex].speciesDetails;
        
        // 添加经验值并处理升级
        if (speciesDetails) {
          const result = addExperience(updatedTeam[battlePokemonIndex], speciesDetails, expGained);
          
          // 添加升级消息
          result.messages.forEach(msg => messages.push(msg));
        } else {
          // 如果没有种族详情，简单地增加经验值
          updatedTeam[battlePokemonIndex].experience += expGained;
          messages.push(`${updatedTeam[battlePokemonIndex].nickname || updatedTeam[battlePokemonIndex].speciesName || updatedTeam[battlePokemonIndex].pokedexId} 获得了 ${expGained} 点经验值！`);
        }
      }
      
      updatedPlayerState.team = updatedTeam;
    }
  }
  
  // 战斗失败
  else if (battle.status === 'OPPONENT_WIN') {
    messages.push('你输掉了战斗...');
    
    // 这里可以实现失败后的逻辑，如金钱损失、回到上一个宝可梦中心等
  }
  
  // 逃跑
  else if (battle.status === 'FLED') {
    messages.push('你成功逃脱了战斗！');
  }
  
  // 清除玩家当前战斗状态
  updatedPlayerState.currentBattle = undefined;
  
  // 确保宝可梦状态正确
  if (!updatedPlayerState.team) {
    updatedPlayerState.team = battle.participants[0].party.map(battlePokemon => {
      return battlePokemon;
    });
  }
  
  return { updatedPlayerState, messages };
}