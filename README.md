# Global Situation Room / 全球态势

一个纯前端的全球态势仪表盘：世界地图 + 多源 RSS + LLM 结构化情报，自动把每条新闻落到地图图标上，并聚合全球热点（Hotspots）。

在线演示（如可用）：https://war.isroot.in

## 功能
- 全球地图态势：Units / Events / Movements / Labels / Infrastructure / Battle Results 多图层开关
- Live Intel：多 RSS 信源汇总后喂给 LLM，每次刷新生成 **10 条**重点情报（手动刷新；首次打开会自动刷新）
- Hotspots：把新闻主坐标聚合为热点簇，支持点击热点过滤新闻并聚焦地图
- 必有地理位置：
  - LLM 可输出坐标（未验证时标记为 `LLM inferred`）
  - 若无法可靠定位，则按新闻标题/摘要里提及的国家/地区落到其**首都坐标**（标记为 `Capital fallback`）
- 中英双语 UI：默认跟随浏览器语言，可手动切换；中文模式下会后台用 LLM 翻译新闻标题/摘要与详情内容（不阻塞 UI）
- 首刷提速：读取 `localStorage` 缓存情报秒出；无缓存时先展示 RSS 预览（真实标题/链接）再后台升级为结构化 signals

## 技术栈
- Vite + React + TypeScript
- Tailwind CSS (v4)
- `react-simple-maps` + `d3-geo`
- `lucide-react` + `motion`

## 实现概览
- `src/App.tsx`：全局状态与数据流（新闻批次历史、scope/category/hotspot 过滤、地图联动、翻译队列、缓存）
- `src/services/rssClient.ts`：纯前端 RSS 聚合（并发队列 + time budget + early stop；支持探测全栈部署的 `/api/rss/*`）
- `src/services/llmService.ts`：RSS -> LLM 输出结构化 `IntelNewsItem + IntelSignal`（每条至少 1 个 signal，包含坐标 + evidence 约束）
- `src/services/placeMentions.ts` + `src/data/capitals.ts`：从标题/摘要提取国家/地区提及，并解析为首都坐标兜底
- `src/services/geocodeService.ts`：后台地理二次确认（Nominatim，带缓存与限速）

## 本地运行
**Prerequisites:** Node.js（建议 20+）

1. Install dependencies:
   `npm install`
   - CI/Zeabur 等严格依赖解析环境建议使用：`npm ci --legacy-peer-deps`
   - 本仓库包含 `.npmrc`（`legacy-peer-deps=true`），即使 Zeabur 默认使用 `npm install` 也不会因 peer deps 冲突而失败
2. Run the app:
   `npm run dev`

打开 `http://localhost:3000`，在右侧 `Live Intel` 点击设置按钮，配置 OpenAI 兼容接口（会保存到浏览器 `localStorage`）：
- Endpoint 示例：`https://api.openai.com/v1`
- API Key：你的 key
- Model：例如 `gpt-4o-mini`

## 构建与预览
1. Build:
   `npm run build`
2. Preview:
   `npm run preview -- --host 0.0.0.0 --port 4173`

## Zeabur 一键部署（纯前端）
[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/90RO4H?referralCode=jacob-sheng)

模板链接：
- https://zeabur.com/templates/90RO4H

## Zeabur 手动部署（纯前端）
1. 在 Zeabur 创建 Project，并连接 GitHub 仓库 `jacob-sheng/iran-situation-room`
2. 选择 Node.js（或通用）服务类型
3. Build Command：
   `npm ci --legacy-peer-deps && npm run build`
4. Start Command：
   `npm run preview -- --host 0.0.0.0 --port $PORT`
5. 部署完成后，在站点 UI 的 Settings 中填写 LLM 的 `endpoint/apiKey/model`

## 全栈版本（前后端一体）
本仓库保持纯前端。一体化 Docker（内置 RSS 聚合后端、更稳更快）将放在新仓库：
- `jacob-sheng/global-situation-room`
