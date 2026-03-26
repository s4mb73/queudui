// ── Shared HTML stripper (used by all parsers) ────────────────────────────────
function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '-')
    .replace(/&nbsp;/g, ' ')
    .replace(/&pound;/gi, '£')
    .replace(/&euro;/gi, '€')
    .replace(/&bull;/gi, '·')
    .replace(/&middot;/gi, '·')
    .replace(/&#xA0;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/=C2=A3/g, '£')
    .replace(/=\r?\n/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isHtmlEmail(raw) {
  return /<html|<body|<table|<td/i.test(raw);
}

// ── Strip email down to just the useful lines for AI ─────────────────────────
export function stripEmailForAI(raw) {
  let body = raw;
  const contentStart = raw.search(/(?:From:|Subject:|<!doctype|<html)/im);
  if (contentStart > 0) body = raw.slice(contentStart);

  if (/<html|<body|<table/i.test(body)) {
    body = stripHtml(body);
  } else {
    body = body
      .replace(/=C2=A3/g, '£')
      .replace(/=\r?\n/g, '')
      .replace(/=20\s*/g, ' ')
      .replace(/&pound;/gi, '£')
      .replace(/&euro;/gi, '€')
      .replace(/&amp;/g, '&');
  }

  return body.split('\n').filter(l => {
    const t = l.trim();
    if (!t || t.length < 1) return false;
    if (/[£€$]\s*[\d,]+/.test(t)) return true;
    if (/seat|row|section|block|stand|area|venue|total|order|booking|confirm|ticket|restrict|standing|pitch|vip|admission/i.test(t)) return true;
    if (t.length > 300 && !/[A-Za-z\s]{10}/.test(t)) return false;
    if (/^\s*(?:padding|margin|font-size|background|border-radius|display|width|height|color|text-align)\s*:/i.test(t)) return false;
    if (/^\s*(?:@font|@media|\{|\}|\.)/.test(t)) return false;
    if (/^https?:\/\/\S{80,}$/.test(t)) return false;
    return true;
  }).join('\n').substring(0, 6000);
}

// ── Standing ticket detection ─────────────────────────────────────────────────
export function isStandingTicket(text) {
  return /\b(standing|pitch standing|rear pitch|front pitch|general admission|ga\b|lawn|infield|festival floor)\b/i.test(text || '');
}

// ── Site detection ────────────────────────────────────────────────────────────
export function detectSite(raw) {
  if (/liverpoolfc\.com|@fans\.emails\.liverpoolfc|Liverpool FC Booking Confirmation/i.test(raw)) return 'liverpool';
  if (/ticketmaster\.co\.uk|email\.ticketmaster\.co\.uk/i.test(raw)) return 'ticketmaster_uk';
  if (/ticketmaster\.com|email\.ticketmaster\.com/i.test(raw)) return 'ticketmaster_us';
  if (/weezevent\.com|@.*weezevent/i.test(raw)) return 'weezevent';
  if (/axs\.com|@axs\.com|AXS Tickets/i.test(raw)) return 'axs';
  if (/seetickets\.com|@seetickets/i.test(raw)) return 'seetickets';
  if (/eticketing\.co\.uk/i.test(raw)) return 'eticketing';
  if (/dice\.fm|@dice\.fm/i.test(raw)) return 'dice';
  return 'generic';
}

// ── Extract cost — shared helper ──────────────────────────────────────────────
// Handles £, €, $ with comma as thousands separator
function parseCurrencyAmount(str) {
  if (!str) return 0;
  // Handle European format: €1.770,00 or €1,770.00
  const euroComma = str.match(/([\d.]+),(\d{2})$/);
  if (euroComma) return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  return parseFloat(str.replace(/,/g, ''));
}

function extractCost(text) {
  const totalInclFee = text.match(/Total\s*\(?incl\.?\s*(?:fee[s]?|VAT)\)?[^\n£€$]*[£€$]\s*([\d.,]+)/i);
  if (totalInclFee) return parseCurrencyAmount(totalInclFee[1]);

  const totalInclVAT = text.match(/Total\s+incl\.?\s*VAT[^\n£€$]*[£€$]\s*([\d.,]+)/i);
  if (totalInclVAT) return parseCurrencyAmount(totalInclVAT[1]);

  // Match €1,947.00 or €1.947,00 patterns directly
  const eurTotal = text.match(/[€]\s*([\d.,]+)\s*(?:Sub-total|Total)/i);
  if (eurTotal) return parseCurrencyAmount(eurTotal[1]);

  const totalCharge = text.match(/Total\s+(?:Charge|Amount|Due)[^\n£€$]{0,20}[£€$]\s*([\d.,]+)/i);
  if (totalCharge) return parseCurrencyAmount(totalCharge[1]);

  const totalPaid = text.match(/Total\s+Paid[^\n£€$]{0,10}[£€$]\s*([\d.,]+)/i);
  if (totalPaid) return parseCurrencyAmount(totalPaid[1]);

  const orderTotal = text.match(/(?:Order|Grand|Booking)\s+Total[^\n£€$]{0,20}[£€$]\s*([\d.,]+)/i);
  if (orderTotal) return parseCurrencyAmount(orderTotal[1]);

  const amountPaid = text.match(/Amount\s+(?:Paid|Charged)[^\n£€$]{0,10}[£€$]\s*([\d.,]+)/i);
  if (amountPaid) return parseCurrencyAmount(amountPaid[1]);

  const amounts = [];
  for (const m of text.matchAll(/[£€$]\s*([\d.,]+)/g)) {
    const v = parseCurrencyAmount(m[1]);
    if (v >= 5 && v <= 50000) amounts.push(v);
  }
  return amounts.length > 0 ? Math.max(...amounts) : 0;
}

// ── Extract order ref — shared helper ─────────────────────────────────────────
function extractOrderRef(text) {
  const patterns = [
    /Order\s*[#№]\s*([A-Z0-9\-\/]{4,25})/i,
    /(?:Order|Booking|Confirmation|Reference)\s*(?:Number|No\.?|Ref\.?)[:\s]*([A-Z0-9\-\/]{4,25})/i,
    /(?:Ref|Booking)[:\s]+([A-Z0-9\-\/]{6,25})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim().substring(0, 25);
  }
  return '';
}

// ── Detect sport vs concert ───────────────────────────────────────────────────
function detectCategory(text) {
  return /\b(?:match|fixture|vs\.?|kick.?off|premier league|championship|fa cup|league cup|nfl|nba|mlb|nhl|ufc|boxing|cricket|rugby|tennis|golf)\b/i.test(text)
    ? 'Sport' : 'Concert';
}

// ── Liverpool FC parser ───────────────────────────────────────────────────────
export function parseLiverpoolEmail(raw) {
  const text = isHtmlEmail(raw) ? stripHtml(raw) : raw
    .replace(/=C2=A3/g, '£')
    .replace(/=\r?\n/g, '')
    .replace(/=20\s*/g, ' ');

  const opponentMatch = text.match(/Liverpool\s+v\s+([^\n\r\-]{3,40})/i);
  const dateLineMatch = text.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}\s+\w+\s+\d{4})/i);
  const opponent = opponentMatch ? opponentMatch[1].trim().replace(/\s+[-–].*$/, '').trim() : null;
  const event = opponent ? `Liverpool v ${opponent}`.substring(0, 60) : 'Liverpool FC';

  const date = dateLineMatch ? dateLineMatch[1].trim() : '';
  const koMatch = text.match(/KO[:\s]+(\d{1,2}:\d{2})/i);
  const time = koMatch ? koMatch[1] : '';
  const orderRef = extractOrderRef(text);
  const totalPaid = extractCost(text);

  const tickets = [];
  const blocks = text.split(/(?=\bStand:)/i);
  const splitBlocks = blocks.length > 1 ? blocks : text.split(/(?=\bArea:)/i);

  splitBlocks.forEach(block => {
    if (!/Area:|Row:|Seat:/i.test(block)) return;
    const standMatch = block.match(/Stand:\s*([^\n\r/]{3,60})/i);
    const areaMatch  = block.match(/Area:\s*([A-Z0-9]+)/i);
    const rowMatch   = block.match(/Row:\s*(\d+)/i);
    const seatMatch  = block.match(/Seat:\s*(\d+)/i);
    const priceMatches = [...block.matchAll(/£\s*([\d]+\.[\d]{2})/g)]
      .map(m => parseFloat(m[1])).filter(v => v >= 5 && v < 1000);
    const costPrice = priceMatches.length > 0 ? priceMatches[0] : 0;
    const restrictionMatch = block.match(/(Severely Restricted View|Restricted View|Restricted Side View|Partial View|Obstructed View|Limited View)/i);
    const row  = rowMatch  ? rowMatch[1].trim()  : '';
    const seat = seatMatch ? seatMatch[1].trim() : '';
    if (row || seat) {
      tickets.push({
        event, date, time,
        venue: 'Anfield Stadium, Liverpool',
        section:      areaMatch        ? areaMatch[1].trim()                       : '',
        row, seats: seat, qty: 1,
        costPrice:    costPrice > 0 ? costPrice : (totalPaid > 0 ? totalPaid : 0),
        orderRef,
        restrictions: restrictionMatch ? restrictionMatch[1].trim()                : '',
        notes:        standMatch       ? standMatch[1].trim().replace(/\s+/g, ' ') : '',
        isStanding: false, category: 'Sport', confidence: 'high',
      });
    }
  });

  if (tickets.length === 0) {
    const areaMatches = [...text.matchAll(/Area:\s*([A-Z0-9]+)\s*\/\s*Row:\s*(\d+)\s*\/\s*Seat:\s*(\d+)/gi)];
    const priceMatches = [...text.matchAll(/£\s*([\d]+\.[\d]{2})/g)]
      .map(m => parseFloat(m[1])).filter(v => v >= 5 && v < 1000);
    areaMatches.forEach((m, i) => {
      tickets.push({
        event, date, time, venue: 'Anfield Stadium, Liverpool',
        section: m[1].trim(), row: m[2].trim(), seats: m[3].trim(), qty: 1,
        costPrice: priceMatches[i] ?? (totalPaid > 0 ? totalPaid / Math.max(areaMatches.length, 1) : 0),
        orderRef, restrictions: '', isStanding: false, category: 'Sport', confidence: 'high',
      });
    });
  }

  if (tickets.length === 0) {
    tickets.push({
      event, date, time, venue: 'Anfield Stadium, Liverpool',
      section: '', row: '', seats: '', qty: 1, costPrice: totalPaid, orderRef,
      restrictions: '', isStanding: false, category: 'Sport', confidence: 'medium',
    });
  }

  if (tickets.length > 1) {
    const missingPrice = tickets.filter(t => t.costPrice === 0);
    if (missingPrice.length === tickets.length && totalPaid > 0) {
      const perSeat = parseFloat((totalPaid / tickets.length).toFixed(2));
      tickets.forEach(t => { t.costPrice = perSeat; });
    }
  }

  return tickets;
}

