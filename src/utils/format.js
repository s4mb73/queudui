export const uid = () => Math.random().toString(36).slice(2, 10);

// fmt — formats a number as GBP (£) — primary currency for this app
export const fmt = (v) => `£${parseFloat(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtCurrency = (amount, currency) => {
  const symbols = { GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$' };
  const sym = symbols[currency] || currency + ' ';
  return `${sym}${parseFloat(amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const fmtPct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
export const today  = () => new Date().toISOString().slice(0, 10);

// Detect currency from a string like "£340.30" or "$200" or "€150"
export const detectCurrency = (text) => {
  if (!text) return 'GBP';
  if (/£/.test(text)) return 'GBP';
  if (/€/.test(text)) return 'EUR';
  if (/CA\$/.test(text)) return 'CAD';
  if (/A\$/.test(text)) return 'AUD';
  if (/\$/.test(text)) return 'USD';
  return 'GBP';
};

// Fetch live exchange rate — returns rate to convert FROM currency TO GBP
export async function fetchExchangeRate(fromCurrency) {
  if (fromCurrency === 'GBP') return 1;
  try {
    const res  = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`);
    const data = await res.json();
    if (data.result === 'success' && data.rates?.GBP) {
      return data.rates.GBP;
    }
  } catch (e) { /* fallback */ }
  const fallback = { USD: 0.79, EUR: 0.85, CAD: 0.58, AUD: 0.51 };
  return fallback[fromCurrency] || 1;
}

export const PLATFORMS = [
  'Viagogo', 'Tixstock', 'Lysted', 'StubHub',
  'Ticketmaster Resale', 'AXS Official Resale',
  'FIXR', 'Skiddle', 'Facebook', 'Twitter/X', 'WhatsApp',
  'Direct Cash', 'Other',
];
export const SPORT_TYPES = ['Football', 'Rugby', 'Cricket', 'Tennis', 'Boxing', 'F1 / Motorsport', 'Basketball', 'Other Sport'];
export const MUSIC_TYPES = ['Pop', 'Rock', 'Dance / Electronic', 'Hip-Hop / Rap', 'R&B / Soul', 'Classical', 'Festival', 'Other Music'];