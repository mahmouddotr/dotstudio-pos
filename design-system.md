# DotStudio® POS — Design System 2026

> **Liquid Glass · Black & White · Lemon Green**
> The single source of truth for every surface in the product: admin console, owner
> dashboard, cashier POS, customer storefront, delivery console and public chat.
> Everything below is implemented as a token or a shared component — never as a
> one-off value inside a page.

---

## 1. Principles

| Principle | What it means in practice |
| --- | --- |
| **Clarity first** | One primary action per screen. Numbers are large, labels are quiet. |
| **Black canvas, light content** | True-black backgrounds; content floats on frosted glass. |
| **Continuous geometry** | Apple-style continuous corners, generous whitespace, no hard edges. |
| **Quiet motion** | Spring easing, 160–480 ms. Motion explains state, never decorates. |
| **Tenant-safe by default** | A tenant only ever sees its own products, orders and people. |
| **Bilingual symmetry** | Every layout must survive AR (RTL) and EN (LTR) without rework. |

---

## 2. Color tokens

All colours are CSS custom properties declared in
`shared/css/design-system.css`. Legacy names (`--bg`, `--surface`, `--lime`, …) are
aliases kept for backwards compatibility — **prefer the semantic Apple names** in new
code.

### 2.1 Canvas & surfaces

| Token | Value | Use |
| --- | --- | --- |
| `--bg-body` / `--bg` | `#000000` | Page canvas |
| `--bg-surface` | `#1C1C1E` | Solid elevated blocks |
| `--bg-elevated` | `rgba(28,28,30,.72)` | Glass panels over canvas |
| `--surface` | `var(--bg-glass)` | Cards, popovers, sidebar |
| `--surface-2` | `rgba(255,255,255,.08)` | Nested rows, chips |
| `--surface-3` | `rgba(255,255,255,.12)` | Hover / pressed layers |
| `--material-thin` | `rgba(255,255,255,.03)` | Subtle separators |
| `--material-regular` | `rgba(255,255,255,.06)` | Default glass fill |
| `--material-thick` | `rgba(255,255,255,.10)` | Strong glass fill |

### 2.2 Text

| Token | Value | Use |
| --- | --- | --- |
| `--text-primary` | `#F5F5F7` | Headlines, prices, key values |
| `--text-secondary` | `#86868B` | Labels, hints, metadata |
| `--text-tertiary` | `#48484A` | Timestamps, disabled-ish copy |
| `--text-disabled` | `#3A3A3C` | Truly disabled |
| `--text-inverse` | `#050505` | Text on lime / white |

### 2.3 Brand & accents

| Token | Value | Meaning |
| --- | --- | --- |
| `--accent` | `#CCFF00` | Brand lemon (marketing, logo plate) |
| `--lime` / `--accent-lime` | `#82FF1F` | Primary interactive accent |
| `--lime-strong` | `#94FF45` | Hover state |
| `--lime-deep` | `#63D400` | Pressed state |
| `--lime-soft` | `rgba(130,255,31,.10)` | Accent wash |
| `--accent-blue` | `#007AFF` | Links, focus rings |
| `--accent-green` / `--success` | `#30D158` | Paid, delivered, healthy stock |
| `--accent-yellow` / `--warning` | `#FFD60A` | Low stock, pending review |
| `--accent-red` / `--danger` | `#FF453A` | Cancelled, destructive, errors |
| `--accent-orange` | `#FF9F0A` | In-progress, delivery en route |
| `--accent-purple` / `--purple` | `#BF5AF2` | VIP / Diamond customers |
| `--accent-teal` / `--info` | `#64D2FF` | Informational badges |
| `--accent-indigo` | `#5E5CE6` | Secondary highlights |

Each accent has a matching `*-soft` wash (`--success-soft`, `--danger-soft`, …) used
for badge backgrounds and alert panels.

### 2.4 Borders

| Token | Value |
| --- | --- |
| `--border-soft` | `rgba(255,255,255,.06)` |
| `--border` | `rgba(255,255,255,.10)` |
| `--border-strong` | `rgba(255,255,255,.18)` |
| `--border-lime` | `rgba(130,255,31,.34)` |

### 2.5 Light appearance

`html[data-theme="light"]` re-maps the same semantics:

| Token | Light value |
| --- | --- |
| `--bg-primary` | `#F5F5F7` |
| `--surface` | `rgba(255,255,255,.72)` |
| `--text-primary` | `#1D1D1F` |
| `--text-secondary` | `#6E6E73` |

