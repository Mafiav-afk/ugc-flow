---
name: merchant-ugc-campaign
description: Plan and generate full-funnel merchant UGC commerce campaigns across beauty, food, home, maternal, pet, electronics, fashion, sports, personal care, automotive, local services, and apps. Use when matching a product to a proven ad format, faithfully replicating a reference ad's structure without copying protected brand assets, creating hooks and 8-beat shot plans, generating character/product/video prompts, checking Chinese commerce-ad risks, or producing batch variations for Douyin, Xiaohongshu, Kuaishou, WeChat Channels, TikTok, or Reels.
---

# Merchant UGC Campaign

Create a complete executable campaign, not isolated copy. Preserve factual product information and never invent certifications, efficacy, prices, ingredients, sales, reviews, or performance.

## Workflow

1. Normalize the product into: category, subcategory, audience, purchase trigger, verified claims, proof assets, price/offer, prohibited claims, target platform, duration, and available references.
2. If a reference ad exists, read [references/replication-protocol.md](references/replication-protocol.md) and extract its structure before writing. Replicate pacing, beat function, camera grammar, proof order, and CTA softness; do not copy a competitor's brand, logo, packaging, music, creator identity, or exact phrasing.
3. Read only the relevant category section in [references/category-playbooks.md](references/category-playbooks.md). Select one primary mechanism and one fallback.
4. Use `winning-ad-formats` to choose the format by mechanism, not category.
5. Write the 8-beat 15-second plan. Every beat must specify time, shot, action, dialogue/voiceover, product visibility, proof, camera, sound, physics, and transition.
6. Use `ai-ugc-realism` for the character reference and final video prompt. Lock identity, outfit, environment, product geometry, product text, voice, physics, camera, lighting, negatives, and sound.
7. Read [references/cn-commerce-compliance.md](references/cn-commerce-compliance.md) before finalizing Chinese-market copy. Convert unsupported absolutes into demonstrable observations.
8. Return the structure in [references/output-schema.md](references/output-schema.md). Include one control version plus at least three variations with exactly one changed variable each.

## Evidence hierarchy

Prefer evidence in this order:

1. Visible product behavior in the shot.
2. User-supplied test data, certification, ingredient, specification, or price.
3. User-supplied review or before/after asset with disclosed conditions.
4. Honest creator observation framed as subjective experience.

If evidence is missing, write a shot that demonstrates the property or mark the claim as `needs_verification`. Never upgrade a selling point into an objective guarantee.

## Replication boundary

Replicate the commercial grammar, not protected expression. Keep the reference's:

- hook type and planted question;
- reveal timing and proof sequence;
- shot durations, framing classes, cut rhythm, and on-camera/voiceover alternation;
- emotional arc and CTA pressure;
- variable slots that make the format repeatable.

Replace the creator identity, environment details, dialogue, brand assets, music, product packaging, and factual claims with original inputs.

## Batch variation rule

Change one variable per variation: hook, creator archetype, first proof, setting, offer framing, or CTA. Keep all other elements locked so performance differences remain interpretable.

## Completion gate

Do not finish unless the output contains:

- verified vs unverified claim separation;
- one format match and mechanism explanation;
- an exact hook;
- 8 timed beats totaling 15 seconds;
- character, product, voice, camera, lighting, physics, negative, and sound locks;
- platform-specific caption and CTA;
- compliance risks and required evidence;
- a measurement plan prioritizing 3-second hold, completion, shares, saves, product clicks, and conversion;
- at least three controlled variations.
