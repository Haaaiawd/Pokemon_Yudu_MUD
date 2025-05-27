// g:\Pokemon_data\Pokemon_Yudu_MUD\yudu-mud-app\src\lib\mapUtils.ts
import { Location as GameLocation } from '@/lib/gameData';

/**
 * 改编自游戏数据中的位置退出定义。
 * Modified to align with the actual locations.json data.
 */
export interface ExitData {
  [direction: string]: string; // Key is the direction, value is the location ID
}

/**
 * 改编自游戏数据中的位置定义，匹配 locations.json.
 * 兼容 gameData.ts 中的 Location 接口
 */
export interface LocationData {
  id: string;
  type: string; // 'location' or 'area'
  name: {
    zh: string;
    en?: string;
  };
  description: string;
  area?: string; // Area ID this location belongs to (for location type)
  exits: ExitData;
  features?: string | string[];
  environment?: string;
  architecture?: string;
  coordinates?: { x: number; y: number; z?: number }; // Optional for mapping
  items?: string[]; // Item IDs that can be found at this location
  tags?: string[]; // Custom tags
}

/**
 * 表示所有位置数据的集合，键是位置ID.
 */
export interface LocationsData {
  [key: string]: LocationData;
}

// 辅助函数：将游戏位置数据类型转换为地图位置数据类型
export function convertToMapLocation(location: GameLocation | LocationData): LocationData {
  // 这里假设两种类型在基本字段上兼容，只需处理特殊字段
  return location as unknown as LocationData;
}

// 辅助函数：将位置映射转换为地图位置映射
export function convertToMapLocations(locations: Map<string, GameLocation> | {[key: string]: GameLocation | LocationData}): LocationsData {
  const result: LocationsData = {};
  
  if (locations instanceof Map) {
    // 如果是Map类型
    locations.forEach((location, id) => {
      result[id] = convertToMapLocation(location);
    });
  } else {
    // 如果是对象类型
    Object.entries(locations).forEach(([id, location]) => {
      result[id] = convertToMapLocation(location);
    });
  }
  
  return result;
}

// 符号定义，用于地图绘制
const mapSymbols = {
  location: {
    center: '█████', // 当前位置
    north: '  ║  ',
    south: '  ║  ',
    east: '═════',
    west: '═════',
    northEast: '  ╝  ',
    northWest: '  ╚  ',
    southEast: '  ╗  ',
    southWest: '  ╔  ',
    wall: '     ',
    corner: '     '
  },
  exits: {
    north: '  ↑  ',
    south: '  ↓  ',
    east: '  →  ',
    west: '  ←  ',
    up: '  △  ',
    down: '  ▽  ',
    special: '  ◆  ' // 如建筑物入口，特殊通道等
  },
  paths: {
    horizontal: '─────',
    vertical: '  │  ',
    northEast: '  └──',
    northWest: '──┘  ',
    southEast: '  ┌──',
    southWest: '──┐  ',
    cross: '──┼──',
    tNorth: '──┬──',
    tSouth: '──┴──',
    tEast: '  ├──',
    tWest: '──┤  '
  },
  player: {
    symbol: '  ☺  ',
    arrow: ' → '
  },
  room: {
    empty: '     ',
    topLeft: '┌───┐',
    topRight: '┌───┐',
    bottomLeft: '└───┘',
    bottomRight: '└───┘',
    horizontal: '│   │',
    player: '│ ☺ │'
  }
};

/**
 * 简化的方向映射，将诸如 "out" 或 "enter" 映射到一般方向。
 */
const directionAliases: { [key: string]: string } = {
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
  u: 'up',
  d: 'down',
  enter: 'special',
  in: 'special',
  out: 'special',
  exit: 'special',
  inside: 'special',
  upstairs: 'up',
  downstairs: 'down',
  outside: 'special',
  climb: 'special',
  continue: 'special',
  back: 'special',
  pc: 'special',
  mart: 'special',
  square: 'special',
  lobby: 'special',
  challenge: 'special',
  path: 'special'
};