// ── Extract HTML part from multipart/alternative emails ──────────────────────
function extractHtmlPart(raw) {
  const htmlPartM = raw.match(/Content-Type:\s*text\/html[^\n]*\n(?:Content-Transfer-Encoding:[^\n]*\n)?\n([\s\S]+?)(?=\n--|\n--[^\n]+--\s*$|$)/i);
  if (htmlPartM) return htmlPartM[1];
  const htmlStartM = raw.match(/(<!DOCTYPE html[\s\S]+|<html[\s\S]+)/i);
  if (htmlStartM) return htmlStartM[1];
  return null;
}

// ── Extract named ticket type from TM Order Summary ───────────────────────────
function extractTicketTypeName(text) {
  const orderSummaryBlock = text.match(/Order\s+Summary[\s\S]{0,2000}?Payment\s+Summary/i);
  const searchIn = orderSummaryBlock ? orderSummaryBlock[0] : text;
  const namedTypeM = searchIn.match(
    /\b((?:VIP|Hospitality|Premium|Platinum|Gold|Silver|Bronze|Club|Executive|Lounge|Padded\s+Seat|Super\s+Pit|Track\s+Club)[^\n\r]{0,30}?(?:Ticket|Package|Admission|Access|Experience))\b/i
  );
  if (namedTypeM) return namedTypeM[1].replace(/\s+/g, ' ').trim().substring(0, 60);
  return null;
}

