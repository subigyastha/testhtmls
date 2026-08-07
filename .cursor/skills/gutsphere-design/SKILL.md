---
name: gutsphere-design
description: Gutsphere product design system and UI rules. Use this skill whenever building, editing, or reviewing ANY Gutsphere UI — screens, components, pages, prototypes, Rails views, HTML, CSS, or React. Also trigger when the user mentions Gutsphere styling, colors, fonts, tokens, spacing, layout, dark mode, light mode, or design consistency. This skill defines the exact colors (light + dark), fonts, spacing, radii, components, and patterns that ALL Gutsphere interfaces must follow. Always read this skill before writing any Gutsphere UI code, even for small changes.
---

# Gutsphere Design System

This skill defines design rules, tokens, and patterns for all Gutsphere UI.

**Core rule: Do not invent design. Assemble from this system.**

---

## 1. Product Principles

- **Clarity over decoration** — No visual treatment unless it improves comprehension or trust
- **Consistency over novelty** — Repeated problems use repeated patterns
- **Mobile-first** — Design for mobile first, always
- **Dense but breathable** — Use hierarchy, grouping, spacing, progressive disclosure
- **Calm, trusted, health-grade** — Reassuring, capable, structured. No playful UI
- **One primary job per surface** — Every screen/card/section has one purpose

---

## 2. Visual Character

The interface should feel: clean, premium, calm, direct, legible, modern — in **both light and dark**.

**Do not use:** flashy gradients, decorative icon overload, excessive glassmorphism, visually loud dashboards, novelty for novelty's sake, pure black (`#000`) or cool blue-gray dark themes.

**Do use:** generous whitespace, simple geometry, restrained color, strong type hierarchy, subtle elevation (light) or stepped surfaces + borders (dark), clear grouping, obvious CTAs.

---

## 3. Fonts

```
Display / Headings:  Inter — weights 400, 500, 600, 700
Body / UI:           DM Sans — weights 400, 500, 600, 700, italic
```

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

```css
--font-display: 'Inter', -apple-system, 'SF Pro Display', sans-serif;
--font-body: 'DM Sans', -apple-system, sans-serif;
```

**Rules:**
- Inter for all headings, page titles, section titles, sheet titles (17px+)
- DM Sans for everything else: body, cards, buttons, rows, labels, inputs
- Sentence case only. Prefer semibold over bold
- No more than 4 text sizes per screen
- Avoid center-aligned long-form text

### Type Scale

| Style | Size / Line / Weight | Font |
|-------|---------------------|------|
| display | 28 / 32 / 600 | Inter |
| title.1 | 24 / 30 / 600 | Inter |
| title.2 | 20 / 28 / 600 | Inter |
| title.3 | 18 / 24 / 600 | Inter |
| body | 16 / 24 / 400 | DM Sans |
| body.small | 14 / 20 / 400 | DM Sans |
| caption | 12 / 16 / 500 | DM Sans |
| label | 13 / 16 / 500 | DM Sans |

### Global text scale modes

Use one app-wide text preference with exactly two states:

- `default` (new baseline): body `16/24`, body.small `14/20`, caption `12/16`, label `13/16`
- `larger` (+1 accessibility step): body `17/26`, body.small `15/22`, caption `13/18`, label `14/18`

Implementation rule:
- Apply scale by switching typography tokens on `<html data-text-scale="default|larger">`
- Never hardcode one-off per-screen font bumps for accessibility mode

---

## 4. Colors & Theming

**Always use CSS variables with the `--gs-` prefix.** Never hardcode hex in views, Stimulus controllers, or inline styles (e.g. no `#FAF6F2`, `#57534E`, `#FFFFFF` for surfaces). Light and dark share the **same variable names**; values swap under `.dark` on `<html>`.

### How dark mode works (implementation)

| Piece | Location | Role |
|-------|----------|------|
| Token remapping | `app/assets/stylesheets/dark_theme.css` | **Single source of truth** for dark palette — edit hex here only |
| Shared primitives | `app/assets/stylesheets/application.tailwind.css` | Reusable classes (`.gs-tracker-card`, `.gs-diet-plan-tablist`, etc.) |
| Activation | `app/views/layouts/shared/_check_dark_mode.html.erb` | Adds `.dark` on `<html>` before paint (OS preference or `localStorage.theme`) |
| User toggle | `dark_mode_controller.js` | Persists `localStorage.setItem('theme', 'dark' \| 'light')` |

**Do not use:** Tailwind `dark:` variants, `bg-white`, `text-gray-*`, or duplicate light/dark class pairs in ERB. If a color must change with theme, it must be a `--gs-*` token.