/**
 * 翻译方向的中文展示
 */
const directionZh: { [key: string]: string } = {
  north: '北方',
  south: '南方',
  east: '东方',
  west: '西方',
  up: '上方',
  down: '下方',
  special: '通道',
  // 特殊方向
  enter: '进入',
  in: '进入',
  out: '出去',
  exit: '出口',
  inside: '内部',
  upstairs: '楼上',
  downstairs: '楼下',
  outside: '外面',
  climb: '攀爬',
  continue: '继续',
  back: '返回',
  pc: '宝可梦中心',
  mart: '商店',
  square: '广场',
  lobby: '大厅',
  challenge: '挑战区',
  path: '小径'
};

/**
 * 获取方向的统一标识符，处理别名。
 */
function getDirectionIdentifier(direction: string): string {
  const lcDirection = direction.toLowerCase();
  return directionAliases[lcDirection] || lcDirection;
}

/**
 * 获取方向的显示名称，根据上下文使用中文或标准方向。
 */
function getDirectionDisplay(direction: string, useDirectionKey: boolean = false): string {
  if (useDirectionKey) {
    return direction;
  }
  return directionZh[direction] || directionZh[getDirectionIdentifier(direction)] || direction;
}

/**
 * 为当前位置生成一个美观的文本地图，展示出口。
 *
 * 输出示例:
 *
 *   ╔═════════════════════╗
 *   ║   启航广场 (Start)   ║
 *   ╚═══════════╦═════════╝
 *               ║
 *               ▲ 北 - 钟楼入口
 *               ║
 *     ◄ 西      ☺      ► 东 - 研究所入口
 *     丰收大道         宝可梦中心     
 *               ║
 *               ▼ 南 - 农田小径
 *               ║
 *
 * @param currentLocation 当前位置对象。
 * @param allLocations 所有位置数据，用于查找出口名称。
 * @returns 一个字符串，表示当前位置及其出口的地图。
 */
