# Colour Swatches

Visual reference for the complete colour palette. Each swatch shows the hex value, its CSS token name, and typical usage.

---

## Light Mode

### Surfaces

| Swatch | Token | Hex | Usage |
|--------|-------|-----|-------|
| ![#FFFFFF](https://placehold.co/40x24/FFFFFF/FFFFFF) | `--color-surface` | `#FFFFFF` | Primary background, cards, inputs |
| ![#F5F5F3](https://placehold.co/40x24/F5F5F3/F5F5F3) | `--color-surface-secondary` | `#F5F5F3` | Secondary surfaces, hover states, inline code bg |
| ![#F9F9F7](https://placehold.co/40x24/F9F9F7/F9F9F7) | `--color-sidebar` | `#F9F9F7` | Sidebar background |
| ![#F7F8FB](https://placehold.co/40x24/F7F8FB/F7F8FB) | `--color-code-surface` | `#F7F8FB` | Code block background |

### Text

| Swatch | Token | Hex | Usage |
|--------|-------|-----|-------|
| ![#1A1A1A](https://placehold.co/40x24/1A1A1A/1A1A1A) | `--color-text-primary` | `#1A1A1A` | Headings, body copy, primary labels |
| ![#737373](https://placehold.co/40x24/737373/737373) | `--color-text-secondary` | `#737373` | Hints, placeholders, meta text |

### Chrome

| Swatch | Token | Hex | Usage |
|--------|-------|-----|-------|
| ![#E5E5E2](https://placehold.co/40x24/E5E5E2/E5E5E2) | `--color-border` | `#E5E5E2` | Borders, dividers, separators |
| ![#DCE1EA](https://placehold.co/40x24/DCE1EA/DCE1EA) | `--color-code-border` | `#DCE1EA` | Code block border |

### Accent

| Swatch | Token | Hex | Usage |
|--------|-------|-----|-------|
| ![#2563EB](https://placehold.co/40x24/2563EB/2563EB) | `--color-accent` | `#2563EB` | Links, active states, buttons, highlights |

---

## Dark Mode

### Surfaces

| Swatch | Token | Hex | Usage |
|--------|-------|-----|-------|
| ![#171717](https://placehold.co/40x24/171717/171717) | `--color-surface` | `#171717` | Primary background |
| ![#262626](https://placehold.co/40x24/262626/262626) | `--color-surface-secondary` | `#262626` | Secondary surfaces |
| ![#1A1A1A](https://placehold.co/40x24/1A1A1A/1A1A1A) | `--color-sidebar` | `#1A1A1A` | Sidebar background |
| ![#1E1F24](https://placehold.co/40x24/1E1F24/1E1F24) | `--color-code-surface` | `#1E1F24` | Code block background |

### Text

| Swatch | Token | Hex | Usage |
|--------|-------|-----|-------|
| ![#EDEDED](https://placehold.co/40x24/EDEDED/EDEDED) | `--color-text-primary` | `#EDEDED` | Primary text |
| ![#999999](https://placehold.co/40x24/999999/999999) | `--color-text-secondary` | `#999999` | Muted text |

### Chrome

| Swatch | Token | Hex | Usage |
|--------|-------|-----|-------|
| ![#303030](https://placehold.co/40x24/303030/303030) | `--color-border` | `#303030` | Borders |
| ![#31343D](https://placehold.co/40x24/31343D/31343D) | `--color-code-border` | `#31343D` | Code block border |

### Accent

| Swatch | Token | Hex | Usage |
|--------|-------|-----|-------|
| ![#60A5FA](https://placehold.co/40x24/60A5FA/60A5FA) | `--color-accent` | `#60A5FA` | Links, active states (lighter for dark bg contrast) |

---

## Ambient Blob Colours

Used for the drifting background blobs. These are NOT tokens — they are fixed values.

| Swatch | Hex | Blob | Size |
|--------|-----|------|------|
| ![#2563EB](https://placehold.co/40x24/2563EB/2563EB) | `#2563EB` / `#60A5FA` | Blob 1 (accent) | 600px, top-right |
| ![#8B5CF6](https://placehold.co/40x24/8B5CF6/8B5CF6) | `#8B5CF6` | Blob 2 (violet) | 500px, bottom-left |
| ![#06B6D4](https://placehold.co/40x24/06B6D4/06B6D4) | `#06B6D4` | Blob 3 (cyan) | 400px, centre |

---

## Status Colours

These use Tailwind's built-in palette, not custom tokens.

| Swatch | Colour | Light | Dark | Usage |
|--------|--------|-------|------|-------|
| ![#16A34A](https://placehold.co/40x24/16A34A/16A34A) | Green 600 | `bg-green-600` | Same | Success toast |
| ![#DC2626](https://placehold.co/40x24/DC2626/DC2626) | Red 600 | `bg-red-600` | Same | Error toast |
| ![#292524](https://placehold.co/40x24/292524/292524) | Stone 800 | `bg-stone-800` | `bg-stone-200` | Info toast |
| ![#10B981](https://placehold.co/40x24/10B981/10B981) | Emerald 500 | `text-emerald-500` | Same | Saved indicator |
| ![#F59E0B](https://placehold.co/40x24/F59E0B/F59E0B) | Amber 500 | `text-amber-500` | Same | Saving indicator |
| ![#FEF08A](https://placehold.co/40x24/FEF08A/FEF08A) | Yellow 200 | `bg-[#FEF08A]` | `bg-[#854D0E]` | Search highlight |
| ![#854D0E](https://placehold.co/40x24/854D0E/854D0E) | Amber 800 | — | `bg-[#854D0E]` | Search highlight (dark) |

---

## Accent Opacity Scale

The single accent colour at different opacities creates depth without introducing new colours.

| Opacity | Light Mode Result | Usage |
|---------|-------------------|-------|
| `accent/5` | ![](https://placehold.co/60x20/F0F4FE/F0F4FE) Very faint | Subtle hover bg |
| `accent/8` | ![](https://placehold.co/60x20/ECF0FD/ECF0FD) Faint | Active nav item bg |
| `accent/10` | ![](https://placehold.co/60x20/E8ECFC/E8ECFC) Light | Active button bg, selected state |
| `accent/15` | ![](https://placehold.co/60x20/DDE4FA/DDE4FA) Visible | Updated badge bg |
| `accent/20` | ![](https://placehold.co/60x20/D3DCF9/D3DCF9) Clear | Accent border |
| `accent/30` | ![](https://placehold.co/60x20/BFCCF6/BFCCF6) Medium | Active element border |
| `accent/40` | ![](https://placehold.co/60x20/ACBDF4/ACBDF4) Strong | Prominent border |
| `accent` (100%) | ![](https://placehold.co/60x20/2563EB/2563EB) Full | CTA buttons, filter pills |

---

## Scrollbar Colours

| State | Light | Dark |
|-------|-------|------|
| Thumb (idle) | `rgba(37, 99, 235, 0.38)` | `rgba(96, 165, 250, 0.45)` |
| Thumb (hover) | `rgba(37, 99, 235, 0.58)` | `rgba(96, 165, 250, 0.66)` |
| Thumb (active) | `rgba(37, 99, 235, 0.75)` | `rgba(96, 165, 250, 0.8)` |
| Track | `rgba(115, 115, 115, 0.16)` | `rgba(115, 115, 115, 0.2)` |
| Gradient bottom | `rgba(99, 102, 241, 0.35)` | Same |
