import { estimateCost, convertCurrency } from '../dist/index.js';
// Deliberately invented prices, not a quote for any provider or model.
const estimate = estimateCost(
  { input: 2, output: 8, currency: 'USD' },
  { inputTokens: 1_000_000, outputTokens: 100_000 },
  Date.parse('2026-06-01T12:00:00Z'),
);
console.log(estimate); // totalCost: 2.8 USD, unrounded
console.log(convertCurrency(estimate.totalCost, 'USD', 'CNY', 7)); // 19.6 CNY (synthetic FX)
