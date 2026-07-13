# UGC Flow

基于 `ai-ugc-realism` 与 `winning-ad-formats` 的本地 AI UGC 带货视频工作流。

## 在线体验

GitHub Pages：`https://mafiav-afk.github.io/ugc-flow/`

在线版本自动进入安全的浏览器演示模式，无需 API Key 即可跑通商品配置、六阶段工作流、成片预览和镜头脚本。真实媒体 API、Codex/Claude 自动连接与技能部署仅在下载 Mac 本地版后启用。

## 已实现功能

- 商品资料、目标人群、禁用词和商品链接录入
- PNG/JPG/WebP 参考素材上传，最多 4 张、单张 10 MB
- 25 套商家带货模板，覆盖美妆、食品、家居、母婴、宠物、数码、服饰、户外、个护、汽车、本地生活和 APP/知识产品
- 模板搜索、品类筛选、平台标签和完整 8 镜头结构复刻
- 本地项目历史
- 六阶段异步任务：商品分析 → 爆款策略 → 角色参考 → 产品锁定 → 视频生成 → 成片
- 实时进度、运行日志、取消、失败重试
- 8 镜头脚本编辑、提示词复制、项目 JSON 导出
- 浏览器自动保存草稿与已完成项目
- 本地演示模式：无需 Key 即可跑通完整流程
- OpenAI 官方与通用兼容 API，不绑定任何单一中转站品牌
- Image API / Responses 图片工具、OpenAI Videos、普通 JSON 与通用媒体异步任务协议
- Codex 或 Claude Code 负责文本推理并使用用户已有登录额度；媒体 API 不承担文本生成
- `ugc-flow-agent` 以紧凑 JSON 调用商家技能，避免把完整 Skill/模板全文发送给模型
- API 地址智能发现：可粘贴 API 根地址或公开文档页，自动解析标准 `baseURL/api_base` 声明、验证模型端点并缓存结果
- 图片、视频模型池随机调用，404/限流/上游错误自动更换模型和端点
- 图片完成后立即回传到过程预览，并自动作为视频生成参考
- 异步图片/视频任务自动轮询，短暂 404 容忍、查询路径回退和受保护成片代理下载
- 一键部署完整技能到 Codex 或 Claude Code
- 桌面、平板、手机响应式布局

## 启动开发环境

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:5173`。开发环境的前端与本地 API 共用一个端口。

首次建议保持“本地演示模式”，选择模板后点击“一键生成带货视频”，约 3 秒可以跑完整个任务状态机。

## 生产运行

```bash
npm run build
npm start
```

生产服务默认运行在 `http://127.0.0.1:8787`，可通过 `HOST` 和 `PORT` 环境变量覆盖。Mac 安装器会自动从 `18787–18807` 选择空闲端口，并在打开页面前验证服务身份。

## 接入真实 API

打开“智能体与 API”，关闭演示模式后：

- 选择 Codex 或 Claude Code；应用会自动检测本机 CLI 与登录状态
- 填写视频 API Base URL、Key 与视频模型
- 若使用上传参考图，只需视频 API；若需要自动生成图片，再填写 GPT Image 或其他兼容图片 API
- 图生视频优先直传图片模型返回的公网 URL；用户上传图或 base64 图片可通过高级设置中的上传接口自动转换为公网 URL，兼容 multipart、JSON data_url 与原始 PUT。供应商支持 multipart/base64 时会直接提交；URL-only 模型且未配置上传接口时，可自动切换文生视频模型
- ToAPIs 文档支持的 Grok 模型使用 `grok-video-3`：提交到 `/videos/generations`，首帧为 `images: [URL]`，分辨率为 `metadata.resolution`，时长为 10/15 秒。其他供应商的 `grok-video-1.5-preview` 与 xAI 官方 `grok-imagine-video-1.5` 系列保留为独立兼容项，不混用协议
- Codex 模式会先生成图片提示词；若当前 Codex CLI 没有返回可下载图片 URL，则自动调用已配置的异步图片 API、轮询取得永久下载链接，并直接作为视频首帧 URL，不需要手工复制
- 图片与视频模型池；使用逗号或换行分隔，任务会随机排列候选
- 图片与视频生成路径；每行一个候选路径
- 视频模型类型、时长、分辨率/尺寸、画面比例及质量版本
- 图片/视频查询和下载路径，其中 `{id}` 会替换为上游任务 ID
- `Authorization: Bearer`、`x-api-key`、`x-goog-api-key`、URL `?key=` 或自定义 Header
- 可选的图片/视频独立 Base URL 与独立 Key

