# Furniture Buyer's App — Architecture

This is the "how it's built" document. For "what to build", see
[requirements.md](requirements.md). For "why this tech and how to work with
Claude on this project", see [CLAUDE.md](CLAUDE.md).

## 1. System overview

Everything runs in one Next.js project — there is no separate backend to
deploy or keep in sync. Next.js serves the pages the buyer sees *and* handles
the behind-the-scenes logic (checking a password, saving an order) as part of
the same program.

```
                 ┌─────────────────────────────────────────┐
                 │              Browser                      │
                 │   (login form, catalogue, basket, orders)  │
                 └───────────────────┬─────────────────────┘
                                     │ HTTP
                                     ▼
                 ┌─────────────────────────────────────────┐
                 │               Next.js app                  │
                 │                                             │
                 │  Pages (what you see)                      │
                 │   /login  /products  /cart  /orders         │
                 │                                             │
                 │  API routes (server-side logic)            │
                 │   /api/login  /api/logout  /api/checkout    │
                 └───────────────────┬─────────────────────┘
                                     │ Prisma (data access layer)
                                     ▼
                 ┌─────────────────────────────────────────┐
                 │          SQLite database (one file)        │
                 │   Users · Products · Orders · OrderItems   │
                 └─────────────────────────────────────────┘
```

Nothing in this diagram needs to be started separately — `npm run dev` starts
the whole thing, database included.

## 2. Components and their responsibilities

| Component | Responsibility |
|---|---|
| **Pages** (`src/app/*/page.tsx`) | What renders in the browser. Fetch data, show it, collect input. |
| **API routes** (`src/app/api/*/route.ts`) | The only place that touches passwords, sessions, and budget maths. Pages call these; pages never talk to the database directly. |
| **Prisma** (`prisma/schema.prisma` + generated client) | Translates between plain JavaScript objects and rows in the database. |
| **SQLite file** (`prisma/dev.db`) | The actual data, on disk, as one file. |
| **`lib/session.ts`** | Reads and writes the signed cookie that says "this browser is logged in as user X". |
| **`lib/money.ts`** | Converts between pennies-as-integer (storage) and "£12.50" (display). |

**Rule of thumb:** a page shows things and collects clicks; an API route
decides whether something is *allowed* and makes it *true* in the database.
Anything security- or money-related happens in an API route, never trusted
from the browser alone.

## 3. Key flows

### 3.1 Login

1. Buyer submits email + password on `/login`.
2. `/api/login` looks up the user by email, compares the submitted password
   against the stored **hash** using bcrypt (the real password is never
   stored, so there's nothing to compare "directly").
3. If it matches, the server creates a signed cookie identifying that user
   and sends it back to the browser.
4. Every later request automatically includes that cookie. `lib/session.ts`
   reads it on each protected page/API route to know who's asking.
5. Logout clears the cookie.

### 3.2 Browsing the catalogue

1. `/products` page asks Prisma for all products.
2. Products render as cards: image, name, price (converted from pennies to
   £ by `lib/money.ts`), an "Add to basket" control.
3. The basket itself lives in the browser (not the database) until checkout
   — it's just a list of "product id + quantity" the buyer is still deciding
   on.

### 3.3 Checkout (the important one)

This is the one flow where getting the order of operations right matters,
because it's the only place real "state" changes:

1. Buyer clicks "Place order" with items in their basket.
2. The browser sends the basket contents to `/api/checkout`.
3. The server — not the browser — looks up the buyer's budget and how much
   they've already spent (sum of past orders).
4. The server recalculates the basket total itself from the current product
   prices in the database (never trusts a total sent from the browser — a
   buyer could otherwise edit that number in their browser's dev tools).
5. If `basket total > remaining budget`, the request is rejected with a clear
   error. Nothing is saved.
6. If it's within budget, the server creates an `Order` plus its `OrderItem`
   rows in a single database transaction (so it's never left half-saved).
7. The new order appears immediately in the buyer's order history.

The reason step 3–4 happen on the server: a disabled "place order" button in
the browser is a courtesy, not a security control. Anyone can bypass browser
JavaScript. The budget check that actually counts is the one in the API
route.

## 4. Data model

```
User
 ├─ id
 ├─ email          (unique)
 ├─ passwordHash
 ├─ name
 └─ budget          (pennies)

Product
 ├─ id
 ├─ name
 ├─ description
 ├─ price           (pennies)
 ├─ imageUrl
 ├─ category
 └─ stock

Order
 ├─ id
 ├─ userId    ──────► User
 ├─ createdAt
 ├─ total           (pennies, snapshot at time of order)
 └─ status

OrderItem
 ├─ id
 ├─ orderId   ──────► Order
 ├─ productId ──────► Product
 ├─ quantity
 └─ unitPrice        (pennies, snapshot — so a later price change
                       doesn't rewrite history)
```

Relationships: one `User` has many `Order`s; one `Order` has many
`OrderItem`s; one `OrderItem` points at one `Product`.

**Remaining budget** is never stored directly — it's always calculated as
`user.budget − sum(user's orders' totals)`. That way there's only one number
to keep correct (the budget itself), instead of two numbers that could drift
out of sync.

## 5. Security model (demo-grade, stated plainly)

- Passwords: hashed with bcrypt before storage. Never logged, never stored
  as plain text.
- Sessions: a signed cookie naming the user id. "Signed" means the server can
  detect if a buyer tampers with the cookie's contents (they can't forge
  being a different user), but the cookie is not encrypted, and there's no
  expiry/rotation/rate-limiting logic. Fine for a demo; not fine for
  production.
- Authorization: every API route re-checks *who* is asking (via the cookie)
  before returning or changing *their* data. A buyer can only ever see their
  own orders and budget, not another buyer's — enforced server-side, not by
  hiding links in the UI.
- Budget enforcement: always recalculated server-side at checkout, as
  described in 3.3. This is the one check in the whole app that must not be
  removable by editing the browser.
- Explicitly not implemented: rate limiting, CSRF tokens, HTTPS (irrelevant
  on localhost), audit logs, password reset. See [CLAUDE.md](CLAUDE.md) for
  the full list of known limits.

## 6. Local development environment

- Runs entirely on one machine, no external services.
- The database is a single file (`prisma/dev.db`) — delete it and
  `npm run seed` to reset to a clean demo state at any point.
- `npx prisma studio` opens a browser tab showing the database as clickable
  tables — the easiest way to check "did that order actually save?" without
  reading any code.

## 7. Future: deployment path (not needed for Day 1)

If this needs to move off one laptop onto a public URL later:

- SQLite's one-file database doesn't persist on most hosting platforms
  (e.g. Vercel resets the filesystem on every deploy). Swapping to a hosted
  Postgres database is a small, well-defined change — mostly one line in
  `prisma/schema.prisma` plus a connection string — not a rewrite.
- Everything else (pages, API routes, login logic) is host-agnostic and
  would not need to change.

This is deliberately deferred — see the open question in
[requirements.md](requirements.md) about whether a public URL is even
needed.