// ── Ticketmaster USA parser ───────────────────────────────────────────────────
// Handles: "You Got Tickets To EVENT" subject
// Date format: "Fri · Apr 03, 2026 · 7:00 PM"
// Seat format: "Sec&nbsp;543, Row&nbsp;21, Seat&nbsp;8 - 9"
// Total:       "Total:&nbsp; $340.30"
// Returns ARRAY of tickets (one per seat), currency USD
export function parseTicketmasterUSEmail(raw) {
  // ── Order ref ──────────────────────────────────────────────────────────────
  const orderM = raw.match(/Order\s*#\s*([A-Z0-9\-\/]+)/i);
  const orderRef = orderM ? orderM[1].trim() : '';

  // ── Event name (from Subject header) ──────────────────────────────────────
  const subjectM = raw.match(/^Subject:\s*(.+)$/im);
  const subject = subjectM ? subjectM[1].trim() : '';
  let event = '';
  const subjectEventM = subject.match(/^You Got Tickets To\s+(.+)$/i);
  if (subjectEventM) {
    event = subjectEventM[1].trim().substring(0, 80);
  }
  // Fallback: event name in bold semibold td
  if (!event) {
    const evFbM = raw.match(/font-size:\s*20px[^>]*600[^>]*>\s*\n?\s*([^\n<]{5,80})\s*\n?\s*<!--|font-size: 20px[^"]*"[^>]*>\s*([^\n<]{5,80}?)\s*(?:<!--|<)/i);
    if (evFbM) event = (evFbM[1] || evFbM[2] || '').trim().substring(0, 80);
  }

  // ── Date & time ────────────────────────────────────────────────────────────
  // Pattern in HTML td: "Fri · Apr 03, 2026 · 8:00 PM"
  let date = '', time = '';
  const dateHtmlM = raw.match(
    /width="300"[^>]*>\s*\n?\s*((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*[·•]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\s*[·•]\s*\d{1,2}:\d{2}\s*(?:AM|PM))/i
  );
  if (dateHtmlM) {
    const raw2 = dateHtmlM[1].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = raw2.split(/\s*[·•]\s*/);
    // [0]=dayName  [1]="Apr 03, 2026"  [2]="7:00 PM"
    if (parts.length >= 3) {
      date = parts[1].trim();
      time = parts[2].trim();
    } else if (parts.length === 2) {
      date = parts[0].trim();
      time = parts[1].trim();
    }
  }

  // ── Venue ──────────────────────────────────────────────────────────────────
  // "Yankee Stadium &mdash; Bronx, New York" in a td width="300"
  let venue = '';
  const venueHtmlM = raw.match(
    /width="300"[^>]*>\s*\n?\s*([A-Z][a-zA-Z0-9\s'\.]+(?:Stadium|Arena|Centre|Center|Theater|Theatre|Amphitheater|Field|Garden|Hall|Park|Forum|Center)[^<\n]*)/i
  );
  if (venueHtmlM) {
    venue = venueHtmlM[1]
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 80);
  }

  // ── Section / Row / Seats ──────────────────────────────────────────────────
  // "Sec&nbsp;218B, Row&nbsp;6, Seat&nbsp;5 - 8"
  let section = '', row = '', seats = '';
  const seatHtmlM = raw.match(
    /Sec&nbsp;([\w\d]+),\s*Row&nbsp;([\w\d]+),\s*Seat&nbsp;([\d\s\-–]+)/i
  );
  if (seatHtmlM) {
    section = seatHtmlM[1].trim();
    row = seatHtmlM[2].trim();
    const seatRaw = seatHtmlM[3].trim();
    const rangeM = seatRaw.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeM) {
      const lo = Math.min(parseInt(rangeM[1]), parseInt(rangeM[2]));
      const hi = Math.max(parseInt(rangeM[1]), parseInt(rangeM[2]));
      seats = Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)).join(', ');
    } else {
      seats = seatRaw;
    }
  }

  // Fallback: check stripped text for seated structure
  if (!section) {
    const htmlPart = extractHtmlPart(raw);
    const text = htmlPart ? stripHtml(htmlPart) : (isHtmlEmail(raw) ? stripHtml(raw) : raw);
    const inlineM = text.match(/Sec(?:tion)?\s*([\w\d]+)[,·\s]+Row\s*([\w\d]+)[,·\s]+Seat[s]?\s*([\d\s,\-–]+)/i);
    if (inlineM) {
      section = inlineM[1].trim();
      row = inlineM[2].trim();
      const seatRaw = inlineM[3].trim();
      const rangeM = seatRaw.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (rangeM) {
        const lo = Math.min(parseInt(rangeM[1]), parseInt(rangeM[2]));
        const hi = Math.max(parseInt(rangeM[1]), parseInt(rangeM[2]));
        seats = Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)).join(', ');
      } else {
        seats = seatRaw;
      }
    }
  }

  // ── Total cost (USD) ───────────────────────────────────────────────────────
  // "Total:&nbsp; $827.40"
  let costUSD = 0;
  const totalM = raw.match(/Total[:\s]*(?:&nbsp;|\s)*\$\s*([\d,]+\.?\d*)/i);
  if (totalM) costUSD = parseFloat(totalM[1].replace(/,/g, ''));

  // ── Derived ────────────────────────────────────────────────────────────────
  const seatList = seats
    ? seats.split(',').map(s => s.trim()).filter(Boolean)
    : [''];
  const qty = seatList.length || 1;
  const costPerTicket = qty > 0 ? parseFloat((costUSD / qty).toFixed(2)) : costUSD;
  const category = detectCategory(event + ' ' + venue);

  // Return one ticket object per seat (same as TM UK parser)
  return seatList.map(seat => ({
    event,
    date,
    time,
    venue,
    section,
    row,
    seats: seat,
    qty: 1,
    costPrice: costPerTicket,
    orderRef,
    restrictions: '',
    isStanding: false,
    category,
    buyingPlatform: 'Ticketmaster',
    originalCurrency: 'USD',
    originalAmount: costPerTicket,
    confidence: event ? 'high' : 'medium',
  }));
}