**Rule:** never hard-code a hex value in page CSS. If a colour is missing, add a token.

---

## 3. Typography

### 3.1 Families

| Token | Stack |
| --- | --- |
| `--font-display` | `'SF Pro Display', 'SF Pro Arabic', -apple-system, sans-serif` |
| `--font-body` | `'SF Pro Arabic', 'SF Pro Display', -apple-system, sans-serif` |
| `--font-mono` | `'SFMono-Regular', ui-monospace, Menlo, monospace` |

Receipts and print use `'Cairo', 'Inter', sans-serif` (see §9).

### 3.2 Scale

| Token | Size | Typical use |
| --- | --- | --- |
| `--fs-2xs` | 10 px | Table meta, receipt micro-copy |
| `--fs-xs` | 11 px | Captions, order numbers |
| `--fs-sm` | 13 px | Secondary body, table cells |
| `--fs-md` | 14 px | Default UI text |
| `--fs-base` | 15 px | Long-form body |
| `--fs-lg` | 17 px | Card titles |
| `--fs-xl` | 20 px | Section headings |
| `--fs-2xl` | 24 px | Page subtitles |
| `--fs-3xl` | 32 px | Page titles |
| `--fs-4xl` | 40 px | KPI numbers |
| `--fs-5xl` | 52 px | Hero display |

### 3.3 Weights, line-height, tracking

- Weights: `--fw-regular 400`, `--fw-medium 500`, `--fw-semibold 600`, `--fw-bold 700`.
- Line-height: `--lh-tight 1.1` (display), `--lh-snug 1.35` (titles), `--lh-normal 1.6` (body).
- Display tracking: `--tracking-tight -0.022em`.

**Minimum sizes:** never below 11 px in interactive UI; receipts may use 8–9 px.

---

## 4. Spacing, radius, elevation, motion

### 4.1 Spacing scale (4 px base)

`--space-0 0` · `1 4` · `2 8` · `3 12` · `4 16` · `5 20` · `6 24` · `7 28` · `8 32` ·
`9 40` · `10 48` · `12 64` · `16 80` *(px)*

### 4.2 Radius (continuous curve)

| Token | Value | Use |
| --- | --- | --- |
| `--radius-xs` | 6 px | Chips, tags |
| `--radius-sm` | 10 px | Inputs, small buttons |
| `--radius-md` | 18 px | Cards, modals |
| `--radius-lg` | 28 px | Large panels, hero cards |
| `--radius-xl` | 44 px | Feature blocks |
| `--radius-2xl` | 36 px | Media plates |
| `--radius-full` | 999 px | Pills, avatars, FABs |

### 4.3 Elevation

