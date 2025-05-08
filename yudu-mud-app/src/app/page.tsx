'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchTestData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-data');
      const data = await response.json();
      setApiResponse(data);
    } catch (error) {
      console.error('Error fetching test data:', error);
      setApiResponse({ error: 'Failed to fetch data' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <main className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-6">
        <h1 className="text-3xl font-bold text-center text-indigo-700 mb-6">
          豫都地区宝可梦冒险
        </h1>
        
        <div className="mb-8 text-center">
          <p className="text-lg text-gray-700 mb-4">
            欢迎来到豫都地区的宝可梦文字冒险游戏！
          </p>
          <p className="text-gray-600 mb-6">
            在这片独特的区域中，探索城镇、森林和神秘地点，收服独特的宝可梦，挑战道馆，成为豫都地区的传奇训练家！
          </p>
          
          <Link href="/game" className="inline-block px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-colors mb-8">
            开始冒险
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-blue-700 mb-2">探索与冒险</h2>
            <p className="text-gray-700">
              豫都地区以其丰富多样的自然环境和独特的文化而闻名。从繁华的都江城到神秘的帝陵遗址，每个地点都有其独特的宝可梦生态和故事。
            </p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-green-700 mb-2">特色宝可梦</h2>
            <p className="text-gray-700">
              豫都地区拥有许多特有的宝可梦，它们适应了这里的独特环境。收服这些宝可梦，组建你的最强队伍！
            </p>
          </div>
        </div>

        <div className="mt-8 border-t pt-6">
          <h3 className="text-xl font-semibold mb-4">测试API连接</h3>
          <button
            onClick={fetchTestData}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition mb-4"
          >
            {loading ? '加载中...' : '测试数据加载'}
          </button>

          {apiResponse && (
            <div className="mt-4 border rounded p-4 bg-gray-50">
              <h4 className="font-bold mb-2">API响应:</h4>
              <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto max-h-60">
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>
        
        <div className="mt-8 text-center text-gray-500 text-sm">
          豫都地区 &copy; {new Date().getFullYear()} - 在开发中
        </div>
      </main>
    </div>
  );
}
