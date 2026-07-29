# Furniture Buyer's App — Hackathon Project

## What this is

A web app for buyers at a furniture shop. A user logs in, browses a product
catalogue, and places orders that are checked against a spending budget.

Built during a hackathon. Day 1 = get it working end to end.

**The owner of this project has no coding background.** Claude picks the
technology and does the building. This has consequences for how to work here —
see "Working style" below.

## Status

Day 1, not yet scaffolded. Stack and structure agreed; nothing built.

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
│   ├── seed.ts            # demo users + ~12 products
│   └── dev.db             # the database (gitignored)
├── src/
│   ├── app/
│   │   ├── login/
│   │   ├── products/
│   │   ├── cart/
│   │   ├── orders/
│   │   └── api/           # login, logout, checkout
│   ├── components/        # ProductCard, BudgetBar, etc.
│   └── lib/
│       ├── db.ts          # Prisma client
│       ├── session.ts     # cookie read/write
│       └── money.ts       # formatting helpers
└── public/                # product images
```

Shallow on purpose. Folder names should say what is in them.

## Data model

- **User** — id, email, passwordHash, name, budget
- **Product** — id, name, description, price, imageUrl, category, stock
- **Order** — id, userId, createdAt, total, status
- **OrderItem** — id, orderId, productId, quantity, unitPrice

Budget logic: `remaining = user.budget - sum(all their orders' totals)`.
Checkout is rejected if the basket total exceeds remaining.

## Conventions

- **Money is stored as whole pennies as integers** (`1250`, not `12.50`).
  Decimal floats introduce rounding errors, and a budget app that is off by a
  penny looks broken. Convert to display format only at the point of rendering,
  via `lib/money.ts`.
- Never store or log a plaintext password.
- Server-side checks are the real checks. Hiding a disabled button is a
  courtesy to the user, not a budget control — always re-verify the budget on
  the server at checkout.
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

To be filled in once the project is scaffolded. Expected:

```bash
npm run dev            # start the app at http://localhost:3000
npx prisma studio      # browse/edit the database in a browser
npx prisma db push     # apply schema changes
npm run seed           # reset to demo data
```

## Open questions

- Does this need to be deployed to a live URL, or is a laptop demo enough?
  (Affects the database: SQLite works locally but does not persist on hosts
  like Vercel. Swapping to hosted Postgres is a one-line Prisma change.)
- Real product data and images, or placeholders?
- Is the budget per-user and fixed, or does it reset per period?
