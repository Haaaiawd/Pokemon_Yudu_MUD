// g:\Pokemon_data\Pokemon_Yudu_MUD\yudu-mud-app\src\app\api\map\route.ts

import { NextResponse, NextRequest } from 'next/server';
import worldManager from '@/game/worldManager';
import { generateLocationMap, generateAreaMap, getLocationMapOverview } from '@/lib/mapUtils';
import { Player } from '@/interfaces/database';

interface MapRequestPayload {
  command?: string; // 可选，完整命令字符串，如 'map' 或 'map area'
  playerState: Partial<Player> & { locationId: string };
}

interface MapResponseData {
  output: string;
  mapData?: {
    type: 'location' | 'area';
    mapString: string;
  };
  error?: string;
}

/**
 * 处理地图命令的API处理程序
 * 支持以下命令格式:
 * - map / 地图 - 显示当前位置的详细地图
 * - map area / 地图 区域 - 显示整个区域的地图
 */
async function handler(req: NextRequest): Promise<NextResponse<MapResponseData>> {
  if (req.method !== 'POST') {
    return NextResponse.json({ 
      output: '方法不允许', 
      error: '方法不允许' 
    }, { status: 405 });
  }

  try {
    // 解析请求数据
    const payload: MapRequestPayload = await req.json();
    const { playerState } = payload;
    let command = payload.command || 'map';
    command = command.toLowerCase().trim();

    // 确保世界管理器已初始化
    if (!(worldManager as any).isInitialized) {
      console.log('为地图API请求初始化世界管理器...');
      await worldManager.initialize();
    }

    // 检查玩家位置是否有效
    if (!playerState || !playerState.locationId) {
      return NextResponse.json({ 
        output: '错误：无法确定玩家位置。', 
        error: '缺少玩家位置信息' 
      }, { status: 400 });
    }

    // 获取当前位置信息
    const currentLocation = worldManager.getLocationById(playerState.locationId);
    if (!currentLocation) {
      return NextResponse.json({ 
        output: `错误：找不到位置ID为 ${playerState.locationId} 的位置！`, 
        error: '无效的位置ID' 
      }, { status: 404 });
    }

    // 获取所有位置数据 - 作为一个Map对象
    // 由于WorldManager没有直接提供getAllLocations()方法，我们创建一个位置ID到位置的映射
    const allLocationIds = worldManager.getAllLocationIds();
    const locationsMap = new Map();
    allLocationIds.forEach(id => {
      const location = worldManager.getLocationById(id);
      if (location) {
        locationsMap.set(id, location);
      }
    });

    // 分析命令并生成相应的地图
    const parts = command.split(/\s+/);
    const isAreaMap = parts.length > 1 && (parts[1] === 'area' || parts[1] === '区域');

    let output: string;
    let mapString: string;    if (isAreaMap) {
      // 生成区域地图
      mapString = generateAreaMap(currentLocation, locationsMap);
      // 由于 currentLocation 可能没有 area 属性，使用一个更通用的描述
      const locationName = currentLocation.name.zh;
      output = `这是${locationName}周围区域的地图：`;
      
      return NextResponse.json({
        output,
        mapData: {
          type: 'area',
          mapString
        }
      });
    } else {
      // 生成位置地图
      mapString = generateLocationMap(currentLocation, locationsMap);
      output = `这是${currentLocation.name.zh}的地图：`;
      
      return NextResponse.json({
        output,
        mapData: {
          type: 'location',
          mapString
        }
      });
    }
  } catch (error: any) {
    console.error('处理地图命令时出错:', error);
    return NextResponse.json({ 
      output: '处理请求时发生内部错误。', 
      error: error.message 
    }, { status: 500 });
  }
}

export { handler as POST };
