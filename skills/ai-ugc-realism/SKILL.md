---
name: ai-ugc-realism
description: Write image-model character reference prompts and video-model (Seedance/Kling class) prompts that produce hyper-realistic UGC ads indistinguishable from real phone footage. Use whenever generating AI UGC content, character references, or any output that must NOT look AI-generated — especially when outputs read as "AI-glossy", plasticky, or cinematic when they should look candid.
---

# AI UGC Realism

The core problem: AI image and video models have a built-in "AI aesthetic attractor" — glowy skin, perfect symmetry, curated backgrounds, posed energy. This skill is the formula that defeats it. Workflow is always two parts: (1) generate a character reference image, (2) use it as a character reference inside the video model.

## Part 1 — Character reference image (5 stacked layers)

### Layer 1: Strip AI-coded language
These words pull the model toward its default "AI person". Delete them: "off-duty model", "ethereal", "stunning", "flawless", "soft luxury", "aesthetic", "curated", "glowy/dewy/porcelain skin", "almond-shaped eyes", "sharp cheekbones", "secretive smile" — and ironically "candid" and "natural beauty" are AI-bait too. Plain language wins: "brown hair" beats "lustrous chestnut waves".

### Layer 2: Stack specific named imperfections
"Natural imperfections" renders NOTHING — the model averages it out. Itemize 6-8 specific flaws by name and location:
- visible pores in a named area (nose, forehead, chin)
- faint redness somewhere specific (around nostrils, near eyebrows)
- a specific blemish near a named landmark (jawline, temple)
- small dry patch (near mouth, hairline)
- undereye darkness / visible eye bags
- asymmetry (one eyebrow slightly higher)
- a hair flaw (flyaways at crown, frizz, strand stuck to cheek)
- chapped lips, asymmetrical natural shape
- freckles/moles in specific SCATTERED (non-symmetric) locations

### Layer 3: Lived-in environment
The background does as much realism work as the face. Unmade bed, charging cable trailing, half-drunk glass, hoodie on a chair, uneven lighting (one side of face brighter). The room is not styled. That's the point.

### Layer 4: Phone-camera language
Use: "iPhone front-facing camera, raw unedited HEIC-style photo", "natural lens distortion, slight chromatic aberration around high-contrast edges", "mild grain in shadow areas", "accidentally-taken phone selfie energy".
Never: "Hasselblad", "50mm portrait lens", "studio softbox" — pro-camera words produce editorial polish, which reads as AI in a candid context.

### Layer 5: The load-bearing negative
End every reference prompt with:
```
no flash, no ring light, no studio lighting, no color grading, no skin smoothing,
no beauty filter, no airbrushing, no AI-aesthetic styling, no posed model energy,
no curated background, no commercial polish, no cinematic look. The photo should
look like an accidentally-taken phone selfie, not a polished content-creator selfie.
```
The phrase "no AI-aesthetic styling" explicitly tells the model to dodge its own default. Never omit it.

## Part 2 — Video generation

### The 11-block structure (order matters — models weight early blocks)
1. Opening style paragraph (format, duration, aesthetic anchor)
2. CHARACTER (@ref tag + identity recap + "character reference only")
3. ENVIRONMENT  4. VOICE  5. TIMELINE (the main body)
6. LIP SYNC  7. PHYSICS  8. CAMERA  9. LIGHTING  10. STYLE + negatives  11. SOUND

### Character lock (kills face drift between cuts)
```
CHARACTER: @girl_ref throughout all scenes — [hair], [skin + named flaws], [eyes],
[build], [outfit], [energy]. Used as character reference only — do not copy the
reference framing or pose. Same exact look in every cut.
```
"Same exact look in every cut" is non-negotiable. Also restate the named imperfections IN the character lock — video models smooth them out otherwise. Use 2k+ reference images; low-res refs give the model room to "improve" the face.

### Voice lock (two layers)
Describe how the voice sounds PHYSICALLY, not personality: "close-mic intimate quality like talking on FaceTime" / "mid-distance casual room mic" / "slightly compressed phone-call quality". The proven formula (use verbatim):
```
VOICE: Soft warm feminine voice, mid-20s, calm casual vlogger tone, soft natural
American accent, conversational and intimate like she's talking to a friend on
FaceTime, slight smile audible, unhurried but not slow, never bubbly.
```
Then in SOUND: "Spoken dialogue in the [voice summary], continuous and uninterrupted across all N scenes." Once a voice description works, copy-paste it verbatim forever — the exact wording is the voice fingerprint; paraphrasing produces a different voice.

### On-camera vs voiceover (frequent fail)
Ambiguous speaking beats default to voiceover. To force on-camera dialogue, every speaking beat needs all three anchors: (1) "holds her phone at chest height in selfie position", (2) "looks directly into the lens with steady eye contact, and speaks clearly to the camera with visible natural mouth movement", (3) "Her face stays in frame the entire time she speaks. Mouth shapes clearly form each word, lip-synced to audio precisely." Action verbs come BEFORE the speaking moment, never concurrent.

### The 8-beat 15s UGC timeline
Hook (0-2s) → Product Reveal (2-4) → Setup (4-6) → Demo/Hero (6-8, the beat that sells) → Reveal/Proof (8-10) → Secondary Use (10-12) → Beauty Cuts (12-14) → Soft CTA (14-15). Alternate on-camera and voiceover beats. 8 beats is reliable ONLY with a locked character reference.