### Surface hierarchy (both themes)

Stack surfaces from darkest → lightest. In **dark mode**, contrast comes from **borders + stepped surfaces**, not heavy shadows.

| Role | Token | Light (approx.) | Dark (approx.) |
|------|--------|-----------------|----------------|
| Page canvas | `--gs-sand` | `#F5EEE8` | `#1A1614` |
| Card | `--gs-card` | `#FFFFFF` | `#221E1B` |
| Elevated / inset tile | `--gs-card-elevated`, `--gs-snapshot-tile-bg` | `#FAF6F2` | `#2A2522` |
| Row icon / subtle well | `--gs-sand-light` | `#FAF6F2` | `#221E1B` |
| Pill tab track | `--gs-segment-track-bg` | `#FAF6F2` | `#2A2522` |
| Sheet / modal | `--gs-card-elevated` | same as card | `#2A2522` |
| In-card row divider | `--gs-divider` | `rgba(0,0,0,0.03)` | `rgba(255,255,255,0.05)` |

`--gs-white` is a legacy alias that maps to `--gs-card` in dark mode. Prefer `--gs-card` for new code.

### Brand (theme-aware)

| Token | Use |
|-------|-----|
| `--gs-coral` | Primary CTA, active tab, key emphasis |
| `--gs-coral-glow` | Subtle brand backgrounds (insight sections, selected chips) |
| `--gs-coral-light` | Brand border tints |
| `--gs-insight-section-bg` / `--gs-insight-section-border` | “What stands out” / highlighted plan sections |

Dark mode uses a slightly lighter coral (`#F87171`) and stronger glow opacities so brand reads on charcoal canvas.

**Form option selected state** (choice chips) — use dedicated tokens, not raw `--gs-coral` on labels:
| Token | Use |
|-------|-----|
| `--gs-choice-selected-border` | Selected chip border |
| `--gs-choice-selected-bg` | Selected chip fill (glow) |
| `--gs-choice-selected-text` | Selected label + ✓ checkmark |

Dark mode uses lighter coral (`#FCA5A5`) for selected text so it does not read as muddy dark red on charcoal. Never use invalid Tailwind like `peer-checked:border-var(--gs-coral)` — use `.gs-choice-chip` only. Do not set inline `style="border-color: …"` on chips; it blocks the checked state.

### Text (theme-aware)

| Token | Use |
|-------|-----|
| `--gs-text-primary` | Headings, primary labels |
| `--gs-text-secondary` | Body copy |
| `--gs-text-muted` | Supporting info |
| `--gs-text-hint` | Metadata, placeholders |

Dark mode: warm off-white (`#F5F0EC`) for primary — **never pure `#FFFFFF` for body text** except on coral buttons.

### Borders & dividers

| Token | Use |
|-------|-----|
| `--gs-border` | Structural edges (cards, inputs, tab tracks) |
| `--gs-border-hover` | Hover borders |
| `--gs-divider` | **In-card row separators only** — lighter than `--gs-border` |

### Semantic status (theme-aware)

| Token | Use |
|-------|-----|
| `--gs-green` / `--gs-green-bg` | Success, positive trends |
| `--gs-amber` / `--gs-amber-bg` / `--gs-amber-text` | Caution callouts |
| `--gs-red` / `--gs-red-bg` | Destructive actions |

Use `.gs-callout-amber` for amber warning boxes — not raw `#FEF3C7` / `#92400E`.

### Usage rules (light + dark)

- Brand color ONLY for primary CTA, selected segment tab, and deliberate emphasis
- Surfaces stay neutral and warm (sand / charcoal) — color never dominates
- No extra accent colors beyond guide avatars (`--gs-sky-*`, `--gs-purple-*`, `--gs-rose-*`)
- Icon wells: neutral `--gs-sand-light` or insight variant — no random colored icon backgrounds
- **Intentional `#fff` on coral buttons only** (text on `--gs-coral` fills)
- Charts may use fixed hex for data series; UI chrome must still use tokens

---

## 5. Spacing

Use ONLY this scale. No arbitrary values.

| Token | Value |
|-------|-------|
| space.0 | 0 |
| space.1 | 4px |
| space.2 | 8px |
| space.3 | 12px |
| space.4 | 16px |
| space.5 | 20px |
| space.6 | 24px |
| space.8 | 32px |
| space.10 | 40px |
| space.12 | 48px |
| space.16 | 64px |