协议行为：

- 商品分析、钩子、8 镜头脚本、图片提示词和视频提示词由 Codex/Claude 加载本地 Skill 生成，不调用中转站文本 API
- 智能体输入剔除 base64 与 Skill 全文，提示词分别限制为 5,000/12,000 字符；大体积 data URL 在 macOS 本地压缩后再传视频接口，避免 413
- Image API 使用 `/images/generations`，Responses 图片工具也可作为候选路径
- OpenAI 官方视频使用 multipart `POST /videos`、`GET /videos/{id}` 与 `/content`
- 普通兼容视频使用 JSON `model`、`prompt`、`duration`、`input_reference`
- 通用媒体异步任务使用 `POST /media/generate` 的 `{ model, prompt, params }`，从 `task_id` 轮询 `/media/status?task_id={id}`，以 `is_final/state` 判断终态并读取 `result_url`
- 若填写的是文档/前台网站而非 API 域名，“智能识别并测试”会从公开页面配置与脚本中发现真实 API 入口；没有硬编码任何供应商品牌或域名
- 媒体参数会根据 GPT Image、Grok Video、Sora、Seedance/即梦、HappyHorse、Kling、Wan 等模型名称自动适配，也可在高级设置中用 JSON 覆盖
- 视频选项严格按模型联动：Grok 1–15 秒；Sora 4/8/12 秒；Seedance 4–15 秒或自动且支持 480p–4K；HappyHorse 3–15 秒；Kling 5/10/15 秒；Wan 3/6/9/12/15 秒
- `notify_url` 作为顶层可选字段；即使启用 webhook，工作流仍保留轮询兜底

系统会保留每次任务实际选中的模型、端点及安全的回退记录，但不会记录 API Key。已归一化 `choices[].message.content`、`output_text`、`image_generation_call.result`、`data[].url`、`b64_json`、`video_url`、`task_id`、`request_id`、`result.url`、Replicate 风格 `output` 等常见字段。

其他完全私有的请求体仍可通过高级路径和 params JSON 适配；若任务创建与状态结构也完全不同，则在 [server/workflow.mjs](./server/workflow.mjs) 增加专用映射。

## 测试

```bash
npm test
npm run build
# 或一次执行
npm run check
```

测试覆盖接口响应归一化、四类鉴权、模型池随机顺序、404 端点回退、通用图片/视频异步任务、模型族参数映射、策略 JSON 修复、HTTP 路由、六阶段演示完成与取消。

## 部署技能

```bash
npm run deploy:codex
npm run deploy:claude
```

页面底部也可以一键部署。Codex 安装到 `~/.codex/skills`，Claude Code 安装到 `~/.claude/skills`。当前包含：

- `ai-ugc-realism`
- `winning-ad-formats`
- `merchant-ugc-campaign`
- `ugc-flow-agent`

## macOS 一键部署包

构建 Apple Silicon 本地包：

```bash
npm run build:mac
npm run verify:mac
```

输出：

- `release/UGC-Flow-Mac-1.3.0-arm64.dmg`
- `release/UGC-Flow-Mac-1.3.0-arm64.zip`
- `release/SHA256.txt`

DMG 内的“UGC Flow 安装器.app”会：

1. 安装自带的 arm64 Node 运行时与生产服务。
2. 自动选择空闲本地端口并注册用户级 LaunchAgent，登录后自动启动。
3. 按选择把四项技能部署到 Codex、Claude Code 或两者，并自动检测登录状态。
4. 安装完成后自动打开本地 UGC Flow。

安装器使用本地临时签名，不包含 Apple Developer ID 公证。如果 Gatekeeper 阻止首次打开，请右键安装器并选择“打开”。

## 安全说明

- API Key 使用 `sessionStorage`，关闭标签页后失效。
- Key 不写入项目历史、localStorage、导出 JSON 或服务日志。
- 工具默认只绑定本机地址；若部署公网，请增加身份认证、速率限制和服务端密钥托管。