### The negative powerhouse (most of the realism lives here)
```
no CGI sheen, no plastic skin, no airbrushing, no beauty filter, no warped hands,
no extra fingers, no stiff movement, no robotic face, no bad lip sync, no jitter,
no flicker, no glossy commercial lighting, no studio lighting, no commercial color
grading, no slow motion, no posed model energy, no on-screen text, no captions, no logos
```
Customize per failure mode. Every failed gen reveals a new negative to add.

### Physics block (always skipped, always matters)
Most "AI-looking" video is broken physics. Per content type: liquids ("no clipping, no floating drops, proper surface tension"), impact ("debris falls with believable mass, uneven, never floating"), lifestyle ("hair with subtle flyaways, fabric drapes realistically"), product demos ("weighted physics, water follows realistic ballistic arcs").

### Product text rule
If the product has ANY visible text, render a separate clean product reference image FIRST and feed it as a locked element. Video models cannot invent readable type — skipping this garbles the text every time. Pair with: "no warped labels, no distorted packaging, no fake branding".

### Start frame rule (img2vid)
Every character that appears or speaks anywhere in the clip must be visible in the start frame. Characters that "enter" mid-clip get invented as random figures.


## Appendix A — Character reference template (fill the brackets)

```
Ultra-realistic vertical iPhone selfie photo of a [age]-year-old [gender], taken at a slightly awkward casual angle as if they just opened the camera app.

[HAIR]: [length, color, texture, style], [specific hair flaw — flyaways, frizz, strand stuck to cheek, oiliness at roots].

[SKIN]: [tone with undertone] with realistic visible pores especially on [specific area], faint redness [specific location], [specific blemish], scattered [freckles/moles in specific locations], slightly visible undereye darkness, [specific dry skin patch].

[EYEBROWS]: [shape] and slightly uneven, [specific quirk].

[EYES]: [color] with realistic moisture catchlights, [specific lash flaw], subtle eye bags, slightly squinted from [reason].

[LIPS]: bare and slightly chapped, [specific dry patch], lightly parted, asymmetrical natural shape.

[OUTFIT]: [casual lived-in clothing] with [subtle wrinkles, small stain, slight fit imperfection].

The selfie is shot at chest height, phone held in [right/left] hand visible at the bottom edge of frame, slight phone-camera motion blur on hair. Mild lens distortion typical of front phone cameras.

[ENVIRONMENT]: [specific lived-in details — unmade bed, charging cable, half-drunk drink], [light source with directionality, which side is brighter], the room is not styled or curated.

Shot on iPhone front-facing camera, vertical 9:16, raw unedited HEIC-style photo aesthetic, natural lens distortion, slight chromatic aberration around high-contrast edges, mild grain in shadow areas, soft natural daylight only, no flash, no ring light, no studio lighting, no color grading, no skin smoothing, no beauty filter, no airbrushing, no AI-aesthetic styling, no posed model energy, no curated background, no commercial polish, no cinematic look. The photo should look like an accidentally-taken phone selfie, not a polished content-creator selfie.
```

## Appendix B — Video ad template, 8-beat 15s (fill the brackets)

```
FORMAT: 9:16 | FPS: 30 | DURATION: ~15s | RESOLUTION: 720p

GLOBAL LOCKS
CHARACTER LOCK: [archetype], [age range], [build], [skin/hair + named flaws], [energy], consistent identity matching @char_ref
OUTFIT LOCK: [every garment, color, fit, fabric, plus wrinkles/smudges/scuffs]
ENVIRONMENT LOCK: [setting with named props, light direction, time of day, lived-in details]
PRODUCT LOCK: [every visible element preserved from the product reference]
STYLE: Casual realistic UGC vlog, hyper-realistic iPhone aesthetic, no CGI look, candid relatable
LIGHTING: [natural light source, color temperature, what it highlights]
AUDIO: [ambient + product sounds. No music — added in post.]
VOICE: [use the locked voice formula verbatim]
TEXT: None
CAMERA: Handheld phone-camera selfie throughout, slight micro-shake, smooth quick vlog cuts

SHOT SEQUENCE
[00:00-00:02 | Hook] on-camera with the three speaking anchors: "[hook line]"
[00:02-00:04 | Product Reveal] macro flat-lay. Voiceover: "[intro line]"
[00:04-00:06 | Setup] close-up of first product action. On-camera: "[setup line]"
[00:06-00:08 | Demo/Hero] macro of the core function + specific physics. Voiceover: "[demo line]"
[00:08-00:10 | Proof] result shot, face enters frame. On-camera: "[reaction line]"
[00:10-00:12 | Second Use] second angle. Voiceover: "[versatility line]"
[00:12-00:14 | Beauty Cuts] 3-4 rapid close-ups. On-camera: "[payoff line]"
[00:14-00:15 | Soft CTA] leaning casually, product visible. On-camera: "[soft CTA]"

LIP SYNC: full natural visible mouth articulation when face is in frame, voice continuity seamless across cuts.
PHYSICS: [domain-specific physics]
STYLE NEGATIVES: [the full negative powerhouse list]
```

## Appendix C — When using reference images

With a reference attached, do NOT re-describe identity in the prompt — it fights the reference and causes drift. The prompt carries only: "the [person] from ref 1" + the new pose/framing + the photography style. The ref carries identity; the prompt carries scene.

## Extended production references

- For category-specific material, liquid, food, fabric, pet, appliance, and automotive physics, read [references/category-physics.md](references/category-physics.md).
- For platform framing, safe zones, dialogue density, audio, and export checks, read [references/platform-production.md](references/platform-production.md).
