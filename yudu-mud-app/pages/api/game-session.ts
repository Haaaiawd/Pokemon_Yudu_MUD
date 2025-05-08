import type { NextApiRequest, NextApiResponse } from 'next';
import sessionManager from '@/game/sessionManager';
import stateManager from '@/game/stateManager';
import commandManager from '@/game/commandManager';
import { Player } from '@/interfaces/database';

// API 请求类型
interface GameSessionRequest {
  action: 'create' | 'command' | 'end';
  sessionId?: string;
  playerName?: string;
  command?: string;
}

// API 响应类型
interface GameSessionResponse {
  success: boolean;
  message?: string;
  sessionId?: string;
  output?: string;
  playerState?: Partial<Player>;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GameSessionResponse>
) {
  // 只接受POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method Not Allowed. Only POST requests are accepted.' 
    });
  }

  try {
    // 确保状态管理器已初始化
    await stateManager.initialize();
    
    const { action, sessionId, playerName, command } = req.body as GameSessionRequest;
    
    // 处理不同的操作
    switch (action) {
      // 创建新会话
      case 'create':
        return handleCreateSession(playerName || 'Trainer', res);
      
      // 处理游戏命令
      case 'command':
        if (!sessionId) {
          return res.status(400).json({
            success: false,
            error: 'Missing sessionId parameter'
          });
        }
        
        if (!command) {
          return res.status(400).json({
            success: false,
            error: 'Missing command parameter'
          });
        }
        
        return handleCommand(sessionId, command, res);
      
      // 结束会话
      case 'end':
        if (!sessionId) {
          return res.status(400).json({
            success: false,
            error: 'Missing sessionId parameter'
          });
        }
        
        return handleEndSession(sessionId, res);
      
      // 未知操作
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown action: ${action}`
        });
    }
  } catch (error: any) {
    console.error('Error in game-session API:', error);
    return res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`
    });
  }
}

/**
 * 处理创建新会话
 */
async function handleCreateSession(playerName: string, res: NextApiResponse<GameSessionResponse>) {
  // 创建新会话
  const session = sessionManager.createSession(playerName);
  
  // 获取玩家初始状态
  const playerState = await stateManager.getPlayerState(session.playerId, playerName);
  
  // 生成欢迎消息
  const output = `
**欢迎来到豫都地区，${playerName}！**

你正站在初始小镇的中心广场上，周围是宁静的街道和友好的居民。你的宝可梦冒险即将开始！

输入 \`look\` 查看周围环境，或输入 \`help\` 查看可用命令。
  `;
  
  return res.status(200).json({
    success: true,
    sessionId: session.sessionId,
    output: output,
    playerState: playerState
  });
}

/**
 * 处理游戏命令
 */
async function handleCommand(sessionId: string, commandText: string, res: NextApiResponse<GameSessionResponse>) {
  // 获取会话信息
  const session = sessionManager.getSession(sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found or expired'
    });
  }
  
  // 获取玩家状态
  const playerState = await sessionManager.getPlayerStateForSession(sessionId);
  
  if (!playerState) {
    return res.status(404).json({
      success: false,
      error: 'Player state not found'
    });
  }
  
  // 使用命令管理器处理命令
  const result = await commandManager.processCommand(commandText, playerState);
  
  // 更新玩家状态
  if (Object.keys(result.updatedPlayerState).length > 0) {
    stateManager.updatePlayerState(session.playerId, result.updatedPlayerState);
  }
  
  // 返回命令处理结果
  return res.status(200).json({
    success: true,
    output: result.output,
    playerState: {
      ...playerState,
      ...result.updatedPlayerState
    }
  });
}

/**
 * 处理结束会话
 */
async function handleEndSession(sessionId: string, res: NextApiResponse<GameSessionResponse>) {
  // 获取会话信息
  const session = sessionManager.getSession(sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found or expired'
    });
  }
  
  // 结束会话
  sessionManager.endSession(sessionId);
  
  return res.status(200).json({
    success: true,
    message: 'Session ended successfully'
  });
}