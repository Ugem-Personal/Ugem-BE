# UGem API contract conventions

All `/api/v1` JSON endpoints use one envelope.

## Success

```json
{
  "success": true,
  "message": "Human-readable result",
  "data": {},
  "meta": null,
  "errors": null,
  "traceId": "request-correlation-id",
  "timestampUtc": "2026-08-01T00:00:00.000Z"
}
```

For list endpoints, `data` is always an array. A paginated list sets:

```json
{
  "meta": {
    "pageIndex": 1,
    "pageSize": 20,
    "totalItems": 42,
    "totalPages": 3
  }
}
```

Non-paginated responses set `meta` to `null`.

## Error

Errors use the same envelope with `success: false`, `data: null`, and
`meta: null`. Validation details are in `errors`; clients should show
`message` and include `traceId` in support reports.

## Canonical identifiers

- Order: `orderId`
- Order line: `orderDetailId`
- Order-line topping: `foodToppingId`
- Review: `reviewId`
- Review line: `reviewDetailId`

The API does not duplicate these as generic `id`, typo aliases, or alternate
field names. Review detail input and response both use `details[].content`.

## Compatibility policy

Additive fields are backward-compatible. Removing or renaming a canonical
field requires a new API version. FE and BE changes to an existing canonical
field must ship together and pass the golden-flow E2E suite.
