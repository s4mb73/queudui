// ── Sale email parsers ────────────────────────────────────────────────────────
function stripQP(raw) {
  return raw.replace(/=\r?\n/g, '').replace(/=C2=A3/g, '£').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function stripHtmlBasic(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#163;/g, '£').replace(/&#8203;/g, '').replace(/\s{2,}/g, ' ').trim();
}

export function parseViagogoSaleEmail(raw) {
  const text = stripHtmlBasic(stripQP(raw));
  const orderIdM = text.match(/Order\s*ID[:\s]+(\d{6,12})/i)
    || text.match(/Please send your tickets\s+(\d{6,12})/i);
  const eventM = text.match(/Event[:\s]+([^\n|]+?)(?:\s*Listing Note|Venue:|$)/i)
    || text.match(/Event[:\s]+([^\n|]{3,60})/i);
  const venueM = text.match(/Venue[:\s]+([^\n|]+?)(?:\s*Date:|Must Ship|$)/i);
  const dateM = text.match(/Date[:\s]+((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},\s+\d{4}[^|<\n]*)/i);
  const ticketsM = text.match(/Ticket\(s\)[:\s]+([^\n<]+)/i);
  const priceM = text.match(/Price\s+per\s+Ticket[:\s]+£\s*([\d,]+\.?\d*)/i);
  const totalM = text.match(/Total\s+Proceeds[:\s]+£\s*([\d,]+\.?\d*)/i);
  const qtyM = text.match(/Number\s+of\s+Tickets[:\s]+(\d+)/i);

  let qty = qtyM ? parseInt(qtyM[1]) : 1;

  // Fallback: qty in brackets on tickets line e.g. "(1 Ticket(s))"
  if (!qtyM && ticketsM) {
    const inlineQtyM = ticketsM[1].match(/\((\d+)\s+Ticket/i);
    if (inlineQtyM) qty = parseInt(inlineQtyM[1]);
  }

  const priceEach = priceM ? parseFloat(priceM[1].replace(/,/g, '')) : (totalM ? parseFloat(totalM[1].replace(/,/g, '')) / qty : 0);

  // Parse section/row/seats from tickets line
  // Old: "Section ARENA E, Row 15, Seat(s) 27 - 28"
  // New: "Section 409, Row 1, (1 Ticket(s))"
  let section = '', row = '', seats = '';
  if (ticketsM) {
    const t = ticketsM[1];
    const secM = t.match(/Section\s+([^,]+)/i);
    const rowM = t.match(/Row\s+([\w\d]+)/i);
    const seatM = t.match(/Seat\(?s?\)?\s+([\d\s\-–]+)/i);
    if (secM) section = secM[1].trim();
    if (rowM) row = rowM[1].trim();
    if (seatM) {
      const rangeM = seatM[1].trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (rangeM) {
        const lo = Math.min(parseInt(rangeM[1]), parseInt(rangeM[2]));
        const hi = Math.max(parseInt(rangeM[1]), parseInt(rangeM[2]));
        seats = Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)).join(', ');
      } else seats = seatM[1].trim();
    }
  }

  return {
    platform: 'Viagogo',
    orderId: orderIdM ? orderIdM[1] : '',
    event: eventM ? eventM[1].trim().replace(/\s+/g, ' ').substring(0, 60) : '',
    venue: venueM ? venueM[1].trim().substring(0, 50) : '',
    date: dateM ? dateM[1].trim() : '',
    section, row, seats, qty,
    priceEach,
    totalProceeds: totalM ? parseFloat(totalM[1].replace(/,/g, '')) : priceEach * qty,
  };
}

export function parseTixstockSaleEmail(raw) {
  const text = stripHtmlBasic(stripQP(raw));
  const orderIdM = text.match(/Order\s+ID[:\s]+([A-Z0-9]+)/i);
  const eventM = text.match(/Event[:\s|\s]+([^\n|]+?)(?:\s*Event date:|$)/i);
  const venueM = text.match(/Venue[:\s]+([^\n|]+?)(?:\s*Quantity:|$)/i);
  const dateM = text.match(/Event\s+date[:\s]+([\d\/]+(?:,\s*[\d:]+)?)/i);
  const sectionM = text.match(/Section[:\s]+([^\n|]+?)(?:\s*Row:|$)/i);
  const rowM = text.match(/\bRow[:\s]+([^\n|]+?)(?:\s*Format:|$)/i);
  const qtyM = text.match(/(?:Number of tickets|Quantity)[:\s]+(\d+)/i);
  const priceM = text.match(/Price\s+per\s+ticket[:\s]+£\s*([\d,]+\.?\d*)/i);
  const totalM = text.match(/Total\s+proceeds[:\s]+£\s*([\d,]+\.?\d*)/i);

  const qty = qtyM ? parseInt(qtyM[1]) : 1;
  const priceEach = priceM ? parseFloat(priceM[1].replace(/,/g, '')) : (totalM ? parseFloat(totalM[1].replace(/,/g, '')) / qty : 0);

  return {
    platform: 'Tixstock',
    orderId: orderIdM ? orderIdM[1] : '',
    event: eventM ? eventM[1].trim().replace(/\s+/g, ' ').substring(0, 60) : '',
    venue: venueM ? venueM[1].trim().replace(/,.*$/, '').substring(0, 50) : '',
    date: dateM ? dateM[1].trim() : '',
    section: sectionM ? sectionM[1].trim().replace(/\s+/g, ' ') : '',
    row: rowM ? rowM[1].trim() : '',
    seats: '',
    qty,
    priceEach,
    totalProceeds: totalM ? parseFloat(totalM[1].replace(/,/g, '')) : priceEach * qty,
  };
}

export function detectSaleSite(raw) {
  if (/viagogo\.com|automated@orders\.viagogo|Please send your tickets/i.test(raw)) return 'viagogo';
  if (/tixstock\.com|orders@tixstock/i.test(raw)) return 'tixstock';
  return null;
}