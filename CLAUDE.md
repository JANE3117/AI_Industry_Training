# Jane's Furniture Buyer Site — Hackathon Project

## What this is

A web app for buyers at a furniture shop. A user logs in, browses a product
catalogue, and places orders that are checked against a spending budget.

Built during a hackathon. Day 1 = get it working end to end.

**The owner of this project has no coding background.** Claude picks the
technology and does the building. This has consequences for how to work here —
see "Working style" below.

## Status

Day 1. The full core journey works end to end: login → browse catalogue →
add to basket → place order (blocked server-side if it exceeds remaining
budget, with a specific error message) → view order history and total
spent. Money displays in AUD (see "Conventions").

The catalogue is real data (762 IKEA-style products imported from an
external MongoDB collection), not placeholders — see "Product data source"
below. The home page caps display at 24 products for load-time reasons;
there's no pagination/search yet.

The account, basket, and navigation are consolidated into one dropdown in
the top-right corner (`AccountMenu`) — click the avatar/name/budget chip to
open it, or add anything to the basket and it opens automatically. It holds:
account info, the live basket (edit quantities, remove, place order, budget
error messages), and links to Catalogue / My orders / Log out. See "UI
layout" below.

The app is also reachable from the public internet via a Cloudflare quick
tunnel (no account needed) — see "Public access" below. This is demo-mode
exposure, not a persistent deployment: it only works while both the dev
server and the tunnel process are running on this machine.

Note: this scaffold used Next.js 16 and Prisma 7, both newer than Claude's
training data. Prisma 7 requires a driver adapter even for SQLite (used
`@prisma/adapter-libsql`, since `better-sqlite3` needs native compilation
tools not installed in this WSL environment). If future work hits
Prisma/Next errors that don't match older documentation, check
`furniture-app/.agents/skills/` first — these are versioned reference docs
the tools installed for themselves, not something to remove.

## The core user journey

1. Log in with email + password
2. See a catalogue of furniture products
3. Add items to a basket
4. See remaining budget update as items are added
5. Place the order — blocked if it would exceed budget
6. View past orders

Everything else is a nice-to-have. If time runs short, cut features from the
end of that list, not the middle.

## Tech stack

| Layer     | Choice                        | Why |
|-----------|-------------------------------|-----|
| Framework | Next.js (App Router) + TypeScript | Pages and server logic in one project, one language |
| Styling   | Tailwind CSS                  | Ships with Next.js, styling lives next to the markup |
| Database  | SQLite (single file)          | No server to install or start |
| DB access | Prisma                        | Readable schema; `prisma studio` gives a clickable view of the data |
| Login     | Hand-rolled: bcrypt + signed cookie | ~50 lines we control, no library config to misconfigure under time pressure |

### Deliberate non-choices

- **No NextAuth/Auth.js.** Powerful, but heavy on configuration and cryptic
  when it fails. Wrong trade for a hackathon.
- **No separate backend service.** Next.js route handlers are enough.
- **No component library** (shadcn/ui, MUI). Extra setup steps for a small app.
- **No Docker.** Nothing here needs it.

### Known limits — say these out loud if asked

The auth is demo-grade: no password reset, no rate limiting, no 2FA, no email
verification. Fine for a hackathon; not fit for real customer data.

## Location and environment

The app lives in `furniture-app/`, a subfolder of the existing
`AI_Industry_Training` repo. It is self-contained — it does not interact with
the Python `.venv` or anything else at the repo root.

**Node.js must be installed inside WSL before anything will work.** The `npm`
currently on PATH is Windows' npm at `/mnt/c/Program Files/nodejs/`, reached
via WSL's Windows-path bridge. Using it for this project causes slow builds and
broken file watching. Install Node in WSL with nvm (no admin rights required)
and confirm `which node` returns a path under `/home/`, not `/mnt/c/`.

## Folder structure

```
furniture-app/
├── prisma/
│   ├── schema.prisma      # data model
│   └── seed.ts            # demo users + placeholder products (see below)
├── scripts/
│   ├── import-catalog.ts    # one-off: loads real catalogue from MongoDB
│   └── inspect-catalog.ts   # read-only: peek at the source schema
├── src/
│   ├── app/
│   │   ├── login/
│   │   ├── orders/         # order history + total spent
│   │   └── api/            # login, logout, checkout
│   ├── components/        # AppHeader, AccountMenu, ProductCard, LogoutButton
│   └── lib/
│       ├── db.ts               # Prisma client
│       ├── session.ts          # cookie read/write
│       ├── money.ts            # formatting helpers
│       └── basket-context.tsx  # basket state, shared via React context
│                                # (see "UI layout" below)
├── dev.db                 # the SQLite database (gitignored, project root —
│                           # NOT inside prisma/, see note below)
└── public/
```

Shallow on purpose. Folder names should say what is in them.

**Gotcha:** the database file (`dev.db`) lives at the project **root**, not
inside `prisma/`, even though `prisma db push`/`prisma studio` are invoked
via files inside `prisma/`. `DATABASE_URL="file:./dev.db"` resolves relative
to `prisma.config.ts`'s location, which Prisma placed at the project root.
Anything that opens `dev.db` directly (a script, a one-off Node command)
must use the same root-relative path — resolving it from inside `scripts/`
or `prisma/` will silently create a second, empty database file instead of
erroring. This bit us once already; `.gitignore` was fixed to `/dev.db`
accordingly.

## Data model

- **User** — id, email, passwordHash, name, budget
- **Product** — id, name, description, price, imageUrl, category, stock
- **Order** — id, userId, createdAt, total, status
- **OrderItem** — id, orderId, productId, quantity, unitPrice