// ── Ticketmaster UK parser ────────────────────────────────────────────────────
// Returns ARRAY of tickets — one per seat
// Parses the well-known text/plain structure of TM UK confirmation emails:
//   You got the tickets / ORDER # / EVENT / date / venue / qty / seats / total
export function parseTicketmasterEmail(raw) {
  // ── Extract text/plain part if available, else strip HTML ────────────────
  let text = '';
  const plainPartM = raw.match(
    /Content-Type:\s*text\/plain[^\n]*\n(?:Content-Transfer-Encoding:[^\n]*\n)?\n([\s\S]+?)(?=\n--[^\n]|\n--[^\n]+--\s*$|$)/i
  );
  if (plainPartM) {
    text = plainPartM[1]
      .replace(/=C2=A3/g, '£')
      .replace(/=\r?\n/g, '')
      .replace(/=20\s*/g, ' ')
      .replace(/&pound;/gi, '£')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#xA0;/g, ' ')
      .trim();
  }
  if (!text) {
    const htmlPart = extractHtmlPart(raw);
    text = htmlPart ? stripHtml(htmlPart) : (isHtmlEmail(raw) ? stripHtml(raw) : raw);
  }

  // Normalise whitespace but preserve line breaks
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  const lines = text.split('\n').map(l => l.trim());

  // ── Order ref ──────────────────────────────────────────────────────────────
  const orderRef = extractOrderRef(text);

  // ── Event name ─────────────────────────────────────────────────────────────
  // Strategy 1: Find the event name line right after "You got the tickets" + ORDER #
  let event = '';
  const gotTicketsIdx = lines.findIndex(l => /you got the tickets/i.test(l));
  const orderLineIdx = lines.findIndex(l => /ORDER\s*#/i.test(l));
  if (gotTicketsIdx >= 0) {
    // The event name is the first non-empty line after the ORDER # line,
    // or after "You got the tickets" if ORDER # is on the same line
    const searchStart = orderLineIdx > gotTicketsIdx ? orderLineIdx + 1 : gotTicketsIdx + 1;
    for (let i = searchStart; i < Math.min(searchStart + 5, lines.length); i++) {
      const l = lines[i];
      if (!l) continue;
      if (/^ORDER\s*#/i.test(l)) continue;
      // Skip if it looks like a date line
      if (/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s/i.test(l)) break;
      event = l.substring(0, 80);
      break;
    }
  }
  // Strategy 2: Subject header fallback
  if (!event) {
    const subjectMatch = raw.match(/^Subject:\s*(.+)$/im);
    if (subjectMatch) {
      event = subjectMatch[1].trim()
        .replace(/^you're in!\s*your\s+/i, '')
        .replace(/^you're in!\s*/i, '')
        .replace(/^your\s+/i, '')
        .replace(/\s+tickets?\s+confirmation\s*$/i, '')
        .replace(/\s+ticket\s+confirmation\s*$/i, '')
        .replace(/\s+confirmation\s*$/i, '')
        .trim()
        .substring(0, 80);
    }
  }
  // Strategy 3: first all-caps line
  if (!event) {
    const capsMatch = text.match(/\n([A-Z][A-Z0-9\s:,&'\-!.]{8,80})\n/);
    if (capsMatch) event = capsMatch[1].trim().substring(0, 80);
  }

  // ── Date & time ────────────────────────────────────────────────────────────
  // Look for "Fri 03 Apr 2026 - 7:00 pm" style TM UK date line
  let date = '', time = '';
  const tmukDateM = text.match(
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+(\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})\s*[-–·]\s*(\d{1,2}:\d{2}\s*(?:am|pm))/i
  );
  if (tmukDateM) {
    date = tmukDateM[1].trim();
    time = tmukDateM[2].trim();
  } else {
    // Broader date match without time on same line
    const dateOnlyM = text.match(
      /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+(\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})/i
    );
    if (dateOnlyM) date = dateOnlyM[1].trim();
    // US-style fallback
    if (!date) {
      const usDateM = text.match(
        /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*[·•\-]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i
      );
      if (usDateM) date = usDateM[1].trim();
    }
    // Standalone time
    const timeOnlyM = text.match(/\b(\d{1,2}:\d{2}\s*(?:am|pm))\b/i);
    if (timeOnlyM) time = timeOnlyM[1].trim();
  }

  // ── Venue ──────────────────────────────────────────────────────────────────
  // In TM UK emails, the venue line sits right after the date line.
  // It typically looks like "O2 Academy Brixton, London" or "Herrington Country Park, Sunderland"
  let venue = '';
  const dateLineIdx = lines.findIndex(l =>
    /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s/i.test(l) &&
    /\d{4}/.test(l)
  );
  if (dateLineIdx >= 0) {
    // Venue is the next non-empty line after the date
    for (let i = dateLineIdx + 1; i < Math.min(dateLineIdx + 3, lines.length); i++) {
      const l = lines[i];
      if (!l) continue;
      // Skip if it looks like the qty line
      if (/^\d+\s*[x×]\s/i.test(l)) break;
      // Must contain a comma (venue, city) or a known venue keyword
      if (/,/.test(l) || /(?:Stadium|Arena|Ground|Park|Hall|Centre|Center|Dome|Theatre|Theater|Amphitheat|Field|Garden|Academy|Pavilion|Forum|Coliseum|Hippodrome|Apollo|Hydro|O2|SSE|OVO)/i.test(l)) {
        venue = l.replace(/\s+/g, ' ').trim().substring(0, 80);
        break;
      }
    }
  }
  // Fallback: keyword-based venue detection
  if (!venue) {
    const venueKeywordM = text.match(
      /([A-Z][a-zA-Z0-9\s']+(?:Stadium|Arena|Ground|Park|Hall|Centre|Center|Dome|Theatre|Theater|Amphitheater|Amphitheatre|Field|Garden|Country Park|Academy|Pavilion|Ballroom|Forum|Coliseum|Hippodrome|Apollo|Hydro))[,\s]*/i
    );
    if (venueKeywordM) {
      venue = venueKeywordM[0].replace(/\s*[—\-–]\s*.+$/, '').trim().substring(0, 80);
    } else {
      const venueCityM = text.match(/\n([A-Z][a-zA-Z\s]{3,40},\s*[A-Z][a-zA-Z\s]{2,30})\n/);
      if (venueCityM) venue = venueCityM[1].trim().substring(0, 80);
    }
  }

  const category = detectCategory(text);

  // ── Qty from "Nx Mobile Ticket" ────────────────────────────────────────────
  const mobileMatch = text.match(/(\d+)\s*[x×]\s*(?:Mobile\s*)?Ticket/i);
  let qty = mobileMatch ? parseInt(mobileMatch[1]) : 1;
  if (isNaN(qty) || qty < 1) qty = 1;
  if (qty > 100) qty = 100;

  // ── Total cost — always prefer "Total (incl. fee)" ─────────────────────────
  let totalCost = 0;
  const totalInclFeeM = text.match(
    /Total\s*\(?incl\.?\s*fee[s]?\)?[^£€$\n]*[£€$]\s*([\d,]+\.?\d*)/i
  );
  if (totalInclFeeM) {
    totalCost = parseFloat(totalInclFeeM[1].replace(/,/g, ''));
  } else {
    totalCost = extractCost(text);
  }

  // ── View restriction detection ─────────────────────────────────────────────
  const viewRestrictionM = text.match(
    /((?:Severely\s+)?Restricted(?:\s+Side)?\s+View|Limited\s+View|Partial\s+View|Obstructed\s+View)/i
  );
  const viewRestriction = viewRestrictionM
    ? viewRestrictionM[1].replace(/\s+/g, ' ').trim().substring(0, 60)
    : '';

  // ── Seated ticket detection ────────────────────────────────────────────────
  // Look for ALL "Section XXX Row YYY Seat ZZZ" blocks in the text.
  // TM UK uses: "Section BLK7 Row O Seat 35" (one per line, repeated per ticket)
  const tickets = [];

  function pushSeat(sec, rw, seatStr) {
    const rangeM = seatStr.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeM) {
      const lo = Math.min(parseInt(rangeM[1]), parseInt(rangeM[2]));
      const hi = Math.max(parseInt(rangeM[1]), parseInt(rangeM[2]));
      for (let s = lo; s <= hi; s++) tickets.push({ section: sec, row: rw, seats: String(s) });
    } else {
      // Could be comma-separated seats or a single seat
      const parts = seatStr.split(/[,\s]+/).filter(s => s.trim());
      if (parts.length > 0) {
        parts.forEach(s => tickets.push({ section: sec, row: rw, seats: s.trim() }));
      } else {
        tickets.push({ section: sec, row: rw, seats: seatStr.trim() });
      }
    }
  }

  // Pattern 1: Inline "Section BLK7 Row O Seat 35" (all on one line)
  let m;
  const inlineFullP = /(?:Sec(?:tion)?|Block|BLK)\s*([\w\d]+)[\s·•,]+Row\s*([\w\d]+)[\s·•,]+Seat[s]?\s*([\d\s,\-–]+)/gi;
  while ((m = inlineFullP.exec(text)) !== null) {
    pushSeat(m[1].trim(), m[2].trim(), m[3]);
  }

  // Pattern 2: Section + Seat without Row
  if (tickets.length === 0) {
    const inlineNoRowP = /(?:Sec(?:tion)?|Block|BLK)\s*([\w\d]+)[\s·•,]+Seat[s]?\s*([\d\s,\-–]+)/gi;
    while ((m = inlineNoRowP.exec(text)) !== null) {
      pushSeat(m[1].trim(), '', m[2]);
    }
  }

  // Pattern 3: Multi-line block format (Section on one line, Row on next, Seat on next)
  if (tickets.length === 0) {
    const blockP = /(?:Sec(?:tion)?|Block|BLK)\s*:?\s*[\r\n\s]*([\w\d]+)(?:[\s\S]*?Row\s*:?\s*[\r\n\s]*([\w\d]+))?[\s\S]*?Seat[s]?\s*:?\s*[\r\n\s]*([\d\s,\-\u2013]+)/gi;
    while ((m = blockP.exec(text)) !== null) {
      pushSeat(m[1].trim(), m[2]?.trim() ?? '', m[3]);
    }
  }

  // Pattern 4: Compact run-together format
  if (tickets.length === 0) {
    const compactP = /(?:Sec(?:tion)?|Block|BLK)\s*([\w\d]+)\s*(?:Row\s*([\w\d]+)\s*)?Seat[s]?\s*([\d\-–]+)/gi;
    while ((m = compactP.exec(text)) !== null) {
      pushSeat(m[1].trim(), m[2]?.trim() ?? '', m[3]);
    }
  }

  // ── If we found seated tickets, return one per seat ────────────────────────
  if (tickets.length > 0) {
    const costPerSeat = totalCost > 0
      ? parseFloat((totalCost / tickets.length).toFixed(2))
      : 0;
    return tickets.map(t => ({
      event, date, time, venue,
      section: t.section, row: t.row, seats: t.seats,
      qty: 1, costPrice: costPerSeat, orderRef,
      restrictions: viewRestriction, isStanding: false, category, confidence: 'high',
    }));
  }

  // ── Non-seated: VIP, Hospitality, Premium named types ──────────────────────
  const namedTicketType = extractTicketTypeName(text);

  if (namedTicketType) {
    const costPerTicket = qty > 0
      ? parseFloat((totalCost / qty).toFixed(2))
      : totalCost;
    return Array.from({ length: qty }, (_, i) => ({
      event, date, time, venue,
      section: namedTicketType, row: '', seats: String(i + 1),
      qty: 1, costPrice: costPerTicket, orderRef,
      restrictions: '', isStanding: false, category, confidence: 'high',
    }));
  }

  // ── GA / Standing detection ────────────────────────────────────────────────
  const gaLabelM = text.match(
    /(General\s+Admission[^\n\r]{0,40}|(?:Unreserved|Rear|Front|Pitch|Floor|Festival)\s+Standing[^\n\r]{0,20}|Standing\s+Only[^\n\r]{0,20})/i
  );
  const standing = !!gaLabelM || isStandingTicket(text.substring(0, 800));

  if (standing) {
    const sectionLabel = gaLabelM
      ? gaLabelM[1].replace(/\s+/g, ' ').trim().substring(0, 60)
      : 'General Admission';
    const costPerTicket = qty > 0
      ? parseFloat((totalCost / qty).toFixed(2))
      : totalCost;
    return Array.from({ length: qty }, (_, i) => ({
      event, date, time, venue,
      section: sectionLabel, row: '', seats: String(i + 1),
      qty: 1, costPrice: costPerTicket, orderRef,
      restrictions: sectionLabel, isStanding: true, category, confidence: 'high',
    }));
  }

  // ── Non-seated, non-standing: try to find ticket type from Order Summary ───
  // Between "Order Summary" and "Payment Summary", look for ticket type names
  const orderSummaryBlock = text.match(/Order\s+Summary([\s\S]{0,2000}?)Payment\s+Summary/i);
  let fallbackSection = '';
  if (orderSummaryBlock) {
    // Find non-empty lines in Order Summary that aren't the qty line
    const summaryLines = orderSummaryBlock[1].split('\n').map(l => l.trim()).filter(Boolean);
    for (const sl of summaryLines) {
      if (/^\d+\s*[x×]\s/i.test(sl)) continue;  // skip "2x Mobile Ticket"
      if (/^Order/i.test(sl)) continue;
      if (/^Payment/i.test(sl)) continue;
      if (sl.length >= 3 && sl.length <= 80) {
        fallbackSection = sl;
        break;
      }
    }
  }

  if (fallbackSection) {
    const costPerTicket = qty > 0
      ? parseFloat((totalCost / qty).toFixed(2))
      : totalCost;
    return Array.from({ length: qty }, (_, i) => ({
      event, date, time, venue,
      section: fallbackSection, row: '', seats: String(i + 1),
      qty: 1, costPrice: costPerTicket, orderRef,
      restrictions: '', isStanding: false, category, confidence: 'high',
    }));
  }

  // ── Final fallback ─────────────────────────────────────────────────────────
  const costPerTicket = qty > 0
    ? parseFloat((totalCost / qty).toFixed(2))
    : totalCost;
  return [{
    event, date, time, venue,
    section: '', row: '', seats: '',
    qty, costPrice: costPerTicket, orderRef,
    restrictions: totalCost > 500 ? 'Possible VIP/Hospitality — check manually' : '',
    isStanding: false, category,
    confidence: totalCost > 0 ? 'medium' : 'low',
  }];
}

// ── Generic parser ────────────────────────────────────────────────────────────
export function parseEmail(raw, site) {
  const detectedSite = site || detectSite(raw);
  if (detectedSite === 'liverpool')       return parseLiverpoolEmail(raw)[0];
  if (detectedSite === 'ticketmaster_uk') return parseTicketmasterEmail(raw)[0];
  if (detectedSite === 'ticketmaster_us') return parseTicketmasterUSEmail(raw)[0];

  const text = isHtmlEmail(raw) ? stripHtml(raw) : raw;
  const find = (patterns) => {
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return (m[1] ?? m[0])?.trim().replace(/\s+/g, ' ') ?? '';
    }
    return '';
  };

  const subjectMatch = raw.match(/^Subject:\s*(.+)$/im);
  const subject = subjectMatch ? subjectMatch[1].trim() : '';

  const trimmed = raw.trim();
  if (trimmed.length < 200 && trimmed.split('\n').length <= 3) {
    const event = trimmed
      .replace(/^(?:You Got Tickets?\s+To|Your Tickets?\s+For|Booking Confirmation[:\s\-—]*|Order Confirmed[:\s\-—]*)/i, '')
      .replace(/\s*[-—|]\s*Order.*$/i, '')
      .replace(/\s*[-—|]\s*\d.*$/, '')
      .trim().substring(0, 60);
    return { event, date: '', time: '', venue: '', section: '', row: '', seats: '', qty: 1, costPrice: 0, orderRef: '', category: detectCategory(trimmed), isStanding: false, confidence: event ? 'medium' : 'low' };
  }

  const event = find([
    /You're in!\s+Your\s+(.+?)\s+ticket confirmation/i,
    /You got the tickets[\s\S]{0,50}\n\s*([A-Z][A-Z\s:,]+)/,
    /You Got Tickets To\s+([^\n\r<]+)/i,
    /Subject:.*?(?:tickets?\s+to|tickets?\s+for)\s+([^\n\r]+)/i,
    /(?:event|show|concert|match|game|fixture)[:\s]+([^\n\r<]{3,60})/i,
    /(?:your tickets?\s+(?:for|to))[:\s]+([^\n\r<]{3,60})/i,
    /([A-Z][a-zA-Z\s]+ vs?\.? [A-Z][a-zA-Z\s]+)/,
    /tickets to\s+([^\n\r<]{3,60})/i,
  ]) || subject
      .replace(/^you're in!\s*/i, '')
      .replace(/^your\s+/i, '')
      .replace(/\s+tickets?\s+confirmation\s*$/i, '')
      .replace(/\s+confirmation\s*$/i, '')
      .replace(/^(?:you got tickets!?|booking confirmation[:\s-]*|order confirmed[:\s-]*)/i, '')
      .trim().substring(0, 60) || '';

  const dateRaw = find([
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*[·•\-]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
    /(?:date|when|on)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /\bDate:\s*(\d{1,2}\/\d{1,2}\/\d{4})\b/i,
  ]);
  const timeStr = find([
    /[·•]\s*(\d{1,2}:\d{2}\s*(?:AM|PM|pm|am))/i,
    /(?:doors?\s*opening|doors?|kick[- ]?off|start|gates?|showtime)[:\s]+(\d{1,2}[:.]\d{2}\s*(?:am|pm)?)/i,
    /\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b/,
    /\b(\d{1,2}:\d{2}\s*pm)\b/i,
  ]);
  const date = dateRaw
    ? (timeStr && !dateRaw.includes(timeStr) ? `${dateRaw} · ${timeStr}` : dateRaw)
    : '';

  const venueRaw = find([
    /([A-Z][a-zA-Z\s]+(?:Stadium|Arena|Ground|Park|Hall|Centre|Center|Theater|Theatre|Field|Dome|Bowl|Coliseum))\s*(?:,\s*[A-Za-z\s]+)?/i,
    /(?:venue|location|at)[:\s]+([^\n\r<,]{5,50})/i,
  ]);
  const venue = venueRaw
    ? venueRaw.split(',')[0].replace(/\s*[—\-–]\s*.+$/, '').trim().substring(0, 50)
    : '';

  let qty = 1;
  const mobileMatch2       = text.match(/(\d+)\s*x\s*(?:Mobile\s*)?Ticket/i);
  const qtyMatch           = text.match(/(?:qty|quantity)[:\s]+(\d+)/i);
  const seatRangeMatch2    = text.match(/Seat[s]?\s*(\d+)\s*[-–]\s*(\d+)/i);
  const ticketsCountMatch  = text.match(/(\d+)\s*(?:x\s*)?(?:adult\s|general\s|standing\s|seated\s)?tickets?\b/i);
  if (mobileMatch2)         qty = parseInt(mobileMatch2[1]);
  else if (qtyMatch)        qty = parseInt(qtyMatch[1]);
  else if (seatRangeMatch2) qty = Math.abs(parseInt(seatRangeMatch2[2]) - parseInt(seatRangeMatch2[1])) + 1;
  else if (ticketsCountMatch) qty = parseInt(ticketsCountMatch[1]);
  if (isNaN(qty) || qty < 1) qty = 1;
  if (qty > 100) qty = 100;

  let section = '', row = '', seats = '';
  // Try structured section/row/seat patterns
  const secRowSeatMatch = text.match(/(?:Sec(?:tion)?|Sector|Block|BLK)\s*([\w\d]+)[,·\s]+Row[:\s]*([\w\d]+)[,·\s]+Seat[s]?[:\s]*([\d\s,\-–]+)/i);
  if (secRowSeatMatch) {
    section = secRowSeatMatch[1].trim();
    row     = secRowSeatMatch[2].trim();
    seats   = secRowSeatMatch[3].trim();
  } else {
    // Weezevent-style: "Sector 122" on its own line + "Row: 18" + "Seat: 21"
    const sectorMatch = text.match(/(?:Sec(?:tion)?|Sector|Block|BLK|Area)[:\s]+(?:.*?[-–]\s*)?(?:Sector|Sec(?:tion)?|Block|BLK)?\s*([\w\d]+)/i);
    const secMatch = sectorMatch || text.match(/(?:Sec(?:tion)?|Block|BLK)[:\s]+([\w\d]+)/i);
    if (secMatch) section = secMatch[1].trim();
    const rowMatch = text.match(/\bRow\s+([\w\d]{1,4})\b/i);
    if (rowMatch) row = rowMatch[1].trim();
    if (seatRangeMatch2) {
      const lo = Math.min(parseInt(seatRangeMatch2[1]), parseInt(seatRangeMatch2[2]));
      const hi = Math.max(parseInt(seatRangeMatch2[1]), parseInt(seatRangeMatch2[2]));
      seats = Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)).join(', ');
    } else {
      const seatListMatch = text.match(/Seat[s]?\s*([\d]+(?:\s*,\s*[\d]+)+)/i);
      if (seatListMatch) seats = seatListMatch[1].trim();
      else {
        const singleSeatMatch = text.match(/\bSeat\s+(\d+)\b/i);
        if (singleSeatMatch) seats = singleSeatMatch[1].trim();
      }
    }
  }

  const ticketTypeMatch = text.match(/(?:Album Pre-Order Pre-Sale\s*-?\s*)?([^\n\r]{5,60}(?:Standing|Pitch|Floor|General Admission|GA|Lawn|Infield|Festival)[^\n\r]{0,40})/i);
  const ticketType = ticketTypeMatch ? ticketTypeMatch[1].trim() : '';
  const standing   = isStandingTicket(ticketType) || (isStandingTicket(text.substring(0, 500)) && !section && !row);
  if (standing) { section = ''; row = ''; seats = ''; }

  const costPrice = extractCost(text);
  const orderRef  = extractOrderRef(text);

  // Detect original currency from the email
  const hasCurrencyEUR = /[€]|EUR\s*\d/i.test(text);
  const hasCurrencyUSD = /\$\d|USD\s*\d/i.test(text) && !/CA\$|A\$/i.test(text);
  const originalCurrency = hasCurrencyEUR ? 'EUR' : hasCurrencyUSD ? 'USD' : 'GBP';

  let restrictions = ticketType
    .replace(/^Album Pre-Order Pre-Sale\s*[-–]\s*/i, '')
    .replace(/^Pre-Sale\s*[-–]\s*/i, '')
    .trim().substring(0, 80);
  if (!restrictions) {
    restrictions = find([
      /(?:restricted|limited|obstructed|side view|rear|hospitality|vip|accessible|wheelchair|partial view)[^\n\r<]{0,60}/i,
    ])?.trim().substring(0, 80) ?? '';
  }

  return {
    event:       event?.substring(0, 60).replace(/\s+/g, ' ').trim() ?? '',
    date:        date?.trim() ?? '',
    time:        timeStr ?? '',
    venue, section, row, seats, qty, costPrice, orderRef, restrictions,
    isStanding:  standing,
    category:    detectCategory(text),
    originalCurrency,
    originalAmount: costPrice,
    confidence:  (event && (date || venue)) ? 'high' : event ? 'medium' : 'low',
  };
}