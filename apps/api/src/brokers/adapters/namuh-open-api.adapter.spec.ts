import assert from "node:assert/strict";
import { namuhDocumentProfile, normalizeNamuhAccounts, normalizeNamuhHoldings } from "./namuh-open-api.adapter";

function testAccountMapping() {
  const accounts = normalizeNamuhAccounts([
    {
      accountNo: "12345678901",
      accountName: "나무 주계좌",
      currencyBase: "KRW"
    }
  ]);

  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].broker, "NAMUH");
  assert.equal(accounts[0].brokerAccountNo, "12345678901");
  assert.equal(accounts[0].accountAlias, "나무 주계좌");
}

function testHoldingMapping() {
  const holdings = normalizeNamuhHoldings([
    {
      종목번호: "005930",
      종목명: "삼성전자",
      잔고수량: "10",
      평균매입가: "70000",
      현재가: "78000",
      평가금액: "780000",
      매입금액: "700000",
      손익: "80000",
      손익율: "11.43"
    },
    {
      종목번호: "A069500",
      종목명: "KODEX 200",
      잔고수량: "2",
      평균매입가: "35000",
      현재가: "36000"
    }
  ]);

  assert.equal(holdings.length, 2);
  assert.equal(holdings[0].symbol, "005930");
  assert.equal(holdings[0].marketCountry, "KR");
  assert.equal(holdings[0].marketValue, 780000);
  assert.equal(holdings[0].profitLossRate, 11.43);
  assert.equal(holdings[1].symbol, "069500");
  assert.equal(holdings[1].assetType, "ETF");
  assert.equal(holdings[1].marketValue, 72000);
}

function testDocumentProfile() {
  const profile = namuhDocumentProfile();
  assert.equal(profile.balanceTrCode, "c8201");
  assert.equal(profile.domesticQuoteTrCode, "IVWUTKMST04");
  assert.equal(profile.realtimeTradeCode, "mc");
  assert.match(profile.sdk, /WMCA/);
}

testAccountMapping();
testHoldingMapping();
testDocumentProfile();

console.log("나무 WMCA 어댑터 매핑 테스트 통과");

