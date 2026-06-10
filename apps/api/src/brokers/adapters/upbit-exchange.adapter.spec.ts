import assert from "node:assert/strict";
import {
  buildUpbitJwt,
  buildUpbitQueryString,
  calculateCryptoHoldingValue,
  normalizeUpbitBalances,
  normalizeUpbitTickers,
  type UpbitMarketResponse
} from "./upbit-exchange.adapter";

function decodeJwtPart(token: string, index: number) {
  return JSON.parse(Buffer.from(token.split(".")[index], "base64url").toString("utf8"));
}

function testAuthJwt() {
  const queryString = buildUpbitQueryString({ states: ["wait", "watch"], market: "KRW-BTC" });
  const token = buildUpbitJwt({
    accessKey: "access-key",
    secretKey: "secret-key",
    nonce: "fixed-nonce",
    queryString
  });
  const header = decodeJwtPart(token, 0);
  const payload = decodeJwtPart(token, 1);

  assert.equal(header.alg, "HS512");
  assert.equal(payload.access_key, "access-key");
  assert.equal(payload.nonce, "fixed-nonce");
  assert.equal(payload.query_hash_alg, "SHA512");
  assert.equal(typeof payload.query_hash, "string");
}

function testTickerMapping() {
  const tickers = normalizeUpbitTickers([
    {
      market: "KRW-BTC",
      trade_price: 100_000_000,
      prev_closing_price: 98_000_000,
      signed_change_price: 2_000_000,
      signed_change_rate: 0.0204,
      timestamp: 1781080000000
    }
  ]);

  assert.equal(tickers.length, 1);
  assert.equal(tickers[0].market, "KRW-BTC");
  assert.equal(tickers[0].tradePrice, 100_000_000);
  assert.equal(tickers[0].signedChangeRate, 2.04);
}

function testBalanceMappingAndValuation() {
  const marketMap = new Map<string, UpbitMarketResponse>([
    ["KRW-BTC", { market: "KRW-BTC", korean_name: "비트코인", english_name: "Bitcoin" }],
    ["KRW-ETH", { market: "KRW-ETH", korean_name: "이더리움", english_name: "Ethereum" }]
  ]);
  const tickerMap = new Map(
    normalizeUpbitTickers([
      { market: "KRW-BTC", trade_price: 100_000_000, timestamp: 1781080000000 },
      { market: "KRW-ETH", trade_price: 5_000_000, timestamp: 1781080000000 }
    ]).map((ticker) => [ticker.market, ticker])
  );
  const result = normalizeUpbitBalances(
    [
      { currency: "KRW", balance: "150000", locked: "50000", avg_buy_price: "0", unit_currency: "KRW" },
      { currency: "BTC", balance: "0.1", locked: "0.02", avg_buy_price: "80000000", unit_currency: "KRW" },
      { currency: "ETH", balance: "2", locked: "0", avg_buy_price: "6000000", unit_currency: "KRW" }
    ],
    marketMap,
    tickerMap
  );

  assert.equal(result.cashBalances.length, 1);
  assert.equal(result.cashBalances[0].currency, "KRW");
  assert.equal(result.cashBalances[0].balance, 150000);
  assert.equal(result.cashBalances[0].locked, 50000);

  const btc = result.holdings.find((holding) => holding.symbol === "BTC");
  assert.ok(btc);
  assert.equal(btc.balance, 0.1);
  assert.equal(btc.locked, 0.02);
  assert.equal(btc.marketValueKrw, 12_000_000);
  assert.equal(btc.costAmountKrw, 9_600_000);
  assert.equal(btc.profitLossKrw, 2_400_000);
  assert.equal(btc.profitLossRate, 25);

  const eth = result.holdings.find((holding) => holding.symbol === "ETH");
  assert.ok(eth);
  assert.equal(eth.marketValueKrw, 10_000_000);
  assert.equal(eth.profitLossKrw, -2_000_000);
}

function testBtcMarketConversion() {
  const marketMap = new Map<string, UpbitMarketResponse>([
    ["BTC-ALT", { market: "BTC-ALT", korean_name: "알트코인", english_name: "Altcoin" }],
    ["KRW-BTC", { market: "KRW-BTC", korean_name: "비트코인", english_name: "Bitcoin" }]
  ]);
  const tickerMap = new Map(
    normalizeUpbitTickers([
      { market: "BTC-ALT", trade_price: 0.01, timestamp: 1781080000000 },
      { market: "KRW-BTC", trade_price: 100_000_000, timestamp: 1781080000000 }
    ]).map((ticker) => [ticker.market, ticker])
  );
  const result = normalizeUpbitBalances(
    [{ currency: "ALT", balance: "3", locked: "1", avg_buy_price: "0.008", unit_currency: "BTC" }],
    marketMap,
    tickerMap
  );

  assert.equal(result.holdings.length, 1);
  assert.equal(result.holdings[0].currentPriceKrw, 1_000_000);
  assert.equal(result.holdings[0].marketValueKrw, 4_000_000);
  assert.equal(result.holdings[0].costAmountKrw, 3_200_000);
}

function testValuationHelper() {
  const value = calculateCryptoHoldingValue({
    balance: 1.5,
    locked: 0.5,
    currentPriceKrw: 10_000,
    avgBuyPrice: 8_000
  });

  assert.equal(value.totalQuantity, 2);
  assert.equal(value.marketValueKrw, 20_000);
  assert.equal(value.costAmountKrw, 16_000);
  assert.equal(value.profitLossKrw, 4_000);
  assert.equal(value.profitLossRate, 25);
}

function testUnknownMarketIsSkipped() {
  const result = normalizeUpbitBalances(
    [{ currency: "UNKNOWN", balance: "1", locked: "0", avg_buy_price: "1", unit_currency: "KRW" }],
    new Map(),
    new Map()
  );

  assert.equal(result.holdings.length, 0);
}

testAuthJwt();
testTickerMapping();
testBalanceMappingAndValuation();
testBtcMarketConversion();
testValuationHelper();
testUnknownMarketIsSkipped();

console.log("업비트 어댑터 테스트 통과");
