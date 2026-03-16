export function stripEmailForAI(raw) {
  let body = raw;
  const contentStart = raw.search(/(?:From:|Subject:|<!doctype|<html)/im);
  if (contentStart > 0) body = raw.slice(contentStart);
  if (/<html|<body|<table/i.test(body)) {
    body = body
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/tr>/gi, '\n').replace(/<\/td>/gi, ' ').replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&mdash;/g, '—').replace(/&nbsp;/g, ' ')
      .replace(/&pound;/gi, '£').replace(/&euro;/gi, '€').replace(/&[a-z]+;/gi, ' ')
      .replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  return body.split('\n').filter(l => {
    const t = l.trim();
    if (!t) return false;
    if (t.length > 300 && !/[A-Za-z\s]{10}/.test(t)) return false;
    if (/^\s*(\.|\{|\}|@font|@media|padding:|margin:|font-size:|background:|border:|color:)/.test(t)) return false;
    return true;
  }).join('\n').substring(0, 6000);
}

export function isStandingTicket(text) {
  return /\b(standing|pitch|floor|general admission|ga\b|lawn|infield|festival|rear pitch|front pitch)/i.test(text || '');
}

// ── Detect which site sent the email ────────────────────────────────────────
export function detectSite(raw) {
  if (/liverpoolfc\.com|@fans\.emails\.liverpoolfc|Liverpool FC Booking Confirmation/i.test(raw)) return 'liverpool';
  if (/ticketmaster\.co\.uk|email\.ticketmaster/i.test(raw)) return 'ticketmaster_uk';
  if (/ticketmaster\.com/i.test(raw)) return 'ticketmaster_us';
  return 'generic';
}

