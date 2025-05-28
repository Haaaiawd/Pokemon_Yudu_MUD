import { Player } from '@/interfaces/database';
import worldManager from './worldManager';
import { getPokedexSummary, getItems } from '@/lib/gameData';
import { PokemonInstance } from '@/interfaces/pokemon';
import { getPotentialWildPokemon } from './encounterManager';
import { getLocationMapOverview, getEnhancedLocationMap, getAreaMap } from '@/lib/mapUtils';  // 导入地图工具

// 定义物品数据接口，确保类型安全
interface ItemData {
  id: string;
  name: {
    zh: string;
    en?: string;
  };
  // 可以根据实际需要添加更多属性
}

// 方向映射
const directionMap: { [key: string]: string } = {
  north: 'north', n: 'north',
  south: 'south', s: 'south',
  east: 'east', e: 'east',
  west: 'west', w: 'west',
  up: 'up', u: 'up',
  down: 'down', d: 'down',
};

// 特殊地点缩写映射
const placeMap: { [key: string]: string } = {
  pc: 'pc',          // Pokemon Center
  pokemart: 'mart',  // Pokemon Mart
  mart: 'mart',      // Pokemon Mart
  shop: 'mart',      // Pokemon Mart
  center: 'pc',      // Pokemon Center
};

// 命令处理结果
interface CommandResult {
  output: string;
  updatedPlayerState: Partial<Player>;
}

/**
 * 命令管理器
 */
