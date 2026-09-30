# Keyvault — roadmap

## Done
- Database: products, stock_items, orders, order_items, profiles, user_roles, site_settings
- deliver_order() stock-release function + seed products/stock

## In progress
- Design system (Frosted Command) in src/styles.css
- Storefront, auth, product/checkout, My Orders, Admin dashboard

## To do
- Self-hosted crypto payments (NO third-party provider):
  - Admin-managed wallet addresses per network (USDT BEP20, USDT TRC20, TRX, BTC, ETH...)
  - Unique expected amount per order + time window for matching
  - On-chain watcher reading public explorers (TronGrid for TRON, BscScan for BEP20)
  - Auto-confirm order -> deliver_order() releases accounts
  - Needs from user: wallet addresses + free BscScan API key (TRON needs none)
- Credential delivery: on-site text view, .txt download, .csv download
- Admin: products & stock (paste + CSV upload), orders, users, site settings
- Make first signed-up owner an admin
