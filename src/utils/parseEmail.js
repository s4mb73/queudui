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
  if (/axs\.com|@axs\.com|AXS Tickets/i.test(raw)) return 'axs';
  if (/seetickets\.com|@seetickets/i.test(raw)) return 'seetickets';
  if (/eticketing\.co\.uk/i.test(raw)) return 'eticketing';
  return 'generic';
}

// ── Extract cost — shared helper ──────────────────────────────────────────────
function extractCost(text) {
  const totalInclFee = text.match(/Total\s*\(incl\.?\s*fee[s]?\)[^\n£€$]*[£€$]\s*([\d,]+\.?\d*)/i);
  if (totalInclFee) return parseFloat(totalInclFee[1].replace(/,/g, ''));

  const totalCharge = text.match(/Total\s+(?:Charge|Amount|Due)[^\n£€$]{0,20}[£€$]\s*([\d,]+\.?\d*)/i);
  if (totalCharge) return parseFloat(totalCharge[1].replace(/,/g, ''));

  const totalPaid = text.match(/Total\s+Paid[^\n£€$]{0,10}[£€$]\s*([\d,]+\.?\d*)/i);
  if (totalPaid) return parseFloat(totalPaid[1].replace(/,/g, ''));

  const orderTotal = text.match(/(?:Order|Grand|Booking)\s+Total[^\n£€$]{0,20}[£€$]\s*([\d,]+\.?\d*)/i);
  if (orderTotal) return parseFloat(orderTotal[1].replace(/,/g, ''));

  const amountPaid = text.match(/Amount\s+(?:Paid|Charged)[^\n£€$]{0,10}[£€$]\s*([\d,]+\.?\d*)/i);
  if (amountPaid) return parseFloat(amountPaid[1].replace(/,/g, ''));

  const amounts = [];
  for (const m of text.matchAll(/[£€$]\s*([\d,]+\.?\d*)/g)) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (v >= 5 && v <= 5000) amounts.push(v);
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
export function parseTicketmasterEmail(raw) {
  const htmlPart = extractHtmlPart(raw);
  const text = htmlPart ? stripHtml(htmlPart) : (isHtmlEmail(raw) ? stripHtml(raw) : raw);

  // ── Event name ─────────────────────────────────────────────────────────────
  const subjectMatch = raw.match(/^Subject:\s*(.+)$/im);
  const subject = subjectMatch ? subjectMatch[1].trim() : '';

  function cleanTMSubject(s) {
    return s
      .replace(/^you're in!\s*/i, '')
      .replace(/^your\s+/i, '')
      .replace(/\s+tickets?\s+confirmation\s*$/i, '')
      .replace(/\s+confirmation\s*$/i, '')
      .trim()
      .substring(0, 60);
  }

  let event = subject ? cleanTMSubject(subject) : '';
  if (!event) {
    const capsMatch = text.match(/\n([A-Z][A-Z0-9\s:,&'\-!.]{8,60})\n/);
    if (capsMatch) event = capsMatch[1].trim().substring(0, 60);
  }

  // ── Date & time ────────────────────────────────────────────────────────────
  const ukDateTimeM = text.match(
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})(?:[^a-z0-9]*(\d{1,2}:\d{2}\s*(?:am|pm)))?/i
  );
  const usDateM = text.match(
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*[·•\-]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i
  );
  const timeOnlyM = text.match(/\b(\d{1,2}:\d{2}\s*(?:am|pm))\b/i);

  let date = '', time = '';
  if (ukDateTimeM) {
    date = ukDateTimeM[1].trim();
    time = ukDateTimeM[2]?.trim() || timeOnlyM?.[1]?.trim() || '';
  } else if (usDateM) {
    date = usDateM[1].trim();
    time = timeOnlyM?.[1]?.trim() || '';
  }

  // ── Venue ──────────────────────────────────────────────────────────────────
  const venueKeywordM = text.match(
    /([A-Z][a-zA-Z0-9\s]+(?:Stadium|Arena|Ground|Park|Hall|Centre|Center|Dome|Theatre|Theater|Amphitheater|Field|Garden|Country Park))[,\s]*/i
  );
  const venueCityM = !venueKeywordM && text.match(
    /\n([A-Z][a-zA-Z\s]{3,40},\s*[A-Z][a-zA-Z\s]{2,30})\n/
  );

  let venue = '';
  if (venueKeywordM) {
    venue = venueKeywordM[0].replace(/\s*[—\-–]\s*.+$/, '').trim().substring(0, 60);
  } else if (venueCityM) {
    venue = venueCityM[1].trim().substring(0, 60);
  }

  const orderRef = extractOrderRef(text);
  const category = detectCategory(text);

  // ── Qty ────────────────────────────────────────────────────────────────────
  const mobileMatch = text.match(/(\d+)\s*[x×]\s*(?:Mobile\s*)?Ticket/i);
  let qty = mobileMatch ? parseInt(mobileMatch[1]) : 1;
  if (isNaN(qty) || qty < 1) qty = 1;

  // ── Cost ───────────────────────────────────────────────────────────────────
  const perTicketM = text.match(/[£$€]([\d,]+\.?\d*)\s*[x×]\s*(\d+)/i)
    || text.match(/(\d+)\s*[x×]\s*[£$€]([\d,]+\.?\d*)/i);
  let totalCost = 0;
  let costPerTicket = 0;
  if (perTicketM) {
    const g1 = parseFloat((perTicketM[1] || '').replace(/,/g, ''));
    const g2 = parseFloat((perTicketM[2] || '').replace(/,/g, ''));
    if (g1 > g2) {
      costPerTicket = g1;
      if (qty === 1) qty = Math.round(g2) || 1;
    } else {
      costPerTicket = g2;
      if (qty === 1) qty = Math.round(g1) || 1;
    }
    totalCost = costPerTicket * qty;
  } else {
    totalCost = extractCost(text);
    costPerTicket = qty > 0 ? parseFloat((totalCost / qty).toFixed(2)) : totalCost;
  }

  // ── Seated structure check ─────────────────────────────────────────────────
  const hasSeatStructure = /(?:Sec(?:tion)?|Block)\s*\d+|Row\s*\d+|\bSeat[s]?\s*\d+/i.test(text);

  // ── Named ticket type — VIP, Hospitality, Premium, etc. ───────────────────
  const namedTicketType = !hasSeatStructure ? extractTicketTypeName(text) : null;

  if (namedTicketType) {
    return Array.from({ length: qty }, (_, i) => ({
      event, date, time, venue,
      section: namedTicketType, row: '', seats: String(i + 1),
      qty: 1, costPrice: costPerTicket, orderRef,
      restrictions: '',
      isStanding: false, category, confidence: 'high',
    }));
  }

  // ── GA / Standing detection ────────────────────────────────────────────────
  const gaLabelM = text.match(
    /(General\s+Admission[^\n\r]{0,40}|(?:Unreserved|Rear|Front|Pitch|Floor|Festival)\s+Standing[^\n\r]{0,20}|Standing\s+Only[^\n\r]{0,20})/i
  );
  const isStanding = !hasSeatStructure && (
    !!gaLabelM || isStandingTicket(text.substring(0, 500))
  );

  if (isStanding) {
    const sectionLabel = gaLabelM
      ? gaLabelM[1].replace(/\s+/g, ' ').trim().substring(0, 60)
      : 'General Admission';

    return Array.from({ length: qty }, (_, i) => ({
      event, date, time, venue,
      section: sectionLabel, row: '', seats: String(i + 1),
      qty: 1, costPrice: costPerTicket, orderRef,
      restrictions: sectionLabel,
      isStanding: true, category, confidence: 'high',
    }));
  }

  // ── Seated — find all Sec/Row/Seat blocks ──────────────────────────────────
  const tickets = [];

  function pushSeats(sec, row, seatStr) {
    const rangeM = seatStr.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeM) {
      const lo = Math.min(parseInt(rangeM[1]), parseInt(rangeM[2]));
      const hi = Math.max(parseInt(rangeM[1]), parseInt(rangeM[2]));
      for (let s = lo; s <= hi; s++) tickets.push({ section: sec, row, seats: String(s) });
    } else {
      seatStr.split(/[,\s]+/).filter(s => /^\d+$/.test(s.trim()))
        .forEach(s => tickets.push({ section: sec, row, seats: s.trim() }));
    }
  }

  let m;
  const inlineWithRow    = /Sec(?:tion)?\s*(\d+)[\s·•,]+Row\s*(\d+)[\s·•,]+Seat[s]?\s*([\d\s,\-–]+)/gi;
  const inlineWithoutRow = /Sec(?:tion)?\s*(\d+)[\s·•,]+Seat[s]?\s*([\d\s,\-–]+)/gi;

  while ((m = inlineWithRow.exec(text)) !== null) pushSeats(m[1].trim(), m[2].trim(), m[3]);
  if (tickets.length === 0) {
    while ((m = inlineWithoutRow.exec(text)) !== null) pushSeats(m[1].trim(), '', m[2]);
  }
  if (tickets.length === 0) {
    const blockPat = /(?:Sec(?:tion)?|Block)\s*:?\s*[\r\n\s]*(\d+)(?:[\s\S]*?Row\s*:?\s*[\r\n\s]*(\d+))?[\s\S]*?Seat[s]?\s*:?\s*[\r\n\s]*([\d\s,\-\u2013]+)/gi;
    while ((m = blockPat.exec(text)) !== null) pushSeats(m[1].trim(), m[2]?.trim() ?? '', m[3]);
  }
  if (tickets.length === 0) {
    const runTogether = /Sec(?:tion)?\s*(\d+)\s*(?:Row\s*(\d+)\s*)?Seat[s]?\s*([\d\-–]+)/gi;
    while ((m = runTogether.exec(text)) !== null) pushSeats(m[1].trim(), m[2]?.trim() ?? '', m[3]);
  }

  if (tickets.length > 0) {
    const costPerSeat = parseFloat((totalCost / tickets.length).toFixed(2));
    const ticketLabelMatch = text.match(/((?:Severely\s+)?Restricted(?:\s+Side)?\s+View(?:\s+\w+){0,4}|Limited\s+View(?:\s+\w+){0,3}|Partial\s+View(?:\s+\w+){0,3}|Obstructed\s+View(?:\s+\w+){0,3})/i);
    const viewRestriction = ticketLabelMatch
      ? ticketLabelMatch[1].replace(/\s*(?:Aisle\s*)?Seated\s*Ticket\s*$/i, '').replace(/\s*Ticket\s*$/i, '').trim().substring(0, 60)
      : '';
    return tickets.map(t => ({
      event, date, time, venue,
      section: t.section, row: t.row, seats: t.seats,
      qty: 1, costPrice: costPerSeat, orderRef,
      restrictions: viewRestriction, isStanding: false, category, confidence: 'high',
    }));
  }

  // Fallback
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
  ]);
  const timeStr = find([
    /[·•]\s*(\d{1,2}:\d{2}\s*(?:AM|PM|pm|am))/i,
    /(?:doors?|kick[- ]?off|start|gates?|showtime)[:\s]+(\d{1,2}[:.]\d{2}\s*(?:am|pm)?)/i,
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
  const secRowSeatMatch = text.match(/Sec(?:tion)?\s*([\w\d]+)[,·\s]+Row\s*([\w\d]+)[,·\s]+Seat[s]?\s*([\d\s,\-–]+)/i);
  if (secRowSeatMatch) {
    section = secRowSeatMatch[1].trim();
    row     = secRowSeatMatch[2].trim();
    seats   = secRowSeatMatch[3].trim();
  } else {
    const secMatch = text.match(/(?:Sec(?:tion)?|Block)[:\s]+([\w\d]+)/i);
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
    confidence:  (event && (date || venue)) ? 'high' : event ? 'medium' : 'low',
  };
}