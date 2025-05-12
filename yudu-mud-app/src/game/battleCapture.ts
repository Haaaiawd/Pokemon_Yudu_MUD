import { BattleState } from '@/interfaces/battle';
import { PokemonInstance } from '@/interfaces/pokemon';
import { Player } from '@/interfaces/database';
import { calculateCaptureRate } from './battleCalculations';

// 状态条件对捕获率的影响
const statusCaptureBonuses: Record<string, number> = {
  SLP: 2.5, // 睡眠
  FRZ: 2.5, // 冰冻
  PAR: 1.5, // 麻痹
  BRN: 1.5, // 灼伤
  PSN: 1.5, // 中毒
  default: 1.0
};

// 不同精灵球的捕获率修正
const ballCaptureBonuses: Record<string, number> = {
  pokeball: 1.0,
  greatball: 1.5,
  ultraball: 2.0,
  masterball: 255.0, // 必定捕获
  nestball: 1.0, // 根据宝可梦等级调整，此处为简化版
  netball: 1.0, // 根据宝可梦类型调整，此处为简化版
  diveball: 1.0, // 根据战斗环境调整，此处为简化版
  // 可以添加更多的精灵球类型
};

/**
 * 尝试捕获宝可梦
 * @param battle 战斗状态
 * @param playerState 玩家状态
 * @param ballType 使用的精灵球类型
 * @returns 更新后的玩家状态、消息和是否成功
 */
export async function attemptCapture(
  battle: BattleState,
  playerState: Player,
  ballType: string = 'pokeball'
): Promise<{ updatedPlayerState: Partial<Player>; messages: string[]; success: boolean }> {
  const messages: string[] = [];
  let success = false;
  
  // 检查是否是野生宝可梦战斗
  if (battle.participants.length < 2 || battle.participants[1].party.length !== 1) {
    messages.push('只能在野生宝可梦战斗中使用精灵球！');
    return { 
      updatedPlayerState: {}, 
      messages,
      success
    };
  }
  
  // 获取野生宝可梦
  const wildPokemon = battle.participants[1].activePokemon;
  
  // 检查玩家是否有相应的精灵球
  const inventoryItemIndex = playerState.inventory.findIndex(item => 
    item.itemId.toLowerCase() === ballType.toLowerCase()
  );
  
  if (inventoryItemIndex === -1) {
    messages.push(`你没有 ${ballType} 了！`);
    return { 
      updatedPlayerState: {}, 
      messages,
      success
    };
  }
  
  // 更新精灵球数量
  const updatedInventory = [...playerState.inventory];
  if (updatedInventory[inventoryItemIndex].quantity > 1) {
    updatedInventory[inventoryItemIndex] = {
      ...updatedInventory[inventoryItemIndex],
      quantity: updatedInventory[inventoryItemIndex].quantity - 1
    };
  } else {
    updatedInventory.splice(inventoryItemIndex, 1);
  }
  
  messages.push(`你使用了 ${ballType}！`);
  
  // 获取精灵球加成
  const ballBonus = ballCaptureBonuses[ballType.toLowerCase()] || 1.0;
  
  // 获取状态加成
  const statusBonus = statusCaptureBonuses[wildPokemon.statusCondition || 'default'] || 1.0;
  
  // 计算捕获几率
  const captureRate = calculateCaptureRate(wildPokemon, ballBonus, statusBonus);
  
  // 确定是否捕获成功
  const randomValue = Math.random();
  success = randomValue < captureRate || ballType.toLowerCase() === 'masterball';
  
  if (success) {
    // 捕获成功
    messages.push('哦！好像被抓住了！');
    messages.push(`恭喜！你成功捕获了 ${wildPokemon.speciesName || wildPokemon.pokedexId}！`);
    
    // 复制野生宝可梦并调整状态
    const capturedPokemon: PokemonInstance = {
      ...wildPokemon,
      // 可以在此处添加捕获时的特殊处理，如重置某些值
    };
    
    // 更新玩家的队伍或PC存储
    let updatedTeam = [...playerState.team];
    let updatedPCBox = playerState.pcBox ? [...playerState.pcBox] : [];
    
    // 如果队伍未满，添加到队伍
    if (updatedTeam.length < 6) {
      updatedTeam.push(capturedPokemon);
      messages.push(`${capturedPokemon.speciesName || capturedPokemon.pokedexId} 被加入了你的队伍！`);
    } 
    // 否则，添加到PC存储
    else {
      updatedPCBox.push(capturedPokemon);
      messages.push(`队伍已满！${capturedPokemon.speciesName || capturedPokemon.pokedexId} 被传送到了PC存储盒！`);
    }
    
    // 更新图鉴
    const updatedPokedex = { ...playerState.pokedex };
    
    // 确保seen数组存在
    if (!updatedPokedex.seen) {
      updatedPokedex.seen = [];
    }
    
    // 确保caught数组存在
    if (!updatedPokedex.caught) {
      updatedPokedex.caught = [];
    }
    
    // 添加到图鉴的已捕获列表
    if (!updatedPokedex.caught.includes(capturedPokemon.pokedexId)) {
      updatedPokedex.caught.push(capturedPokemon.pokedexId);
      
      // 如果不在已见列表中，也添加到已见列表
      if (!updatedPokedex.seen.includes(capturedPokemon.pokedexId)) {
        updatedPokedex.seen.push(capturedPokemon.pokedexId);
      }
      
      messages.push(`${capturedPokemon.speciesName || capturedPokemon.pokedexId} 的数据被记录在图鉴中！`);
    }
    
    // 返回更新后的玩家状态
    return {
      updatedPlayerState: {
        team: updatedTeam,
        pcBox: updatedPCBox,
        inventory: updatedInventory,
        pokedex: updatedPokedex,
        currentBattle: undefined
      },
      messages,
      success
    };
  } else {
    // 捕获失败
    messages.push('可惜！宝可梦挣脱了！');
    
    return {
      updatedPlayerState: {
        inventory: updatedInventory
      },
      messages,
      success
    };
  }
}

/**
 * 计算并更新捕获到的宝可梦的昵称
 * @param pokemon 捕获的宝可梦
 * @param nickname 要设置的昵称
 * @returns 更新后的宝可梦
 */
export function setNickname(pokemon: PokemonInstance, nickname: string): PokemonInstance {
  // 验证昵称长度
  if (nickname.length > 12) {
    nickname = nickname.substring(0, 12);
  }
  
  // 返回更新后的宝可梦
  return {
    ...pokemon,
    nickname
  };
}