# Keyvault — roadmap

## Done
- Database: products, stock_items, orders, order_items, profiles, user_roles, site_settings, payment_wallets
- deliver_order() stock-release function + seed products/stock
- Design system (Frosted Command) in src/styles.css
- Self-hosted on-chain payment watcher (chain.server.ts) + order server functions

## Done (UI)
- Storefront, product/checkout, My Orders (text/.txt/.csv), admin dashboard, live chat widget, Telegram link
- Storefront, auth, product/checkout, My Orders, Admin dashboard pages

## To do
- Self-hosted crypto payments wiring in UI
  - Admin wallet manager (USDT BEP20, USDT TRC20, TRX, BNB, BTC)
  - Needs from user: wallet addresses + free block-explorer API key for BNB/ETH chains (TRON/BTC need none)
- Credential delivery: on-site text view, .txt download, .csv download
- Admin: products & stock (paste + CSV upload), orders, users, site settings
- First signed-up owner becomes admin (claim_admin)
- Support: in-site live chat box (user <-> admin messages, stored in DB)
- Support: Telegram support handle in settings, shown across the site