| Token | Value |
| --- | --- |
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,.36)` |
| `--shadow-sm` | `0 6px 18px rgba(0,0,0,.34)` |
| `--shadow-md` | `0 16px 40px rgba(0,0,0,.42)` |
| `--shadow-lg` | `0 28px 80px rgba(0,0,0,.55)` |
| `--shadow-xl` | `0 48px 120px rgba(0,0,0,.65)` |
| `--shadow-lime` | `0 12px 40px rgba(130,255,31,.28)` |
| `--shadow-blue` | `0 12px 40px rgba(0,122,255,.32)` |
| `--ring` | `0 0 0 3px rgba(0,122,255,.28)` |
| `--ring-lime` | `0 0 0 3px rgba(130,255,31,.24)` |

### 4.4 Blur & motion

- Glass blur: `--blur-glass 50px` (chrome), `--blur-soft 24px` (cards).
- Easing: `--ease cubic-bezier(.25,.1,.25,1)`, `--ease-out cubic-bezier(.16,1,.3,1)`.
- Durations: `--transition-fast 160ms`, `--transition-base 280ms`,
  `--transition-slow 480ms`, `--transition-apple 400ms`.

**Rule:** `.delivery-card` must remain static — no keyframes, no transitions.

---

## 5. Layout

| Token | Value |
| --- | --- |
| `--sidebar-w` | 280 px |
| `--sidebar-w-collapsed` | 84 px |
| `--topbar-h` | 72 px |
| `--content-max` | 1440 px |
| `--z-dropdown` | 60 |
| `--z-sticky` | 40 |
| `--z-drawer` | 80 |
| `--z-modal` | 100 |
| `--z-toast` | 120 |
| `--z-command` | 130 |

Screen shells use `.app-shell` → `.sidebar` + `.main` → `.topbar` + `.content`.
Every authenticated page calls:

```js
DS.shell.mount({ roles, active, title, eyebrow, sub, actions, content });
```

### 5.1 Key page grids

- **POS** — 70 / 30 split (`.pos-layout`): product grid + search on the inline-start
  side, cart + checkout on the inline-end side. Collapses to a single column under
  1024 px.
- **Storefront** — 12-column product grid, 2 columns on mobile.
- **Checkout** — 2 columns: form (fluid) + sticky summary (~360 px).
- **Dashboard** — KPI row of 4, then 2-column chart/table split.

RTL/LTR is handled by logical properties (`inset-inline`, `margin-inline`,
`text-align: start`). Never use `left`/`right` for layout.

---

## 6. Components

Shared classes live in `shared/css/components.css` and `shared/css/app.css`.
Markup helpers live in `shared/js/core.js` (`DS.icon`, `DS.badge`, `DS.modal`,
`DS.toast`, `DS.avatar`, …).

### 6.1 Buttons — `.btn`

| Variant | Class | Use |
| --- | --- | --- |
| Primary | `.btn.btn-primary` | One per view — the main action |
| Secondary | `.btn.btn-secondary` | Supporting actions |
| Ghost | `.btn.btn-ghost` | Toolbars, icon-only |
| Danger | `.btn.btn-danger` | Destructive |
| Sizes | `.btn-sm`, default, `.btn-lg` | 32 / 40 / 48 px height |

Requirements: 40 px minimum touch target, `--radius-full` for pills,
`icon + label` left-to-right in EN and mirrored in AR.

### 6.2 Cards — `.card`

`background: var(--surface)` · `border: 1px solid var(--border)` ·
`border-radius: var(--radius-md)` · `backdrop-filter: blur(var(--blur-soft))`.
Structure: `.card-head` (title + actions) → `.card-body` → optional `.card-foot`.

### 6.3 Inputs — `.input`, `.select`, `.textarea`

Height 44 px, `--radius-sm`, `--surface-2` fill, `--border` outline, focus ring
`--ring`. Labels sit above; help text uses `--fs-xs` and `--text-secondary`.

**Floating-label fields** (checkout): `.co-field` + `.co-input` + `<label>` with
`placeholder=" "`; label animates into the border on focus/fill.

### 6.4 Badges — `.badge`

Pill, `--fs-2xs`, 600 weight, uppercase-ish tracking. Status colours map 1:1 to tokens:
`pending → warning`, `preparing → info`, `out_for_delivery → orange`,
`delivered → success`, `cancelled → danger`.

### 6.5 Tables — `.table`

Sticky header, `--fs-sm` cells, row hover `--surface-2`, numeric columns `.num`
(`font-variant-numeric: tabular-nums`, inline-end aligned).

### 6.6 Modals — `DS.modal({ title, body, actions })`

Scrim `rgba(0,0,0,.62)` + `backdrop-filter: blur(10px)`. Panel `--radius-lg`,
`--shadow-xl`, max-width 560 px (720 px wide variant). Focus traps inside; `Esc`
closes; return `false` from an action to keep it open.

### 6.7 Toasts — `DS.toast(message, type)`

Types: `success` · `error` · `warning` · `info`. Bottom inline-start, stacked,
auto-dismiss 3.6 s. **`alert()` is forbidden** — use `DS.toast`.

### 6.8 Avatars — `.avatar` / `DS.avatarUrl(user)`

Circle, `--radius-full`, 28 / 36 / 48 / 64 px. Initials fallback on
`--surface-3` with `--text-primary`.

### 6.9 Sidebar — `.sidebar-item`

44 px row, `--radius-sm`, icon 18 px + label. Active state: `--lime-soft` fill,
`--text-primary` label, 2 px lime indicator on the inline-start edge. Collapsed mode
shows icons only with tooltips.

### 6.10 Skeletons — `.skeleton`

`--surface-2` base with a 1.4 s shimmer. Always mirror the real block's dimensions so
there is no layout shift.

### 6.11 Logo

`assets/img/LOGO-WHAIT.png` is always rendered at
`height: 40px !important; width: auto !important;` — never scaled by page CSS.

---

## 7. Pro Max modules (2026 layer)

Implemented in `shared/css/pro-max.css` + page modules. Loaded last so it can refine
base components without forking them.

### 7.1 Smart inventory forecasting
Owner dashboard card listing products whose stock covers **≤ 3 days** at the last
14-day sales velocity.
Copy: `تحذير: منتج [X] سينفد خلال 3 أيام. اطلب 50 قطعة`
Source: `DS.data.inventoryForecast(tenantId)`.

### 7.2 Customer lifetime value + Diamond tier
`DS.data.customerLifetime(tenantId)` returns spend, average basket and the top 10 %
cut-off. VIP customers get `.pm-vip-badge` (`عميل ماسي`) in the customers table and
the detail modal, plus a summary card in the owner dashboard.

### 7.3 Multi-branch stock transfer
Per-branch ledger in `localStorage` (`ds_branch_stock_<tenant>`) plus a transfer log
(`ds_branch_transfers_<tenant>`). The simulator moves units between branches without
mutating global product stock, and renders a `.pm-dist-chip` distribution row.

### 7.4 One-click checkout
The delivery identity (name, phone, address, city, coordinates) is stored in
`localStorage` as `ds_quick_customer` on order placement. On return, a
`.co-quickpay` card labelled **`الدفع السريع`** refills the form in one tap.

### 7.5 Browser notifications
`DS.notify` (in `shell.js`) wraps the Notification API. Customers opt in via the
`.pm-notify-fab`; status changes arrive from the `ds:order-status` event, `ds:data`
and cross-tab `storage`, producing native notifications.

### 7.6 Checkout layout
`.co-fields` grid with floating labels, saved-address cards, and a full-width
`.co-place-btn` that repeats the total next to the confirm label.

### 7.7 POS layout
`.pos-layout` 70/30. Search → scan → add on one side; the cart and a single
`.pos-checkout-stack` on the other. Customer, discount and notes live in a collapsed
`<details class="pos-checkout-more">` labelled **`خيارات إضافية`** so the sale screen
stays free of pre-sale data entry.

---

## 8. Iconography

`DS.icon(name, size)` renders 24×24 stroke icons (`stroke-width: 1.75`,
`stroke: currentColor`, rounded caps). Names are kebab/camel keys in the `ICONS` map
(e.g. `search`, `cart`, `chevronDown`, `zap`, `wallet`, `truck`, `shield`, `store`).

**Rules:** icons inherit text colour, never carry their own fill, and are always paired
with a text label in primary actions.

---

## 9. Thermal printing spec

Receipts target **80 mm** roll paper.

```css
@media print {
  @page { size: 80mm auto; margin: 0 !important; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body { font-family: 'Cairo', 'Inter', sans-serif !important; }
  body * { visibility: hidden !important; }
  .invoice-print-area, .invoice-print-area *,
  .invoice-container, .invoice-container * { visibility: visible !important; }
  .invoice-container {
    width: 80mm !important; max-width: 80mm !important;
    margin: 0 !important; padding: 0 !important;
    border-radius: 0 !important; box-shadow: none !important;
    background: #fff !important; color: #000 !important;
  }
  .invoice-print-area {
    position: absolute !important; left: 0 !important; top: 0 !important;
    width: 80mm !important; margin: 0 !important; padding: 0 !important;
    box-sizing: border-box !important;
    font-family: 'Cairo', 'Inter', sans-serif !important;
  }
}
```

The rule set ships in two places and both must stay in sync:
`DS.thermalCss` (`shared/js/ui.js`) for in-page printing and
`THERMAL_CSS` (`shared/js/ui.js`, popup path) for `DS.printReceipt`.

Receipt typography: 8–11 px, tabular numerals, 1.45 line-height, no shadows, no
backgrounds, max width 80 mm, zero page margin.

---

## 10. Content & tone

- **Arabic first.** Every string exists in AR and EN; the toggle reloads the page.
- Use `DS.t('key')` for shared strings; page-local pairs use `L(ar, en)`.
- Buttons are verbs: `تأكيد الطلب`, `إضافة`, `طباعة`.
- Numbers: currency via `DS.money()`, dates via `DS.date()`, relative time via
  `DS.timeAgo()`, escapes via `DS.esc()`.
- Errors explain the fix, not the failure.
- No `alert()`, no `confirm()`, no browser `prompt()`.

---

## 11. Accessibility

- Contrast: body text ≥ 4.5:1 against its surface; large display text ≥ 3:1.
- Focus is always visible: `--ring` on `:focus-visible`.
- Interactive targets ≥ 40×40 px.
- Icons that carry meaning need `aria-label`; decorative ones use `aria-hidden`.
- Modals trap focus, restore it on close, and close on `Esc`.
- Respect `prefers-reduced-motion` — disable transforms, keep opacity fades.
- RTL: use logical properties; test every new layout with the AR toggle.

---

## 12. Figma-ready token export

```json
{
  "color": {
    "canvas":        { "value": "#000000" },
    "surface":       { "value": "#1C1C1E" },
    "glass":         { "value": "rgba(28,28,30,0.72)" },
    "text-primary":  { "value": "#F5F5F7" },
    "text-secondary":{ "value": "#86868B" },
    "text-tertiary": { "value": "#48484A" },
    "brand-lemon":   { "value": "#CCFF00" },
    "accent-lime":   { "value": "#82FF1F" },
    "blue":          { "value": "#007AFF" },
    "green":         { "value": "#30D158" },
    "yellow":        { "value": "#FFD60A" },
    "orange":        { "value": "#FF9F0A" },
    "red":           { "value": "#FF453A" },
    "purple":        { "value": "#BF5AF2" },
    "teal":          { "value": "#64D2FF" },
    "indigo":        { "value": "#5E5CE6" },
    "border":        { "value": "rgba(255,255,255,0.10)" }
  },
  "radius": { "xs": 6, "sm": 10, "md": 18, "lg": 28, "xl": 44, "2xl": 36, "full": 999 },
  "space":  { "0": 0, "1": 4, "2": 8, "3": 12, "4": 16, "5": 20, "6": 24, "7": 28, "8": 32, "9": 40, "10": 48, "12": 64, "16": 80 },
  "font": {
    "display": "SF Pro Display, SF Pro Arabic, -apple-system, sans-serif",
    "body":    "SF Pro Arabic, SF Pro Display, -apple-system, sans-serif",
    "mono":    "SFMono-Regular, ui-monospace, Menlo, monospace",
    "print":   "Cairo, Inter, sans-serif"
  },
  "fontSize": { "2xs": 10, "xs": 11, "sm": 13, "md": 14, "base": 15, "lg": 17, "xl": 20, "2xl": 24, "3xl": 32, "4xl": 40, "5xl": 52 },
  "shadow": {
    "sm": "0 6px 18px rgba(0,0,0,0.34)",
    "md": "0 16px 40px rgba(0,0,0,0.42)",
    "lg": "0 28px 80px rgba(0,0,0,0.55)",
    "xl": "0 48px 120px rgba(0,0,0,0.65)"
  },
  "motion": {
    "fast": "160ms cubic-bezier(0.25,0.1,0.25,1)",
    "base": "280ms cubic-bezier(0.25,0.1,0.25,1)",
    "slow": "480ms cubic-bezier(0.25,0.1,0.25,1)",
    "spring": "cubic-bezier(0.16,1,0.3,1)"
  }
}
```

---

## 13. File map

| File | Responsibility |
| --- | --- |
| `shared/css/design-system.css` | Tokens, resets, base typography |
| `shared/css/components.css` | Buttons, cards, inputs, badges, tables, modals |
| `shared/css/app.css` | App shell, sidebar, topbar, page layouts |
| `shared/css/pro-max.css` | 2026 refinements + Pro Max modules + print overrides |
| `shared/css/storefront.css` | Storefront grid and product cards |
| `shared/css/pos-clean.css` | POS 70/30 layout and product media |
| `shared/js/core.js` | Tokens-in-JS, i18n, icons, toasts, modals, `DS.url()` |
| `shared/js/shell.js` | Sidebar/topbar, role guards, `DS.notify` |
| `shared/js/ui.js` | Order modal, charts, map, thermal CSS |
| `shared/js/data.js` | Seeded data, read models, mutations |

**CSS load order on every page:**
`design-system.css` → `components.css` → `app.css` → page CSS → `pro-max.css`.

---

## 14. Do / Don't

| Do | Don't |
| --- | --- |
| Use `var(--token)` for every colour, size and shadow | Hard-code `#fff`, `12px`, `left: 20px` |
| Use `DS.toast()` for feedback | Call `alert()` / `confirm()` |
| Use `DS.url('page.html')` for navigation | Write relative paths that break in nested folders |
| Keep one primary button per view | Stack three lime buttons |
| Animate with `--transition-base` | Add keyframes to `.delivery-card` |
| Escape all interpolated data with `DS.esc()` | Inject raw user strings into HTML |
| Test AR **and** EN before shipping | Assume LTR only |
| Respect tenant isolation in every query | Render another tenant's products |

---

*DotStudio® POS — Design System 2026 · maintained alongside the codebase.*
