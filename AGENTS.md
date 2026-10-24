# DotStudio® POS — Agent Guide

## What this is
Multi-tenant store-management SaaS: admin console, owner dashboard, cashier POS, customer
storefront, delivery console and public community chat. Offline-first demo database in
`localStorage` (`ds_db_v1`); Firebase is optional and not required for the demo.

## Run locally
```bash
cd "النسخة النهائية للكاشير"
python3 -m http.server 8080
# open http://localhost:8080
```
Opening files with `file://` works too, but a local server is recommended for service-worker
and cross-page navigation tests.

## Architecture
- `index.html` — custom split-layout login (no shell).
- `marketing/index.html` — public landing page.
- `shared/js/core.js` — utilities, i18n (AR/EN), session, toasts, modals, avatar picker,
  command palette (⌘/Ctrl+K), icons, `DS.url()`.
- `shared/js/data.js` — seeded tenant-isolated data + all queries/mutations.
- `shared/js/shell.js` — sidebar/topbar, role guards, `DS.shell.mount()`.
- `shared/js/ui.js` — order modal, product editor, charts, tracking map, receipt printing.
- `shared/js/chat.js` — Support / Public / Stores / Delivery channels (with role locks).
- `shared/js/gps-track.js` — 2 km route simulation, moves only while `status === 'delivering'`,
  ETA refresh every 10 s.
- `shared/js/pages/*.js` — one module per page.
- `shared/css/design-system.css` → `components.css` → `app.css` (load in that order).

Every authenticated page calls:
```js
DS.shell.mount({ roles: [...], active: 'orders', title, eyebrow, sub, actions, content });
```

## Rules
- **Tenant isolation is non-negotiable.** Smozy = juices only; Caznova = watches, rings,
  perfumes, accessories; Bn Alsheikh = coffee only; MA Store = apparel/accessories only.
  Never render products from another tenant.
- Use design tokens (`--bg`, `--surface`, `--lime`, `--text-primary`, `--text-secondary`,
  `--border`, `--danger`, `--success`). No hard-coded colours.
- Use shared components: `.btn`, `.card`, `.input`, `.badge`, `.modal`, `.toast`, `.skeleton`,
  `.avatar`, `.sidebar-item`, `.table`.
- Replace `alert()` with `DS.toast(message, type)`.
- Keep `.delivery-card` static: no keyframes/animations.
- Every page must survive AR (RTL) and EN (LTR); toggle reloads the page on purpose.
- Navigation must go through `DS.url(relativePath)` so links work from nested folders.
- Logo `assets/img/LOGO-WHAIT.png` always renders at `height:40px !important;width:auto !important`.

## Demo accounts
| Role | Username | Password |
| --- | --- | --- |
| Super admin | `admin` | `admin2026` |
| Sub-admins | `dina`, `amal`, `fatma`, `nada`, `basmala` | `<username>2026` |
| Owners | `caznova`, `smozy`, `bnsheikh`, `mastore` | `<username>2026` |
| Cashiers | `ca_cashier`, `sm_cashier`, `bn_cashier`, `ma_cashier` | `<username>2026` |
| Delivery | `talqa`, `hala`, `ahla` | `<username>2026` |
| Customer | `customer` | `customer2026` |

Role home routes: admin/subadmin → `admin/dashboard.html`; owner → `owner/dashboard.html`;
cashier → `cashier/pos.html`; delivery → `delivery/dashboard.html`;
customer → `customer/storefront.html`.

## Before shipping
```bash
# syntax-check every JS file
find shared -name '*.js' -print0 | xargs -0 -n1 node --check
# optional: mirror to www and sync Capacitor
rsync -a --exclude _ARCHIVE_TRASH --exclude node_modules ./ www/
npx cap sync
```
Reset demo data: Settings → Security → Reset demo database (clears `ds_db_v1`).
