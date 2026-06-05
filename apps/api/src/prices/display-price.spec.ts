import assert from "node:assert/strict";
import { calculateHoldingMarketValue, resolveDisplayPrice } from "./display-price";

const usExtended = resolveDisplayPrice({
  marketCountry: "US",
  regularMarketPrice: null,
  extendedMarketPrice: 101,
  lastPrice: 99,
  previousClose: 95,
  lastSuccessfulPrice: 90
});
assert.equal(usExtended?.displayPrice, 101);
assert.equal(usExtended?.priceSource, "EXTENDED");
assert.equal(usExtended?.isStale, false);

const usPreviousClose = resolveDisplayPrice({
  marketCountry: "US",
  previousClose: 95,
  lastSuccessfulPrice: 90
});
assert.equal(usPreviousClose?.displayPrice, 95);
assert.equal(usPreviousClose?.priceSource, "PREVIOUS_CLOSE");
assert.equal(usPreviousClose?.isStale, true);

const krCurrent = resolveDisplayPrice({
  marketCountry: "KR",
  lastPrice: 71000,
  extendedMarketPrice: 70900,
  previousClose: 70000
});
assert.equal(krCurrent?.displayPrice, 71000);
assert.equal(krCurrent?.priceSource, "LAST");

assert.equal(
  calculateHoldingMarketValue({
    quantity: 2,
    displayPrice: 100,
    currency: "USD",
    usdKrwRate: 1400
  }),
  280000
);

console.log("display-price resolver tests passed");
