# Jane's Furniture Buyer Site — Requirements

This is the "what to build" document. For "why we chose this technology" and
"how to work with Claude on this project", see [CLAUDE.md](CLAUDE.md). For
"how the pieces fit together technically", see [architecture.md](architecture.md).

## 1. Overview

A web app for buyers at a furniture shop. A buyer logs in, browses a product
catalogue, adds items to a basket, and places an order — which is blocked if
it would exceed their spending budget.

## 2. User roles

Only one role for Day 1:

- **Buyer** — logs in, browses products, places orders, views their own order
  history.

Not in scope for Day 1: admin/manager roles, approval workflows, multiple
buyers sharing one budget.

## 3. Functional requirements

Grouped by feature, ranked Must / Should / Could — if time runs out, cut from
the bottom up.

### 3.1 Login

- **Must** — A buyer can log in with an email and password.
- **Must** — A wrong email/password shows a clear error, not a crash.
- **Must** — A logged-in buyer stays logged in while using the app (session
  persists across page loads).
- **Must** — A buyer can log out.
- **Should** — Logging in redirects to the catalogue; visiting a protected
  page while logged out redirects to login.
- **Could** — "Remember me" / long-lived sessions.
- **Out of scope** — Sign-up, password reset, email verification, 2FA. Demo
  accounts are seeded directly into the database.

### 3.2 Catalogue

- **Must** — A logged-in buyer sees a list of furniture products: name,
  image, price.
- **Must** — Prices are shown clearly (e.g. "A$125.00"), never as raw numbers.
- **Should** — Products can be filtered or grouped by category (e.g. Chairs,
  Tables, Storage). Was a nice-to-have when the plan was ~12 demo products;
  worth revisiting now that the real catalogue is 762 products across 17
  categories and only the first 24 are shown (see [architecture.md](architecture.md)).
- **Should** — Each product has a short description.
- **Could** — Search by name.
- **Could** — Sort by price.
- **Out of scope** — Stock supply chains, supplier management, product
  editing by the buyer.

### 3.3 Basket and budget

- **Must** — A buyer can add a product to their basket and choose a quantity.
- **Must** — The basket shows a running total.
- **Must** — The buyer's remaining budget is visible at all times while
  shopping (e.g. "A$340 of A$500 remaining").
- **Must** — If the basket total would exceed the remaining budget, the buyer
  is stopped from placing the order and told why.
- **Should** — A buyer can remove an item or change its quantity in the
  basket before checkout.
- **Could** — A visual budget bar (green → amber → red as it's used up).
- **Out of scope** — Splitting one order across multiple budgets, discounts,
  promo codes.

### 3.4 Orders

- **Must** — Placing an order deducts its total from the buyer's remaining
  budget.
- **Must** — A buyer can view a list of their own past orders with totals and
  dates.
- **Should** — A buyer can view the items inside a past order.
- **Could** — Order statuses (e.g. Placed → Delivered) — likely unnecessary
  for a Day 1 demo, since there's no fulfilment happening behind it.
- **Out of scope** — Editing or cancelling a placed order, invoices/PDFs,
  email confirmations.

## 4. Non-functional requirements

- **Users**: a handful of demo buyer accounts, seeded in advance — no
  self-registration needed for the demo.
- **Data**: a few demo buyers, seeded automatically. The product catalogue
  is 762 real furniture items imported from an external source (see
  [architecture.md](architecture.md)) rather than hand-written placeholders
  — bigger than originally planned, which is why the catalogue page caps
  what it displays at once (see 3.2).
- **Devices**: must work in a modern desktop browser (Chrome/Edge/Firefox).
  Mobile-friendly is a bonus, not a requirement.
- **Performance**: no specific target — this is a small demo dataset, not a
  production load.
- **Security**: demo-grade only. Passwords are hashed, never stored as plain
  text, and the budget check happens on the server (not just hidden in the
  browser) so it can't be bypassed by disabling a button. Beyond that —
  rate limiting, HTTPS in production, audit logging — is explicitly out of
  scope for Day 1. See "Known limits" in [CLAUDE.md](CLAUDE.md).
- **Deployment**: runs locally, exposed to the internet for demo purposes via
  a temporary tunnel (see [CLAUDE.md](CLAUDE.md)) rather than a hosted
  deployment. Whether it needs to survive independently of one laptop is
  still an open question — see below.

## 5. Out of scope for Day 1 (explicit)

- Payments of any kind (this app tracks a budget, it does not take money)
- Admin/back-office screens for managing products or budgets
- Multi-currency support
- Notifications (email, SMS, push)
- Accessibility audit (should still be reasonably usable, just not audited)

## 6. Definition of done for the Day 1 demo

The app is demo-ready when someone can, without any coding help:

1. Open the app in a browser and log in with a demo account.
2. Browse the catalogue and see real-looking products with prices.
3. Add a few items to a basket and watch the remaining budget update.
4. Try to place an order that exceeds budget and see it correctly blocked.
5. Place an order within budget and see the budget reduce accordingly.
6. Look at their order history and see that order listed.
7. Log out and log back in as a different demo buyer with a different
   budget, and see that buyer's own data (not the first buyer's).

## 7. Open questions

(Duplicated from [CLAUDE.md](CLAUDE.md) so they're visible in the requirements
doc too — resolve here or there, whichever is more convenient.)

- Resolved: real product data is in use (762 items from an external source,
  not placeholders), and the app is reachable via a public URL (a temporary
  tunnel, not a hosted deployment).
- If the app needs to be reachable independently of one laptop being on
  (e.g. a judge checking it later without you online), that's a real
  deployment — bigger step than what's built so far, see
  [architecture.md](architecture.md) section 7.
- Is the budget per-buyer and fixed, or does it reset on a schedule (e.g.
  monthly)?
