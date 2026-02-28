<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Iran Situation Room

一个现代、科技感的态势可视化仪表盘：左侧地图展示单位/事件/基础设施/战果等图层，右侧 `Live Intel` 通过可配置的 OpenAI 兼容接口拉取并汇总最新新闻。

## 功能
- 地图态势：Units / Events / Movements / Labels / Infrastructure / Battle Results 多图层开关
- Live Intel：从公共 RSS 抓取实时上下文，再喂给 LLM 生成 5 条重点情报
- OpenAI 兼容设置：自定义 `endpoint / apiKey / model`，并保存到浏览器本地存储

## 技术栈
- Vite + React + TypeScript
- Tailwind CSS (v4)
- `react-simple-maps` + `d3-geo`
- `lucide-react` + `motion`

## 核心实现说明
### 组件结构与页面布局
- `src/App.tsx`: 页面骨架与状态管理（暗色模式、图层筛选、选中项、设置弹窗）
- `src/components/MapDashboard.tsx`: 地图渲染与缩放/拖拽；按筛选条件渲染图层
- `src/components/ControlPanel.tsx`: 图层开关面板（更新 `filters`）
- `src/components/DetailsPanel.tsx`: 点击地图元素后的详情卡片
- `src/components/NewsPanel.tsx`: 新闻列表、刷新、错误提示
- `src/components/SettingsModal.tsx`: 配置 OpenAI 兼容接口（通过 `/models` 拉取模型列表）

### 数据来源与数据流
- 地图数据来自 `src/constants.ts` 的 mock 数据（`MOCK_UNITS / MOCK_EVENTS / MOCK_INFRASTRUCTURE / MOCK_BATTLE_RESULTS`）
- 新闻数据来自 `src/services/llmService.ts`：
  - 通过 `rss2json` 拉取 BBC Middle East RSS（失败则降级）
  - 调用 `${endpoint}/chat/completions` 并要求返回严格 JSON 数组
- `endpoint/apiKey/model` 保存在浏览器 `localStorage`（key: `llmSettings`）

### 关于 geminiService
仓库里存在 `src/services/geminiService.ts`（依赖 `GEMINI_API_KEY`），但当前 UI 只使用 `llmService`，`geminiService` 未接入。

### 注意事项
- `apiKey` 会保存在浏览器本地存储；建议仅在可信环境使用
- 地图底图数据来自 CDN：`https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json`，网络受限时可能加载失败

## 本地运行
**Prerequisites:** Node.js（建议 20+）

1. Install dependencies:
   `npm install`
   - CI/Zeabur 等严格依赖解析环境建议使用：`npm ci --legacy-peer-deps`
   - 本仓库包含 `.npmrc`（`legacy-peer-deps=true`），即使 Zeabur 默认使用 `npm install` 也不会因 peer deps 冲突而失败
2. Run the app:
   `npm run dev`

打开 `http://localhost:3000`，然后点击右侧 `Live Intel` 顶部的设置按钮，填写：
- Endpoint 示例：`https://api.openai.com/v1`
- API Key：你的 key
- Model：例如 `gpt-3.5-turbo`

## 构建与预览
1. Build:
   `npm run build`
2. Preview:
   `npm run preview -- --host 0.0.0.0 --port 4173`

## Zeabur 一键部署
[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/90RO4H?referralCode=jacob-sheng)

模板链接：
- https://zeabur.com/templates/90RO4H

## Zeabur 手动部署
1. 在 Zeabur 创建 Project，并连接 GitHub 仓库 `jacob-sheng/iran-situation-room`
2. 选择 Node.js（或通用）服务类型
3. Build Command：
   `npm ci --legacy-peer-deps && npm run build`
4. Start Command：
   `npm run preview -- --host 0.0.0.0 --port $PORT`
5. 部署完成后，在站点 UI 的 Settings 中填写 LLM 的 `endpoint/apiKey/model`

## AI Studio（可选）
导出/迁移来源链接（便于对照）：
- https://ai.studio/apps/84f06ea2-9800-416e-b902-59cae3529886
