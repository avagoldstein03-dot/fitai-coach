export interface CountryInfo {
  name: string;
  currency: string;
  symbol: string;
  rate: number; // approximate rate vs USD (1 USD = X units)
}

export const COUNTRIES: CountryInfo[] = [
  { name: "United States",      currency: "USD", symbol: "$",   rate: 1.00 },
  { name: "United Kingdom",     currency: "GBP", symbol: "£",   rate: 0.79 },
  { name: "European Union",     currency: "EUR", symbol: "€",   rate: 0.92 },
  { name: "Canada",             currency: "CAD", symbol: "CA$", rate: 1.36 },
  { name: "Australia",          currency: "AUD", symbol: "A$",  rate: 1.53 },
  { name: "New Zealand",        currency: "NZD", symbol: "NZ$", rate: 1.63 },
  { name: "Switzerland",        currency: "CHF", symbol: "CHF", rate: 0.90 },
  { name: "Japan",              currency: "JPY", symbol: "¥",   rate: 149.0 },
  { name: "South Korea",        currency: "KRW", symbol: "₩",   rate: 1320.0 },
  { name: "India",              currency: "INR", symbol: "₹",   rate: 83.0 },
  { name: "Brazil",             currency: "BRL", symbol: "R$",  rate: 4.97 },
  { name: "Mexico",             currency: "MXN", symbol: "MX$", rate: 17.2 },
  { name: "Argentina",          currency: "ARS", symbol: "$",   rate: 850.0 },
  { name: "Colombia",           currency: "COP", symbol: "COL$",rate: 3900.0 },
  { name: "Chile",              currency: "CLP", symbol: "CLP$",rate: 890.0 },
  { name: "South Africa",       currency: "ZAR", symbol: "R",   rate: 18.7 },
  { name: "Nigeria",            currency: "NGN", symbol: "₦",   rate: 1500.0 },
  { name: "Egypt",              currency: "EGP", symbol: "E£",  rate: 30.9 },
  { name: "Saudi Arabia",       currency: "SAR", symbol: "SR",  rate: 3.75 },
  { name: "United Arab Emirates",currency: "AED",symbol: "د.إ", rate: 3.67 },
  { name: "Israel",             currency: "ILS", symbol: "₪",   rate: 3.72 },
  { name: "Turkey",             currency: "TRY", symbol: "₺",   rate: 30.5 },
  { name: "Russia",             currency: "RUB", symbol: "₽",   rate: 88.0 },
  { name: "Ukraine",            currency: "UAH", symbol: "₴",   rate: 37.0 },
  { name: "Poland",             currency: "PLN", symbol: "zł",  rate: 3.96 },
  { name: "Sweden",             currency: "SEK", symbol: "kr",  rate: 10.4 },
  { name: "Norway",             currency: "NOK", symbol: "kr",  rate: 10.6 },
  { name: "Denmark",            currency: "DKK", symbol: "kr",  rate: 6.87 },
  { name: "Czech Republic",     currency: "CZK", symbol: "Kč",  rate: 22.6 },
  { name: "Hungary",            currency: "HUF", symbol: "Ft",  rate: 357.0 },
  { name: "Romania",            currency: "RON", symbol: "lei", rate: 4.56 },
  { name: "Singapore",          currency: "SGD", symbol: "S$",  rate: 1.34 },
  { name: "Hong Kong",          currency: "HKD", symbol: "HK$", rate: 7.82 },
  { name: "China",              currency: "CNY", symbol: "¥",   rate: 7.24 },
  { name: "Taiwan",             currency: "TWD", symbol: "NT$", rate: 31.7 },
  { name: "Thailand",           currency: "THB", symbol: "฿",   rate: 35.1 },
  { name: "Indonesia",          currency: "IDR", symbol: "Rp",  rate: 15600.0 },
  { name: "Malaysia",           currency: "MYR", symbol: "RM",  rate: 4.69 },
  { name: "Philippines",        currency: "PHP", symbol: "₱",   rate: 56.5 },
  { name: "Vietnam",            currency: "VND", symbol: "₫",   rate: 24300.0 },
  { name: "Pakistan",           currency: "PKR", symbol: "₨",   rate: 278.0 },
  { name: "Bangladesh",         currency: "BDT", symbol: "৳",   rate: 110.0 },
  { name: "Ghana",              currency: "GHS", symbol: "GH₵", rate: 12.0 },
  { name: "Kenya",              currency: "KES", symbol: "KSh", rate: 130.0 },
];

export function getCountryByCurrency(currency: string): CountryInfo | undefined {
  return COUNTRIES.find((c) => c.currency.toLowerCase() === currency.toLowerCase());
}

export function getCountryByName(name: string): CountryInfo | undefined {
  return COUNTRIES.find((c) => c.name === name);
}

export function convertFromUSD(usdAmount: number, rate: number): number {
  return usdAmount * rate;
}

export function formatCurrencyAmount(amount: number, info: CountryInfo): string {
  // For currencies with large values (JPY, KRW, VND, etc.), show no decimals
  const noDecimals = amount >= 100;
  const rounded = noDecimals ? Math.round(amount) : Math.round(amount * 100) / 100;
  const formatted = noDecimals
    ? rounded.toLocaleString()
    : rounded.toFixed(2);
  return `${info.symbol}${formatted}`;
}

// USD base prices per plan/period
const USD_PRICES: Record<string, Record<string, number>> = {
  starter: { weekly: 2.99, monthly: 9.99,  annual: 89.99 },
  pro:     { weekly: 3.99, monthly: 15.99, annual: 119.99 },
  elite:   { weekly: 4.99, monthly: 19.99, annual: 149.99 },
};

export function getLocalPrice(
  tier: string,
  period: string,
  countryInfo: CountryInfo
): string {
  const usd = USD_PRICES[tier]?.[period];
  if (usd == null) return "—";
  const local = convertFromUSD(usd, countryInfo.rate);
  return formatCurrencyAmount(local, countryInfo);
}

export const DEFAULT_COUNTRY: CountryInfo = COUNTRIES[0]; // United States