**Defaults:**
- Page padding mobile: 16px
- Card padding: 16px
- Gap between stacked cards: 12px
- Gap between sections: 16px
- Gap between tightly related items: 8px

---

## 6. Radius

| Token | Value | Use |
|-------|-------|-----|
| radius.sm | 8px | tags, small chips |
| radius.md | 12px | buttons, inputs, rows |
| radius.lg | 16px | cards |
| radius.xl | 20px | sheets, modals |
| radius.pill | 9999px | pills, segment tabs |

---

## 7. Shadows

Restrained elevation only.

- `shadow.sm` — cards: `0 1px 3px rgba(0,0,0,0.04)`
- `shadow.md` — sheets, dropdowns: `0 4px 16px rgba(0,0,0,0.08)`
- `shadow.lg` — high-priority overlays only

Prefer borders + subtle elevation. No dramatic shadows. No shadow stacking.

---

## 8. Components

Use shared primitives. Do not recreate in feature code.

### Button
- Variants: primary (coral), secondary (outline), ghost, destructive
- Full-width on mobile by default
- One primary button per section. Never two primary side by side
- Labels: 2–5 words, action-oriented ("Log symptom", "View pattern")
- Radius: md (12px)
- Must support: default, pressed, disabled, loading states

### Card
- One main job per card
- Padding: 16px. Radius: lg (16px)
- Prefer `Gs::CardComponent` or primitives: `.gs-surface-card`, `.gs-tracker-card`, `.gs-insight-emphasis` / `.gs-stands-out-section`
- Food / checklist lists: `.gs-diet-plan-bucket`, `.gs-diet-plan-checklist` (elevated inset on card)
- Secondary buttons: `.gs-btn-muted`
- Do not nest cards unless pattern explicitly requires it
- Use section headers to break up dense screens

### Row / List Item
- Primary label + optional secondary text + optional status + right chevron
- Min height: 48px (touch target)
- Icon container: 40×40px, radius 12px, `--sand-light` background, `--text-secondary` color
- ALL row icons use the same neutral treatment. No colored icon backgrounds

### Segments / Tabs
- Use only for sibling views. Not for deep branching
- **Use shared classes** — do not hand-roll tab styles per screen
- Pill track: `.gs-segment-tablist` or `.gs-diet-plan-tablist` (background: `--gs-segment-track-bg`, border: `--gs-border`)
- Tab button: `.gs-segment-tab` / `.gs-diet-plan-tab` + `.gs-tab-active` / `.gs-tab-inactive`
- Program week picker (Low FODMAP): `.gs-program-week-tablist` + `.gs-program-week-btn` with `aria-selected="true"` for active week
- Stimulus tab controllers must toggle **classes**, not inline `style.background` / `style.color`
- Top-level active: coral fill (`--gs-coral`), white text
- Sub-level active: coral-glow fill, coral text (`.gs-tab-sub-active` / `.gs-tab-sub-inactive`)
- Labels: short and obvious. Radius: pill

### Sheet / Modal
- Sheet on mobile by default
- Clear title (Inter, 18px, 600). Close affordance required
- Primary action anchored at bottom. Radius: xl (20px)

### Empty State
- Explain what the area is for, why it matters, what to do next
- Include one clear action

### Insight / Pattern Card
- Signal or title first, interpretation second, next step third
- Optional confidence indicator. Optional action CTA

---

## 9. Layout

### Mobile Screen Anatomy
1. Header (flex-shrink: 0, always visible)
2. Page title + contextual summary
3. Scrollable main content
4. Bottom nav (flex-shrink: 0, always visible)

### Navigation Structure
- **Bottom nav:** Today, Track, Patterns, Care, Chat
- **Header left:** Profile avatar (or back button on detail screens)
- **Header right:** Notifications bell
- **FAB:** Quick Add floating button
- **Sheets:** Quick logging and secondary workflows

### Bottom Nav Style
- Tokens: `--gs-nav-bg`, `--gs-nav-active`
- Inactive labels/icons: muted text tokens
- Active: frosted pill with coral text — not a solid coral fill on the whole tab
- Dark mode: nav uses charcoal frosted glass, not light sand

---

## 10. Interaction Rules

### States
Every interactive element must support: default, pressed, disabled, focus, loading.

### Motion
- Subtle and purposeful only
- Page transitions: fade + translateX (0.3s ease)
- Card press: scale(0.985)
- Sheet: translateY with 0.35s ease
- No bouncy or playful motion in clinical flows

### Feedback
- Toast for lightweight confirmation
- Inline validation for forms
- Sheet/modal for multi-step decisions
- Confirmation only for destructive/irreversible actions

