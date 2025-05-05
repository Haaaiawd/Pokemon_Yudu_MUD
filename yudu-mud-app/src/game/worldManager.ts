import { WorldPlace, Location, Route, getLocations } from '../lib/gameData';

/**
 * 管理游戏世界地图数据和地点/路线查找。
 */
class WorldManager {
  private locations: Map<string, Location> = new Map();
  private routes: Map<string, Route> = new Map();
  private allPlaces: Map<string, WorldPlace> = new Map();
  private isInitialized: boolean = false;

  /**
   * 加载并初始化世界数据。
   * 必须在使用管理器之前调用。
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('WorldManager is already initialized.');
      return;
    }

    try {
      console.log('Initializing WorldManager: Loading locations...');
      const worldData = await getLocations();

      worldData.forEach(place => {
        this.allPlaces.set(place.id, place);
        if (place.type === 'location') {
          this.locations.set(place.id, place);
        } else if (place.type === 'route') {
          this.routes.set(place.id, place);
        }
      });

      this.isInitialized = true;
      console.log(`WorldManager initialized successfully. Loaded ${this.allPlaces.size} places (${this.locations.size} locations, ${this.routes.size} routes).`);
    } catch (error) {
      console.error('Failed to initialize WorldManager:', error);
      throw new Error('Could not load world data for WorldManager.');
    }
  }

  /**
   * 检查管理器是否已初始化。
   */
  ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('WorldManager has not been initialized. Call initialize() first.');
    }
  }

  /**
   * 根据 ID 获取地点或路线信息。
   * @param id 地点或路线的 ID
   * @returns WorldPlace 或 undefined (如果未找到)
   */
  getPlaceById(id: string): WorldPlace | undefined {
    this.ensureInitialized();
    return this.allPlaces.get(id);
  }

  /**
   * 根据 ID 获取地点信息。
   * @param id 地点的 ID
   * @returns Location 或 undefined (如果未找到或不是地点)
   */
  getLocationById(id: string): Location | undefined {
    this.ensureInitialized();
    const place = this.allPlaces.get(id);
    return place?.type === 'location' ? place : undefined;
  }

  // --- 未来可能添加的功能 ---
  // - getRouteById(id: string): Route | undefined;
  // - getLocationByCoordinates(x: number, y: number): Location | undefined; // 如果有坐标系统
  // - findPath(startLocationId: string, endLocationId: string): string[] | null; // 寻路
  // - getValidExits(locationId: string): { [exitId: string]: string }; // 获取有效出口
}

// 创建并导出 WorldManager 的单例
// 注意：在 Vercel Serverless 环境中，每次函数调用可能是新的实例，
// 可能需要更复杂的缓存策略或在全局范围内初始化。
// 但对于基本功能，先这样实现。
const worldManager = new WorldManager();

export default worldManager;

// 建议在应用启动时（例如 _app.ts 或全局 API 中间件，如果适用）调用一次初始化
// worldManager.initialize().catch(console.error); 