export function generateLocationMap(currentLocation: GameLocation | LocationData, allLocations: Map<string, GameLocation> | {[key: string]: GameLocation | LocationData}): string {
  if (!currentLocation) {
    return "错误：当前位置未定义。";
  }

  const location = convertToMapLocation(currentLocation);
  const locations = convertToMapLocations(allLocations);
  // 标题：位置名称框
  const locationName = `${location.name.zh} (${location.name.en || ''})`;
  const padding = 2;
  const boxWidth = locationName.length + (padding * 2);
  const boxTop = `╔${'═'.repeat(boxWidth)}╗`;
  const boxMiddle = `║${' '.repeat(padding)}${locationName}${' '.repeat(padding)}║`;
  const boxBottom = `╚${'═'.repeat(boxWidth)}╝`;

  // 主要地图区域：位置及周围环境
  const exitEntries = Object.entries(location.exits);
  
  // 这里将输出格式化成预定义的地图格式
  let mapRows: string[] = [];
  
  // 添加标题框
  mapRows.push(boxTop);
  mapRows.push(boxMiddle);
  mapRows.push(boxBottom);
  
  // 建立一个简单的实时图，基于基本方向（北南东西）
  const standardDirections = ['north', 'south', 'east', 'west', 'up', 'down'];
  const directionMap: { [key: string]: { symbol: string; destination: string } } = {};
  
  // 处理特殊出口
  const specialExits: { direction: string; destination: string }[] = [];

  // 组织所有出口信息
  exitEntries.forEach(([direction, exitId]) => {
    const destination = locations[exitId];
    const destName = destination ? `${destination.name.zh}` : exitId;
    const dirId = getDirectionIdentifier(direction);

    if (standardDirections.includes(dirId)) {
      directionMap[dirId] = { 
        symbol: mapSymbols.exits[dirId as keyof typeof mapSymbols.exits],
        destination: destName
      };
    } else {
      specialExits.push({
        direction: direction,
        destination: destName
      });
    }
  });

  // 构建地图中心部分 - 使用更丰富的布局和符号表示
  // 美化北方区域
  let northSection = '';
  if (directionMap.north) {
    northSection = `               ${mapSymbols.exits.north}\n` +
                   `               ${mapSymbols.paths.vertical}\n` + 
                   `    ┌─────────┐${mapSymbols.paths.vertical}┌─────────┐\n` +
                   `    │         │${mapSymbols.paths.vertical}│         │\n` +
                   `    │  北方   │${mapSymbols.paths.vertical}│ ${padString(directionMap.north.destination, 7)} │\n` +
                   `    │         │${mapSymbols.paths.vertical}│         │\n` +
                   `    └─────────┘${mapSymbols.paths.vertical}└─────────┘\n` + 
                   `               ${mapSymbols.paths.vertical}`;
  } else {
    northSection = `\n\n\n\n\n\n\n               ${mapSymbols.paths.vertical}`;
  }
  
  // 美化南方区域
  let southSection = '';
  if (directionMap.south) {
    southSection = `               ${mapSymbols.paths.vertical}\n` +
                   `    ┌─────────┐${mapSymbols.paths.vertical}┌─────────┐\n` +
                   `    │         │${mapSymbols.paths.vertical}│         │\n` +
                   `    │  南方   │${mapSymbols.paths.vertical}│ ${padString(directionMap.south.destination, 7)} │\n` +
                   `    │         │${mapSymbols.paths.vertical}│         │\n` +
                   `    └─────────┘${mapSymbols.paths.vertical}└─────────┘\n` +
                   `               ${mapSymbols.exits.south}`;
  } else {
    southSection = `               ${mapSymbols.paths.vertical}\n\n\n\n\n\n\n`;
  }
  
  // 构建东西方向的中心区域
  let westSection = '';
  if (directionMap.west) {
    westSection = `┌─────────┐     │     `;
    westSection += `\n│         │     │     `;
    westSection += `\n│  西方   │  ←  │     `;
    westSection += `\n│ ${padString(directionMap.west.destination, 7)} │     │     `;
    westSection += `\n└─────────┘     │     `;
  } else {
    westSection = `              │     `;
    westSection += `\n              │     `;
    westSection += `\n              │     `;
    westSection += `\n              │     `;
    westSection += `\n              │     `;
  }
  
  let eastSection = '';
  if (directionMap.east) {
    eastSection = `     ┌─────────┐`;
    eastSection += `\n     │         │`;
    eastSection += `\n     │  →  东方│`;
    eastSection += `\n     │     ${padString(directionMap.east.destination, 7)} │`;
    eastSection += `\n     │         │`;
    eastSection += `\n     └─────────┘`;
  } else {
    eastSection = `     │              `;
    eastSection += `\n     │              `;
    eastSection += `\n     │              `;
    eastSection += `\n     │              `;
    eastSection += `\n     │              `;
    eastSection += `\n                    `;
  }

  // 中心区域 - 玩家当前位置
  let centerArea = `     ┌─────────┐     `;
  centerArea += `\n     │         │     `;
  centerArea += `\n     │    ☺    │     `;
  centerArea += `\n     │ 当前位置 │     `;
  centerArea += `\n     └─────────┘     `;

  // 上下方向信息
  let upDownInfo = '';
  if (directionMap.up || directionMap.down) {
    upDownInfo += `\n   `;
    
    if (directionMap.up) {
      upDownInfo += `↑ 上: ${directionMap.up.destination}   `;
    }
    
    if (directionMap.down) {
      upDownInfo += `↓ 下: ${directionMap.down.destination}`;
    }
  }

  // 组合地图
  mapRows.push('');
  mapRows.push(northSection);
  
  // 东西中心区域由单独的行组成
  const westLines = westSection.split('\n');
  const centerLines = centerArea.split('\n');
  const eastLines = eastSection.split('\n');
  
  // 确保所有方向有相同数量的行
  const maxLines = Math.max(westLines.length, centerLines.length, eastLines.length);
  for (let i = 0; i < maxLines; i++) {
    const westLine = i < westLines.length ? westLines[i] : ' '.repeat(15);
    const centerLine = i < centerLines.length ? centerLines[i] : ' '.repeat(15);
    const eastLine = i < eastLines.length ? eastLines[i] : ' '.repeat(15);
    
    mapRows.push(`${westLine}${centerLine}${eastLine}`);
  }
  
  mapRows.push(southSection);
  
  if (upDownInfo) {
    mapRows.push(upDownInfo);
  }

  // 添加特殊出口信息
  if (specialExits.length > 0) {
    mapRows.push('\n特殊出口:');
    specialExits.forEach(exit => {
      const dirDisplay = getDirectionDisplay(exit.direction, true);
      mapRows.push(`◆ ${dirDisplay} - ${exit.destination}`);
    });
  }

  mapRows.push('');
  return mapRows.join('\n');

// 辅助函数：处理字符串填充，确保显示宽度一致
function padString(str: string, maxLen: number): string {
  if (str.length > maxLen) {
    return str.substring(0, maxLen - 1) + '…';
  }
  const padding = Math.floor((maxLen - str.length) / 2);
  return ' '.repeat(padding) + str + ' '.repeat(maxLen - str.length - padding);
}
}

