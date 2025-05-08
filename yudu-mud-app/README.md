This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## 豫都宝可梦 MUD 游戏

这是一个基于 Next.js 开发的文字冒险游戏，以架空的"豫都地区"为背景，采用 MUD（多用户地下城）的玩法风格。

### 系统功能

- **世界探索系统**：探索豫都地区的各个城镇和路线
- **宝可梦系统**：捕捉、训练和战斗
- **物品系统**：使用各种道具
- **战斗系统**：回合制战斗机制
- **遭遇系统**：在路线中探索和遭遇野生宝可梦

### 遭遇系统

游戏实现了两种宝可梦遭遇机制：

1. **路线勘探**：在路线区域使用 `look pokemon` 或 `look wild` 命令可以查看该区域可能出现的宝可梦
2. **随机遭遇**：在路线区域移动时，有几率随机遭遇野生宝可梦并开始战斗

遭遇数据配置在 `data/encounters.json` 文件中，支持以下功能：
- 为不同地点设置不同的遭遇率
- 为每个地点配置可遇到的宝可梦种类、等级范围和出现概率权重
- 基于权重系统的稀有宝可梦机制

### 最近更新

- 实现宝可梦遭遇系统，支持路线勘探和随机遭遇
- 修复 TypeScript 错误
- 完善宝可梦战斗系统

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
