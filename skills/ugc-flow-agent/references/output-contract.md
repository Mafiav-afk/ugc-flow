# Output contract

Return one JSON object:

- `product.summary`: concise verified product summary.
- `product.audience`: target audience.
- `product.claims`: up to six supported selling points.
- `product.risks`: unsupported or compliance-sensitive claims.
- `strategy.format`: selected proven format.
- `strategy.mechanism`: why the format works.
- `strategy.hook`: exact opening line.
- `strategy.shots`: exactly eight concise timed shot descriptions.
- `strategy.metrics`: exactly three priority metrics.
- `imagePrompt`: one production-ready 9:16 character/product reference prompt.
- `videoPrompt`: one production-ready prompt matching the selected duration, ratio, and references.

Do not add prose outside the JSON object.
