# 515Store upgrades and fixes

## Goal
Fix wallet-credit checkout, make product popularity visible, rename the browser-facing brand, and give the storefront clearer navigation and a stronger product-first opening.

## Plan

### 1. Fix wallet-credit purchases
- Replace the balance debit path that currently attempts a negative insert and triggers the database’s non-negative balance rule.
- Make wallet purchases atomic: lock the customer balance, verify it is sufficient, debit it safely, create the order, record the transaction, and release the purchased accounts in one database operation.
- Return a clear “not enough wallet balance” message instead of exposing a database constraint error.
- Refresh wallet, order, product-stock, and storefront data after a successful purchase so the customer immediately sees the new balance and order.

### 2. Show product sales totals
- Add a safe public aggregate for each product’s sold stock count without exposing account contents or customer details.
- Include `sold` alongside available stock in storefront and product-page data.
- Display a compact “X sold” indicator on every product card and on the product detail page, including zero-sales products.

### 3. Rename browser-facing branding
- Change every page title and social-sharing title from Keyvault to **515Store**.
- Update the default store name and fallback labels so browser tabs, error states, header, and footer consistently use 515Store.
- Preserve any editable dashboard store-name setting while making 515Store the reliable default.

### 4. Improve the landing page — products first
- Replace the centered introductory block with a compact storefront masthead that keeps products visible immediately.
- Add a clearer catalog heading, useful inventory/sales context, and stronger visual hierarchy around the product grid.
- Refine product cards so banners, name, price, available quantity, sold count, and action are faster to scan.
- Keep the existing dark Frosted Command visual identity while improving contrast and spacing rather than introducing a different theme.

### 5. Make top navigation prominent
- Redesign Store, My Orders, Wallet, and Admin as clearly separated icon-and-label navigation controls with stronger active and focus states.
- Ensure signed-out and signed-in actions remain visually distinct.
- Add a compact mobile layout that keeps all destinations readable and prevents wrapping or overlap.

### 6. Verify
- Test wallet purchases with sufficient and insufficient balances, including repeated clicks and concurrent attempts.
- Confirm the displayed sold count matches sold stock and updates after a wallet purchase.
- Check all page titles for 515Store.
- Review the storefront and navigation at desktop and the current compact viewport, then run database security checks and the project build.

## Technical details
- Apply the database-function correction and public sold-count aggregate through a tracked migration; retain row-level security and existing grants.
- Continue using authenticated server functions for customer wallet operations and the existing public read path for storefront aggregates.
- Use existing semantic color tokens and shared controls; no customer or credential data becomes public.