/**
 * 为整个区域生成文本地图。
 * 这个功能更复杂，涉及多个位置的布局。
 *
 * 输出示例 (概念性):
 *
 *    启程镇地区
 *    ───────────────────────
 *                   ┌───────┐
 *                   │ 钟楼  │
 *                   └───┬───┘
 *                       │
 *    ┌───────┐      ┌───┴───┐      ┌───────┐
 *    │丰收路 ├──────┤ 广场 *├──────┤研究所 │
 *    └───────┘      └───┬───┘      └───────┘
 *                       │
 *                   ┌───┴───┐
 *                   │ 农田  │
 *                   └───────┘
 *
 *    * 你在这里
 *
 * @param currentLocation 玩家当前位置。
 * @param allLocations 所有位置数据。
 * @param areaId 要绘制地图的区域ID。如果未提供，则使用当前位置的区域。
 * @returns 表示指定区域地图的字符串。
 */
export function generateAreaMap(currentLocation: GameLocation | LocationData, allLocations: Map<string, GameLocation> | {[key: string]: GameLocation | LocationData}, areaId?: string): string {
  const location = convertToMapLocation(currentLocation);
  const locations = convertToMapLocations(allLocations);
  
  // 确定目标区域ID
  const targetAreaId = areaId || 
    (location.type === 'location' && (location as any).area) ? 
    (location as any).area : location.id;
  
  if (!targetAreaId) {
    return "错误：无法确定区域ID。";
  }

  // 查找区域内的所有位置
  const locationsInArea = Object.values(locations).filter(loc => {
    // 如果有明确的区域ID并且位置有area属性
    if ((loc as any).area && (loc as any).area === targetAreaId) {
      return true;
    }
    
    // 包括目标位置本身
    if (loc.id === targetAreaId) {
      return true;
    }
    
    // 包括与目标位置直接相连的位置
    const targetExits = locations[targetAreaId]?.exits || {};
    if (Object.values(targetExits).includes(loc.id)) {
      return true;
    }
    
    const locExits = loc.exits || {};
    if (Object.values(locExits).includes(targetAreaId)) {
      return true;
    }
    
    return false;
  });

  if (locationsInArea.length === 0) {
    return `未找到区域 ${targetAreaId} 的位置。`;
  }

  // 确定区域名称
  const areaLocation = locations[targetAreaId];
  const areaName = areaLocation ? areaLocation.name.zh : targetAreaId;

  // 改进的区域地图生成
  let mapString = `\n${areaName}地区地图\n`;
  mapString += "═════════════════════════\n\n";

  // 构建一个简单的图形表示连接关系
  // 首先，组织位置间的连接数据
  const locationNodes: {
    [id: string]: {
      name: string;
      isCurrent: boolean;
      coords: { x: number, y: number };
      connected: string[];
    }
  } = {};

  // 首先，将当前位置放在中心
  locationNodes[location.id] = {
    name: location.name.zh,
    isCurrent: true,
    coords: { x: 5, y: 3 }, // 假设中心位置
    connected: []
  };

  // 然后根据出口关系，尝试放置周围的位置
  const layoutPositions = [
    { x: 5, y: 1 },  // 北
    { x: 5, y: 5 },  // 南
    { x: 8, y: 3 },  // 东
    { x: 2, y: 3 },  // 西
    { x: 8, y: 1 },  // 东北
    { x: 2, y: 1 },  // 西北
    { x: 8, y: 5 },  // 东南
    { x: 2, y: 5 }   // 西南
  ];
  
  let positionIndex = 0;

  // 为简化起见，先添加与当前位置直接相连的位置
  Object.entries(location.exits).forEach(([dir, targetId]) => {
    if (positionIndex < layoutPositions.length && locations[targetId]) {
      const targetLoc = locations[targetId];
      locationNodes[targetId] = {
        name: targetLoc.name.zh,
        isCurrent: false,
        coords: layoutPositions[positionIndex++],
        connected: [location.id]
      };
      locationNodes[location.id].connected.push(targetId);
    }
  });

  // 如果需要添加更多位置，可以再进行拓展
  
  // 基于这些位置数据绘制地图
  // 创建一个网格来表示地图
  const gridSize = { width: 11, height: 7 };
  const grid: string[][] = Array(gridSize.height).fill(0).map(() => 
    Array(gridSize.width).fill('     ')
  );
  
  // 在网格上放置位置
  Object.entries(locationNodes).forEach(([id, node]) => {
    if (node.coords.y < gridSize.height && node.coords.x < gridSize.width) {
      const x = node.coords.x;
      const y = node.coords.y;
      // 放置位置名称
      grid[y][x] = node.isCurrent ? `[${padLocationName(node.name, 3)}]` : `<${padLocationName(node.name, 3)}>`;
    }
  });
  
  // 添加连接线
  Object.entries(locationNodes).forEach(([id, node]) => {
    node.connected.forEach(connId => {
      const target = locationNodes[connId];
      if (target) {
        drawConnection(grid, node.coords, target.coords);
      }
    });
  });
  
  // 将网格转换为字符串
  for (let y = 0; y < gridSize.height; y++) {
    let row = '';
    for (let x = 0; x < gridSize.width; x++) {
      row += grid[y][x];
    }
    mapString += row + '\n';
  }
  
  mapString += "\n" + 
               "图例: [位置] = 当前位置, <位置> = 相连位置\n" +
               "      │ ─ ┌ ┐ └ ┘ = 连接路径\n";
  
  return mapString;
}

