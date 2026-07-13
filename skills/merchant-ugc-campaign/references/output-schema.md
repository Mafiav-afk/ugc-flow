# Structured Output

Return concise Markdown plus this JSON-compatible structure:

```json
{
  "product": {"category":"", "audience":"", "verified_claims":[], "needs_verification":[], "do_not_use":[]},
  "format": {"name":"", "mechanism":"", "reference_similarity_boundary":""},
  "hook": "",
  "locks": {"character":"", "outfit":"", "environment":"", "product":"", "voice":"", "camera":"", "lighting":"", "physics":"", "negatives":"", "sound":""},
  "shots": [{"time":"00:00-00:02", "function":"", "shot":"", "action":"", "dialogue":"", "product_visibility":"", "proof":"", "camera":"", "sound":"", "transition":""}],
  "platform": {"name":"", "caption":"", "cta":"", "safe_zone_notes":""},
  "variations": [{"changed_variable":"hook", "value":""}],
  "metrics": ["3_second_hold", "completion", "shares", "saves", "product_clicks", "conversion"]
}
```

Keep exactly 8 shots. Total duration must equal 15 seconds. Mark missing inputs explicitly rather than inventing them.
