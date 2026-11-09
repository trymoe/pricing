import { estimateCost, validatePrice, type Price, type CostEstimate } from '../src/index.js';
const price: Price = { input: 1, output: 2, currency: 'USD' };
const result: CostEstimate = estimateCost(price, { inputTokens: 1000, outputTokens: 2000 }, 0);
const raw: unknown = JSON.parse('{"input":1,"output":2,"currency":"USD"}');
validatePrice(raw);
estimateCost(raw, { inputTokens: 0, outputTokens: 0 });
void result;
// @ts-expect-error Unsupported currency must fail at compile time.
const badCurrency: Price = { input: 1, output: 2, currency: 'EUR' };
// @ts-expect-error Missing outputTokens must fail at compile time.
estimateCost(price, { inputTokens: 1 });
void badCurrency;