// 辅助函数：绘制两点之间的连接
function drawConnection(grid: string[][], from: {x: number, y: number}, to: {x: number, y: number}) {
  // 简单的连接算法 - 只处理水平和垂直连接
  if (from.x === to.x) {
    // 垂直连接
    const startY = Math.min(from.y, to.y) + 1;
    const endY = Math.max(from.y, to.y);
    for (let y = startY; y < endY; y++) {
      grid[y][from.x] = '  │  ';
    }
  } else if (from.y === to.y) {
    // 水平连接
    const startX = Math.min(from.x, to.x) + 1;
    const endX = Math.max(from.x, to.x);
    for (let x = startX; x < endX; x++) {
      grid[from.y][x] = '─────';
    }
  }
  // 可以在这里添加对角线连接逻辑
}

// 辅助函数：处理位置名称填充
function padLocationName(name: string, maxLen: number): string {
  if (name.length > maxLen) {
    return name.substring(0, maxLen - 1) + '…';
  }
  return name;
}

/**
 * 获取当前位置的简洁美观地图，适合在玩家移动或使用look命令时自动显示。
 * 这是一个优化版本，适合常规游戏流程中展示。
 * 
 * @param currentLocation 当前位置对象。
 * @param allLocations 所有位置数据。
 * @returns 适合游戏流中显示的简洁地图字符串。
 */
