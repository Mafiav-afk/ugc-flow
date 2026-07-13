# UGC Flow API 接入说明

版本：1.3.1

原则：文本由 Codex/Claude 处理；媒体 API 只负责图片和视频。

## 1. 通用鉴权

系统支持：

- `Authorization: Bearer <API_KEY>`
- `x-api-key: <API_KEY>`
- `x-goog-api-key: <API_KEY>`
- 查询参数 `?key=<API_KEY>`
- 自定义 Header 与前缀

Base URL 可填写 `https://host.example/v1` 或供应商根地址。系统会规范重复 `/v1` 并尝试候选端点。

## 2. ToAPIs Grok Video 3

创建任务：`POST /v1/videos/generations`

```json
{
  "model": "grok-video-3",
  "prompt": "人物自然展示商品，真实手机自拍视频，镜头轻微推进",
  "duration": 10,
  "aspect_ratio": "9:16",
  "images": ["https://cdn.example.com/product.png"],
  "metadata": {"resolution": "720P"}
}
```

关键约束：

- `duration` 是整数，公开规格为 10/15；实际可用档位取决于渠道计费配置。
- `images` 是公网 URL 数组，不支持本地路径。
- `metadata.resolution` 为 `720P` 或 `1080P`。
- 查询任务：`GET /v1/videos/generations/{task_id}`。
- 完成结果通常位于 `result.data[0].url`。

## 3. xAI 官方 Grok Imagine

官方模型 ID：`grok-imagine-video-1.5`，预览别名为 `grok-imagine-video-1.5-preview`。不要与中转站的 `grok-video-*` 混用。

```json
{
  "model": "grok-imagine-video-1.5",
  "prompt": "Animate the product naturally",
  "duration": 10,
  "aspect_ratio": "9:16",
  "resolution": "720p",
  "image": {"url": "https://cdn.example.com/product.png"}
}
```

创建：`POST /v1/videos/generations`；查询：`GET /v1/videos/{request_id}`；完成 URL：`video.url`。

## 4. 通用媒体任务协议

部分中转站使用固定三字段结构：

```json
{
  "model": "vendor-video-model",
  "prompt": "视频动作描述",
  "params": {
    "images": "https://cdn.example.com/product.png",
    "aspect_ratio": "9:16",
    "resolution": "720p",
    "duration": "10"
  },
  "notify_url": "https://merchant.example.com/webhook"
}
```

- 创建：常见为 `POST /v1/media/generate`。
- 查询：常见为 `GET /v1/media/status?task_id={id}`。
- `notify_url` 必须位于顶层，不能放入 `params`。
- 是否使用字符串或数字时长，以供应商模型文档为准。

## 5. 图片上传与公网 URL

视频模型只接受 URL 时，系统依次尝试：

1. 图片模型直接返回的公网 URL。
2. 供应商 `/v1/uploads/images` 或 `/uploads/images`。
3. 用户填写的自定义 multipart、JSON data URL 或 PUT 上传服务。

上传成功响应可从 `url`、`data.url`、`result.url`、`file.url` 等常见字段自动识别，也可配置字段路径。

## 6. 错误诊断

- 模型不存在：从 `/models` 读取当前 Key 实际可用模型，不要只用展示名。
- 参考图缺失：确认请求体字段和图片 URL 在公网可访问。
- 非 JSON：候选地址可能是网站前台；系统会继续尝试其他端点。
- 网络断开：连接重置、DNS 和超时会作为可恢复错误切换端点。
- 计费规则失败：调整模型、时长、分辨率，或联系渠道开通价格规则。

## 7. 上线验收清单

- 模型 ID 来自当前供应商文档或 `/models`。
- 使用正确协议和创建端点。
- 图片 URL 可从公网匿名读取。
- 时长类型、大小写、分辨率字段完全符合文档。
- 能取得 task ID、轮询进度和最终视频 URL。
- 下载后检查实际时长、画面比例和音轨。
