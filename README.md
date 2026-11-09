# TryMoe Pricing

A small, dependency-free runtime for **AI API token cost estimates**. Extracted from the pure calculation logic in [TryMoe](https://try.moe/), then given a standalone API and strict input validation.

[简体中文](README.zh-CN.md) · [Exact semantics](docs/semantics.md) · [License](LICENSE)

- Separate input and output costs, with an explicit token denominator.
- Scheduled promotions, including free periods.
- Whole-request input-context tiers.
- IANA time zones, weekday rules, peak/off-peak windows and DST.
- Caller-supplied USD/CNY conversion. No hidden exchange-rate requests.
- Node.js and browser ES modules, TypeScript declarations, no runtime dependencies.

**This is an estimator, not an invoice engine.** All examples and demo rates are invented. This package contains no live vendor price catalog, production data, backend, monitoring or user information. For current sourced quotes, use [TryMoe](https://try.moe/).

## Build and try

Requires Node.js 22 or newer with full ICU time-zone support, npm, and Git.

```sh
git clone https://github.com/trymoe/pricing.git trymoe-pricing
cd trymoe-pricing
npm ci
npm run check
node examples/basic.mjs
npm run demo
```

Open `http://127.0.0.1:4178`. The demo runs locally and calculates in your browser. `npm run demo:build` produces a self-contained static site in `site/` for any static host.

The source repository can be built and packaged with `npm pack`. This README does not assume a release has been published to the npm registry.

## Example

```ts
import { estimateCost, convertCurrency } from './dist/index.js';

const quote = {
  currency: 'USD' as const,
  unit: 1_000_000,
  input: 2,
  output: 8,
  tiers: [{ minInputTokens: 200_000, input: 3, output: 12 }],
};

const result = estimateCost(
  quote,
  { inputTokens: 250_000, outputTokens: 10_000 },
  Date.parse('2026-06-01T12:00:00Z'),
);
// inputCost = 0.75, outputCost = 0.12, totalCost = 0.87 USD
// The selected tier prices the ENTIRE request, not just tokens above 200k.

const cny = convertCurrency(result.totalCost, 'USD', 'CNY', 7);
// Approximately 6.09 CNY. The FX rate above is synthetic.
```

Use `effectivePrice(quote, inputTokens, now)` to inspect the selected rate, regular rate, promotion state and rule index without computing a total. Use `validatePrice(unknownValue)` for parsed JSON; invalid values throw `RangeError` with a field path.

After installing a locally packed tarball, import the same API from `'trymoe-pricing'`. Only ESM is exported; there is no CommonJS build.

## Rules in brief

1. Start with the base rate. Select the highest applicable tier **or** the matching time window. Tiers and time windows cannot be mixed in one quote.
2. Apply only the selected rule's promotion. The base promotion is not inherited by a tier or time window.
3. Promotion start is inclusive; end is exclusive. Missing boundaries are unbounded. An omitted end is not evidence the offer lasts forever.
4. Time windows are same-day `[start, end)` in one named time zone. Split overnight windows. `24:00` is allowed only as an end.
5. Total = input tokens × effective input rate ÷ unit + output tokens × effective output rate ÷ unit. `unit` defaults to one million.

Pass an explicit timestamp for reproducible estimates. Otherwise the current clock is used. Monetary output uses JavaScript floating-point arithmetic without invoice rounding. Format only for display, or use an appropriate decimal/settlement engine for billing.

## Limits

- No tokenizer; callers supply measured or estimated token counts.
- No cache read/write, batch/Flex rules, images/audio/video, tool calls, minimum charges, taxes, top-ups, subscriptions, fees or currency-rate fetching.
- No progressive/marginal tier billing. Input count selects one tier for both input and output across the request.
- At most 1 billion tokens per direction, rates from 0 to 100 million per unit, 20 tiers or 24 time windows. Invalid, overlapping or contradictory rules are rejected even if inactive.
- Time-zone results depend on the host ICU/tzdata version. DST repeated minutes match twice; skipped local minutes never occur.
- Price freshness, provider trust and real model identity are outside this package's scope.

## Contributing and verification

See [CONTRIBUTING.md](CONTRIBUTING.md). Tests use synthetic data and fixed timestamps, plus a deterministic property sweep. CI runs checks on Node 22 and 24 and verifies the packed artifact in a fresh directory.

MIT applies to this package's code and documentation. It does not license vendor catalogs, brands or the rest of TryMoe. Development dependencies keep their own licenses; see [third-party notices](docs/third-party-notices.md).
