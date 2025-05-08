import { v4 as uuidv4 } from 'uuid';
import stateManager from './stateManager';

// 保存活跃会话信息
interface Session {
  sessionId: string;
  playerId: string;
  playerName: string;
  lastActivity: Date;
}

// 内存中的会话存储 (在实际应用中应使用数据库或Redis等)
const activeSessions: Record<string, Session> = {};

// 会话超时时间 (毫秒)
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30分钟

/**
 * 会话管理器
 */
const sessionManager = {
  /**
   * 创建新会话
   */
  createSession(playerName: string = 'Trainer'): Session {
    // 为新用户创建唯一ID (如果是注册用户，这个ID应该从数据库获取)
    const playerId = uuidv4();
    const sessionId = uuidv4();
    
    // 创建会话信息
    const session: Session = {
      sessionId,
      playerId,
      playerName,
      lastActivity: new Date()
    };
    
    // 保存会话
    activeSessions[sessionId] = session;
    console.log(`Created new session ${sessionId} for player ${playerName} (${playerId})`);
    
    return session;
  },
  
  /**
   * 获取会话信息
   */
  getSession(sessionId: string): Session | null {
    const session = activeSessions[sessionId];
    
    if (!session) {
      console.log(`Session ${sessionId} not found`);
      return null;
    }
    
    // 检查会话是否过期
    const now = new Date();
    const elapsed = now.getTime() - session.lastActivity.getTime();
    
    if (elapsed > SESSION_TIMEOUT) {
      console.log(`Session ${sessionId} has expired`);
      this.endSession(sessionId);
      return null;
    }
    
    // 更新最后活动时间
    activeSessions[sessionId].lastActivity = now;
    return session;
  },
  
  /**
   * 更新会话的最后活动时间
   */
  updateSessionActivity(sessionId: string): boolean {
    const session = activeSessions[sessionId];
    
    if (!session) {
      return false;
    }
    
    session.lastActivity = new Date();
    return true;
  },
  
  /**
   * 结束会话
   */
  endSession(sessionId: string): boolean {
    const session = activeSessions[sessionId];
    
    if (!session) {
      return false;
    }
    
    // 可选：保存玩家状态到持久存储
    
    // 删除会话
    delete activeSessions[sessionId];
    console.log(`Ended session ${sessionId}`);
    return true;
  },
  
  /**
   * 获取会话关联的玩家状态
   */
  async getPlayerStateForSession(sessionId: string) {
    const session = this.getSession(sessionId);
    
    if (!session) {
      return null;
    }
    
    // 使用状态管理器获取玩家状态
    const playerState = await stateManager.getPlayerState(session.playerId, session.playerName);
    return playerState;
  },
  
  /**
   * 清理过期会话
   */
  cleanupExpiredSessions() {
    const now = new Date().getTime();
    let expiredCount = 0;
    
    Object.keys(activeSessions).forEach(sessionId => {
      const session = activeSessions[sessionId];
      const elapsed = now - session.lastActivity.getTime();
      
      if (elapsed > SESSION_TIMEOUT) {
        this.endSession(sessionId);
        expiredCount++;
      }
    });
    
    if (expiredCount > 0) {
      console.log(`Cleaned up ${expiredCount} expired sessions`);
    }
    
    return expiredCount;
  }
};

export default sessionManager; 