// ── Liverpool FC parser ──────────────────────────────────────────────────────
// Returns an ARRAY of tickets (one per supporter/seat in the email)
export function parseLiverpoolEmail(raw) {
  const stripHtml = (html) => html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/tr>/gi, '\n').replace(/<\/td>/gi, ' ').replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&pound;/gi, '£')
    .replace(/&#xA0;/g, ' ').replace(/&#\d+;/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .replace(/=C2=A3/g, '£').replace(/=\r?\n/g, '') // decode quoted-printable
    .replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  const isHtml = /<html|<body|<table/i.test(raw);
  const text = isHtml ? stripHtml(raw) : raw
    .replace(/=C2=A3/g, '£')
    .replace(/=\r?\n/g, '')
    .replace(/=20\s*/g, ' ');

  // Event: "Liverpool v West Ham United - Sat 28 Feb 2026 KO: 15:00"
  const eventMatch = text.match(/Liverpool\s+v\s+[^\n\r\-]{3,40}\s*[-–]\s*((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^\n\r]{5,40})/i);
  const event = eventMatch
    ? ('Liverpool v ' + text.match(/Liverpool\s+v\s+([^\n\r\-]{3,40})/i)?.[1]?.trim() + ' - ' + eventMatch[1].trim()).substring(0, 60)
    : 'Liverpool FC';

  // Date & KO time from event line
  const dateMatch = text.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}\s+\w+\s+\d{4})/i);
  const koMatch = text.match(/KO[:\s]+(\d{1,2}:\d{2})/i);
  const date = dateMatch ? dateMatch[1].trim() : '';
  const time = koMatch ? koMatch[1] : '';

  // Total paid
  const totalMatch = text.match(/Total Paid[:\s]*£([\d.]+)/i);
  const totalPaid = totalMatch ? parseFloat(totalMatch[1]) : 0;

  // Parse each ticket block — LFC format:
  // Stand: Sir Kenny Dalglish Stand Lower Tier
  // Area: KP / Row: 12 / Seat: 244
  // Severely Restricted View (optional)
  // £52.00 Adult
  const tickets = [];

  // Split by "Stand:" occurrences to get individual ticket blocks
  const blocks = text.split(/(?=\bStand:)/i);
  // Also try splitting by "Area:" if Stand: not present
  const splitBlocks = blocks.length > 1 ? blocks : text.split(/(?=\bArea:)/i);

  splitBlocks.forEach(block => {
    if (!/Area:|Row:|Seat:/i.test(block)) return;

    const standMatch = block.match(/Stand:\s*([^\n\r/]{3,60})/i);
    const areaMatch = block.match(/Area:\s*([A-Z0-9]+)/i);
    const rowMatch = block.match(/Row:\s*(\d+)/i);
    const seatMatch = block.match(/Seat:\s*(\d+)/i);
    const priceMatch = block.match(/£([\d.]+)/);
    const restrictionMatch = block.match(/(Severely Restricted View|Restricted View|Restricted Side View|Partial View|Obstructed View)/i);

    const section = areaMatch ? areaMatch[1].trim() : '';
    const row = rowMatch ? rowMatch[1].trim() : '';
    const seat = seatMatch ? seatMatch[1].trim() : '';
    const costPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
    const restrictions = restrictionMatch ? restrictionMatch[1].trim() : '';
    const stand = standMatch ? standMatch[1].trim().replace(/\s+/g, ' ') : '';

    if (row || seat) {
      tickets.push({
        event,
        date,
        time,
        venue: 'Anfield Stadium, Liverpool',
        section,
        row,
        seats: seat,
        qty: 1,
        costPrice,
        orderRef: '',
        restrictions,
        notes: stand,
        isStanding: false,
        category: 'Sport',
        confidence: 'high',
      });
    }
  });

  // If we got nothing from block parsing, try flat regex
  if (tickets.length === 0) {
    const areaMatches = [...text.matchAll(/Area:\s*([A-Z0-9]+)\s*\/\s*Row:\s*(\d+)\s*\/\s*Seat:\s*(\d+)/gi)];
    const priceMatches = [...text.matchAll(/£([\d.]+)/g)].map(m => parseFloat(m[1])).filter(v => v > 5 && v < 500);

    areaMatches.forEach((m, i) => {
      tickets.push({
        event, date, time,
        venue: 'Anfield Stadium, Liverpool',
        section: m[1].trim(),
        row: m[2].trim(),
        seats: m[3].trim(),
        qty: 1,
        costPrice: priceMatches[i] || (totalPaid / Math.max(areaMatches.length, 1)),
        orderRef: '',
        restrictions: '',
        isStanding: false,
        category: 'Sport',
        confidence: 'high',
      });
    });
  }

  // Fallback: single ticket with total
  if (tickets.length === 0) {
    tickets.push({
      event, date, time,
      venue: 'Anfield Stadium, Liverpool',
      section: '', row: '', seats: '',
      qty: 1,
      costPrice: totalPaid,
      orderRef: '',
      restrictions: '',
      isStanding: false,
      category: 'Sport',
      confidence: 'medium',
    });
  }

  return tickets;
}


