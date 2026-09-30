---
name: Security and commerce boundaries
description: Durable security and payment decisions for the Telegram Shop.
---

- Secrets for admin sessions, the admin password, and Telegram webhook authentication are mandatory configuration; missing values must fail closed rather than use development fallbacks.
- Telegram webhook requests must include Telegram's secret-token header, and duplicate update IDs should be treated as successful no-ops.
- Internal-balance purchases and coupon redemption must use database-side conditional updates inside transactions; external payment methods remain disabled until a real provider is integrated.

**Why:** The shop handles account balances and order creation, so partial updates, replayed webhooks, or fake payment success would create direct financial and operational risk.

**How to apply:** Preserve these boundaries when adding payment providers, Mini App flows, admin tools, or new balance-affecting actions.