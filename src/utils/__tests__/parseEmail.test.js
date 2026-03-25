import { describe, it, expect } from 'vitest';
import { parseTicketmasterEmail } from '../parseEmail.js';

// Helper: wraps a text/plain body so the parser can extract it
// (the parser looks for Content-Type: text/plain boundary)
function wrapPlain(textBody) {
  return [
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    textBody,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Test 1 — Seated tickets with BLK section and letter row
// ---------------------------------------------------------------------------
describe('parseTicketmasterEmail — seated BLK section (Muse @ O2 Academy)', () => {
  const emailBody = wrapPlain(`
Your ticket confirmation

You got the tickets
ORDER # 8-38214/UK7

MUSE
Fri 03 Apr 2026 - 7:00 pm
O2 Academy Brixton, London
2x Mobile Ticket

Order Summary
2x Mobile Ticket

Standard Ticket
Section BLK7 Row O Seat 35
Section BLK7 Row O Seat 34

Payment Summary
2x Standard Ticket
Service Fee
Order Processing Fee
Total (incl. fee) £283.75
`);

  const tickets = parseTicketmasterEmail(emailBody);

  it('should return 2 tickets', () => {
    expect(tickets).toHaveLength(2);
  });

  it('should parse event name as MUSE', () => {
    expect(tickets[0].event).toBe('MUSE');
  });

  it('should parse date and time', () => {
    expect(tickets[0].date).toBe('03 Apr 2026');
    expect(tickets[0].time).toBe('7:00 pm');
  });

  it('should parse venue', () => {
    expect(tickets[0].venue).toBe('O2 Academy Brixton, London');
  });

  it('should parse order ref', () => {
    expect(tickets[0].orderRef).toBe('8-38214/UK7');
  });

  it('should have section BLK7 on both tickets', () => {
    tickets.forEach(t => expect(t.section).toBe('BLK7'));
  });

  it('should have row O on both tickets', () => {
    tickets.forEach(t => expect(t.row).toBe('O'));
  });

  it('should have seats 34 and 35', () => {
    const seats = tickets.map(t => t.seats).sort();
    expect(seats).toEqual(['34', '35']);
  });

  it('should split total cost evenly per ticket (£141.87 or £141.88)', () => {
    tickets.forEach(t => {
      expect(t.costPrice).toBeGreaterThanOrEqual(141.87);
      expect(t.costPrice).toBeLessThanOrEqual(141.88);
    });
  });

  it('should set qty=1 per ticket object', () => {
    tickets.forEach(t => expect(t.qty).toBe(1));
  });

  it('should detect as Concert category', () => {
    tickets.forEach(t => expect(t.category).toBe('Concert'));
  });
});

// ---------------------------------------------------------------------------
// Test 2 — VIP / GA tickets without seats (BBC Radio 1 Big Weekend)
// ---------------------------------------------------------------------------
describe('parseTicketmasterEmail — VIP no-seat tickets (BBC Radio 1 Big Weekend)', () => {
  const emailBody = wrapPlain(`
Your ticket confirmation

You got the tickets
ORDER # 48-15113/UK3

BBC RADIO 1'S BIG WEEKEND - SUNDAY
Sun 24 May 2026 - 11:00 am
Herrington Country Park, Sunderland
2x Mobile Ticket

Order Summary
2x Mobile Ticket

VIP Ticket

Payment Summary
2x VIP Ticket
Service Fee
Order Processing Fee
Total (incl. fee) £212.00
`);

  const tickets = parseTicketmasterEmail(emailBody);

  it('should return 2 tickets', () => {
    expect(tickets).toHaveLength(2);
  });

  it('should parse event name', () => {
    expect(tickets[0].event).toBe("BBC RADIO 1'S BIG WEEKEND - SUNDAY");
  });

  it('should parse date and time', () => {
    expect(tickets[0].date).toBe('24 May 2026');
    expect(tickets[0].time).toBe('11:00 am');
  });

  it('should parse venue', () => {
    expect(tickets[0].venue).toBe('Herrington Country Park, Sunderland');
  });

  it('should parse order ref', () => {
    expect(tickets[0].orderRef).toBe('48-15113/UK3');
  });

  it('should use VIP Ticket as section', () => {
    tickets.forEach(t => expect(t.section).toBe('VIP Ticket'));
  });

  it('should have empty row (no seats)', () => {
    tickets.forEach(t => expect(t.row).toBe(''));
  });

  it('should calculate cost per ticket as £106', () => {
    tickets.forEach(t => expect(t.costPrice).toBe(106));
  });

  it('should set qty=1 per ticket object', () => {
    tickets.forEach(t => expect(t.qty).toBe(1));
  });
});

// ---------------------------------------------------------------------------
// Test 3 — Standard numeric section (Coldplay @ Wembley)
// ---------------------------------------------------------------------------
describe('parseTicketmasterEmail — numeric section (Coldplay @ Wembley)', () => {
  const emailBody = wrapPlain(`
Your ticket confirmation

You got the tickets
ORDER # 12-34567/UK1

COLDPLAY
Sat 21 Jun 2026 - 6:30 pm
Wembley Stadium, London
4x Mobile Ticket

Order Summary
4x Mobile Ticket

Standard Ticket
Section 215 Row 8 Seat 1
Section 215 Row 8 Seat 2
Section 215 Row 8 Seat 3
Section 215 Row 8 Seat 4

Payment Summary
4x Standard Ticket
Service Fee
Order Processing Fee
Total (incl. fee) £600.00
`);

  const tickets = parseTicketmasterEmail(emailBody);

  it('should return 4 tickets', () => {
    expect(tickets).toHaveLength(4);
  });

  it('should parse event name as COLDPLAY', () => {
    expect(tickets[0].event).toBe('COLDPLAY');
  });

  it('should parse date and time', () => {
    expect(tickets[0].date).toBe('21 Jun 2026');
    expect(tickets[0].time).toBe('6:30 pm');
  });

  it('should parse venue', () => {
    expect(tickets[0].venue).toBe('Wembley Stadium, London');
  });

  it('should parse order ref', () => {
    expect(tickets[0].orderRef).toBe('12-34567/UK1');
  });

  it('should have section 215 on all tickets', () => {
    tickets.forEach(t => expect(t.section).toBe('215'));
  });

  it('should have row 8 on all tickets', () => {
    tickets.forEach(t => expect(t.row).toBe('8'));
  });

  it('should have seats 1 through 4', () => {
    const seats = tickets.map(t => t.seats).sort();
    expect(seats).toEqual(['1', '2', '3', '4']);
  });

  it('should calculate cost per ticket as £150', () => {
    tickets.forEach(t => expect(t.costPrice).toBe(150));
  });

  it('should set qty=1 per ticket object', () => {
    tickets.forEach(t => expect(t.qty).toBe(1));
  });
});

// ---------------------------------------------------------------------------
// Test 4 — Event name cleaning from subject line
// ---------------------------------------------------------------------------
describe('parseTicketmasterEmail — event name extraction from subject', () => {
  it('should extract MUSE from subject when body has no event line', () => {
    const email = [
      'Subject: You\'re in! Your MUSE ticket confirmation',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      'Your ticket confirmation',
      '',
      'ORDER # 8-38214/UK7',
      '',
      'Fri 03 Apr 2026 - 7:00 pm',
      'O2 Academy Brixton, London',
      '2x Mobile Ticket',
      '',
      'Order Summary',
      '2x Mobile Ticket',
      '',
      'Standard Ticket',
      'Section BLK7 Row O Seat 35',
      '',
      'Payment Summary',
      'Total (incl. fee) £141.88',
    ].join('\n');

    const tickets = parseTicketmasterEmail(email);
    expect(tickets[0].event).toBe('MUSE');
  });

  it('should extract BBC RADIO 1\'S BIG WEEKEND - SUNDAY from subject when body has no event line', () => {
    const email = [
      "Subject: You're in! Your BBC RADIO 1'S BIG WEEKEND - SUNDAY ticket confirmation",
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      'Your ticket confirmation',
      '',
      'ORDER # 48-15113/UK3',
      '',
      'Sun 24 May 2026 - 11:00 am',
      'Herrington Country Park, Sunderland',
      '2x Mobile Ticket',
      '',
      'Order Summary',
      '2x Mobile Ticket',
      '',
      'VIP Ticket',
      '',
      'Payment Summary',
      'Total (incl. fee) £212.00',
    ].join('\n');

    const tickets = parseTicketmasterEmail(email);
    expect(tickets[0].event).toBe("BBC RADIO 1'S BIG WEEKEND - SUNDAY");
  });
});
