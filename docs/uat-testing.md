# Local UAT and Postman

## Seed

The seed is additive and idempotent. It only owns accounts ending in
`@uat.ugem.local` plus the `UAT10` campaign and UAT-labelled catalog data. It
does not delete existing records and refuses to run with `NODE_ENV=production`.

```bash
npm run seed:uat
```

Default local password: `UGemUat123!`. Override it before seeding with
`UAT_SEED_PASSWORD`; never use this password outside local UAT.

Accounts:

- `admin@uat.ugem.local`
- `staff@uat.ugem.local`
- `customer@uat.ugem.local`
- `reviewer@uat.ugem.local`
- `merchant@uat.ugem.local`

Re-running the command updates the owned fixtures instead of creating
duplicates.

## Postman

Import both files from `postman/`:

1. `UGem-UAT.postman_collection.json`
2. `UGem-Local.postman_environment.json`

Select **UGem Local UAT**, then run folders in numeric order. The login requests
capture role tokens. The merchant food request captures `foodId`; order creation
captures `orderId`, so the remaining lifecycle requests require no manual IDs.

The collection intentionally excludes a successful SePay webhook request to
avoid accidentally simulating a real payment with a production key. SePay is
covered by the isolated E2E database suite.