Budget logic: `remaining = user.budget - sum(all their orders' totals)`.
Checkout is rejected if the basket total exceeds remaining.

### Product data source

`scripts/import-catalog.ts` replaces all Products with data pulled from an
external MongoDB collection (762 IKEA-style furniture items: name, category,
price, colours, dimensions, and an image). Two adaptations from the source
shape:

- The source has no `description` field — one is synthesized from colours
  + dimensions.
- The source has no `stock` field — every imported product defaults to
  `stock: 10`. Not real inventory data; flag if a different default matters.
- Images arrive as raw base64 + a separate mime-type field, not a URL.
  They're stored in `imageUrl` as a `data:` URI (e.g.
  `data:image/jpeg;base64,...`) so the existing `<img src={imageUrl}>` code
  works unchanged.

The script refuses to run if any `OrderItem` already references a Product
(protects real order history from a careless re-import). The Mongo
connection string lives in `.env` as `MONGODB_URI` — never hardcode it in
the script.

## UI layout

Basket state (line items, quantities, checkout submission, errors) lives in
`lib/basket-context.tsx` (`BasketProvider` + `useBasket()`), not in one
component's local state — it needs to be reachable from two places that
aren't parent/child of each other: `ProductCard`'s "Add to basket" button
(deep in the product grid) and `AccountMenu`'s dropdown (in the header).
React Context is the tool for exactly this "two siblings need the same
state" situation.

- `useBasket()` returns `null` when called outside a `BasketProvider` (the
  orders page doesn't have one, since there's nothing to add to a basket
  there) — components check for `null` rather than crashing, so `AppHeader`
  can render on any page.
- The home page (`page.tsx`) is the only place wrapped in `<BasketProvider>`.
- Adding an item increments a counter (`lastAddedAt`) that `AccountMenu`
  watches specifically to auto-open the dropdown — it does *not* watch the
  whole basket object, because that object is a new reference on every
  render (unmemoized context value) and would reopen the menu on every
  quantity edit too, not just on add.

If this menu ever needs real automated UI testing: Playwright was tried in
this environment and failed — headless Chromium needs system libraries
(`libnspr4` and friends) that need `sudo apt install`, which this sandbox
can't run interactively. It would work fine from a normal terminal with
`sudo` access; someone just has to run the install step by hand.

## Public access (tunnel)

The app is exposed to the internet via a Cloudflare quick tunnel — no
account or signup needed, unlike ngrok (which now requires a free account +
authtoken before it'll start). This is dev/demo exposure, not a production
deployment.

```bash
export PATH="$HOME/.local/bin:$PATH"   # cloudflared lives here, not on PATH by default
cloudflared tunnel --url http://localhost:3000
```

This prints a fresh `https://<random-words>.trycloudflare.com` URL each time
it starts — it changes on every restart (no fixed address without a
Cloudflare account). Both the Next.js dev server (`npm run dev`) and this
tunnel process need to keep running for the URL to work; closing either one
(or the laptop) takes it down.

Known limits worth saying out loud: anyone with the URL can reach the login
page (though not get past it without the demo credentials, which admittedly
*are* printed on that same login page — fine for a hackathon demo, not for
anything with real data).

## Conventions

- **Money is stored as whole cents as integers** (`1250`, not `12.50`).
  Decimal floats introduce rounding errors, and a budget app that is off by a
  cent looks broken. Convert to display format only at the point of
  rendering, via `lib/money.ts` (formats as AUD, e.g. `A$12.50`).
- **Display currency is AUD, but this is a relabel, not a conversion.**
  Numeric values were never actually run through an AUD exchange rate — the
  same integers that were shown with a `£` prefix are now shown with an
  `A$` prefix. Flag it if real currency conversion ever matters.
- Never store or log a plaintext password.
- Server-side checks are the real checks. Hiding a disabled button is a
  courtesy to the user, not a budget control — the checkout API route
  (`/api/checkout`) always re-fetches current prices and re-checks the
  budget itself; it never trusts totals sent from the browser.
- Prefer boring, obvious code over clever code. This has to be readable and
  debuggable at speed.

## Working style

The owner does not read code, so:

- **Explain in plain English before building.** Trade-offs and consequences,
  not just what was chosen.
- **Keep the app runnable at all times.** A working app missing a feature beats
  a broken app that was mid-refactor. Prefer small changes that can be seen
  working over large ones that land all at once.
- **Say when something is not done, broken, or skipped.** Do not report
  success without having actually run it.
- **Flag anything needing a human decision** (real product data, branding,
  whether it needs to be deployed) rather than quietly inventing an answer.

## Commands

Run from inside `furniture-app/`. Node is installed via nvm — if a fresh
terminal says `node: command not found`, run
`export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh"` first (a new terminal
picks this up automatically from `.bashrc`; only needed for non-interactive
shells).

```bash
npm run dev                          # start the app at http://localhost:3000
npx prisma studio                    # browse/edit the database in a browser
npx prisma db push                   # apply schema changes
npm run seed                         # (re)seed demo users + placeholder products
npx tsx scripts/import-catalog.ts    # replace Products with the real MongoDB catalogue
```

Demo logins: `alice@example.com` / `bob@example.com`, password
`password123` for both.

## Open questions

- The tunnel gives a public URL for the demo, but it's tied to this laptop
  staying on and both processes staying up. If this needs to survive
  independently (e.g. judges checking it later without you online), that's
  a real deployment (Vercel + a hosted database, since SQLite doesn't
  persist on serverless hosts) — a bigger step than what's built so far.
- Is the budget per-user and fixed, or does it reset per period?
- The catalogue now has 762 products across 17 categories but the home page
  only shows the first 24 (no pagination/search built yet). Worth building
  next, or is a capped single-page view fine for the demo?
