# Handoff: XANVOR — Metal Handicrafts Storefront

## Overview
XANVOR is the ecommerce + trade storefront for a Moradabad (India) metal-handicrafts house — a manufacturer / exporter / OEM brand selling brass, copper, silver-gilt, sheesham (rosewood) and wireform décor. It is a **dual-audience** store:

- **B2C retail** — shoppers buy individual pieces (currently the *Hot-Serve* collection), add to a **cart**, and check out (WhatsApp / UPI / COD / bank transfer).
- **B2B trade** — buyers add pieces to an **Enquiry Basket** (no public prices), configure bulk quantities with an indicative tier calculator, and send a single trade enquiry.

The two flows coexist on the product page through a **retail / wholesale toggle** that switches automatically at a 50-piece threshold.

A separate internal page (*Product Studio*) is a React design-comparison tool, not part of the customer storefront — see [§ Product Studio](#product-studio-internal-tool).

---

## About the Design Files
The files in `site/` are **design references built as static HTML / CSS / vanilla JS** — fully working prototypes that demonstrate the intended look, copy, layout and interaction behavior. **They are not the production codebase to ship verbatim.**

Your task is to **recreate these designs inside the target codebase's environment** using its established patterns and libraries — most naturally a React/Next.js or similar component app backed by a real CMS/commerce backend. If there is no existing environment yet, pick the most appropriate stack for a small content-driven storefront (e.g. Next.js + a headless commerce/CMS) and implement the designs there.

What to lift exactly from the references:
- The visual system (colors, type, spacing, component styling) — these are **hi-fi** (see below).
- The copy, product taxonomy, and the data model in `assets/products.js`.
- The interaction logic in the JS files (cart, enquiry basket, bulk-tier calculator, checkout) — treat these as **spec**, then re-implement against real state management + a backend instead of `localStorage`.

What to replace for production:
- `localStorage` carts → server/session-backed cart & order persistence.
- Hardcoded WhatsApp/UPI/bank placeholders → real payment integration (see [§ Checkout](#5-checkout--checkouthtml)).
- Static `products.js` array → a real product service / CMS.
- The Netlify-form enquiry submit → your form/CRM endpoint.

## Fidelity
**High-fidelity (hi-fi).** Colors, typography, spacing, component styling, hover/active states and copy are final-quality and should be reproduced pixel-faithfully. Use the exact token values in [§ Design Tokens](#design-tokens). The only "rough" areas are backend-dependent: payment, form submission, and product data source — those are intentionally stubbed.

---

## Tech at a glance (reference build)
| Concern | How the reference does it | Production guidance |
|---|---|---|
| Pages | Static multi-page HTML | Componentize into routes |
| Styling | Inline `<style>` per page, CSS custom properties in `:root` | Extract tokens to a theme; reuse across components |
| Product data | `assets/products.js` → `window.XANVOR_PRODUCTS` (array of objects) | Product service / headless CMS |
| Retail cart | `shop-cart.js` → `window.XanvorShop`, `localStorage` key `xanvor_shop_cart_v1` | Real cart state + persistence |
| Trade enquiry | `enquiry-basket.js` → `window.XanvorBasket`, `localStorage` key `xanvor_enquiry_basket_v1` | CRM/lead capture |
| PDP logic | `product.js` (reads `?id=` from URL, renders into `#product-root`) | Server/route component |
| Checkout | `checkout.html` inline script, `window.XANVOR_SHOPCFG` config | Payment gateway integration |
| Fonts | Google Fonts: Fraunces, Cormorant Garamond, JetBrains Mono, Space Grotesk | Same |

No build step, no framework, no external CSS/JS dependencies (except Google Fonts and — for the Studio page only — React/Babel via CDN).

---

## Screens / Views

### 1. Homepage — `index.html`
The brand front door. Single long scroll, fixed top nav.

**Sections, in order:**
1. **Nav (fixed)** — `XANVOR` wordmark left; right links: **Categories** (hover/click dropdown → 6 collections, last one "Hot-Serve" carries a *New* badge), **Catalogue**, **Contact**. The cart button is injected by `shop-cart.js` into `nav .links`. Nav is transparent over the hero and gains an ivory blurred background + bottom border on scroll (`nav.scrolled`, toggled past 40px scrollY).
2. **Hero** — full-viewport, centered. Thin inset brass frame (`.hero-frame`, `inset:20px`). Stacked brass logo image, mono eyebrow tagline ("Manufacturer · Exporter · Ecommerce"), Fraunces display H1 ("Metal handicrafts, hand-finished in *Moradabad*" — *Moradabad* in italic rust), lead line, two CTAs (primary "View the Collection", ghost "Trade Enquiry"), animated "Scroll" cue at bottom. Entrance: staggered `rise` keyframe (opacity + translateY) on load.
3. **Trust strip** (`.trust`) — 4 cells (Manufacturer / Exporter / OEM Partner / Ecommerce), each with a roman-numeral italic figure + mono caption. Divided by vertical rules; collapses to 2×2 then 1-col.
4. **Featured pieces** (`.featured`) — 3-card grid of signature products, each a link to `product.html?id=…`, with a pin badge (Signature / Heirloom / Modern), contained product photo, Fraunces title, description, code + "View piece →".
5. **Catalogue** (`.catalogue`, `#catalogue`) — intro block, **jump chips** (I–VI) to each collection, then **collection groups** (`#c-silvergold`, `#c-copper`, `#c-brass`, `#c-wood`, `#c-furniture`). Each group has a centered head (roman numeral + title + mono sub) and one or more `.cat-grid` blocks. Grid cell 1 is a **lead card** (`.cat-lead`, series label); remaining cells are `.cat-item` product cards (photo / ornament glyph / title / desc / code + "View piece →"). Some cards are `.signature` (span full row, horizontal layout, "Signature Piece" pin).
6. **Collections** (`.collections`) — 5 image tiles (`assets/col_*.jpg`) with numbered captions, hover zoom + brightness lift.
7. **Process** (`.process`) — deep-band strip, 4 numbered steps (Cast → Finish → … ).
8. **House + trade value props** (`.house`) — intro, 3 pillars, a 4-up `.trade-grid` of icon value cards.
9. **Contact** (`.contact`, `#contact`) — deep claret band with inset border; contact details, partner links, a map placeholder (striped, with a CSS pin), and the **enquiry form** (Netlify-style). Two-column → single-column responsive.
10. **Footer** — logo mark, rule, tagline, legal line, policy links.

**Reveal animation:** elements with `.reveal` (and `.d1`–`.d4` delay variants) fade/translate in via `IntersectionObserver`; base hidden state only applies when `html.js` is present (set by an inline script in `<head>`) so no-JS still shows content.

### 2. Product Detail Page (PDP) — `product.html` + `product.js`
URL-driven: `product.html?id=<product-id>`. `product.js` finds the product in `window.XANVOR_PRODUCTS`, sets `<title>`/meta, and renders everything into `#product-root`. If not found, shows a "Piece not found" state.

**Layout** (`.pdp`, a grid):
- **Breadcrumbs** — Home / Collection / Piece name.
- **Gallery** (left) — large contained product shot with optional pin badge, "Photographed at the workshop · Moradabad" caption, and a **finish selector** row (Antique gold / Polished / Matte gold / Oxidised / Silver swatches — visual only, hidden for priced retail items).
- **Details** (right) — eyebrow (collection · series), H1, code, badge row (Hand-cast / OEM / FOB·EXW·DDP), rule, description, and a **highlights / "What you can specify"** feature list with inline stroke icons.
- **Buybox** (right rail) — see two modes below.
- **A+ modules** (below) — "Made in our Moradabad atelier" band, 3 detail cards, a **bulk pricing tier table**, a **specifications** table, and a **related pieces** grid (same series → same collection, up to 4).

**Buybox — two modes:**
- **Trade-only items** (no price in data): "Trade Desk · Bulk Quote" box. Tier chips (Sample / 50+ / 200+ / 500+ / 1000+), quantity stepper, and a live quote card (volume tier, indicative discount, lead time, shipping terms, unit price "disclosed on enquiry"). CTAs: **Add to Enquiry**, **Add as Sample · 5 pcs**, **Download Spec Sheet**.
- **Priced items** (Hot-Serve, `offer`/`retail` present): a **retail ⇄ wholesale toggle** buybox.
  - *Retail* (qty < 50): price + MRP + % off, qty stepper, subtotal / GST 18% / pay-at-checkout card, **Add to Cart** + **Buy Now** (Buy Now → `checkout.html`). Note nudging to wholesale at 50+.
  - *Wholesale* (qty ≥ 50): per-piece "from" price, volume tier / indicative discount / lead time / est. order value, **Add to Enquiry** + **Request bulk quote**.
  - The toggle auto-switches when qty crosses the threshold (`window.XANVOR_SHOPCFG.THRESHOLD`, default 50).

**Bulk tiers (`TIERS` in `product.js`, illustrative):**
| Qty band | Indicative discount | Lead time | Shipping |
|---|---|---|---|
| Sample · 1–49 | Standard | 2–3 weeks | Air cargo · DHL/FedEx |
| Trial · 50–199 | ~12% off sample | 4–5 weeks | FOB · EXW · DDP |
| Volume · 200–499 | ~22% off sample | 6–7 weeks | FOB · EXW · DDP |
| Bulk · 500–999 | ~32% off sample | 8–10 weeks | FOB Mundra / Nhava Sheva |
| Container · 1000+ | ~40% off sample | 10–12 wks (split shipment) | FOB · CIF · DDP |

### 3. Hot-Serve Collection — `Hot-Serve Collection.html`
A standalone **retail collection landing page** for the Hot-Serve range (hammered insulated food warmers, hot-pots, serving domes). Product grid links into `product.html?id=xv-fw-…`. Loads `assets/products.js` + `shop-cart.js` (retail cart, no enquiry basket here). This is the primary B2C shopping surface; reachable from the nav Categories dropdown (badged *New*) and catalogue jump chips.

### 4. Retail Cart — `shop-cart.js` (global, slide-in drawer)
Injected on `index.html`, `product.html`, `Hot-Serve Collection.html`.
- Adds a **Cart** button (with count bubble) into `nav .links`.
- Slide-in right drawer with line items (thumb, name, code, unit price + struck MRP, qty stepper, remove), subtotal, "+18% GST & free shipping at checkout", **Proceed to Checkout** → `checkout.html`.
- **Threshold guard:** if any line ≥ 50 pcs, shows an inline warning nudging the buyer to **switch to a bulk enquiry** on the PDP.
- State: `localStorage` key `xanvor_shop_cart_v1`; cross-tab sync via `storage` event + custom `xanvor:cart-change` event. API: `window.XanvorShop` (`add/setQty/remove/clear/open/close`, `count/lines/subtotal`).
- Config: `window.XANVOR_SHOPCFG` — `THRESHOLD:50`, `GST:0.18`, `FREE_SHIP:true`, `WHATSAPP`, `UPI`, `BANK{…}` (UPI/bank are **placeholders to replace**).

### 5. Checkout — `checkout.html`
Retail checkout reading the same cart.
- Address form (name, phone/WhatsApp, email, address, city, state, PIN, landmark).
- **Payment methods:** Order on WhatsApp (Fastest), UPI / QR, Cash on Delivery, Bank transfer.
- Order summary with line items, subtotal, GST 18%, total.
- On submit: generates an order id `XV########`, builds an order text message, and routes by method — WhatsApp opens a pre-filled `wa.me` chat; UPI builds a `upi://pay?…` deep link; bank shows account details; COD confirms. **All payment endpoints are placeholder/manual-confirm — wire a real gateway for production.**

### 6. Trade Enquiry Basket — `enquiry-basket.js` (global, B2B)
Injected on `index.html`, `product.html` (and the legacy `updates-for-cowork` variants).
- Floating **Enquiry** pill (bottom-right) with count; opens a right drawer.
- Line items (thumb, name, code, finish, qty stepper, remove) + an inline **enquiry form** (name*, email*, company, country/city, notes) → submitted as a Netlify form (`form-name: trade-enquiry`) with a serialized basket payload. **No prices anywhere** — this is a quote request.
- State: `localStorage` key `xanvor_enquiry_basket_v1`; merges items by `code|finish`. API: `window.XanvorBasket`.
- Success state thanks the buyer ("reply within one working day") and clears the basket after ~4.5s.

### Product Studio (internal tool)
`Xanvor Product Studio.html` + `studio-app.js` + `studio-data.js` — a **React (CDN + Babel) design-comparison tool**, NOT a customer page. It presents three candle-holder redesign concepts (Swan / Lotus / Peacock) as Amazon-style product mockups with a brief, feature callouts, spec tables and a comparison matrix — an internal merchandising/art-direction artifact. Implement only if the team wants to keep an internal concept-review surface; it is independent of the storefront.

---

## Interactions & Behavior
- **Nav scroll state:** add `.scrolled` past 40px scrollY (background + blur + border).
- **Categories dropdown:** opens on hover and on click/tap (`.nav-cat.open`); chevron rotates 180°; closes on outside click / Escape.
- **Reveal-on-scroll:** `IntersectionObserver` adds `.in` to `.reveal` elements; staggered via `.d1`–`.d4`. Hidden base state gated behind `html.js`.
- **Hero & section entrance:** `rise` keyframe (opacity 0→1, translateY 22px→0), staggered delays.
- **Card hover:** `translateY(-3px)` + brass/rust border + soft shadow; product image `scale(1.04)` over 0.8s `cubic-bezier(.2,.7,.2,1)`.
- **Cart/enquiry drawers:** scrim fade + `translateX(100%→0)` over 0.35s; body scroll locked while open; Escape closes; pill/button "flash"/"pop" keyframe on add.
- **Qty steppers:** clamp to ≥1; in bulk mode step by 50 above 50, else by 1/10.
- **Retail⇄wholesale auto-switch:** crossing the 50-pc threshold flips the buybox mode and updates the tier table highlight.
- **Reduced motion / no-JS:** all content must be visible without animation (base styles are the end state; hidden states only under `html.js`).

## State Management
Reference uses `localStorage` + custom events. For production, model:
- **Retail cart:** array of `{ id, code, name, image, price, mrp, finish, qty }`; derived `count`, `lineCount`, `subtotal`; GST and shipping applied at checkout. Merge key = `code|finish`.
- **Enquiry basket:** array of `{ code, name, image, qty, finish }`; merge key = `code|finish`; no pricing.
- **PDP buybox:** local `qty`, `mode (retail|wholesale)`, selected `finish`, derived tier.
- **Checkout:** address fields + selected payment method + generated order id.
- Cross-surface sync: both carts dispatch change events and listen to `storage` for multi-tab consistency — replicate with your state layer / server.

## Data fetching
Reference loads a static `assets/products.js` (`window.XANVOR_PRODUCTS`). Replace with a product service. The PDP, Hot-Serve page, homepage featured/catalogue cards and "related pieces" all read from this one source, keyed by `id`.

---

## Design Tokens

**Color (CSS custom properties, from `:root`):**
| Token | Hex | Use |
|---|---|---|
| `--ink` | `#1F140C` | Deepest brown-black text |
| `--claret-deep` | `#241510` | Headings on light |
| `--claret` | `#3A2718` | Dark brand brown |
| `--storm` | `#3F2C1B` | Gradient stop |
| `--band` | `#5E3F28` | Deep "band" sections / footer |
| `--brass` | `#B68B5C` | Brass accent |
| `--brass-soft` | `#C9A57E` | Lighter brass / italic accents on dark |
| `--rust` | `#A85D2A` | Primary accent / CTAs / italic accents on light |
| `--parchment` | `#D9CBAE` | Muted caption on dark |
| `--bone` | `#F4EEE2` | Page background (warm ivory) |
| `--bone-warm` | `#FBF6E8` | Lightest ivory (text on dark) |
| `--paper` | `#FCFAF4` | Card surface |
| `--paper-2` | `#F8F2E6` | Card surface 2 / image wells |
| `--line` | `#E6DCC8` | Hairline borders |
| `--line-strong` | `#D8CBB0` | Stronger borders |
| `--ink-soft` | `#6E6151` | Secondary text |
| `--ink-faint` | `#9A8E7C` | Tertiary text |
| Body text on light | `#43352B` / `#5A4636` | Paragraphs |
| CTA hover | `#C0712F` | Rust hover |

Finish swatches (PDP): Antique gold `#A87B3F`, Polished `#C9A57E`, Matte gold `#8C6A38`, Oxidised `#5E4322`, Silver `#B6B2A6`.

**Typography:**
| Role | Family | Notes |
|---|---|---|
| Display / headings | **Fraunces** (300/400/500, italic) | `.display` = 300, line-height 1.04; italics used for emphasis words |
| Body / serif UI | **Cormorant Garamond** (400/500, italic) | Base body 18–19px, line-height 1.6 |
| Eyebrows / labels / code | **JetBrains Mono** (400/500) | UPPERCASE, letter-spacing .2–.34em, ~10.5px |
| (Studio page only) | Marcellus + Hanken Grotesk | Internal tool |

Type scale highlights: hero H1 `clamp(34px,5.4vw,62px)`; section H2 `clamp(30px,4.6vw,54px)`; card titles 22px; eyebrow 10.5px; body 18–19px. **Keep mono labels ~10.5px min.**

**Spacing / radius / shadow:**
- Section padding: `clamp(80px,11vw,140px)` vertical, `6vw` horizontal.
- Grid gaps: 14–22px; card body padding ~22–26px.
- Radius: cards `8px`; menus `12px`; pills/buttons-round `50px`; small chips `5–9px`.
- Card hover shadow: `0 20px 50px -28px rgba(58,39,24,.4)`.
- Drawer shadow: `-20px 0 60px -20px rgba(36,21,16,.4)`.
- Buttons: mono 11px uppercase, letter-spacing .2em, padding `16px 30px`, 1px border; primary = rust fill, ghost = rust outline; hover `translateY(-2px)`.
- Decorative: faint SVG grain overlay (`body::after`, opacity ~.045, `mix-blend-mode:overlay`).

**Motifs:** roman numerals (I–VI) for collections; the `❧`/`✷` ornament glyph (`&#x2767;`, `✺`) as a recurring decorative mark; inset thin brass frames on hero & contact band.

---

## Assets
All under `site/assets/` (copied with this bundle):
- `logo_stacked_brass.png`, `logo_mark.png`, `favicon.png` — brand marks.
- `products/*.jpg` — 56 product shots, named by product `id` (e.g. `sg-401.jpg`, `xv-fw-101.jpg`). Referenced from `products.js`.
- `col_*.jpg` (5) — collection tiles for the homepage Collections section.
- `catalogue_cover.jpg`, `catalogue/page-01…12.jpg` — PDF catalogue cover + page scans.
- `ref-swan-lifestyle.jpg`, `ref-swan-detail.jpg` — reference photography used by the Product Studio tool.
- `products.js` — **the product data source** (`window.XANVOR_PRODUCTS`).

Product images are on warm/neutral backgrounds and displayed `object-fit:contain` inside padded wells — preserve this (don't crop-fill) so silhouettes read cleanly.

---

## Files (in this bundle, under `site/`)
**Customer storefront**
- `index.html` — homepage (nav, hero, trust, featured, catalogue, collections, process, house, contact, footer).
- `Hot-Serve Collection.html` — retail collection landing page.
- `product.html` + `product.js` — PDP shell + render/logic (URL `?id=`).
- `checkout.html` — retail checkout (address + payment + summary).
- `shop-cart.js` — retail cart drawer + nav button (`window.XanvorShop`, `window.XANVOR_SHOPCFG`).
- `enquiry-basket.js` — B2B trade enquiry basket pill + drawer (`window.XanvorBasket`).
- `assets/products.js` — product catalogue data.
- `assets/…` — images & brand marks.

**Internal tool (optional)**
- `Xanvor Product Studio.html` + `studio-app.js` + `studio-data.js` — React concept-comparison artifact.

### How to run the reference
Serve `site/` over any static HTTP server (needed so the `<script src>` files and `?id=` routing resolve), e.g. `npx serve site` or `python3 -m http.server` from inside `site/`. Open `index.html`. Opening files directly via `file://` may break relative script loading on some browsers.

---

## Build priority (suggested)
1. Theme/tokens + typography + nav + footer shell.
2. Homepage sections (static content) + reveal animations.
3. Product data service + PDP (both buybox modes + tier calculator).
4. Hot-Serve collection grid + retail cart + checkout (with real payments).
5. Trade enquiry basket + form endpoint.
6. (Optional) internal Product Studio.
