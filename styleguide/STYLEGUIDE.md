# Visual Identity Styleguide

**Origin**: Dalil desktop handbook app
**Purpose**: Blueprint for all Scooda desktop and web applications
**Design philosophy**: Things.app-inspired — warm paper-like surfaces, shadows over borders, micro-animations, generous whitespace, native macOS sensibility

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Typography](#2-typography)
3. [Colour System](#3-colour-system)
4. [Spacing & Layout](#4-spacing--layout)
5. [Surfaces & Elevation](#5-surfaces--elevation)
6. [Buttons](#6-buttons)
7. [Form Controls](#7-form-controls)
8. [Navigation Patterns](#8-navigation-patterns)
9. [Cards & Panels](#9-cards--panels)
10. [Badges, Tags & Pills](#10-badges-tags--pills)
11. [Overlays & Modals](#11-overlays--modals)
12. [Toast Notifications](#12-toast-notifications)
13. [Loading & Empty States](#13-loading--empty-states)
14. [Iconography](#14-iconography)
15. [Motion & Animation](#15-motion--animation)
16. [Dark Mode](#16-dark-mode)
17. [Scrollbars](#17-scrollbars)
18. [Focus & Accessibility](#18-focus--accessibility)
19. [macOS Native Integration](#19-macos-native-integration)
20. [Ambient Background](#20-ambient-background)
21. [Prose / Long-Form Content](#21-prose--long-form-content)
22. [Responsive Patterns](#22-responsive-patterns)
23. [Z-Index Scale](#23-z-index-scale)
24. [CSS Token Reference](#24-css-token-reference)
25. [Implementation Notes](#25-implementation-notes)

---

## 1. Design Principles

### Core Philosophy

The visual identity draws from **Things.app** (Cultured Code) and premium macOS desktop applications. Every surface should feel like quality stationery — warm, tactile, and considered.

### Guiding Rules

| Principle | Description |
|-----------|-------------|
| **Warmth over clinical** | Off-white surfaces (`#F5F5F3`, `#F9F9F7`) instead of pure white. Warm stone tones instead of cold greys. |
| **Shadows over borders** | Prefer soft, diffused shadows to communicate depth. When borders are used, keep them subtle (60–70% opacity). |
| **Translucency & blur** | Key surfaces (topbar, sidebar, panels) use `backdrop-blur-xl` with semi-transparent backgrounds to create depth and connection to content beneath. |
| **Restraint in colour** | A single blue accent (`#2563EB`) carries all interactive meaning. Status colours (green, red, amber) appear only for feedback. Everything else is neutral. |
| **Micro-animations** | Every interactive element has subtle motion — scale on press, translate on hover, fade on appear. Motion is fast (80–200ms), never bouncy, and respects `prefers-reduced-motion`. |
| **Generous whitespace** | Content breathes. Padding is generous (40px vertical on pages). Spacing between sections is deliberate and consistent. |
| **Typography hierarchy** | Size, weight, and colour establish hierarchy. Never rely on decoration alone. Headings are tight-tracked and semibold. Body is relaxed and readable. |
| **Native feel** | On macOS: transparent titlebar with overlay traffic lights, system font stack, platform scrollbar behaviour, blur effects. The app should feel like it belongs on the platform. |

---

## 2. Typography

### Font Stack

```css
--font-sans: 'Poppins', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
--font-mono: 'SF Mono', 'Fira Code', ui-monospace, monospace;
```

**Poppins** is the primary typeface for all apps. Load via Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500&display=swap" rel="stylesheet">
```

**Required weights**: 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold). Italic variants for 400 and 500.

### Root Settings

```css
html {
  font-size: 15px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Type Scale

| Element | Size | Weight | Line Height | Letter Spacing | Colour |
|---------|------|--------|-------------|----------------|--------|
| **H1** | `1.95rem` → `2.15rem` (sm+) | 600 (SemiBold) | `leading-tight` (1.25) | `tracking-tight` (-0.025em) | `text-primary` |
| **H2** | `1.25rem` (20px) | 600 | `leading-tight` | `tracking-tight` | `text-primary` |
| **H3** | `1rem` (16px) | 600 | `leading-tight` | `tracking-tight` | `text-primary` |
| **H4** | `0.875rem` (14px) | 600, uppercase | Normal | `tracking-wide` (0.025em) | `text-secondary` |
| **Body** | `15px` (root) | 400 | 1.6 | Normal | `text-primary` |
| **Body (prose)** | `15px` | 400 | `leading-relaxed` (1.625) | Normal | `text-primary` |
| **Labels** | `0.875rem` (14px) | 500 | Normal | Normal | `text-primary` |
| **Small labels** | `0.75rem` (12px) | 500 | Normal | Normal | `text-secondary` |
| **Section headers** | `11px` | 600, uppercase | Normal | `tracking-[0.08em]` | `text-secondary` |
| **Micro text** | `10px` – `11px` | 500 | Normal | Normal | `text-secondary` |
| **Sidebar links** | `13px` | 400 (normal), 500 (active) | Normal | Normal | `text-primary/80` or `accent` |
| **Inline code** | `0.85em` | 400 | Normal | Normal | `text-primary` |
| **Code blocks** | `13px` | 400 | 1.65 | Normal | Syntax-highlighted |

### Heading Spacing (in prose context)

| Heading | Margin Top | Margin Bottom | Extra |
|---------|-----------|---------------|-------|
| H1 | `mt-8` | `mb-4` | — |
| H2 | `mt-10` | `mb-3` | Bottom border: `pb-2 border-b border-border` |
| H3 | `mt-7` | `mb-2` | — |
| H4 | `mt-5` | `mb-1.5` | Uppercase, `tracking-wide`, `text-secondary` |

---

## 3. Colour System

### Design Tokens

All colours are defined as CSS custom properties within a Tailwind `@theme` directive, making them available as utility classes (e.g. `bg-surface`, `text-accent`).

### Light Mode Palette

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--color-surface` | `#FFFFFF` | 255, 255, 255 | Primary background, cards, input fields |
| `--color-surface-secondary` | `#F5F5F3` | 245, 245, 243 | Secondary surfaces, hover backgrounds, code inline |
| `--color-sidebar` | `#F9F9F7` | 249, 249, 247 | Sidebar background |
| `--color-text-primary` | `#1A1A1A` | 26, 26, 26 | Headings, body copy, primary labels |
| `--color-text-secondary` | `#737373` | 115, 115, 115 | Hints, placeholders, meta text, muted labels |
| `--color-border` | `#E5E5E2` | 229, 229, 226 | Borders, dividers, separators |
| `--color-accent` | `#2563EB` | 37, 99, 235 | Links, active states, buttons, interactive highlights |
| `--color-code-surface` | `#F7F8FB` | 247, 248, 251 | Code block background |
| `--color-code-border` | `#DCE1EA` | 220, 225, 234 | Code block border |

### Dark Mode Palette

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--color-surface` | `#171717` | 23, 23, 23 | Primary background |
| `--color-surface-secondary` | `#262626` | 38, 38, 38 | Secondary surfaces |
| `--color-sidebar` | `#1A1A1A` | 26, 26, 26 | Sidebar background |
| `--color-text-primary` | `#EDEDED` | 237, 237, 237 | Primary text |
| `--color-text-secondary` | `#999999` | 153, 153, 153 | Muted text |
| `--color-border` | `#303030` | 48, 48, 48 | Borders |
| `--color-accent` | `#60A5FA` | 96, 165, 250 | Links, active states (lighter for contrast) |
| `--color-code-surface` | `#1E1F24` | 30, 31, 36 | Code block background |
| `--color-code-border` | `#31343D` | 49, 52, 61 | Code block border |

### Status Colours

These are **not** custom tokens — they use Tailwind's built-in colour palette to keep the token surface small.

| Status | Light | Dark | Usage |
|--------|-------|------|-------|
| **Success** | `bg-green-600 text-white` | Same | Toast success, connection test pass |
| **Error** | `bg-red-600 text-white` | Same | Toast error, validation failure |
| **Error text** | `text-red-600` | `text-red-400` | Inline error messages |
| **Info** | `bg-stone-800 text-stone-100` | `bg-stone-200 text-stone-900` | Neutral toast |
| **Saved** | `border-emerald-500/35 bg-emerald-500/10 text-emerald-500` | Same | Save confirmation badge |
| **Saving** | `border-amber-500/40 bg-amber-500/10 text-amber-500` | Same | In-progress indicator |
| **Search highlight** | `bg-[#FEF08A]` (yellow) | `bg-[#854D0E]` (dark amber) | FTS search matches |

### Accent Usage Pattern

The accent colour appears at varying opacities to create depth:

| Opacity | Usage Example |
|---------|---------------|
| `accent/5` | Very subtle hover background (recently updated items) |
| `accent/8` | Active sidebar link background |
| `accent/10` | Active button background, selected state |
| `accent/12` | Compare mode changed section background |
| `accent/15` | Updated badge background |
| `accent/20` | Subtle accent border |
| `accent/30` | Active border on accent elements |
| `accent/35` | Active toggle border |
| `accent/40` | Prominent accent border |
| `accent` (100%) | Filter pill active state, primary CTA, links |

### Colour Mixing

For nuanced surface treatments, use CSS `color-mix()`:

```css
/* Semi-transparent surface with slight tint */
background: color-mix(in srgb, var(--color-surface-secondary) 78%, transparent);

/* Accent-tinted border */
border-color: color-mix(in srgb, var(--color-accent) 38%, var(--color-border));

/* Accent-tinted surface */
background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-secondary));
```

---

## 4. Spacing & Layout

### Spacing Scale

The spacing system uses Tailwind's default 4px grid. These are the most commonly used values:

| Name | Value | Tailwind | Common Usage |
|------|-------|----------|--------------|
| Micro | 2px | `0.5` | Tiny gaps, indicator dots |
| XS | 4px | `1` | Inner padding on micro elements |
| SM | 6px | `1.5` | Gap between toolbar items, icon+label pairs |
| MD | 8px | `2` | Inner padding on small elements, list spacing |
| Base | 12px | `3` | Sidebar padding, card inner spacing |
| LG | 16px | `4` | Section spacing, standard padding |
| XL | 20px | `5` | Modal body padding, section breaks |
| 2XL | 24px | `6` | Page horizontal padding |
| 3XL | 32px | `8` | Large horizontal padding (lg breakpoint) |
| 4XL | 40px | `10` | Page vertical padding, home page padding |

### Page-Level Layout

```text
┌──────────────────────────────────────────────────────┐
│  Topbar (52px, fixed, full-width, z-50)              │
├────────────┬─────────────────────────────────────────┤
│            │                                         │
│  Sidebar   │  Main Content Area                      │
│  (resizable│  (flex-1, scrollable, pt-52px)          │
│  ~280px    │                                         │
│  default)  │  ┌─────────────────────────────────┐    │
│            │  │ Content Container (max-width)    │    │
│            │  │ px-6 py-10 lg:px-8               │    │
│            │  └─────────────────────────────────┘    │
│            │                                         │
├────────────┴─────────────────────────────────────────┤
```

### Content Container Widths

| Page Type | Max Width | Padding |
|-----------|-----------|---------|
| Document page | `max-w-[88rem]` (1408px) | `px-6 py-10 lg:px-8` |
| Help / Springboard | `max-w-5xl` (1024px) | `px-6 py-10 lg:px-8` |
| Home page | `max-w-3xl` (768px) | `px-10 py-10` |

### Document Page Layout (with right sidebar)

```text
┌─────────────────────────────────────────────────────┐
│  Content area (max-w-[88rem])                       │
│  ┌──────────────────────────────┬───────────────┐   │
│  │  Article content (flex-1)    │  Right sidebar │   │
│  │                              │  (21rem/336px) │   │
│  │  Breadcrumbs                 │  sticky        │   │
│  │  ContentHeader card          │  top-[96px]    │   │
│  │  Prose body                  │                │   │
│  │                              │  • ToC card    │   │
│  │                              │  • Bookmarks   │   │
│  │                              │  • Notes       │   │
│  │                              │  • Highlights  │   │
│  └──────────────────────────────┴───────────────┘   │
│                                  (hidden < lg)       │
└─────────────────────────────────────────────────────┘
```

### Sidebar Structure

| Section | Spacing |
|---------|---------|
| Project switcher | `px-3 pt-2.5 pb-1.5` |
| Collection switcher | `px-3 pb-1` |
| Navigation tree | `px-2.5 py-1.5`, scrollable |
| Footer | `px-3 py-2.5`, `border-t border-border/70` |

### Sidebar Properties

- Width: resizable, default ~280px, min ~180px, max ~480px
- Background: `bg-sidebar/72 backdrop-blur-xl`
- Right border: `border-r border-border/70`
- Inner shadow: `shadow-[inset_-1px_0_0_rgba(255,255,255,0.02)]`
- Collapse animation: `width 200ms ease-out`
- Resize handle: 4px wide, `cursor: col-resize`, accent colour on hover at 40% opacity

---

## 5. Surfaces & Elevation

### Elevation Hierarchy

From lowest to highest:

| Level | Surface | Properties | Usage |
|-------|---------|------------|-------|
| **Ground** | `bg-surface` | No shadow, no blur | Main content area background |
| **Recessed** | `bg-surface-secondary/45` | No shadow | Input fields, code blocks, textarea |
| **Raised** | `border border-border/60 bg-surface/50 backdrop-blur-xl` | `shadow-[0_14px_30px_-26px_rgba(15,23,42,0.8)]` | Content header card |
| **Floating** | `border border-border/60 bg-surface/52 backdrop-blur-xl` | `shadow-[0_10px_30px_-24px_rgba(0,0,0,0.85)]` | Right sidebar cards |
| **Overlay** | `bg-surface shadow-2xl ring-1 ring-border` | No blur on panel, blur on backdrop | Command palette, modals |
| **Toast** | `shadow-lg` | No border | Toast notifications |
| **Fixed UI** | `bg-surface/72 backdrop-blur-xl border-b border-border/70` | No shadow | Topbar, fixed toolbars |

### Shadow Definitions

```css
/* Content header — warm, wide, upward-biased */
shadow-[0_14px_30px_-26px_rgba(15,23,42,0.8)]

/* Right sidebar cards — deeper, tighter */
shadow-[0_10px_30px_-24px_rgba(0,0,0,0.85)]

/* Modals / command palette */
shadow-2xl  /* Tailwind default: 0 25px 50px -12px rgba(0,0,0,0.25) */

/* Toast notifications */
shadow-lg   /* Tailwind default: 0 10px 15px -3px rgba(0,0,0,0.1) */
```

### Backdrop Blur

- **Topbar**: `backdrop-blur-xl` with `bg-surface/72` (72% opacity)
- **Sidebar**: `backdrop-blur-xl` with `bg-sidebar/72`
- **Right sidebar cards**: `backdrop-blur-xl` with `bg-surface/52`
- **Command palette overlay**: `backdrop-blur-sm` with `bg-black/40`
- **Back-to-top button**: `backdrop-blur` (standard) with `bg-surface/75`

### Border Opacity Scale

Borders are rarely at full opacity. The scale:

| Opacity | Usage |
|---------|-------|
| `/55` | Search input border (very subtle) |
| `/60` | Card borders, panel borders |
| `/70` | Topbar border, sidebar footer border, dividers |
| Full | Focus borders, modal dividers |

---

## 6. Buttons

### Primary Button (CTA)

```html
<button class="rounded-lg bg-accent px-4 py-2 text-sm text-white font-medium
               transition-opacity hover:opacity-90 disabled:opacity-50">
  Save
</button>
```

| Property | Value |
|----------|-------|
| Background | `bg-accent` (#2563EB light / #60A5FA dark) |
| Text | `text-white`, `font-medium` |
| Size | `text-sm` (14px), `px-4 py-2` |
| Radius | `rounded-lg` (8px) |
| Hover | `opacity-90` |
| Disabled | `opacity-50` |

### Secondary Button (Cancel / Ghost)

```html
<button class="rounded-lg border border-border px-4 py-2 text-sm
               text-text-primary hover:bg-surface-secondary transition-colors">
  Cancel
</button>
```

### Topbar Chip Button

Small, translucent buttons used in the toolbar area.

```css
.topbar-chip-btn {
  border: 1px solid color-mix(in srgb, var(--color-border) 78%, transparent);
  background: color-mix(in srgb, var(--color-surface-secondary) 50%, transparent);
  color: var(--color-text-secondary);
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 8%, transparent);
}

/* Hover */
.topbar-chip-btn:hover {
  border-color: var(--color-border);
  background: color-mix(in srgb, var(--color-surface-secondary) 86%, transparent);
  color: var(--color-text-primary);
}

/* Active/Open */
.topbar-chip-btn[data-open='true'] {
  border-color: color-mix(in srgb, var(--color-accent) 38%, var(--color-border));
  background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-secondary));
  color: color-mix(in srgb, var(--color-accent) 84%, var(--color-text-primary));
}
```

### Topbar Action Button

Small utility buttons used for Help, Ask AI, etc.

```html
<button class="h-7 px-2.5 rounded-md text-xs font-medium transition-colors border
               border-border/60 bg-surface-secondary/40 text-text-secondary
               hover:text-text-primary hover:bg-surface-secondary/70 hover:border-border">
  Help
</button>
```

**Active state** (when the route is active):
```html
<button class="h-7 px-2.5 rounded-md text-xs font-medium border
               border-accent/35 bg-accent/10 text-accent">
  Help
</button>
```

### Icon Button

Square, icon-only buttons for settings/toggle actions.

```html
<button class="flex items-center justify-center w-7 h-7 rounded-md
               text-text-secondary hover:text-text-primary
               hover:bg-surface-secondary/80 transition-colors">
  <svg class="w-4 h-4" .../>
</button>
```

Larger variant (sidebar footer, collapse toggle):
```html
<button class="flex items-center justify-center w-8 h-8 -m-1 rounded-md
               text-text-secondary hover:text-text-primary
               hover:bg-surface-secondary/80 transition-colors">
```

### Small Action Button (Right Sidebar)

```html
<button class="rounded border border-border/70 bg-surface-secondary/25 px-2 py-1
               text-[11px] font-medium text-text-secondary
               hover:text-text-primary hover:bg-surface-secondary transition-colors">
  Bookmark page
</button>
```

**Active variant**:
```text
bg-accent/10 text-accent border-accent/30
```

### Share/Action Button (Content Header)

```html
<button class="inline-flex items-center gap-1.5 rounded-md border border-border/60
               bg-surface-secondary/30 px-2.5 py-1.5 text-xs font-medium text-text-secondary
               hover:text-text-primary hover:bg-surface-secondary transition-colors">
  <svg class="w-3.5 h-3.5" />
  Share
</button>
```

### Button Micro-Interactions

```css
/* Sidebar nav links — subtle scale on press */
nav a:active, nav button:active {
  transform: scale(0.98);
}

/* Toolbar buttons — more pronounced scale */
[style*="no-drag"] button:active {
  transform: scale(0.94);
}

/* Tab pills — lift on hover */
.topbar-tab-pill:hover {
  transform: translateY(-1px);
}
.topbar-tab-pill:active {
  transform: translateY(0);
}
```

---

## 7. Form Controls

### Text Input

```html
<input class="w-full rounded-lg border border-border bg-surface px-3 py-2
              text-sm text-text-primary placeholder:text-text-secondary
              focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
```

| Property | Value |
|----------|-------|
| Height | Auto (padding determines) |
| Radius | `rounded-lg` (8px) |
| Border | `border-border` (1px solid) |
| Background | `bg-surface` |
| Padding | `px-3 py-2` |
| Font size | `text-sm` (14px) |
| Placeholder | `text-text-secondary` or `text-text-secondary/60` |
| Focus | `border-accent` + `ring-1 ring-accent` |

### Select Dropdown (`.ui-select`)

Custom-styled native select with CSS-only dropdown chevron:

```css
.ui-select {
  appearance: none;
  min-height: 2.5rem;
  border-radius: 0.625rem;
  border: 1px solid var(--color-border);
  background-color: color-mix(in srgb, var(--color-surface-secondary) 78%, transparent);
  padding: 0.5rem 2.25rem 0.5rem 0.75rem;
  /* Custom chevron via CSS gradients */
  background-image: /* two rotated triangles forming a chevron */;
}

.ui-select:focus {
  border-color: var(--color-accent);
  background-color: var(--color-surface);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 22%, transparent);
}
```

**Small variant** (`.ui-select-sm`): `min-height: 2rem`, `border-radius: 0.5rem`

### Textarea

```html
<textarea rows="5"
  class="w-full rounded-lg border border-border/70 bg-surface-secondary/45
         px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60
         focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
```

### Search Input (Transparent)

Used inside command palette and toolbar:

```html
<input class="flex-1 bg-transparent text-sm text-text-primary
              placeholder:text-text-secondary/60 outline-none" />
```

### Search Trigger Button

Resembles an input but is a button:

```html
<button class="flex items-center gap-2 w-[250px] h-7 px-2.5 rounded-lg
               border border-border/55 bg-surface-secondary/35 text-text-secondary text-xs
               hover:bg-surface-secondary/70 hover:border-border transition-colors">
  <svg class="w-3.5 h-3.5 opacity-50" />
  <span class="opacity-50">Search...</span>
  <kbd class="px-1.5 py-0.5 rounded border border-border/50 bg-surface/50
              text-[10px] font-medium text-text-secondary/70">⌘K</kbd>
</button>
```

### Keyboard Shortcut Badge (`<kbd>`)

```html
<kbd class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded
            border border-border bg-surface-secondary text-[10px]
            font-mono text-text-secondary/60">
  Esc
</kbd>
```

### Form Labels

Standard:
```html
<label class="block text-sm font-medium text-text-primary">Label</label>
```

Small/uppercase:
```html
<label class="block text-xs font-medium uppercase tracking-wide text-text-secondary">
  Label
</label>
```

### Help Text

```html
<p class="text-xs text-text-secondary">Helper text below form fields.</p>
```

### Validation Error

```html
<p class="text-xs text-red-600 dark:text-red-400">Error message here.</p>
```

Error state on input: `border-red-400 dark:border-red-600 ring-red-400`

---

## 8. Navigation Patterns

### Topbar

```text
Height: 52px, fixed, full-width
Background: bg-surface/72 backdrop-blur-xl
Border: border-b border-border/70
Drag region: -webkit-app-region: drag (entire bar)
Interactive areas: -webkit-app-region: no-drag (buttons, inputs)

┌──────────────────────────────────────────────────────────┐
│  [78px traffic light space] [Nav] [Bookmarks]     [Search] [Help] [AI] [⚙] │
│  pl-[78px]                                              pr-3  │
└──────────────────────────────────────────────────────────┘
```

### Sidebar Navigation Links

```html
<a class="flex items-center px-2 py-[5px] text-[13px] rounded-md
          transition-colors truncate"
   :style="{ paddingLeft: `${(level * 12) + 20}px` }">
```

| State | Classes |
|-------|---------|
| Default | `text-text-primary/80 hover:bg-surface-secondary/80 hover:text-text-primary` |
| Active | `bg-accent/8 text-accent font-medium` |

**Updated indicator**: Small dot next to link when content has been updated.
```html
<span class="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-accent/80" />
```

Nesting: Each level indents by `12px`. Base left padding is `20px`.

### Breadcrumbs

```html
<nav class="flex items-center gap-1.5 text-xs text-text-secondary">
  <a class="rounded px-1.5 py-0.5 hover:text-text-primary
            hover:bg-surface-secondary/45 transition-colors">
    Collection
  </a>
  <svg class="w-3 h-3 text-text-secondary/40" /> <!-- Chevron separator -->
  <span class="text-text-primary font-medium truncate max-w-[200px]">
    Current Page
  </span>
</nav>
```

### Tab Pills (Document Tabs)

```css
.topbar-tab-pill {
  transition: border-color 130ms ease, background-color 130ms ease,
              color 130ms ease, transform 130ms ease, box-shadow 130ms ease;
}
.topbar-tab-pill:hover { transform: translateY(-1px); }
.topbar-tab-pill:active { transform: translateY(0); }
.topbar-tab-pill[data-active='true'] {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 16%, transparent);
}
```

Close button on tabs: `opacity: 0.72`, full opacity on tab hover/focus.

### Back-to-Top Button

Appears when scroll > 300px:

```html
<button class="fixed bottom-5 right-6 z-[70] flex h-9 w-9 items-center justify-center
               rounded-full border border-border/70 bg-surface/75 shadow-lg backdrop-blur
               text-text-secondary hover:text-text-primary hover:bg-surface-secondary
               transition-colors">
  <svg class="h-4 w-4" /> <!-- Chevron up -->
</button>
```

Transition: fade + translateY(1) on enter/leave.

### Collapsed Sidebar Toggle

When sidebar is collapsed, a small button appears:

```html
<button class="fixed bottom-3 left-3 z-[60] flex items-center justify-center
               w-8 h-8 rounded-md border border-border/70 bg-surface/82
               text-text-secondary shadow-lg backdrop-blur
               hover:text-text-primary hover:bg-surface-secondary/82 transition-colors">
```

---

## 9. Cards & Panels

### Content Header Card

The primary document header:

```html
<header class="mb-5 rounded-xl border border-border/60 bg-surface/50
               backdrop-blur-xl px-4 py-4
               shadow-[0_14px_30px_-26px_rgba(15,23,42,0.8)]">
```

Contains: section label (H4-style), H1 title, metadata line, tags.

### Right Sidebar Card

Floating tool panels:

```html
<section class="rounded-xl border border-border/60 bg-surface/52
                backdrop-blur-xl p-3.5
                shadow-[0_10px_30px_-24px_rgba(0,0,0,0.85)]">
```

**Card header pattern**:
```html
<p class="inline-flex items-center gap-1.5 text-[11px] font-semibold
          uppercase tracking-[0.08em] text-text-secondary">
  <svg class="h-3 w-3 opacity-80" />
  Section Title
</p>
<span class="rounded-full border border-border/70 bg-surface-secondary/30
             px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
  3
</span>
```

### List Card (Home Page)

```html
<button class="w-full rounded-lg border border-border bg-surface p-3
               text-left hover:bg-surface-secondary/70 transition-colors">
  <p class="text-sm font-medium text-text-primary truncate">Title</p>
  <p class="text-xs text-text-secondary truncate mt-0.5">Subtitle</p>
</button>
```

**Updated variant** (accent-tinted):
```html
<button class="w-full rounded-lg border border-accent/20 bg-accent/5 p-3
               text-left hover:bg-accent/10 transition-colors">
```

### Collection Card (Home Page Grid)

```html
<button class="flex flex-col items-start gap-1.5 p-4 rounded-lg border border-border
               bg-surface hover:bg-surface-secondary/60 hover:border-text-secondary/20
               transition-all text-left group">
  <div class="flex items-center gap-2">
    <span class="text-lg">📚</span>
    <h2 class="text-sm font-semibold text-text-primary">Name</h2>
  </div>
  <p class="text-xs text-text-secondary leading-relaxed">Description</p>
</button>
```

### Nested Item Card (Bookmark, Highlight)

```html
<div class="rounded-lg border border-border/60 bg-surface-secondary/28 p-2.5">
  <!-- Content -->
</div>
```

---

## 10. Badges, Tags & Pills

### Tag (Navigable)

```html
<a class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
          bg-surface-secondary text-text-secondary
          hover:text-accent hover:bg-accent/10 transition-colors">
  tag-name
</a>
```

### Filter Pill (Command Palette)

```html
<!-- Inactive -->
<button class="px-2 py-0.5 rounded-full text-[11px] font-medium
               bg-surface-secondary text-text-secondary
               hover:text-text-primary transition-colors">
  Filter
</button>

<!-- Active -->
<button class="px-2 py-0.5 rounded-full text-[11px] font-medium
               bg-accent text-white">
  Filter
</button>
```

### Count Badge

```html
<span class="rounded-full border border-border/70 bg-surface-secondary/30
             px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
  12
</span>
```

### Updated Badge

```html
<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent">
  Updated
</span>
```

### Status Badge

```html
<!-- Saved -->
<span class="rounded-full border px-1.5 py-0.5 text-[10px] font-medium
             border-emerald-500/35 bg-emerald-500/10 text-emerald-500">
  Saved
</span>

<!-- Saving -->
<span class="rounded-full border px-1.5 py-0.5 text-[10px] font-medium
             border-amber-500/40 bg-amber-500/10 text-amber-500">
  Saving
</span>
```

### Section Label Badge (Content Header)

```html
<p class="text-xs font-medium uppercase tracking-wider text-text-secondary mb-2">
  Section Name
</p>
```

---

## 11. Overlays & Modals

### Command Palette

- **Overlay**: `fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm`
- **Panel**: `mx-auto mt-[18vh] w-full max-w-lg overflow-hidden rounded-xl bg-surface shadow-2xl ring-1 ring-border`
- **Input area**: `flex items-center gap-2.5 px-4 py-3`
- **Dividers**: `border-t border-border`
- **Results area**: `max-h-[320px] overflow-y-auto`

**Transitions**:
- Overlay: opacity 150ms ease-out in, 100ms ease-in out
- Panel: opacity + `scale-[0.98] translate-y-1` → `scale-100 translate-y-0`

### Settings Modal

- **Overlay**: `fixed inset-0 bg-black/30 dark:bg-black/50 z-50`
- **Panel**: `bg-surface rounded-xl border border-border shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto`
- **Header**: `flex items-center justify-between px-5 py-4 border-b border-border`
- **Body**: `px-5 py-4 space-y-5`
- **Footer**: `px-5 py-4 border-t border-border`

**Transitions**:
- Overlay: opacity 200ms ease
- Panel: opacity + `scale(0.95)` → `scale(1)`, 200ms ease

### Slide-Over Panel (AI Ask)

- **Overlay**: `fixed inset-0 bg-black/20 dark:bg-black/40 z-[100]`
- **Panel**: `fixed top-0 right-0 bottom-0 w-[460px] max-w-[90vw] bg-surface border-l border-border shadow-xl z-[110]`
- **Transition**: `transform 250ms ease`, `translateX(100%)` → `translateX(0)`

### Dialog (Add Project)

Follows the same modal pattern with `max-w-md`, centred positioning.

---

## 12. Toast Notifications

Position: `fixed bottom-4 right-4 z-[200]`

```html
<div class="flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg
            text-sm font-medium cursor-pointer select-none"
     :class="{
       'bg-green-600 text-white': type === 'success',
       'bg-red-600 text-white': type === 'error',
       'bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-900': type === 'info'
     }">
  Message text
</div>
```

**Transition**: Enter `duration-200 ease-out` from `opacity-0 translate-y-2 scale-95`. Leave `duration-150 ease-in`.

---

## 13. Loading & Empty States

### Skeleton Loading

```html
<div class="animate-pulse space-y-2.5">
  <div class="ui-skeleton-bar h-5 w-3/4" />
  <div class="ui-skeleton-bar h-5 w-1/2" />
  <div class="ui-skeleton-bar h-5 w-5/6" />
</div>
```

```css
.ui-skeleton-bar {
  border-radius: 0.5rem;
  border: 1px solid color-mix(in srgb, var(--color-border) 74%, transparent);
  background: color-mix(in srgb, var(--color-surface-secondary) 92%, var(--color-surface));
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 4%, transparent);
}
```

Vary widths across bars to create visual rhythm: `w-3/4`, `w-1/2`, `w-5/6`, `w-2/3`, `w-3/5`, `w-4/5`.

### Loading Spinner

```html
<div class="h-3.5 w-3.5 animate-spin rounded-full
            border-[1.5px] border-text-secondary/30 border-t-text-secondary" />
```

### Empty State

```html
<div class="px-4 py-8 text-center">
  <svg class="w-10 h-10 text-text-secondary/40 mx-auto mb-3" />
  <p class="text-sm text-text-secondary">No results found.</p>
</div>
```

For large empty states (full-page): use `w-16 h-16` icon with `text-text-secondary/20`.

### Error State

```html
<div class="px-4 py-8 text-center">
  <p class="text-sm text-red-600 dark:text-red-400 mb-2">Search failed</p>
  <p class="text-xs text-text-secondary">Error details here.</p>
</div>
```

---

## 14. Iconography

### Library

All icons are **inline SVG**, drawn from the Heroicons style (outline variant). No icon font or sprite sheet is used.

### Standard Properties

```html
<svg class="w-{size} h-{size}" fill="none" viewBox="0 0 24 24"
     stroke="currentColor" stroke-width="1.5">
  <path stroke-linecap="round" stroke-linejoin="round" d="..." />
</svg>
```

For filled icons (search in command palette):
```html
<svg fill="currentColor" viewBox="0 0 20 20">
```

### Icon Sizes

| Context | Size | Class |
|---------|------|-------|
| Topbar icons | 14px | `w-3.5 h-3.5` |
| Standard inline | 16px | `w-4 h-4` |
| Section header icons | 12px | `w-3 h-3` with `opacity-80` |
| Medium standalone | 24px | `w-6 h-6` |
| Empty state (small) | 40px | `w-10 h-10` with `text-text-secondary/40` |
| Empty state (large) | 64px | `w-16 h-16` with `text-text-secondary/20` |

### Stroke Weights

| Context | Weight |
|---------|--------|
| Default | `stroke-width="1.5"` |
| Heavier (close, breadcrumb chevron) | `stroke-width="2"` |
| Lighter (section headers) | `stroke-width="1.8"` |

### Icon Colour

Icons inherit colour from their parent via `currentColor`. Colour is controlled by text colour classes on the parent or the SVG element itself:

- Default: `text-text-secondary`
- Hover: `text-text-primary`
- Active: `text-accent`
- Disabled: `text-text-secondary/40`

---

## 15. Motion & Animation

### Timing Guidelines

| Speed | Duration | Easing | Usage |
|-------|----------|--------|-------|
| **Instant** | 80ms | `ease` | Button press transforms |
| **Quick** | 100–130ms | `ease` | Tab hover, link transitions |
| **Standard** | 150ms | `ease` / `ease-out` | Background/colour changes, fade in/out |
| **Smooth** | 200ms | `ease` / `ease-out` | Modal open/close, global bg transition, toast enter |
| **Deliberate** | 250ms | `ease` | Slide-over panel |
| **Ambient** | 20–30s | `ease-in-out` | Background blob drift |

### Transition Presets

```css
/* Standard interactive element */
transition: background-color 150ms ease, color 150ms ease;

/* Button with transform */
transition: background-color 150ms ease, color 150ms ease, transform 100ms ease;

/* Chip/pill with all properties */
transition: border-color 140ms ease, background-color 140ms ease,
            color 140ms ease, box-shadow 140ms ease;

/* Form control */
transition: border-color 150ms ease, background-color 150ms ease,
            box-shadow 150ms ease;

/* Global background (for theme switching) */
transition: background-color 200ms;
```

### Page Transitions

```css
/* Fade between pages */
.page-enter-active, .page-leave-active { transition: opacity 150ms ease; }
.page-enter-from, .page-leave-to { opacity: 0; }

/* Content mount animation */
@keyframes content-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.prose[data-enter] { animation: content-fade-in 200ms ease-out; }
```

### Sidebar Transitions

```css
/* Width change (collapse/expand) */
.sidebar-transition { transition: width 200ms ease-out; }

/* Section expand/collapse */
.section-enter-active, .section-leave-active {
  transition: opacity 150ms ease;
  overflow: hidden;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable all animations */
  .ambient-blob { animation: none !important; }
  .prose[data-enter] { animation: none !important; }

  /* Minimise transition durations */
  .page-enter-active, .page-leave-active,
  .section-enter-active, .section-leave-active,
  .sidebar-transition,
  nav a, nav button,
  [style*="no-drag"] button,
  .prose a, .prose .heading-anchor,
  .prose pre .code-copy-btn,
  .sidebar-resize-handle {
    transition-duration: 0.01s !important;
  }
}
```

---

## 16. Dark Mode

### Implementation

- **Mechanism**: Class-based via `.dark` on `<html>` element
- **Modes**: `'light'` | `'dark'` | `'system'`
- **Storage**: `localStorage` key (app-specific, e.g. `dalil-theme-mode`)
- **Flash prevention**: Inline `<script>` in `<body>` before app mount:

```html
<script>
  ;(function () {
    var mode = localStorage.getItem('app-theme-mode') || 'system'
    var dark = mode === 'dark' || (mode === 'system' &&
               window.matchMedia('(prefers-color-scheme: dark)').matches)
    if (dark) document.documentElement.classList.add('dark')
  })()
</script>
```

### Token Override Pattern

```css
.dark {
  --color-surface: #171717;
  --color-surface-secondary: #262626;
  --color-sidebar: #1A1A1A;
  --color-text-primary: #EDEDED;
  --color-text-secondary: #999999;
  --color-border: #303030;
  --color-accent: #60A5FA;
  --color-code-surface: #1E1F24;
  --color-code-border: #31343D;
  --scrollbar-thumb: rgba(96, 165, 250, 0.45);
  /* etc. */
}
```

### Dark Mode Adjustments

- **Accent shifts**: `#2563EB` → `#60A5FA` (lighter blue for dark backgrounds)
- **Overlay opacity increases**: `bg-black/30` → `bg-black/50` for modals
- **Toast info inverts**: `bg-stone-800 text-stone-100` → `bg-stone-200 text-stone-900`
- **Error text lightens**: `text-red-600` → `text-red-400`
- **Search highlights darken**: `#FEF08A` → `#854D0E`
- **Ambient blob opacity decreases**: `0.18` → `0.10`
- **Code syntax**: Shiki dual-theme via `var(--shiki-light)` / `var(--shiki-dark)`

---

## 17. Scrollbars

Custom scrollbars use accent-tinted colours with gradient effects:

```css
:root {
  --scrollbar-thumb: rgba(37, 99, 235, 0.38);
  --scrollbar-thumb-hover: rgba(37, 99, 235, 0.58);
  --scrollbar-thumb-active: rgba(37, 99, 235, 0.75);
  --scrollbar-track: rgba(115, 115, 115, 0.16);
}

* {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track {
  background: linear-gradient(180deg, transparent, var(--scrollbar-track));
  border-radius: 999px;
}
::-webkit-scrollbar-thumb {
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
  background-image: linear-gradient(180deg, var(--scrollbar-thumb), rgba(99, 102, 241, 0.35));
  min-height: 34px;
}
```

---

## 18. Focus & Accessibility

### Focus Visible Ring

```css
:where(a[href], button, [role='button'], input, select, textarea):focus-visible {
  outline: 2px solid color-mix(in srgb, var(--color-accent) 55%, transparent);
  outline-offset: 2px;
}
```

### Skip to Content Link

```html
<a href="#main-content"
   class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200]
          focus:bg-white focus:dark:bg-stone-800 focus:px-4 focus:py-2 focus:rounded
          focus:shadow-lg focus:text-stone-900 focus:dark:text-stone-100">
  Skip to content
</a>
```

### Text Selection

UI chrome is non-selectable. Content areas opt back in:

```css
/* Disable on UI */
*:not(input):not(textarea):not([contenteditable='true']) {
  user-select: none;
}

/* Re-enable in content */
.prose, .prose *, [data-selectable], [data-selectable] * {
  user-select: text !important;
}
```

### Cursor Affordances

| Element | Cursor |
|---------|--------|
| Links, buttons, `[role='button']`, `<summary>` | `pointer` |
| Disabled elements | `not-allowed` |
| Sidebar resize handle | `col-resize` |
| Lightbox images | `zoom-in` |
| Text areas, inputs | `text` (browser default) |

### ARIA Patterns

- Toasts: `role="status" aria-live="polite"`
- Search results: `aria-live="polite"` with screen-reader count announcements
- Modals: Focus trap via composable, Escape to close
- Decorative elements: `aria-hidden="true"` (ambient blobs)
- Sidebar: `<aside>` with `aria-label`
- Navigation: `<nav>` elements

---

## 19. macOS Native Integration

### Titlebar

- The topbar acts as a native drag region via `-webkit-app-region: drag`
- Interactive elements within it override with `-webkit-app-region: no-drag`
- Traffic light controls are positioned by macOS; the topbar accounts for them with `pl-[78px]`

### Transparency

- Tauri config: `macOSPrivateApi: true` enables titlebar transparency
- The topbar uses `bg-surface/72 backdrop-blur-xl` for the vibrancy effect
- The sidebar uses `bg-sidebar/72 backdrop-blur-xl`
- This creates a native feel where content is visible through chrome

### Window Behaviour

- `contain: content` on the main content area for paint containment
- Visibility change listener pauses ambient animations when window is hidden

---

## 20. Ambient Background

Three large, softly blurred circles drift slowly behind the content, creating subtle visual warmth:

```css
.ambient-blobs {
  position: fixed; inset: 0; z-index: 1;
  overflow: hidden; pointer-events: none;
}

.ambient-blob {
  position: absolute; border-radius: 50%;
  filter: blur(80px);
  opacity: 0.18;          /* Light mode */
  will-change: transform;
  contain: strict;
}
.dark .ambient-blob { opacity: 0.10; }
```

### Blob Configuration

| Blob | Size | Colour | Position | Animation |
|------|------|--------|----------|-----------|
| 1 | 600×600px | `var(--color-accent)` (blue) | Top-right | 25s drift, ±40px, ±5% scale |
| 2 | 500×500px | `#8B5CF6` (violet) | Bottom-left | 30s drift, ±30px, ±8% scale |
| 3 | 400×400px | `#06B6D4` (cyan) | Centre-left | 20s drift, ±30px, ±10% scale |

All blobs pause when the window is hidden (`.page-hidden`).

---

## 21. Prose / Long-Form Content

The `.prose` class (via `@tailwindcss/typography` plugin) styles long-form document content.

### Key Overrides

| Element | Styling |
|---------|---------|
| **Headings** | `font-semibold tracking-tight text-text-primary` |
| **H2** | Bottom border: `pb-2 border-b border-border` |
| **H4** | Uppercase, `tracking-wide`, `text-text-secondary` |
| **Links** | `text-accent no-underline`, underline on hover |
| **Strong** | `text-text-primary font-semibold` |
| **Blockquotes** | `border-accent/30 text-text-secondary`, not italic |
| **Lists** | `padding-left: 1.25rem`, tight item spacing (`0.25em`) |
| **Tables** | `font-size: 14px`, header uppercase with wider tracking |
| **Inline code** | Mono font, `0.85em`, surface-secondary background, border, `0.25rem` radius |
| **Code blocks** | Mono font, `13px`, `1.65` line height, code-surface background, code-border, `0.5rem` radius |

### Heading Anchor Links

Section headings (H2, H3) have hoverable anchor buttons:

```css
.prose .heading-anchor {
  opacity: 0;
  margin-left: 0.35em;
  transition: opacity 150ms ease;
}
.prose h2:hover .heading-anchor { opacity: 0.6; }
.prose .heading-anchor:hover { opacity: 1; color: var(--color-accent); }
```

After copying, a "Copied" label appears with a green fade-in-out animation (1.5s).

### Code Block Copy Button

```css
.prose pre .code-copy-btn {
  position: absolute; top: 0.5rem; right: 0.5rem;
  width: 28px; height: 28px;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  background-color: var(--color-surface);
  opacity: 0;
  transition: opacity 150ms ease;
}
.prose pre:hover .code-copy-btn { opacity: 1; }
```

### Image Lightbox

Images wider than 100px get a `cursor: zoom-in` and open in a lightbox on click.

---

## 22. Responsive Patterns

This design system targets desktop-first (Tauri apps, web dashboards). Responsive adaptations are minimal:

| Pattern | Implementation |
|---------|---------------|
| Right sidebar | `hidden lg:block` — hidden on screens smaller than `lg` (1024px) |
| H1 responsive | `text-[1.95rem] sm:text-[2.15rem]` |
| Content width | Max-width constraints adapt per page type |
| Grid layout | Collection cards: single column → 2 columns via `grid-cols-2` |
| Command palette | `max-w-lg` with `mx-auto`, responsive within viewport |
| Slide-over panel | `w-[460px] max-w-[90vw]` — caps at 90% viewport width |
| Keyboard shortcuts | `hidden sm:inline-flex` — only shown on wider screens |

---

## 23. Z-Index Scale

| Layer | Z-Index | Elements |
|-------|---------|----------|
| Ambient blobs | `1` | Background decoration |
| Sidebar | `10` | Navigation sidebar |
| Resize handle | `30` | Sidebar drag handle |
| Topbar | `50` | Fixed toolbar/titlebar |
| Settings modal | `50` | Modal overlay + panel |
| Collapsed sidebar button | `60` | Floating toggle |
| Back-to-top button | `70` | Floating action |
| Command palette | `100` | Search overlay + panel |
| AI panel overlay | `100` | Slide-over backdrop |
| AI panel | `110` | Slide-over panel |
| Toasts | `200` | Notification stack |
| Skip to content | `200` | Accessibility shortcut |

---

## 24. CSS Token Reference

### Complete Token List

```css
@theme {
  /* Typography */
  --font-sans: 'Poppins', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', ui-monospace, monospace;

  /* Surfaces */
  --color-surface: #FFFFFF;
  --color-surface-secondary: #F5F5F3;
  --color-sidebar: #F9F9F7;

  /* Text */
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #737373;

  /* Chrome */
  --color-border: #E5E5E2;
  --color-accent: #2563EB;

  /* Code */
  --color-code-surface: #F7F8FB;
  --color-code-border: #DCE1EA;
}

/* Scrollbar tokens (on :root) */
:root {
  --scrollbar-thumb: rgba(37, 99, 235, 0.38);
  --scrollbar-thumb-hover: rgba(37, 99, 235, 0.58);
  --scrollbar-thumb-active: rgba(37, 99, 235, 0.75);
  --scrollbar-track: rgba(115, 115, 115, 0.16);
}
```

### Dark Mode Overrides

```css
.dark {
  --color-surface: #171717;
  --color-surface-secondary: #262626;
  --color-sidebar: #1A1A1A;
  --color-text-primary: #EDEDED;
  --color-text-secondary: #999999;
  --color-border: #303030;
  --color-accent: #60A5FA;
  --color-code-surface: #1E1F24;
  --color-code-border: #31343D;
  --scrollbar-thumb: rgba(96, 165, 250, 0.45);
  --scrollbar-thumb-hover: rgba(96, 165, 250, 0.66);
  --scrollbar-thumb-active: rgba(96, 165, 250, 0.8);
  --scrollbar-track: rgba(115, 115, 115, 0.2);
}
```

---

## 25. Implementation Notes

### Technology Stack

This styleguide is framework-agnostic, but the reference implementation uses:

- **CSS framework**: Tailwind CSS v4 with `@theme` directive and `@tailwindcss/typography` plugin
- **Dark mode**: Tailwind class-based dark mode via `.dark` on `<html>`
- **Component framework**: Vue 3 (reference), but all patterns are pure CSS + HTML
- **Build tool**: Vite with `@tailwindcss/vite` plugin

### Adopting in a New App

1. **Install Tailwind CSS v4** with the typography plugin
2. **Copy the `@theme` block** and dark mode overrides into your global CSS
3. **Add Poppins** via Google Fonts `<link>` tag in your HTML `<head>`
4. **Copy the shared CSS classes**: `.ui-select`, `.ui-skeleton-bar`, `.topbar-chip-btn`, `.topbar-tab-pill`, `.topbar-menu-item`, and the focus/cursor/selection rules
5. **Copy the scrollbar styles** for consistent branded scrollbars
6. **Copy the ambient blob CSS** if your app benefits from the warm background treatment
7. **Add the dark mode flash prevention script** in your HTML `<body>`
8. **Use the patterns in this guide** for every component you build

### Naming Conventions

- CSS tokens: `--color-{category}` or `--color-{category}-{variant}`
- Utility classes: `.ui-{component}` for shared non-Tailwind components
- Interaction classes: `.topbar-{variant}` for topbar-specific primitives
- Animation classes: `.{context}-enter-active`, `.{context}-leave-active`
- State attributes: `data-open`, `data-active`, `data-enter`

### Quality Checklist

For every new component or screen, verify:

- [ ] Uses only the defined colour tokens (no arbitrary hex values outside the palette)
- [ ] Correct border opacity for context (not full `border-border` everywhere)
- [ ] Hover and focus states defined
- [ ] Transitions on interactive elements (never instant)
- [ ] `prefers-reduced-motion` respected for any animations
- [ ] Dark mode tested (both explicit and system preference)
- [ ] Text selection disabled on chrome, enabled in content
- [ ] Focus-visible ring present on all interactive elements
- [ ] Appropriate z-index from the defined scale
- [ ] Poppins font loading confirmed

---

## Supporting Files

See the `styleguide/` directory for:

- `tokens.css` — Copy-pasteable CSS token definitions
- `COLOUR_SWATCHES.md` — Visual reference for the colour palette
