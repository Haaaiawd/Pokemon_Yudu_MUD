import { Player } from '@/interfaces/database';
import worldManager from './worldManager';
import { getPokemonSpeciesDetails } from '@/lib/gameData'; // Keep for direct use if needed elsewhere, or remove if truly unused
import { createPokemonInstance } from './pokemonUtils'; // Import createPokemonInstance
import { v4 as uuidv4 } from 'uuid';

// 默认起始地点ID
const DEFAULT_STARTING_LOCATION = 'beginville_square';

// 内存中存储的游戏状态（在真实环境中这应该使用数据库）
// key是玩家ID，value是玩家状态
const gameStates: Record<string, Player> = {};

/**
 * 游戏状态管理器
 */
const stateManager = {
  /**
   * 初始化状态管理器
   */
  async initialize() {
    console.log('Initializing StateManager...');
    
    // 确保世界管理器已经初始化
    if (!(worldManager as any).isInitialized) {
      await worldManager.initialize();
    }
    
    console.log('StateManager initialized successfully');
    return true;
  },

  /**
   * 获取玩家状态，如果不存在则创建一个新的
   */
  async getPlayerState(playerId: string, playerName: string = 'Trainer'): Promise<Player> {
    // 如果玩家状态已存在，直接返回
    if (gameStates[playerId]) {
      return gameStates[playerId];
    }

    // 创建新的玩家状态
    console.log(`Creating new player state for ${playerName} (${playerId})`);
    const newPlayer = await this.createNewPlayer(playerId, playerName);
    gameStates[playerId] = newPlayer;
    return newPlayer;
  },

  /**
   * 创建一个新的玩家状态
   */
  async createNewPlayer(playerId: string, playerName: string): Promise<Player> {
    // 确保世界管理器已初始化
    if (!(worldManager as any).isInitialized) {
      await worldManager.initialize();
    }

    // 创建新玩家对象
    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      // 初始位置设为默认起始位置
      locationId: DEFAULT_STARTING_LOCATION,
      currentHp: 100,
      maxHp: 100,
      badges: [],
      money: 3000, // 初始资金
      creditStatus: 0,
      inventory: [
        // 初始物品
        { itemId: 'potion', quantity: 3 },
        { itemId: 'pokeball', quantity: 5 }
      ],
      team: [], // 初始队伍为空
      pcBox: [], // PC存储为空
      pokedex: {
        seen: [],
        caught: []
      },
      questFlags: {
        hasStarterPokemon: false, // 是否已获得初始宝可梦
        // 其他任务标记可以在这里添加
      },
      relationshipFlags: {}
    };

    return newPlayer;
  },

  /**
   * 更新玩家状态
   */
  updatePlayerState(playerId: string, updatedState: Partial<Player>): boolean {
    if (!gameStates[playerId]) {
      console.error(`Cannot update state for non-existent player: ${playerId}`);
      return false;
    }

    // 合并现有状态和更新状态
    gameStates[playerId] = {
      ...gameStates[playerId],
      ...updatedState
    };

    // 这里可以添加状态更新后的保存逻辑（如写入数据库）
    console.log(`Updated state for player ${playerId}`);
    return true;
  },

  /**
   * 删除玩家状态（登出或重置）
   */
  removePlayerState(playerId: string): boolean {
    if (!gameStates[playerId]) {
      return false;
    }

    delete gameStates[playerId];
    console.log(`Removed state for player ${playerId}`);
    return true;
  },

  /**
   * 将游戏状态保存到持久存储（在实现中可替换为数据库操作）
   */
  async saveGameStateToPersistentStorage(): Promise<boolean> {
    // 这里是模拟保存到持久存储的操作
    // 在实际实现中，这里应该调用数据库API进行保存
    console.log('Saving game states to persistent storage...');
    console.log(`Total states in memory: ${Object.keys(gameStates).length}`);
    return true;
  },

  /**
   * 从持久存储加载游戏状态（在实现中可替换为数据库操作）
   */
  async loadGameStatesFromPersistentStorage(): Promise<boolean> {
    // 这里是模拟从持久存储加载的操作
    // 在实际实现中，这里应该调用数据库API进行加载
    console.log('Loading game states from persistent storage...');
    return true;
  },
  
  /**
   * 给玩家添加一只初始宝可梦
   */
  async addStarterPokemon(playerId: string, pokemonId: string): Promise<boolean> {
    if (!gameStates[playerId]) {
      console.error(`Player ${playerId} not found`);
      return false;
    }
    
    try {
      // 获取宝可梦图鉴信息 (createPokemonInstance will do this, but we might want to check existence first or get name)
      const pokemonDetails = await getPokemonSpeciesDetails(pokemonId); 
      if (!pokemonDetails) {
        console.error(`Pokemon details not found for ID: ${pokemonId} before creating instance.`);
        return false;
      }

      // 创建玩家的宝可梦实例（5级初始宝可梦）
      const starterPokemonInstance = await createPokemonInstance(pokemonId, 5);

      if (!starterPokemonInstance) {
        console.error(`Failed to create starter Pokemon instance for ID: ${pokemonId}`);
        return false;
      }

      // 更新玩家队伍
      const player = gameStates[playerId];
      player.team.push(starterPokemonInstance); // Push the instance created by createPokemonInstance
      
      // 更新图鉴状态
      player.pokedex.seen.push(pokemonId);
      player.pokedex.caught.push(pokemonId);
      
      // 设置任务标记
      player.questFlags.hasStarterPokemon = true;
      
      return true;
    } catch (error) {
      console.error('Error adding starter Pokemon:', error);
      return false;
    }
  }
};

export default stateManager;