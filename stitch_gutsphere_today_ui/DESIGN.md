---
name: Gutsphere
colors:
  surface: '#fff8f6'
  surface-dim: '#ebd6cf'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1ec'
  surface-container: '#ffe9e3'
  surface-container-high: '#fae4dd'
  surface-container-highest: '#f4ded7'
  on-surface: '#241915'
  on-surface-variant: '#57423b'
  inverse-surface: '#3a2e29'
  inverse-on-surface: '#ffede8'
  outline: '#8b7169'
  outline-variant: '#dec0b6'
  surface-tint: '#a43c12'
  primary: '#a43c12'
  on-primary: '#ffffff'
  primary-container: '#ff7f50'
  on-primary-container: '#6c2000'
  inverse-primary: '#ffb59c'
  secondary: '#625e59'
  on-secondary: '#ffffff'
  secondary-container: '#e8e1db'
  on-secondary-container: '#68645f'
  tertiary: '#006970'
  on-tertiary: '#ffffff'
  tertiary-container: '#00b5c0'
  on-tertiary-container: '#004145'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcf'
  primary-fixed-dim: '#ffb59c'
  on-primary-fixed: '#380c00'
  on-primary-fixed-variant: '#822800'
  secondary-fixed: '#e8e1db'
  secondary-fixed-dim: '#ccc5c0'
  on-secondary-fixed: '#1e1b18'
  on-secondary-fixed-variant: '#4a4642'
  tertiary-fixed: '#7af4ff'
  tertiary-fixed-dim: '#4dd9e4'
  on-tertiary-fixed: '#002022'
  on-tertiary-fixed-variant: '#004f54'
  background: '#fff8f6'
  on-background: '#241915'
  surface-variant: '#f4ded7'
  gs-sand: '#F5EEE8'
  gs-card: '#FFFFFF'
  gs-card-elevated: '#FAF6F2'
  gs-coral: '#FF7F50'
  gs-coral-glow: rgba(255, 127, 80, 0.1)
  gs-dark-sand: '#1A1614'
  gs-dark-card: '#221E1B'
  gs-dark-card-elevated: '#2A2522'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: DM Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  space-3: 12px
  space-4: 16px
  space-6: 24px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 24px
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

---

## 3. Fonts

```
Display / Headings:  Inter — weights 400, 500, 600, 700
Body / UI:           DM Sans — weights 400, 500, 600, 700, italic
```

---

## 4. Colors & Theming

**Always use CSS variables with the `--gs-` prefix.**

### Surface hierarchy (both themes)

| Role | Token | Light (approx.) | Dark (approx.) |
|------|--------|-----------------|----------------|
| Page canvas | `--gs-sand` | `#F5EEE8` | `#1A1614` |
| Card | `--gs-card` | `#FFFFFF` | `#221E1B` |
| Elevated / inset tile | `--gs-card-elevated`, `--gs-snapshot-tile-bg` | `#FAF6F2` | `#2A2522` |

### Brand (theme-aware)

| Token | Use |
|-------|-----|
| `--gs-coral` | Primary CTA, active tab, key emphasis |
| `--gs-coral-glow` | Subtle brand backgrounds |

### Text (theme-aware)

| Token | Use |
|-------|-----|
| `--gs-text-primary` | Headings, primary labels |
| `--gs-text-secondary` | Body copy |
| `--gs-text-muted` | Supporting info |

---

## 5. Spacing

| Token | Value |
|-------|-------|
| space.3 | 12px |
| space.4 | 16px |
| space.6 | 24px |

---

## 6. Radius

| Token | Value | Use |
|-------|-------|-----|
| radius.md | 12px | buttons, inputs |
| radius.lg | 16px | cards |
| radius.xl | 20px | sheets, modals |
| radius.pill | 9999px | pills |
