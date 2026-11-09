# Pricing semantics and schema

## Minimal schema

`Price` has `input`, `output`, `currency` (`USD` or `CNY`), optional `unit` (default `1_000_000`), and optional `promotion`, `tiers`, `timeRates`.

- Rates: finite numbers, `0 ≤ rate ≤ 100_000_000`.
- Unit: safe integer from 1 to `1_000_000_000`, shared by every rule and promotion.
- Usage: `inputTokens` and `outputTokens`, integers from 0 to `1_000_000_000`.
- Promotion: `input`, `output`, nonblank `label` (up to 60 UTF-16 code units), optional `startsAt`, `endsAt`. Neither rate may increase, at least one must decrease. Dates must be real calendar timestamps with seconds and a `Z` or explicit offset. Optional fractional seconds have 1–3 digits. Leap seconds are not supported. End must be after start.
- Tier: `minInputTokens`, `input`, `output`, optional promotion. Thresholds must be strictly increasing positive integer input-token counts. Max 20.
- Time rate: `startTime`, `endTime` (`HH:mm`), named `timeZone`, optional `weekdays`, `input`, `output`, optional promotion. Max 24. Weekdays are distinct integers 0–6. Missing/empty means all days. All windows share the exact same time-zone identifier.

Unknown extra fields are ignored, not serialized by the core's outputs. Validation is for pricing correctness, not a general-purpose security sanitizer or input size limiter. Parse and bound untrusted transport payloads before calling it.

## Selection and arithmetic

Choose the highest tier with `inputTokens >= minInputTokens`, or the matching time window. If no rule applies, choose the base rate. A tier applies to the **entire** request, not marginal increments. Time windows and tiers are mutually exclusive.

Then choose the selected rule's active promotion. Promotions use `[startsAt, endsAt)`; missing dates are unbounded. Selecting a tier/window without a promotion does not inherit the base promotion. The regular rates in the result belong to the selected rule, not necessarily the base.

`inputCost = inputTokens / unit * effectiveInput`; output uses the same formula. Total is their sum. All values use the quote currency. Extremely small IEEE-754 values can underflow to zero, and large values may lose precision. The library never rounds, guesses a currency, fetches prices or converts automatically.

`convertCurrency(amount, from, to, usdCnyRate?)` uses caller-supplied USD→CNY rates, range `0.000001` to `1_000_000`. The rate is mandatory for different currencies. When supplied for the same currency it is still validated. Overflow is rejected. Rates are not a freshness guarantee.

## Time windows

Local time is resolved with `Intl.DateTimeFormat`, explicit time zone, Gregorian weekday names and an h23 clock. Window start is inclusive, end exclusive, to minute resolution. A request at 16:59:59 is inside a window ending 17:00. No window may span midnight; split it into `[22:00,24:00)` and `[00:00,06:00)`, taking care that the second part belongs to the next local weekday.

DST gaps have no matching instant for the skipped minutes. During a repeated hour, both occurrences match the same wall-clock rule. Time-zone aliases are allowed if the runtime recognizes them, but all windows must use an identical identifier. Fixed-offset strings are rejected; UTC is supported. Results can change with timezone database updates.

## Error and output contract

Every public calculation validates the entire quote, usage and supplied time first. Invalid input throws `RangeError`, never silently becomes zero cost. `now` is integer Unix epoch milliseconds within JavaScript's date range; omitted means `Date.now()`.

`effectivePrice` returns effective and regular rates, currency, unit, promotion status (`none`, `active`, `upcoming`, `expired`), optional promotion label, source (`base`, `tier`, `time`) and optional zero-based rule index. `estimateCost` returns it plus `inputCost`, `outputCost`, `totalCost`, and currency. Outputs have no mutable references to input objects.

These are local floating-point estimates. Use explicit timestamps and record quote inputs/FX/time-zone database version if reproducibility matters. Use a separate decimal, accounting and vendor-rule implementation for actual settlement.

## Extraction boundary

The public package carries only the pure rate-selection, token-cost and currency-conversion concepts from TryMoe, adapted into a standalone API. Input validation mirrors those concepts but is stricter than the former browser-only helper. No backend, UI state, catalog, reviews, credentials, deployment files or original Git history are part of this repository. Synthetic tests are written for this package; this is not a claim that every production provider's billing rules are covered.