const commandManager = {
  /**
   * 处理玩家输入的命令
   */
  async processCommand(command: string, playerState: Player): Promise<CommandResult> {
    const commandClean = command.trim().toLowerCase();
    const parts = commandClean.split(' ');
    const verb = parts[0];
    const argument = parts.slice(1).join(' '); // 所有参数合并为一个字符串
    
    let output = '';
    let updatedPlayerState: Partial<Player> = {}; // 需要更新的玩家状态
    
    // 确保世界管理器已初始化
    if (!(worldManager as any).isInitialized) {
      await worldManager.initialize();
    }
    
    // 处理移动命令
    let targetDirection: string | undefined = undefined;
    
    // 检查是否是方向命令
    if (directionMap[verb]) {
      targetDirection = directionMap[verb];
    } 
    // 检查是否是 "go 方向" 格式
    else if (verb === 'go' && parts.length > 1 && directionMap[parts[1]]) {
      targetDirection = directionMap[parts[1]];
    }
    // 检查常见的 "enter" 和 "exit" 同义词
    else if (verb === 'enter' || verb === 'in') {
      targetDirection = 'enter';
    } else if (verb === 'exit' || verb === 'out' || verb === 'leave') {
      targetDirection = 'out';
    }
    // 检查特殊地点缩写
    else if (placeMap[verb]) {
      targetDirection = placeMap[verb];
    }
    // 检查是否是 "go 地点缩写" 格式
    else if (verb === 'go' && parts.length > 1 && placeMap[parts[1]]) {
      targetDirection = placeMap[parts[1]];
    }
    
    // 如果是移动命令，执行移动逻辑
    if (targetDirection) {
      return this.handleMovement(targetDirection, playerState);
    }
    
    // 处理其他命令
    switch (verb) {
      case 'look':
      case 'l':
      case 'examine':
      case 'ex':
        return this.handleLook(argument, playerState);
        
      case 'map':
      case '地图':
        return this.handleMap(argument, playerState);
        
      case 'inventory':
      case 'inv':
      case 'i':
        return this.handleInventory(playerState);
        
      case 'pokemon':
      case 'team':
        return this.handleTeam(playerState);
        
      case 'help':
      case 'h':
        return this.handleHelp();
        
      case 'get':
      case 'take':
        return this.handleGetItem(argument, playerState);
        
      case 'drop':
        return this.handleDropItem(argument, playerState);
        
      case 'status':
      case 'stats':
        return this.handleStatus(playerState);
        
      default:
        return {
          output: `未知命令："${command}"，输入 "help" 查看可用命令。`,
          updatedPlayerState: {}
        };
    }
  },
  
  /**
   * 处理移动命令
   */
  async handleMovement(direction: string, playerState: Player): Promise<CommandResult> {
    const currentLocation = worldManager.getLocationById(playerState.locationId);
    
    if (!currentLocation) {
      return {
        output: `错误：无法找到当前位置，ID: ${playerState.locationId}`,
        updatedPlayerState: {}
      };
    }
    
    // 检查该方向是否有出口
    const targetLocationId = currentLocation.exits[direction];
    
    if (!targetLocationId) {
      return {
        output: `你不能向 ${direction} 方向走。`,
        updatedPlayerState: {}
      };
    }
    
    // 尝试获取目标位置
    const nextLocation = worldManager.getLocationById(targetLocationId);
    
    if (!nextLocation) {
      return {
        output: `错误：找不到目标位置，ID: ${targetLocationId}`,
        updatedPlayerState: {}
      };
    }
      // 构建移动信息
    let output = `你向 ${direction} 方向移动。\n\n`;
    output += `**${nextLocation.name.zh} (${nextLocation.name.en || ''})**\n`;
    output += `${nextLocation.description}\n`;
    
    // 构建位置地图信息
    const locationsMap = new Map();
    worldManager.getAllLocationIds().forEach(id => {
      const loc = worldManager.getLocationById(id);
      if (loc) locationsMap.set(id, loc);
    });
      const mapOverview = getEnhancedLocationMap(nextLocation, locationsMap);
    if (mapOverview) {
      output += `\n${mapOverview}\n`;
    } else {
      // 如果地图生成失败，仍然显示基本的出口信息
      const availableExits = Object.keys(nextLocation.exits).join(', ');
      output += `\n出口: ${availableExits || '无'}`;
    }
    
    // 返回移动结果
    return {
      output,
      updatedPlayerState: { locationId: targetLocationId }
    };
  },
  
  /**
   * 处理查看命令
   */
  async handleLook(target: string, playerState: Player): Promise<CommandResult> {
    const currentLocation = worldManager.getLocationById(playerState.locationId);
    
    if (!currentLocation) {
      return {
        output: `错误：无法找到当前位置，ID: ${playerState.locationId}`,
        updatedPlayerState: {}
      };
    }
    
    // 如果没有指定目标或目标是当前位置，则查看当前位置
    if (!target || target === currentLocation.id || 
        target === currentLocation.name.zh.toLowerCase() || 
        target === (currentLocation.name.en || '').toLowerCase()) {
      
      // 构建位置描述
      let output = `**${currentLocation.name.zh} (${currentLocation.name.en || ''})**\n`;
      output += `${currentLocation.description}\n`;
        // 显示位置上的物品
      if (currentLocation.items && currentLocation.items.length > 0) {
        const allItems = await getItems();
        output += "\n你看到地上有：";
        
        const itemNames = currentLocation.items.map(itemId => {
          // 使用明确的类型断言避免类型"never"错误
          const itemData = allItems.find(i => i.id === itemId) as ItemData | undefined;
          if (itemData) {
            const nameZh = itemData.name.zh;
            const nameEn = itemData.name.en || itemData.id;
            return `${nameZh}(${nameEn})`;
          } else {
            return itemId;
          }
        });
        
        output += itemNames.join('、') + '\n';
      }
      
      // 构建位置地图信息
      const locationsMap = new Map();
      worldManager.getAllLocationIds().forEach(id => {
        const loc = worldManager.getLocationById(id);
        if (loc) locationsMap.set(id, loc);
      });
        const mapOverview = getEnhancedLocationMap(currentLocation, locationsMap);
      if (mapOverview) {
        output += `\n${mapOverview}\n`;
      } else {
        // 如果地图生成失败，仍然显示基本的出口信息
        const availableExits = Object.keys(currentLocation.exits).join(', ');
        output += `\n出口: ${availableExits || '无'}`;
      }
      
      return {
        output,
        updatedPlayerState: {}
      };
    }
    
    // 如果目标是方向，则查看那个方向
    if (directionMap[target]) {
      const direction = directionMap[target];
      const exitId = currentLocation.exits[direction];
      
      if (exitId) {
        const exitLocation = worldManager.getLocationById(exitId);
        return {
          output: `向 ${direction} 方向看，那边是 ${exitLocation ? `${exitLocation.name.zh} (${exitLocation.name.en || ''})` : '未知区域'}。`,
          updatedPlayerState: {}
        };
      } else {
        return {
          output: `那个方向 (${target}) 没有出口。`,
          updatedPlayerState: {}
        };
      }
    }
    
    // 如果目标是特殊地点缩写，则查看那个地点
    if (placeMap[target]) {
      const place = placeMap[target];
      const exitId = currentLocation.exits[place];
      
      if (exitId) {
        const exitLocation = worldManager.getLocationById(exitId);
        return {
          output: `向 ${place === 'pc' ? '宝可梦中心' : '商店'} 方向看，那边是 ${exitLocation ? `${exitLocation.name.zh} (${exitLocation.name.en || ''})` : '未知区域'}。`,
          updatedPlayerState: {}
        };
      } else {
        return {
          output: `这里没有 ${place === 'pc' ? '宝可梦中心' : '商店'}。`,
          updatedPlayerState: {}
        };
      }
    }
    
    // 如果目标是"pokemon"，处理查看宝可梦
    if (target === 'pokemon') {
      // 这部分逻辑将在后续实现，这里添加一个占位
      return {
        output: `这个区域没有宝可梦。`,
        updatedPlayerState: {}
      };
    }
    
    // 如果目标是其他东西
    return {
      output: `你仔细看了看 ${target}，但没有发现什么特别之处。`,
      updatedPlayerState: {}
    };
  },
  
  /**
   * 处理查看背包命令
   */
  async handleInventory(playerState: Player): Promise<CommandResult> {
    if (playerState.inventory.length === 0) {
      return {
        output: "你的背包是空的。",
        updatedPlayerState: {}
      };
    }
    
    // 加载物品数据
    const allItems = await getItems();
    
    // 构建背包内容描述
    let output = "背包物品:\n";
    output += "--------------------\n";
    
    playerState.inventory.forEach(invItem => {
      // 使用明确的类型声明避免类型"never"错误
      const itemData = allItems.find(i => i.id === invItem.itemId) as ItemData | undefined;
      
      if (itemData) {
        // 提取属性到变量，避免在模板字符串中直接访问可能不存在的属性
        const nameZh = itemData.name.zh;
        const nameEn = itemData.name.en || itemData.id;
        const name = `${nameZh}(${nameEn})`;
        output += `- ${name} x${invItem.quantity}\n`;
      } else {
        // 物品数据不存在，仅显示ID
        output += `- ${invItem.itemId} x${invItem.quantity}\n`;
      }
    });
    
    output += "--------------------";
    
    return {
      output,
      updatedPlayerState: {}
    };
  },
  
  /**
   * 处理查看队伍命令
   */
  async handleTeam(playerState: Player): Promise<CommandResult> {
    const team = playerState.team;
    
    if (team.length === 0) {
      return {
        output: "你的队伍里目前没有宝可梦。",
        updatedPlayerState: {}
      };
    }
    
    // 加载宝可梦图鉴数据
    const pokedexSummaryArray = await getPokedexSummary();
    
    // 构建队伍信息
    let output = "当前队伍:\n";
    output += "--------------------\n";
    
    team.forEach((pokemon: PokemonInstance, index) => {
      // 查找种族信息
      const speciesSummary = pokedexSummaryArray.find(entry => entry.yudex_id === pokemon.pokedexId);
      
      // 使用昵称或种族名称
      const name = pokemon.nickname || (speciesSummary ? speciesSummary.name : `宝可梦 #${pokemon.pokedexId}`);
      const status = pokemon.statusCondition ? ` [${pokemon.statusCondition}]` : '';
      
      output += `${index + 1}. ${name} (Lv. ${pokemon.level}) HP: ${pokemon.currentHp}/${pokemon.maxHp}${status}\n`;
    });
    
    output += "--------------------";
    
    return {
      output,
      updatedPlayerState: {}
    };
  },
  
  /**
   * 处理帮助命令
   */
  async handleHelp(): Promise<CommandResult> {
    const output = `
**豫都地区冒险 - 命令帮助**

**基本命令:**
- \`look\` 或 \`l\` - 查看当前位置
- \`look <方向>\` - 查看某个方向
- \`look <物体>\` - 查看特定物体
- \`look pokemon\` - 查看当前区域的宝可梦
- \`go <方向>\` 或直接输入方向 (\`north\`, \`n\`, \`east\`, \`e\` 等) - 向指定方向移动
- \`inventory\` 或 \`inv\` 或 \`i\` - 查看背包
- \`team\` 或 \`pokemon\` - 查看当前队伍
- \`status\` 或 \`stats\` - 查看玩家状态
- \`help\` 或 \`h\` - 显示帮助信息

**地图命令:**
- \`map\` 或 \`地图\` - 显示增强版地图（默认）
- \`map area\` 或 \`map 区域\` - 显示区域地图
- \`map simple\` 或 \`map 简单\` - 显示简单版地图
- \`map enhanced\` 或 \`map 增强\` - 显示详细增强版地图

**特殊地点:**
- \`pc\` 或 \`center\` - 前往宝可梦中心
- \`mart\` 或 \`shop\` 或 \`pokemart\` - 前往商店
- \`look pc\` - 查看宝可梦中心方向
- \`look mart\` - 查看商店方向

**物品相关:**
- \`get <物品>\` 或 \`take <物品>\` - 拿起物品
- \`drop <物品>\` - 丢弃物品
- \`use <物品>\` - 使用物品 (开发中)

**宝可梦相关:**
- \`pokedex\` - 查看图鉴 (开发中)
- \`battle\` - 战斗相关命令 (开发中)
- \`catch\` - 捕捉宝可梦 (开发中)
- \`train\` - 训练宝可梦 (开发中)

**其他:**
- \`save\` - 保存游戏 (开发中)
- \`load\` - 加载游戏 (开发中)
    `;
    
    return {
      output,
      updatedPlayerState: {}
    };
  },
  
  /**
   * 处理获取物品命令
   */
  async handleGetItem(itemName: string, playerState: Player): Promise<CommandResult> {
    if (!itemName) {
      return {
        output: "你要捡起什么？ (格式: get <物品名称>)",
        updatedPlayerState: {}
      };
    }
    
    const currentLocation = worldManager.getLocationById(playerState.locationId);
    
    if (!currentLocation || !currentLocation.items || currentLocation.items.length === 0) {
      return {
        output: "这里地上什么也没有。",
        updatedPlayerState: {}
      };
    }
    
    // 加载物品数据
    const allItems = await getItems();
    
    // 查找物品
    let foundItemIndex = -1;
    // 使用明确的类型定义，避免推断为never
    let foundItemData: ItemData | null = null;
    
    foundItemIndex = currentLocation.items.findIndex(itemId => {
      const itemData = allItems.find(i => i.id === itemId);
      if (!itemData) return false;
      
      if (itemData.id.toLowerCase() === itemName.toLowerCase() || 
          itemData.name.zh.toLowerCase() === itemName.toLowerCase() ||
          (itemData.name.en && itemData.name.en.toLowerCase() === itemName.toLowerCase())) {
        foundItemData = itemData as ItemData;
        return true;
      }
      
      return false;
    });
    
    if (foundItemIndex === -1 || !foundItemData) {
      return {
        output: `地上没有找到 '${itemName}'。`,
        updatedPlayerState: {}
      };
    }
    
    // 获取物品ID
    const itemIdToGet = currentLocation.items[foundItemIndex];
    
    // 添加到玩家背包
    const updatedInventory = [...playerState.inventory];
    
    // 检查是否已有该物品
    const existingItemIndex = updatedInventory.findIndex(item => item.itemId === itemIdToGet);
    
    if (existingItemIndex >= 0) {
      // 如果已有该物品，增加数量
      updatedInventory[existingItemIndex] = {
        ...updatedInventory[existingItemIndex],
        quantity: updatedInventory[existingItemIndex].quantity + 1
      };
    } else {
      // 如果没有该物品，添加新物品
      updatedInventory.push({
        itemId: itemIdToGet,
        quantity: 1
      });
    }
    
    // 重新确认物品类型并提取属性，避免在返回语句中直接访问对象属性
    // 这样可以解决类型"never"上不存在属性的错误
    const itemData: ItemData = foundItemData; // 显式类型转换
    const itemNameZh = itemData.name.zh;
    const itemNameEn = itemData.name.en || itemData.id;
    
    return {
      output: `你捡起了 ${itemNameZh}(${itemNameEn})。`,
      updatedPlayerState: { inventory: updatedInventory }
    };
  },
  
  /**
   * 处理丢弃物品命令
   */
  async handleDropItem(itemName: string, playerState: Player): Promise<CommandResult> {
    if (!itemName) {
      return {
        output: "你要丢弃什么？ (格式: drop <物品名称>)",
        updatedPlayerState: {}
      };
    }
    
    // 加载物品数据
    const allItems = await getItems();
    
    // 查找背包中的物品
    let foundInventoryItemIndex = -1;
    // 明确类型定义，避免推断为never
    let foundInventoryItemData: ItemData | null = null;
    
    foundInventoryItemIndex = playerState.inventory.findIndex(invItem => {
      const itemData = allItems.find(i => i.id === invItem.itemId);
      if (!itemData) return false;
      
      if (itemData.id.toLowerCase() === itemName.toLowerCase() || 
          itemData.name.zh.toLowerCase() === itemName.toLowerCase() ||
          (itemData.name.en && itemData.name.en.toLowerCase() === itemName.toLowerCase())) {
        foundInventoryItemData = itemData as ItemData;
        return true;
      }
      
      return false;
    });
    
    if (foundInventoryItemIndex === -1 || !foundInventoryItemData) {
      return {
        output: `你的背包里没有 '${itemName}'。`,
        updatedPlayerState: {}
      };
    }
    
    // 获取物品
    const itemToDrop = playerState.inventory[foundInventoryItemIndex];
    
    // 创建更新后的背包
    const updatedInventory = [...playerState.inventory];
    
    // 从背包中移除
    if (itemToDrop.quantity > 1) {
      updatedInventory[foundInventoryItemIndex] = {
        ...updatedInventory[foundInventoryItemIndex],
        quantity: updatedInventory[foundInventoryItemIndex].quantity - 1
      };
    } else {
      updatedInventory.splice(foundInventoryItemIndex, 1);
    }
    
    // 重新确认物品类型并提取属性，避免在返回语句中直接访问对象属性
    // 这样可以解决类型"never"上不存在属性的错误
    const itemData: ItemData = foundInventoryItemData; // 显式类型转换
    const itemNameZh = itemData.name.zh;
    const itemNameEn = itemData.name.en || itemData.id;
    
    // 返回结果 (添加到地点的逻辑在API中处理)
    return {
      output: `你丢下了 ${itemNameZh}(${itemNameEn})。`,
      updatedPlayerState: { inventory: updatedInventory }
    };
  },
  
  /**
   * 处理查看状态命令
   */
  async handleStatus(playerState: Player): Promise<CommandResult> {
    let output = `**${playerState.name} 状态**\n`;
    output += `--------------------\n`;
    output += `金钱: ${playerState.money} 元\n`;
    output += `徽章数: ${playerState.badges.length}\n`;
    output += `队伍宝可梦: ${playerState.team.length}/6\n`;
    output += `图鉴登记: 已见到 ${playerState.pokedex.seen.length} 种, 已捕获 ${playerState.pokedex.caught.length} 种\n`;
    output += `--------------------`;
    
    return {
      output,
      updatedPlayerState: {}
    };
  },

  /**
   * 处理地图命令
   */
  async handleMap(argument: string, playerState: Player): Promise<CommandResult> {
    const currentLocation = worldManager.getLocationById(playerState.locationId);
    
    if (!currentLocation) {
      return {
        output: `错误：无法找到当前位置，ID: ${playerState.locationId}`,
        updatedPlayerState: {}
      };
    }

    // 构建位置地图信息
    const locationsMap = new Map();
    worldManager.getAllLocationIds().forEach(id => {
      const loc = worldManager.getLocationById(id);
      if (loc) locationsMap.set(id, loc);
    });

    let mapDisplay = '';
    let message = '';
    const args = argument.trim().toLowerCase();
    
    if (args === '' || args === 'area' || args === '区域' || args === 'region' || args === '地区') {
      mapDisplay = getAreaMap(currentLocation, locationsMap);
      message = `区域概览地图。\n提示：使用 "map simple" 查看详细的本地地图。`;
    } else if (args === 'simple' || args === '简单' || args === 'basic' || args === '基本') {
      mapDisplay = getLocationMapOverview(currentLocation, locationsMap);
      message = `简单本地地图。\n提示：使用 "map area" 查看区域概览。`;
    } else {
      // 对于无法识别的参数，默认显示简单本地地图并给出帮助信息
      mapDisplay = getLocationMapOverview(currentLocation, locationsMap);
      message = `地图选项: \n • "map" 或 "map area" - 查看区域概览 \n • "map simple" - 查看简单本地地图 (当前显示)\n未知参数 '${args}'. 显示简单本地地图。`;
    }

    return {
      output: `${mapDisplay}\n\n${message}`,
      updatedPlayerState: {}
    };
  },
};

export default commandManager;