### Progressive Disclosure
Do not show every detail at once. Especially important for trackers, symptom logging, care guidance, and summaries.

---

## 11. Content Voice

Calm, direct, helpful, respectful, intelligent, human.

- Plain language. Concrete wording. No jargon unless medically necessary
- Explain the next step clearly. No hype language
- Non-diagnostic: "may", "appears to", "your data suggests" — never "confirmed", "diagnosed"
- Button labels: "Log symptom", "View pattern", "Start tracking", "Prepare for visit"
- Avoid vague: "Continue", "Submit", "Next" unless context is obvious

---

## 12. Core Screen Patterns

### Today
Command center. Priority order: what matters now → daily actions → latest patterns → guidance → quick access.

### Track
Fast capture. Optimize for speed. Reduce cognitive load. Context-specific fields only.

### Patterns
Signal first → meaning second → next step third. Confidence framing throughout.

### Care
Action-oriented. Separate self-care, navigation, and clinical. Action blocks, not essays.

### Chat
Guide-based contact list. Each guide is a specialist perspective. Should feel like contacting a trusted person, not using a chatbot.

### Summary / Reports
Structured, scannable, clinically readable. Signal first. Support export.

---

## 13. Anti-Patterns — Do NOT Do These

- Multiple competing primary actions on one screen
- Arbitrary spacing values outside the scale
- Colored icon backgrounds (use neutral `--gs-sand-light` uniformly)
- **Hardcoded light-mode hex** (`#FAF6F2`, `#F5EEE8`, `#57534E`, `bg-white`, `text-gray-900`) in views or JS
- **Tailwind `dark:` utility pairs** — use `--gs-*` tokens instead
- **Setting tab/button colors via inline `style` in Stimulus** — toggle CSS classes
- Dark cards filled with `--gs-text-primary` — use `coral-glow` / `--gs-insight-section-*` for emphasis instead
- Random card styles or one-off visual treatments
- Deeply nested cards
- Large blocks of centered text
- Long explanatory paragraphs inside action surfaces
- Feature-specific style systems outside this shared system
- Decorative animation in clinical flows
- Diagnostic language ("confirmed", "diagnosed") in pattern descriptions

---

## 14. Priority Order for Tradeoffs

When forced to choose:
1. Clarity
2. Consistency
3. Accessibility
4. Speed of use
5. Elegance
6. Novelty

---

## 15. Checklist Before Outputting UI

- [ ] Used `--gs-*` tokens only (no hardcoded surface/text hex, no `dark:`)?
- [ ] Verified appearance in **both** light and dark (toggle `localStorage.theme` or OS setting)?
- [ ] Used shared components (button, card, row, sheet, segment tab classes)?
- [ ] Stimulus/controllers toggle **classes**, not inline colors?
- [ ] Matches an approved screen pattern?
- [ ] One primary CTA per section?
- [ ] Labels and hierarchy clear?
- [ ] Inter for headings, DM Sans for body?
- [ ] Neutral icon backgrounds throughout?
- [ ] Inset lists/tiles use `--gs-snapshot-tile-bg` or `.gs-diet-plan-bucket`?
- [ ] Result is calm, structured, trustworthy?
- [ ] Non-diagnostic language for health content?
- [ ] Accessible (touch targets, labels, contrast in both themes)?
- [ ] No new ad hoc visual rules invented?

---

## 16. Shared CSS primitives (Rails app)

Defined in `application.tailwind.css` — **compose these instead of duplicating rules**:

