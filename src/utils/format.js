export const uid = () => Math.random().toString(36).slice(2, 10);
export const fmt = (v) => `$${parseFloat(v || 0).toFixed(2)}`;
export const fmtCurrency = (amount, currency) => {
  const symbols = { USD: "$", GBP: "£", EUR: "€", CAD: "CA$", AUD: "A$" };
  const sym = symbols[currency] || currency + " ";
  return `${sym}${parseFloat(amount || 0).toFixed(2)}`;
};
export const fmtPct = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
export const today = () => new Date().toISOString().slice(0, 10);

// Detect currency from a string like "£340.30" or "$200" or "€150"
export const detectCurrency = (text) => {
  if (!text) return "USD";
  if (/£/.test(text)) return "GBP";
  if (/€/.test(text)) return "EUR";
  if (/CA\$/.test(text)) return "CAD";
  if (/A\$/.test(text)) return "AUD";
  return "USD";
};

// Fetch live exchange rate — returns rate to convert FROM currency TO USD
export async function fetchExchangeRate(fromCurrency) {
  if (fromCurrency === "USD") return 1;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`);
    const data = await res.json();
    if (data.result === "success" && data.rates?.USD) {
      return data.rates.USD;
    }
  } catch (e) { /* fallback */ }
  // Fallback rates if API fails
  const fallback = { GBP: 1.27, EUR: 1.08, CAD: 0.73, AUD: 0.65 };
  return fallback[fromCurrency] || 1;
}

export const PLATFORMS = ["StubHub", "Viagogo", "Ticketmaster Resale", "AXS Official Resale", "FIXR", "Skiddle", "Facebook", "Twitter/X", "WhatsApp", "Direct Cash", "Other"];
export const SPORT_TYPES = ["Football", "Rugby", "Cricket", "Tennis", "Boxing", "F1 / Motorsport", "Basketball", "Other Sport"];
export const MUSIC_TYPES = ["Pop", "Rock", "Dance / Electronic", "Hip-Hop / Rap", "R&B / Soul", "Classical", "Festival", "Other Music"];