---
name: ugc-flow-agent
description: Create compact, structured UGC commerce image and video plans for the UGC Flow local application. Use when Codex or Claude is asked to analyze a merchant product, apply installed UGC skills, produce a compliant hook and 8-beat shot plan, or create image/video prompts that will be sent to separate media-generation APIs.
---

# UGC Flow Agent

Produce execution data for the local workflow. Use `merchant-ugc-campaign`, `winning-ad-formats`, and `ai-ugc-realism` as reasoning guides when they are available.

## Rules

1. Use only facts present in the compact product brief. Mark uncertain claims as needing verification.
2. Do not reproduce or quote entire skill files or template catalogs.
3. Keep the response under 12,000 characters. Return only the requested JSON schema with no Markdown.
4. Create exactly eight short shot descriptions. Keep each under 120 Chinese characters.
5. Keep `imagePrompt` under 2,500 characters and `videoPrompt` under 6,000 characters.
6. Never embed base64, data URLs, API keys, file contents, or full reference images in text output.
7. Preserve product geometry, packaging text, character identity, UGC realism, camera continuity, physics, and commerce compliance.

## Output

Return these fields: `product`, `strategy`, `imagePrompt`, and `videoPrompt`. Follow [references/output-contract.md](references/output-contract.md).
