export function stripEmailForAI(raw) {
  let body = raw;
  const contentStart = raw.search(/(?:From:|Subject:|<!doctype|<html)/im);
  if (contentStart > 0) body = raw.slice(contentStart);
  if (/<html|<body|<table/i.test(body)) {
    body = body
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/tr>/gi, '\n').replace(/<\/td>/gi, ' ').replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&mdash;/g, '—').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, ' ')
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

export function parseEmail(raw) {
  const stripHtml = (html) => html
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/tr>/gi, '\n').replace(/<\/td>/gi, ' ').replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&mdash;/g, '—').replace(/&ndash;/g, '-')
    .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  const trimmed = raw.trim();
  if (trimmed.length < 200 && trimmed.split('\n').length <= 3) {
    let event = trimmed
      .replace(/^(?:You Got Tickets? To|Your Tickets? For|Booking Confirmation[:\s\-—]*|Order Confirmed[:\s\-—]*)/i, '')
      .replace(/\s*[-—|]\s*Order.*$/i, '')
      .replace(/\s*[-—|]\s*\d.*$/, '')
      .trim().substring(0, 60);
    const isSport = /(?:vs?\.?|fc |united|city|f\.c\.|stadium|ground|nfl|nba|ufc)/i.test(trimmed);
    return { event, date: "", time: "", venue: "", section: "", row: "", seats: "", qty: 2, costPrice: 0, orderRef: "", category: isSport ? "Sport" : "Concert", confidence: event ? "medium" : "low" };
  }

  const isHtml = /<html|<body|<table|<td/i.test(raw);
  const text = isHtml ? stripHtml(raw) : raw;
  const find = (patterns) => { for (const p of patterns) { const m = text.match(p); if (m) return (m[1] || m[0])?.trim().replace(/\s+/g, ' '); } return ""; };

  const subjectMatch = raw.match(/^Subject:\s*(.+)$/im);
  const subject = subjectMatch ? subjectMatch[1].trim() : "";

  const event = find([
    /You Got Tickets To\s+([^\n\r<]+)/i,
    /Subject:.*?(?:tickets? to|tickets? for)\s+([^\n\r]+)/i,
    /(?:event|show|concert|match|game|fixture)[:\s]+([^\n\r<]{3,60})/i,
    /(?:your tickets? (?:for|to))[:\s]+([^\n\r<]{3,60})/i,
    /([A-Z][a-zA-Z\s]+ vs?\.? [A-Z][a-zA-Z\s]+)/,
    /tickets to\s+([^\n\r<]{3,60})/i,
  ]) || (subject.match(/tickets? to (.+)/i)?.[1]?.trim() || "");

  const dateRaw = find([
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*[·•\-]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
    /(?:date|when|on)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  ]);
  const time = find([
    /[·•]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
    /(?:doors?|kick[- ]?off|start|gates?|showtime)[:\s]+(\d{1,2}[:.]\d{2}\s*(?:am|pm)?)/i,
    /(\d{1,2}:\d{2}\s*(?:AM|PM))/,
  ]);
  const date = dateRaw + (time && !dateRaw.includes(time) ? ` · ${time}` : "");

  const venue = find([
    /([A-Z][a-zA-Z\s]+(?:Stadium|Arena|Ground|Park|Hall|Centre|Center|Theater|Theatre|Field|Dome|Bowl|Coliseum|Amphitheater|Amphitheatre))\s*(?:—|-|,|\n)/i,
    /(?:venue|location|at)[:\s]+([^\n\r<,]{5,50})/i,
  ])?.replace(/\s*[—\-–]\s*.+$/, '').trim().substring(0, 50) || "";

  const sectionRaw = find([
    /(Sec[tion]*\s*[\d\w]+(?:,?\s*Row\s*[\d\w]+)?(?:,?\s*Seat[s]?\s*[\d\w\s\-]+)?)/i,
    /(?:section|block)[:\s]+([A-Z0-9]+)/i,
    /(?:row)[:\s]+([A-Z0-9]+)/i,
  ])?.substring(0, 40) || "";

  let qty = 1;
  const seatRange = text.match(/Seat[s]?\s*(\d+)\s*[-–]\s*(\d+)/i);
  if (seatRange) qty = Math.abs(parseInt(seatRange[2]) - parseInt(seatRange[1])) + 1;
  else qty = parseInt(find([/(\d+)\s*(?:x\s*)?(?:adult |general |standing )?tickets?/i, /(?:qty|quantity)[:\s]+(\d+)/i, /(\d+)\s+seats?/i])) || 1;

  const costRaw = find([
    // Ticketmaster UK — "Total (incl. fee) £171.25" in plain text
    /Total\s*\(incl\.?\s*fee\)[^\n£]*£\s*([\d,]+\.?\d*)/i,
    // Plain text total line
    /Total[^\n£]{0,20}£\s*([\d,]+\.?\d*)/i,
    // Payment summary table total
    /Total\s*£\s*([\d,]+\.?\d*)/i,
    // Generic order/grand total
    /(?:order total|grand total|amount (?:paid|charged)|total paid|total cost)[:\s]*[$£]?\s*([\d,]+\.?\d*)/i,
    // VISA/card charge
    /(?:visa|mastercard|maestro|amex|paypal)[^\n£]{0,20}£\s*([\d,]+\.?\d*)/i,
    // Any £ amount — pick the LARGEST one (most likely to be the total)
    /£\s*([\d,]+\.?\d*)/g,
  ]);

  // If we used the last pattern (global), find the largest £ amount
  let costPrice = 0;
  const allAmounts = [];
  const amountMatches = text.matchAll(/£\s*([\d,]+\.?\d*)/g);
  for (const m of amountMatches) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (v > 0) allAmounts.push(v);
  }
  if (allAmounts.length > 0) {
    // Use the largest amount under £5000 (avoids insurance/face value inflated numbers)
    const reasonable = allAmounts.filter(v => v >= 5 && v <= 5000);
    costPrice = reasonable.length > 0 ? Math.max(...reasonable) : parseFloat(costRaw?.replace(/,/g, '') || '0') || 0;
  } else {
    costPrice = parseFloat(costRaw?.replace(/,/g, '') || '0') || 0;
  }

  const orderRef = find([
    // Ticketmaster: "Order # 19-21054/WES"
    /Order\s*#\s*([A-Z0-9\-\/]+)/i,
    /(?:order|booking|confirmation|reference)\s*(?:number|#|no\.?)[:\s]*([A-Z0-9\-\/]+)/i,
  ])?.substring(0, 25) || "";

  const isSport = /(?:match|fixture|vs\.?|stadium|ground|kick.?off|premier league|championship|nfl|nba|mlb|nhl|ufc|boxing|cricket|rugby)/i.test(text);

  // Extract restrictions/ticket type e.g. "Restricted Side View", "Standing", "Hospitality"
  const restrictions = find([
    /(?:restricted|limited|obstructed|side view|rear|standing|hospitality|vip|accessible|wheelchair|partial view)[^\n\r<]{0,60}/i,
    /(?:Album Pre-Order|Early Bird|Pre-Sale|General Admission|Seated|Standing|Floor)[^\n\r<]{0,50}/i,
  ])?.trim().substring(0, 80) || "";
  const confidence = (event && (date || venue)) ? "high" : event ? "medium" : "low";

  return {
    event: event?.substring(0, 60).replace(/\s+/g, ' ').trim() || "",
    date: date?.trim() || "", time: time || "", venue, section: sectionRaw,
    qty, costPrice, orderRef, restrictions,
    category: isSport ? "Sport" : "Concert", confidence,
  };
}