export function getLocationMapOverview(currentLocation: GameLocation | LocationData, allLocations: Map<string, GameLocation> | {[key: string]: GameLocation | LocationData}): string {
  if (!currentLocation) {
    return "";
  }

  const location = convertToMapLocation(currentLocation);
  const locations = convertToMapLocations(allLocations);

  // 获取所有出口
  const exits = Object.entries(location.exits);
  if (exits.length === 0) {
    return `【${location.name.zh}】- 没有明显出口`;
  }

  // 收集各方向的出口信息
  const directionalExits: {[direction: string]: string} = {};
  const specialExits: string[] = [];
  
  // 处理所有出口
  exits.forEach(([direction, exitId]) => {
    const destination = locations[exitId];
    const destName = destination ? destination.name.zh : exitId;
    const dirId = getDirectionIdentifier(direction);
    
    const standardDirections = ['north', 'south', 'east', 'west', 'up', 'down'];
    if (standardDirections.includes(dirId)) {
      directionalExits[dirId] = destName;
    } else {
      specialExits.push(`${direction}:${destName}`);
    }
  });

  // 辅助函数：截断地名并居中显示
  function formatLocationName(name: string, maxLength: number): string {
    if (name.length > maxLength) {
      return name.substring(0, maxLength - 1) + '…';
    }
    const padding = Math.floor((maxLength - name.length) / 2);
    return ' '.repeat(padding) + name + ' '.repeat(maxLength - name.length - padding);
  }

  // 构建增强版地图，在箭头周围显示地点名称
  let mapString = `【${location.name.zh}】\n`;
  
  // 准备各方向的显示内容
  const northName = directionalExits.north ? formatLocationName(directionalExits.north, 8) : '        ';
  const southName = directionalExits.south ? formatLocationName(directionalExits.south, 8) : '        ';
  const westName = directionalExits.west ? formatLocationName(directionalExits.west, 6) : '      ';
  const eastName = directionalExits.east ? formatLocationName(directionalExits.east, 6) : '      ';
  
  // 构建5行的地图布局
  mapString += '\n';
  
  // 第1行：北方地名
  if (directionalExits.north) {
    mapString += `       ${northName}       \n`;
  } else {
    mapString += '                        \n';
  }
  
  // 第2行：北方箭头
  if (directionalExits.north) {
    mapString += '           ↑            \n';
  } else {
    mapString += '                        \n';
  }
  
  // 第3行：西方地名 + 西箭头 + 玩家 + 东箭头 + 东方地名
  let middleLine = '';
  if (directionalExits.west) {
    middleLine += `${westName} ← `;
  } else {
    middleLine += '         ';
  }
  
  middleLine += ' ☺ ';
  
  if (directionalExits.east) {
    middleLine += `→ ${eastName}`;
  } else {
    middleLine += '         ';
  }
  
  mapString += middleLine + '\n';
  
  // 第4行：南方箭头
  if (directionalExits.south) {
    mapString += '           ↓            \n';
  } else {
    mapString += '                        \n';
  }
  
  // 第5行：南方地名
  if (directionalExits.south) {
    mapString += `       ${southName}       \n`;
  } else {
    mapString += '                        \n';
  }

  // 添加上下方向信息（如果有的话）
  if (directionalExits.up || directionalExits.down) {
    mapString += '\n';
    if (directionalExits.up) {
      mapString += `↗ 上: ${directionalExits.up}  `;
    }
    if (directionalExits.down) {
      mapString += `↙ 下: ${directionalExits.down}`;
    }
    mapString += '\n';
  }
  
  // 添加特殊出口信息
  if (specialExits.length > 0) {
    mapString += '\n特殊出口: ' + specialExits.join(', ');
  }
  
  return mapString;
}