// ── Ticketmaster UK parser ───────────────────────────────────────────────────
// Returns ARRAY of tickets — one per seat block found in email
export function parseTicketmasterEmail(raw) {
  const stripHtml = (html) => html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/tr>/gi, '\n').replace(/<\/td>/gi, ' ').replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&pound;/gi, '£')
    .replace(/&bull;/gi, '·').replace(/&mdash;/g, '—').replace(/&#\d+;/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  const isHtml = /<html|<body|<table|<td/i.test(raw);
  const text = isHtml ? stripHtml(raw) : raw;

  // ── Event name ──
  const subjectMatch = raw.match(/^Subject:\s*(.+)$/im);
  const subject = subjectMatch ? subjectMatch[1].trim() : '';
  let event = subject
    .replace(/^you're in!\s+your\s+/i, '')
    .replace(/\s+ticket confirmation\s*$/i, '')
    .trim().substring(0, 60);
  if (!event) {
    const bodyEventMatch = text.match(/HARRY STYLES[^\n\r]{0,50}|([A-Z][A-Z\s:,&]{8,50}(?:TOGETHER|TOUR|STADIUM|ARENA))/);
    if (bodyEventMatch) event = (bodyEventMatch[0] || bodyEventMatch[1] || '').trim().substring(0, 60);
  }

  // ── Date/time ──
  const dateMatch = text.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i);
  const timeMatch = text.match(/\b(\d{1,2}:\d{2}\s*(?:am|pm))\b/i);
  const date = dateMatch ? dateMatch[1].trim() : '';
  const time = timeMatch ? timeMatch[1].trim() : '';

  // ── Venue ──
  const venueMatch = text.match(/([A-Z][a-zA-Z\s]+(?:Stadium|Arena|Ground|Park|Hall|Centre|Center|Dome))\s*(?:,\s*[A-Za-z]+)?/i);
  const venue = venueMatch ? venueMatch[0].replace(/\s*[—\-–]\s*.+$/, '').trim().substring(0, 50) : '';

  // ── Order ref ──
  const orderRefMatch = text.match(/Order\s*#\s*([A-Z0-9\-\/]+)/i);
  const orderRef = orderRefMatch ? orderRefMatch[1].substring(0, 25) : '';

  // ── Total cost ──
  const totalMatch = text.match(/Total\s*\(incl\.?\s*fee\)[^\n£$]*[£$]\s*([\d,]+\.?\d*)/i);
  const totalCost = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0;

  // ── Detect standing ──
  const standingMatch = text.match(/(?:Album Pre-Order Pre-Sale\s*-\s*)?([^\n\r]{3,60}(?:Rear Pitch Standing|Front Pitch Standing|Pitch Standing|General Standing|Standing)[^\n\r]{0,40})/i);
  const isStanding = !!standingMatch || isStandingTicket(text.substring(0, 1000));

  if (isStanding) {
    const mobileMatch = text.match(/(\d+)\s*x\s*(?:Mobile\s*)?Ticket/i);
    const qty = mobileMatch ? parseInt(mobileMatch[1]) : 1;
    const restrictions = standingMatch
      ? standingMatch[1].replace(/^Album Pre-Order Pre-Sale\s*[-–]\s*/i, '').trim().substring(0, 80)
      : 'Standing Ticket';
    return [{
      event, date, time, venue, section: '', row: '', seats: '',
      qty, costPrice: totalCost, orderRef, restrictions,
      isStanding: true, category: 'Concert', confidence: 'high',
    }];
  }

  // ── Seated: find all Sec/Row/Seat blocks ──
  // Ticketmaster body has pattern: "Sec 519 · Row 30 · Seats 185–186" or "Section 519 Row 30 Seat 185"
  const tickets = [];

  // Try "Sec X · Row Y · Seats A-B" or "Sec X · Row Y · Seat N" inline format
  const inlinePattern = /Sec(?:tion)?\s*(\d+)[\s·,]+Row\s*(\d+)[\s·,]+Seat[s]?\s*([\d\s,\-–]+)/gi;
  let m;
  while ((m = inlinePattern.exec(text)) !== null) {
    const sec = m[1].trim();
    const row = m[2].trim();
    const seatStr = m[3].trim();
    // Parse seat range or list
    const rangeM = seatStr.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeM) {
      const lo = Math.min(parseInt(rangeM[1]), parseInt(rangeM[2]));
      const hi = Math.max(parseInt(rangeM[1]), parseInt(rangeM[2]));
      for (let s = lo; s <= hi; s++) {
        tickets.push({ section: sec, row, seats: String(s) });
      }
    } else {
      const seatNums = seatStr.split(/[,\s]+/).filter(s => /^\d+$/.test(s.trim()));
      seatNums.forEach(s => tickets.push({ section: sec, row, seats: s.trim() }));
    }
  }

  // If no inline pattern found, try block-style (each ticket on its own lines)
  if (tickets.length === 0) {
    // Match: "Section: 519\nRow: 30\nSeat: 185"
    const blocks = text.split(/(?=Section:|Sec:|Block:)/i);
    blocks.forEach(block => {
      const secM = block.match(/(?:Sec(?:tion)?|Block)[:\s]+(\d+)/i);
      const rowM = block.match(/Row[:\s]+(\d+)/i);
      const seatM = block.match(/Seat[s]?[:\s]+([\d,\-–\s]+)/i);
      if (secM && (rowM || seatM)) {
        const seatStr = seatM ? seatM[1].trim() : '';
        const rangeM2 = seatStr.match(/^(\d+)\s*[-–]\s*(\d+)$/);
        if (rangeM2) {
          const lo = Math.min(parseInt(rangeM2[1]), parseInt(rangeM2[2]));
          const hi = Math.max(parseInt(rangeM2[1]), parseInt(rangeM2[2]));
          for (let s = lo; s <= hi; s++) tickets.push({ section: secM[1], row: rowM ? rowM[1] : '', seats: String(s) });
        } else {
          const nums = seatStr.split(/[,\s]+/).filter(s => /^\d+$/.test(s.trim()));
          if (nums.length > 0) nums.forEach(s => tickets.push({ section: secM[1], row: rowM ? rowM[1] : '', seats: s.trim() }));
          else tickets.push({ section: secM[1], row: rowM ? rowM[1] : '', seats: seatStr });
        }
      }
    });
  }

  // Distribute cost evenly across seats
  const costPerSeat = tickets.length > 0 ? parseFloat((totalCost / tickets.length).toFixed(2)) : totalCost;

  if (tickets.length > 0) {
    return tickets.map(t => ({
      event, date, time, venue,
      section: t.section, row: t.row, seats: t.seats,
      qty: 1, costPrice: costPerSeat, orderRef,
      restrictions: '', isStanding: false, category: 'Concert', confidence: 'high',
    }));
  }

  // Fallback: single record
  return [{
    event, date, time, venue,
    section: '', row: '', seats: '',
    qty: 1, costPrice: totalCost, orderRef,
    restrictions: '', isStanding: false, category: 'Concert', confidence: 'medium',
  }];
}

