import { NextResponse, NextRequest } from 'next/server';
import sessionManager from '@/game/sessionManager';
import stateManager from '@/game/stateManager';
import commandManager from '@/game/commandManager';
import { Player } from '@/interfaces/database';

interface GameSessionRequest {
  action: 'create' | 'command' | 'end';
  sessionId?: string;
  playerName?: string;
  command?: string;
}

interface GameSessionResponseData {
  success: boolean;
  message?: string;
  sessionId?: string;
  output?: string;
  playerState?: Partial<Player>;
  error?: string;
}

async function handler(req: NextRequest): Promise<NextResponse<GameSessionResponseData>> {
  if (req.method !== 'POST') {
    return NextResponse.json({ 
      success: false, 
      error: 'Method Not Allowed. Only POST requests are accepted.' 
    }, { status: 405 });
  }

  try {
    await stateManager.initialize();
    
    const body = await req.json() as GameSessionRequest;
    const { action, sessionId, playerName, command } = body;
    
    switch (action) {
      case 'create':
        return handleCreateSession(playerName || 'Trainer');
      
      case 'command':
        if (!sessionId) {
          return NextResponse.json({
            success: false,
            error: 'Missing sessionId parameter'
          }, { status: 400 });
        }
        
        if (!command) {
          return NextResponse.json({
            success: false,
            error: 'Missing command parameter'
          }, { status: 400 });
        }
        
        return handleCommand(sessionId, command);
      
      case 'end':
        if (!sessionId) {
          return NextResponse.json({
            success: false,
            error: 'Missing sessionId parameter'
          }, { status: 400 });
        }
        
        return handleEndSession(sessionId);
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in game-session API:', error);
    return NextResponse.json({
      success: false,
      error: `Internal server error: ${error.message}`
    }, { status: 500 });
  }
}

export { handler as POST };

async function handleCreateSession(playerName: string): Promise<NextResponse<GameSessionResponseData>> {
  const session = sessionManager.createSession(playerName);
  const playerState = await stateManager.getPlayerState(session.playerId, playerName);
  
  const output = `
**欢迎来到豫都地区，${playerName}！**

你正站在初始小镇的中心广场上，周围是宁静的街道和友好的居民。你的宝可梦冒险即将开始！

输入 \`look\` 查看周围环境，或输入 \`help\` 查看可用命令。
  `;
  
  return NextResponse.json({
    success: true,
    sessionId: session.sessionId,
    output: output,
    playerState: playerState
  });
}

async function handleCommand(sessionId: string, commandText: string): Promise<NextResponse<GameSessionResponseData>> {
  const session = sessionManager.getSession(sessionId);
  
  if (!session) {
    return NextResponse.json({
      success: false,
      error: 'Session not found or expired'
    }, { status: 404 });
  }
  
  const playerState = await sessionManager.getPlayerStateForSession(sessionId);
  
  if (!playerState) {
    return NextResponse.json({
      success: false,
      error: 'Player state not found'
    }, { status: 404 });
  }
  
  const result = await commandManager.processCommand(commandText, playerState);
  
  if (Object.keys(result.updatedPlayerState).length > 0) {
    stateManager.updatePlayerState(session.playerId, result.updatedPlayerState);
  }
  
  return NextResponse.json({
    success: true,
    output: result.output,
    playerState: {
      ...playerState,
      ...result.updatedPlayerState
    }
  });
}

async function handleEndSession(sessionId: string): Promise<NextResponse<GameSessionResponseData>> {
  const session = sessionManager.getSession(sessionId);
  
  if (!session) {
    return NextResponse.json({
      success: false,
      error: 'Session not found or expired'
    }, { status: 404 });
  }
  
  sessionManager.endSession(sessionId);
  
  return NextResponse.json({
    success: true,
    message: 'Session ended successfully'
  });
}
