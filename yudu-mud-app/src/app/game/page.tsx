'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// 玩家状态接口
interface PlayerState {
  id: string;
  name: string;
  locationId: string;
  inventory: Array<{ itemId: string; quantity: number }>;
  team: any[]; // 简化起见，这里使用any
  pokedex: { seen: string[]; caught: string[] };
  money: number;
  badges: string[];
  [key: string]: any; // 允许其他属性
}

// 游戏消息接口
interface GameMessage {
  content: string;
  type: 'system' | 'output' | 'input';
}

export default function GamePage() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 创建游戏会话
  const startGame = async () => {
    if (!playerName.trim()) {
      alert('请输入你的名字');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/game-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          playerName: playerName.trim()
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSessionId(data.sessionId);
        setPlayerState(data.playerState || null);
        setMessages([
          {
            content: data.output || '游戏开始！',
            type: 'system'
          }
        ]);
        setIsStarted(true);
      } else {
        addMessage(`错误: ${data.error}`, 'system');
      }
    } catch (error) {
      console.error('Failed to start game:', error);
      addMessage('无法连接到游戏服务器。请稍后再试。', 'system');
    } finally {
      setIsLoading(false);
    }
  };

  // 发送命令
  const sendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId) return;

    const command = input.trim();
    setInput('');
    addMessage(`> ${command}`, 'input');
    setIsLoading(true);

    try {
      const response = await fetch('/api/game-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'command',
          sessionId,
          command
        }),
      });

      const data = await response.json();

      if (data.success) {
        addMessage(data.output || '命令已处理。', 'output');
        if (data.playerState) {
          setPlayerState(data.playerState);
        }
      } else {
        addMessage(`错误: ${data.error}`, 'system');
        
        // 如果会话过期，返回开始页面
        if (data.error?.includes('Session not found or expired')) {
          setSessionId(null);
          setIsStarted(false);
        }
      }
    } catch (error) {
      console.error('Failed to process command:', error);
      addMessage('无法连接到游戏服务器。请稍后再试。', 'system');
    } finally {
      setIsLoading(false);
    }
  };

  // 添加消息到历史记录
  const addMessage = (content: string, type: 'system' | 'output' | 'input') => {
    setMessages(prev => [...prev, { content, type }]);
  };

  // 结束游戏会话
  const endGame = async () => {
    if (!sessionId) return;

    try {
      await fetch('/api/game-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'end',
          sessionId
        }),
      });

      // 不管结果如何，都重置状态
      setSessionId(null);
      setPlayerState(null);
      setMessages([]);
      setIsStarted(false);
      router.push('/');
    } catch (error) {
      console.error('Failed to end game:', error);
    }
  };

  // 渲染消息
  const renderMessage = (message: GameMessage, index: number) => {
    let className = '';
    
    if (message.type === 'system') {
      className = 'text-yellow-500';
    } else if (message.type === 'input') {
      className = 'text-cyan-500 font-bold';
    } else if (message.type === 'output') {
      className = 'text-white';
    }
      // 处理Markdown风格的文本和地图特殊字符
    const formattedContent = message.content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // 粗体
      .replace(/\n/g, '<br />'); // 换行符
    
    return (
      <div key={index} className={`mb-2 ${className}`}>
        <div dangerouslySetInnerHTML={{ __html: formattedContent }} className="whitespace-pre-wrap font-mono" />
      </div>
    );
  };

  // 渲染游戏状态栏
  const renderStatusBar = () => {
    if (!playerState) return null;
    
    return (
      <div className="bg-gray-800 p-2 text-xs text-gray-300 flex justify-between border-b border-gray-700">
        <div>
          <span className="font-bold">{playerState.name}</span>
          <span className="mx-2 text-gray-400">|</span>
          <span>金钱: {playerState.money}元</span>
        </div>
        <div>
          <span>队伍: {playerState.team.length}/6</span>
          <span className="mx-2 text-gray-400">|</span>
          <span>图鉴: {playerState.pokedex.caught.length}</span>
          <span className="mx-2 text-gray-400">|</span>
          <span>徽章: {playerState.badges.length}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      {/* 游戏标题 */}
      <header className="bg-indigo-900 p-4 text-center">
        <h1 className="text-2xl font-bold">豫都地区宝可梦冒险</h1>
      </header>

      {!isStarted ? (
        // 游戏开始界面
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-center">开始你的宝可梦冒险</h2>
            <div className="mb-4">
              <label htmlFor="playerName" className="block text-sm font-medium text-gray-300 mb-1">
                输入你的名字
              </label>
              <input
                id="playerName"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 text-white"
                placeholder="训练家名称"
                disabled={isLoading}
              />
            </div>
            <button
              onClick={startGame}
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition"
            >
              {isLoading ? '正在连接...' : '开始冒险'}
            </button>
          </div>
        </div>
      ) : (
        // 游戏主界面
        <div className="flex-1 flex flex-col">
          {/* 状态栏 */}
          {renderStatusBar()}
          
          {/* 游戏消息显示区域 */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-900">
            <div className="max-w-3xl mx-auto">
              {messages.map(renderMessage)}
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* 命令输入区域 */}
          <div className="bg-gray-800 border-t border-gray-700 p-4">
            <form onSubmit={sendCommand} className="max-w-3xl mx-auto flex">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-700 rounded-l border border-gray-600 text-white"
                placeholder="输入命令..."
                disabled={isLoading}
                ref={inputRef}
                autoFocus
              />
              <button
                type="submit"
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-r transition"
              >
                发送
              </button>
            </form>
          </div>
          
          {/* 结束游戏按钮 */}
          <div className="bg-gray-800 border-t border-gray-700 p-2 text-center">
            <button
              onClick={endGame}
              className="text-sm text-gray-400 hover:text-white"
            >
              结束游戏
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 