| Class | Purpose |
|-------|---------|
| `.gs-surface-card`, `.gs-tracker-card` | Standard card shell |
| `.gs-insight-emphasis`, `.gs-stands-out-section` | Coral-glow highlighted section |
| `.gs-surface-elevated`, `.gs-weekly-snapshot-tile`, `.gs-recap-stat` | Inset metric / stat tiles |
| `.gs-diet-plan-bucket`, `.gs-diet-plan-checklist` | Food list / check-in checklist |
| `.gs-segment-tablist`, `.gs-diet-plan-tablist` | Eat / Careful / Avoid (and similar) |
| `.gs-segment-tab`, `.gs-diet-plan-tab` | Tab button base |
| `.gs-tab-active`, `.gs-tab-inactive` | Tab states |
| `.gs-tab-sub-active`, `.gs-tab-sub-inactive` | Secondary tab states |
| `.gs-program-week-tablist`, `.gs-program-week-btn` | Low FODMAP week picker |
| `.gs-choice-chip` (+ `--row`, `--stack`, `--prominent`, `--shape`, `--tall`) | Form option labels — use `gs_choice_chip_class("modifier")` in ERB; input must be `class="peer hidden"` immediately before the label |
| `.gs-btn-muted` | Secondary / cancel buttons |
| `.gs-callout-amber` | Amber caution callout |
| `.gs-record-list`, `.gs-record-row` | Stacked records with `--gs-divider` |
| `.gs-form-section` | Tracker form field group (sand-light inset) |
| `.gs-form-section-inner` | Inner card surface inside a section |
| `.gs-form-input`, `.gs-form-textarea` | Text, date, time, number inputs |
| `.gs-photo-upload-zone` | Dashed file-upload drop zone |
| `.gs-form-alert-error`, `.gs-form-alert-success` | Inline validation / flash messages |
| `.gs-callout-success` | Positive state blocks (e.g. “no symptoms today”) |
| `.gs-color-swatch-border` | Color picker dots (stool/blood swatches) |
| `.gs-btn-destructive-sm` | Small remove/delete on forms |
| `.gs-time-quick-btn`, `.gs-time-quick-btn--active` | BM time presets (Morning, Afternoon, …) — toggle active class in JS, never `#307FE2` blue |

Add new shared primitives when the same pattern appears 3+ times — do not copy-paste token blocks into feature views.

---

## Reference: CSS variables (`--gs-*`)

Production tokens live in `application.tailwind.css` (`:root`) and `dark_theme.css` (`.dark` overrides). Shorthand names below map to `--gs-*` in code.

### Light (`:root` — key values)

```css
--gs-coral: #EF5350;
--gs-coral-glow: rgba(239, 83, 80, 0.07);
--gs-coral-light: rgba(239, 83, 80, 0.14);
--gs-sand: #F5EEE8;
--gs-sand-light: #FAF6F2;
--gs-card: #FFFFFF;
--gs-text-primary: #1C1917;
--gs-text-secondary: #57534E;
--gs-text-muted: #A8A29E;
--gs-text-hint: #C4BBB5;
--gs-border: #E7E0DA;
--gs-divider: rgba(0, 0, 0, 0.03);
--gs-green: #2E7D32;
--gs-amber-bg: #FEF3C7;
--gs-amber-text: #92400E;
--gs-red: #DC2626;
--gs-segment-track-bg: #FAF6F2;
--gs-snapshot-tile-bg: #FAF6F2;
--gs-insight-section-bg: rgba(239, 83, 80, 0.07);
--gs-insight-section-border: rgba(239, 83, 80, 0.22);
--gs-choice-selected-border: #EF5350;
--gs-choice-selected-bg: rgba(239, 83, 80, 0.12);
--gs-choice-selected-text: #EF5350;
```

### Dark (`.dark` on `<html>` — key values)

Warm charcoal canvas — **not** cool gray, **not** pure black (`#000`).

```css
--gs-sand: #1A1614;
--gs-sand-light: #221E1B;
--gs-card: #221E1B;
--gs-card-elevated: #2A2522;
--gs-text-primary: #F5F0EC;
--gs-text-secondary: #C4BBB5;
--gs-text-muted: #8A817A;
--gs-coral: #F87171;
--gs-coral-glow: rgba(248, 113, 113, 0.12);
--gs-border: #3A3431;
--gs-divider: rgba(255, 255, 255, 0.05);
--gs-segment-track-bg: #2A2522;
--gs-snapshot-tile-bg: #2A2522;
--gs-insight-section-bg: rgba(248, 113, 113, 0.18);
--gs-insight-section-border: rgba(248, 113, 113, 0.40);
--gs-choice-selected-border: #FCA5A5;
--gs-choice-selected-bg: rgba(248, 113, 113, 0.22);
--gs-choice-selected-text: #FCA5A5;
--gs-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.50); /* stronger in dark */
```

Optional dev palettes: `data-palette` on `<html>` (see `dark_theme.css` — `evolved-warm`, `neutral`, `teal`, etc.). Production UI uses the default warm palette unless testing.

### Typography & layout tokens (unchanged by theme)

```css
--font-display: 'Inter', -apple-system, 'SF Pro Display', sans-serif;
--font-body: 'DM Sans', -apple-system, sans-serif;
--gs-radius-sm: 8px; --gs-radius-md: 12px; --gs-radius-lg: 16px;
--gs-radius-xl: 20px; --gs-radius-pill: 9999px;
--gs-page-px: 16px; --gs-max-width: 430px;
```