// ── Generic / Ticketmaster parser ────────────────────────────────────────────
export function parseEmail(raw, site) {
  // Route to site-specific parser if known
  const detectedSite = site || detectSite(raw);
  if (detectedSite === 'liverpool') {
    // Return first ticket for single-ticket flow; bulk uses parseLiverpoolEmail
    return parseLiverpoolEmail(raw)[0];
  }

  const stripHtml = (html) => html
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/tr>/gi, '\n').replace(/<\/td>/gi, ' ').replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&mdash;/g, '—').replace(/&ndash;/g, '-')
    .replace(/&nbsp;/g, ' ').replace(/&pound;/gi, '£').replace(/&euro;/gi, '€').replace(/&#\d+;/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  const trimmed = raw.trim();
  if (trimmed.length < 200 && trimmed.split('\n').length <= 3) {
    let event = trimmed
      .replace(/^(?:You Got Tickets? To|Your Tickets? For|Booking Confirmation[:\s\-—]*|Order Confirmed[:\s\-—]*)/i, '')
      .replace(/\s*[-—|]\s*Order.*$/i, '').replace(/\s*[-—|]\s*\d.*$/, '')
      .trim().substring(0, 60);
    const isSport = /(?:vs?\.?|fc |united|city|f\.c\.|stadium|ground|nfl|nba|ufc)/i.test(trimmed);
    return { event, date: '', time: '', venue: '', section: '', row: '', seats: '', qty: 1, costPrice: 0, orderRef: '', category: isSport ? 'Sport' : 'Concert', isStanding: false, confidence: event ? 'medium' : 'low' };
  }

  const isHtml = /<html|<body|<table|<td/i.test(raw);
  const text = isHtml ? stripHtml(raw) : raw;
  const find = (patterns) => { for (const p of patterns) { const m = text.match(p); if (m) return (m[1] || m[0])?.trim().replace(/\s+/g, ' '); } return ''; };

  const subjectMatch = raw.match(/^Subject:\s*(.+)$/im);
  const subject = subjectMatch ? subjectMatch[1].trim() : '';

  const event = find([
    // Ticketmaster UK: "You're in! Your HARRY STYLES: TOGETHER, TOGETHER ticket confirmation"
    /You're in!\s+Your\s+(.+?)\s+ticket confirmation/i,
    // Event name appears as all-caps line after "You got the tickets" in body
    /You got the tickets[\s\S]{0,50}\n\s*([A-Z][A-Z\s:,]+)/,
    /You Got Tickets To\s+([^\n\r<]+)/i,
    /Subject:.*?(?:tickets? to|tickets? for)\s+([^\n\r]+)/i,
    /(?:event|show|concert|match|game|fixture)[:\s]+([^\n\r<]{3,60})/i,
    /(?:your tickets? (?:for|to))[:\s]+([^\n\r<]{3,60})/i,
    /([A-Z][a-zA-Z\s]+ vs?\.? [A-Z][a-zA-Z\s]+)/,
    /tickets to\s+([^\n\r<]{3,60})/i,
  ]) || (subject
    .replace(/^you're in!\s+your\s+/i, '')
    .replace(/\s+ticket confirmation\s*$/i, '')
    .replace(/^(you got tickets!?|booking confirmation[:\s-]*|order confirmed[:\s-]*)/i, '')
    .trim().substring(0, 60) || '');

  const dateRaw = find([
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*[·•\-]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
    /(?:date|when|on)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  ]);
  const time = find([
    /[·•]\s*(\d{1,2}:\d{2}\s*(?:AM|PM|pm|am))/i,
    /(?:doors?|kick[- ]?off|start|gates?|showtime)[:\s]+(\d{1,2}[:.]\d{2}\s*(?:am|pm)?)/i,
    /(\d{1,2}:\d{2}\s*(?:AM|PM))/,
    /\b(\d{1,2}:\d{2}\s*pm)\b/i,
  ]);
  const date = dateRaw + (time && !dateRaw.includes(time) ? ` · ${time}` : '');

  const venue = find([
    /([A-Z][a-zA-Z\s]+(?:Stadium|Arena|Ground|Park|Hall|Centre|Center|Theater|Theatre|Field|Dome|Bowl|Coliseum))\s*(?:,\s*[A-Za-z]+)?/i,
    /(?:venue|location|at)[:\s]+([^\n\r<,]{5,50})/i,
  ])?.replace(/\s*[—\-–]\s*.+$/, '').trim().substring(0, 50) || '';

  // Qty
  let qty = 1;
  const mobileMatch = text.match(/(\d+)\s*x\s*(?:Mobile\s*)?Ticket/i);
  const qtyMatch = text.match(/(?:qty|quantity)[:\s]+(\d+)/i);
  const seatRangeMatch = text.match(/Seat[s]?\s*(\d+)\s*[-–]\s*(\d+)/i);
  const ticketsCountMatch = text.match(/(\d+)\s*(?:x\s*)?(?:adult |general |standing |seated )?tickets?\b/i);
  if (mobileMatch) qty = parseInt(mobileMatch[1]);
  else if (qtyMatch) qty = parseInt(qtyMatch[1]);
  else if (seatRangeMatch) qty = Math.abs(parseInt(seatRangeMatch[2]) - parseInt(seatRangeMatch[1])) + 1;
  else if (ticketsCountMatch) qty = parseInt(ticketsCountMatch[1]);
  if (isNaN(qty) || qty < 1) qty = 1;
  if (qty > 20) qty = 20;

  // Section / Row / Seat
  let section = '', row = '', seats = '';
  const secRowSeatMatch = text.match(/Sec(?:tion)?\s*([\w\d]+)[,·\s]+Row\s*([\w\d]+)[,·\s]+Seat[s]?\s*([\d\s,\-–]+)/i);
  if (secRowSeatMatch) {
    section = secRowSeatMatch[1].trim();
    row = secRowSeatMatch[2].trim();
    seats = secRowSeatMatch[3].trim();
  } else {
    const secMatch = text.match(/(?:Sec(?:tion)?|Block)[:\s]+([\w\d]+)/i);
    if (secMatch) section = secMatch[1].trim();
    const rowMatch = text.match(/\bRow\s+([\w\d]{1,4})\b/i);
    if (rowMatch) row = rowMatch[1].trim();
    if (seatRangeMatch) {
      const s1 = parseInt(seatRangeMatch[1]), s2 = parseInt(seatRangeMatch[2]);
      const lo = Math.min(s1, s2), hi = Math.max(s1, s2);
      seats = Array.from({ length: hi - lo + 1 }, (_, i) => (lo + i).toString()).join(', ');
    } else {
      const seatListMatch = text.match(/Seat[s]?\s*([\d]+(?:\s*,\s*[\d]+)+)/i);
      if (seatListMatch) seats = seatListMatch[1].trim();
      else { const singleSeatMatch = text.match(/\bSeat\s+(\d+)\b/i); if (singleSeatMatch) seats = singleSeatMatch[1].trim(); }
    }
  }

  const ticketTypeMatch = text.match(/(?:Album Pre-Order Pre-Sale\s*-?\s*)?([^\n\r]{5,60}(?:Standing|Pitch|Floor|General Admission|GA|Lawn|Infield|Festival)[^\n\r]{0,40})/i);
  const ticketType = ticketTypeMatch ? ticketTypeMatch[1].trim() : '';
  const standing = isStandingTicket(ticketType) || isStandingTicket(text.substring(0, 500));
  if (standing) { section = ''; row = ''; seats = ''; }

  let costPrice = 0;
  const totalInclFeeMatch = text.match(/Total\s*\(incl\.?\s*fee\)[^\n£$]*[£$]\s*([\d,]+\.?\d*)/i);
  if (totalInclFeeMatch) {
    costPrice = parseFloat(totalInclFeeMatch[1].replace(/,/g, ''));
  } else {
    const allAmounts = [];
    for (const m of text.matchAll(/£\s*([\d,]+\.?\d*)/g)) {
      const v = parseFloat(m[1].replace(/,/g, ''));
      if (v >= 5 && v <= 5000) allAmounts.push(v);
    }
    if (allAmounts.length > 0) costPrice = Math.max(...allAmounts);
  }

  const orderRef = find([
    /Order\s*#\s*([A-Z0-9\-\/]+)/i,
    /(?:order|booking|confirmation|reference)\s*(?:number|#|no\.?)[:\s]*([A-Z0-9\-\/]+)/i,
  ])?.substring(0, 25) || '';

  const isSport = /(?:match|fixture|vs\.?|stadium|ground|kick.?off|premier league|championship|nfl|nba|mlb|nhl|ufc|boxing|cricket|rugby)/i.test(text);

  let restrictions = ticketType.replace(/^Album Pre-Order Pre-Sale\s*[-–]\s*/i, '').replace(/^Pre-Sale\s*[-–]\s*/i, '').trim().substring(0, 80);
  if (!restrictions) {
    restrictions = find([/(?:restricted|limited|obstructed|side view|rear|standing|hospitality|vip|accessible|wheelchair|partial view)[^\n\r<]{0,60}/i])?.trim().substring(0, 80) || '';
  }

  return {
    event: event?.substring(0, 60).replace(/\s+/g, ' ').trim() || '',
    date: date?.trim() || '', time: time || '', venue,
    section, row, seats, qty, costPrice, orderRef, restrictions,
    isStanding: standing,
    category: isSport ? 'Sport' : 'Concert',
    confidence: (event && (date || venue)) ? 'high' : event ? 'medium' : 'low',
  };
}