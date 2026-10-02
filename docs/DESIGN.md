# Design system: a sunny kitchen

Soothing, comforting, joyful. A family kitchen on a bright morning: sage walls, basil on the windowsill, a marigold tea towel, handwritten recipe cards. Warm without the generic cream-and-terracotta look.

Source of truth for tokens: `frontend/src/index.css`. This file explains them.

## Color

One accent. Basil is the action color; marigold is the only accent and is used sparingly (quote marks, the card rule, highlights, gingham).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#F2F6EC` sage morning | `#10201A` | page |
| `--bg-2` | `#E5EEDA` | `#15291F` | sections, chips, skeletons |
| `--surface` | `#FFFDF8` linen | `#1A3027` | cards, inputs |
| `--ink` | `#1D3529` herb | `#EAF3E5` | text |
| `--muted` | `#4A6355` | `#A9C2AF` | secondary text (AA on bg and surface) |
| `--line` | `#D3E0C9` | `#2C4638` | borders |
| `--primary` | `#2E6B4C` basil | `#92D6AC` | buttons, links, progress |
| `--on-primary` | `#FFFFFF` | `#10201A` | text on primary |
| `--accent` | `#F5B83D` marigold | `#F6C55A` | the one accent |
| `--accent-soft` | `#FDEFC8` butter | `#3A3218` | warm tint |
| `--danger` / `--danger-soft` | `#B23A26` / `#FBE3DC` | `#FF9A85` / `#3D1F19` | errors only |

Text on marigold is always `--on-accent` (herb), never white. Theme follows the OS (`prefers-color-scheme`). Selection, caret and scrollbar are themed too.

## Type

| Role | Face | Notes |
| --- | --- | --- |
| Display / headings | **Bricolage Grotesque** (variable) | 800 weight for page titles, tracking -0.025 to -0.035em, `text-wrap: balance` |
| Body / UI | **Hanken Grotesk** (variable) | 17px base (`html { font-size: 106.25% }`) for older eyes, line-height 1.6 |
| The speaker's own words | **Caveat** | Only for quotes and things a person said. Never for UI. |
| PDF | **Lora** (bundled TTF) | Print serif, italics for story and quote |

All fonts are self-hosted (Fontsource), OFL licensed.

## Shape

- Surfaces, photos, cards, panels: `--r` = 16px.
- Buttons, chips, segmented controls, toasts: full pill (`999px`).
- Inputs: 12px.
- That is the whole rule. Do not introduce other radii.

## Signature elements

1. **Gingham tea towel** (`.gingham`, marigold on butter; `.gingham-sage` for quiet bands). Used for: the top/bottom bands, the hero towel, empty photo slots, the close-CTA frame, the PDF cover band.
2. **Index card** (`.index-card`): linen card with a marigold header rule and faint ruled lines. Used whenever a person's words are shown.
3. **Real photography**: openly licensed food photos plus 1930s public-domain archive photos for nostalgia. Always via `<Img>` (skeleton, lazy, fade-in).
4. **Custom spot illustrations** (`components/Brand.tsx`): mic, card, book, empty pot (404), boiled-over pot (error), sleeping kettle (wake-up). Grammar: 96x96, 2.6 round strokes in `currentColor`, butter circle behind, marigold accents.
5. **Logo mark**: marigold speech bubble with three grains of salt on a basil tile (`favicon.svg`).

## Layout

- Max width 80rem (`max-w-7xl`), 16px gutters on phones, 24px from `sm`.
- Left-aligned by default. Centered only for short closing statements and status pages.
- Landing section families (each used once): split hero with story carousel, interactive demo, numbered steps band (a real sequence), mixed-size bento, full-bleed archive photo band, classics grid, gingham-framed close.
- No eyebrow labels above headings. No section numbers unless the content is a sequence (How it works, guide steps). No em dashes in UI copy.
- Every multi-column layout collapses to one column below `md` (768px). The page never scrolls sideways (`overflow-x-clip` on the landing root).

## Motion

- GSAP, landing page only, all inside `prefers-reduced-motion: no-preference`:
  1. Hero intro: headline lines rise, photo clip-path reveal, card dealt in.
  2. Hero deck (FIFO): a stack of photos and a stack of quote cards. Advancing slides the top print and card off and tucks them in at the back while the rest step forward; back pulls the last to the front. Hover fans the deck and tilts the top print toward the pointer; touch drags it and springs back or advances. Slow Ken Burns on the top photo; 7s autoplay that pauses on hover, focus, touch and hidden tabs.
  3. How it works: illustration strokes draw themselves as each step enters.
  4. Photos "develop" on scroll (`.reveal-img`): they arrive warm, faded and a little soft, then settle into full colour like prints laid on a table. Bento photo drifts; archive photo parallax.
- Everywhere else: CSS only, for feedback (button press, pop-in toasts, check-off strike-through, step transitions in cook mode).
- Easing: expo/back out. Never bounce on UI.

## Components

`Layout` (header with mobile menu, footer, skip link, wake-up/offline banners), `HeroStories`, `VoiceToRecipe`, `ClassicCard`, `RecipeTile`, `Img`, `Stepper` + `StatusBadge`, `CookMode`, `LevelMeter`, `ConfirmDialog`, `Toast`, `Capabilities`.

## Voice

Plain, warm, kitchen words. Buttons say what happens ("Make the recipe", "Add to my book", "Build the book"). Errors say what went wrong and what to do next, without apologising. One label per intent across the app (e.g. always "Add a memo").
