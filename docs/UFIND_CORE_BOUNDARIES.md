# UFind Core Boundaries

Phase 8 keeps the existing commerce schema and routes for backward compatibility. Order, Payment, Booking, AffiliateLink, AffiliateTransaction and reviewer earning flows are legacy/optional modules; they are not removed or migrated away.

## Core UFind flow

`Discovery -> Sponsored/Organic -> Verified Visit -> MerchantAcquisitionEvent -> Review/Gem Points -> Rebalancing -> Merchant Analytics -> PPVV preview`

Core metrics use verified acquisition events, not Order or Payment records.

## Dependency classification

- **Core:** discovery, campaign attribution, CheckIn DirectQr/CustomerCode, CheckIn reviews, Gem Points, rebalancing and Merchant Analytics.
- **Legacy:** Orders, Payments, Booking, Affiliate commission/earnings, Order QR and Order-based reviews.
- **Compatibility:** nullable `orderId`, `bookingId` and `affiliateLinkId` fields, legacy APIs, legacy dashboard metrics and database relations.

## API conventions

- New CheckIn flows use `DirectQr` or `CustomerCode`.
- `OrderQr` remains available only for backward compatibility.
- New reviews use `checkInId`; `orderId` is accepted only by the legacy dispatch.
- Customer-facing contribution data uses `gemPoints` and `contributionRank`. Database fields such as `reviewerPoints` remain unchanged for compatibility.

No Phase 8 migration drops legacy tables or changes their relations.
