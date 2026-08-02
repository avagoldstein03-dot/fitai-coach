import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  getCountryByCurrency,
  getCountryByName,
  convertFromUSD,
  formatCurrencyAmount,
  getLocalPrice,
  type CountryInfo,
} from "./currency";

describe("getCountryByCurrency", () => {
  it("finds a country by currency code, case-insensitively", () => {
    expect(getCountryByCurrency("gbp")?.name).toBe("United Kingdom");
    expect(getCountryByCurrency("EUR")?.name).toBe("European Union");
  });

  it("returns undefined for an unknown currency", () => {
    expect(getCountryByCurrency("XXX")).toBeUndefined();
  });
});

describe("getCountryByName", () => {
  it("finds a country by exact name", () => {
    expect(getCountryByName("Japan")?.currency).toBe("JPY");
  });

  it("returns undefined for an unknown name", () => {
    expect(getCountryByName("Atlantis")).toBeUndefined();
  });
});

describe("convertFromUSD", () => {
  it("multiplies the USD amount by the given rate", () => {
    expect(convertFromUSD(10, 0.92)).toBeCloseTo(9.2);
  });
});

describe("formatCurrencyAmount", () => {
  const usd: CountryInfo = { name: "United States", currency: "USD", symbol: "$", rate: 1 };
  const jpy: CountryInfo = { name: "Japan", currency: "JPY", symbol: "¥", rate: 149 };

  it("shows two decimals for small amounts", () => {
    expect(formatCurrencyAmount(9.99, usd)).toBe("$9.99");
  });

  it("shows no decimals and thousands separators for large amounts", () => {
    expect(formatCurrencyAmount(1490, jpy)).toBe("¥1,490");
  });

  it("rounds to two decimals correctly for small amounts", () => {
    expect(formatCurrencyAmount(9.996, usd)).toBe("$10.00");
  });
});

describe("getLocalPrice", () => {
  it("returns the formatted local price for a known tier/period", () => {
    expect(getLocalPrice("starter", "monthly", DEFAULT_COUNTRY)).toBe("$9.99");
  });

  it("converts and formats for a non-USD country", () => {
    const eur = getCountryByCurrency("EUR")!;
    expect(getLocalPrice("starter", "monthly", eur)).toBe(formatCurrencyAmount(9.99 * eur.rate, eur));
  });

  it("returns an em dash for an unknown tier or period", () => {
    expect(getLocalPrice("nonexistent", "monthly", DEFAULT_COUNTRY)).toBe("—");
    expect(getLocalPrice("starter", "nonexistent", DEFAULT_COUNTRY)).toBe("—");
  });
});

describe("COUNTRIES / DEFAULT_COUNTRY", () => {
  it("defaults to the United States", () => {
    expect(DEFAULT_COUNTRY.currency).toBe("USD");
  });

  it("has no duplicate country names", () => {
    const names = COUNTRIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
