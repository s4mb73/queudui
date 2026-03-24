// ─────────────────────────────────────────────────────────────────────────────
// src/lib/schema.js
// ─────────────────────────────────────────────────────────────────────────────

// ── Ticket statuses ───────────────────────────────────────────────────────────
export const TICKET_STATUSES = ["Unsold", "Listed", "Sold", "Delivered", "Completed"];

export const TICKET_STATUS_STYLES = {
  Unsold:    { bg: "#f1f5f9",                 text: "#64748b", dot: "#94a3b8" },
  Listed:    { bg: "rgba(26,58,110,0.08)",    text: "#1a3a6e", dot: "#1a3a6e" },
  Sold:      { bg: "rgba(5,150,105,0.08)",    text: "#059669", dot: "#059669" },
  Delivered: { bg: "rgba(249,115,22,0.08)",   text: "#f97316", dot: "#f97316" },
  Completed: { bg: "rgba(15,23,42,0.06)",     text: "#374151", dot: "#374151" },
};

export const SOLD_STATUSES = new Set(["Sold", "Delivered", "Completed"]);

// ── Sale statuses ─────────────────────────────────────────────────────────────
// "Awaiting Delivery" = confirmed sale, tickets not yet transferred to buyer
// "Delivered"         = tickets transferred, fully complete
export const SALE_STATUSES = ["Awaiting Delivery", "Delivered"];

export const SALE_STATUS_STYLES = {
  // Legacy fallback — old "Sold" records auto-migrate to "Awaiting Delivery"
  "Sold":              { bg: "rgba(249,115,22,0.08)",  text: "#c2410c", dot: "#f97316", border: "rgba(249,115,22,0.2)" },
  "Awaiting Delivery": { bg: "rgba(249,115,22,0.08)",  text: "#c2410c", dot: "#f97316", border: "rgba(249,115,22,0.2)" },
  "Delivered":         { bg: "rgba(5,150,105,0.08)",   text: "#059669", dot: "#059669", border: "rgba(5,150,105,0.2)" },
};

// ── Platform colours ──────────────────────────────────────────────────────────
export const PLATFORM_COLORS = {
  Viagogo:               "#1a3a6e",
  Tixstock:              "#059669",
  Lysted:                "#7c3aed",
  StubHub:               "#f97316",
  "Ticketmaster Resale": "#ef4444",
  "AXS Official Resale": "#0ea5e9",
  Default:               "#64748b",
};

export function platformColor(platform) {
  return PLATFORM_COLORS[platform] || PLATFORM_COLORS.Default;
}

// ── Categories ────────────────────────────────────────────────────────────────
export const CATEGORIES = ["Concert", "Sport", "Theatre", "Comedy", "Festival", "Other"];

export const CATEGORY_CONFIG = {
  Sport:   { icon: "⚽", accent: "#1a3a6e", bg: "rgba(26,58,110,0.08)" },
  Concert: { icon: "🎵", accent: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  Theatre: { icon: "🎭", accent: "#0ea5e9", bg: "rgba(14,165,233,0.08)" },
  Comedy:  { icon: "🎤", accent: "#f97316", bg: "rgba(249,115,22,0.08)" },
  Festival:{ icon: "🎪", accent: "#059669", bg: "rgba(5,150,105,0.08)" },
  Other:   { icon: "🎟️", accent: "#64748b", bg: "rgba(100,116,139,0.08)" },
};

export function categoryConfig(category) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Concert;
}

export function categoryAccent(category) {
  return categoryConfig(category).accent;
}

// ── Canonical ticket shape ────────────────────────────────────────────────────
export const BLANK_TICKET = {
  id: "", event: "", category: "Concert", subtype: "",
  date: "", time: "", venue: "", section: "", row: "", seats: "",
  qty: 1, qtyAvailable: 1, costPrice: 0,
  originalCurrency: "USD", originalAmount: 0, exchangeRate: 1,
  orderRef: "", notes: "", accountEmail: "",
  status: "Unsold", restrictions: "", isStanding: false, parentOrderRef: "",
};

// ── Canonical sale shape ──────────────────────────────────────────────────────
export const BLANK_SALE = {
  id: "", eventId: "", sellingPlatform: "",
  orderId: "", qtySold: 1,
  salePrice: 0, salePriceEach: 0,
  saleStatus: "Awaiting Delivery",
  date: "", notes: "",
  ticketIds: [],
  section: "", row: "", seats: "",
  customerEmail: "", customerPhone: "",
};

// ── Seat info helpers ─────────────────────────────────────────────────────────
export function resolveSeatInfo(sale, matchedTickets = []) {
  const primary = matchedTickets[0];
  return {
    section: sale.section || primary?.section || "",
    row:     sale.row     || primary?.row     || "",
    seats:   sale.seats   ||
      (matchedTickets.length > 0
        ? matchedTickets.map(t => t.seats).filter(Boolean).join(", ")
        : ""),
  };
}

export function isStandingSection(section = "") {
  return /standing|pitch|floor|general admission|ga\b/i.test(section);
}

// ── Design tokens ─────────────────────────────────────────────────────────────
export const COLORS = {
  navy: "#1a3a6e", orange: "#f97316", green: "#059669",
  purple: "#7c3aed", red: "#ef4444", slate: "#64748b",
  bg: "#f7f8fa", white: "#ffffff", border: "#e2e6ea",
  borderSoft: "#f0f0f3", text: "#111827",
  textMuted: "#9ca3af", textSub: "#6b7280",
};

export const FONT = "Inter, sans-serif";