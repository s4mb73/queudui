import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

function dbToTicket(row) {
  return {
    id: row.id,
    event: row.event,
    category: row.category,
    subtype: row.subtype || '',
    date: row.date || '',
    time: row.time || '',
    venue: row.venue || '',
    section: row.section || '',
    row: row.row || '',
    seats: row.seats || '',
    qty: row.qty,
    qtyAvailable: row.qty_available,
    costPrice: parseFloat(row.cost_price) || 0,
    originalCurrency: row.original_currency || 'USD',
    originalAmount: parseFloat(row.original_amount) || 0,
    exchangeRate: parseFloat(row.exchange_rate) || 1,
    orderRef: row.order_ref || '',
    notes: row.notes || '',
    accountEmail: row.account_email || '',
    status: row.status || 'Unsold',
    restrictions: row.restrictions || '',
    parentOrderRef: row.parent_order_ref || '',
    addedAt: row.added_at,
  };
}

export function ticketToDb(t) {
  return {
    id: t.id,
    event: t.event,
    category: t.category || 'Concert',
    subtype: t.subtype || '',
    date: t.date || '',
    time: t.time || '',
    venue: t.venue || '',
    section: t.section || '',
    row: t.row || '',
    seats: t.seats || '',
    qty: parseInt(t.qty) || 1,
    qty_available: t.qtyAvailable ?? t.qty ?? 1,
    cost_price: parseFloat(t.costPrice) || 0,
    original_currency: t.originalCurrency || 'USD',
    original_amount: parseFloat(t.originalAmount) || 0,
    exchange_rate: parseFloat(t.exchangeRate) || 1,
    order_ref: t.orderRef || '',
    notes: t.notes || '',
    account_email: t.accountEmail || '',
    status: t.status || 'Unsold',
    restrictions: t.restrictions || '',
    parent_order_ref: t.parentOrderRef || t.orderRef || '',
  };
}

export { dbToTicket };

export function useTickets(initialData = []) {
  const [tickets, setTicketsState] = useState(initialData);

  const setTickets = useCallback((updater) => {
    setTicketsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;

      const prevIds = new Set(prev.map(t => t.id));
      const nextIds = new Set(next.map(t => t.id));

      const toUpsert = next.filter(t => {
        if (!prevIds.has(t.id)) return true;
        const old = prev.find(p => p.id === t.id);
        return JSON.stringify(t) !== JSON.stringify(old);
      });

      const toDelete = [...prevIds].filter(id => !nextIds.has(id));

      if (toUpsert.length > 0) {
        supabase.from('tickets').upsert(toUpsert.map(ticketToDb)).then(({ error }) => {
          if (error) console.error('Ticket upsert error:', error);
        });
      }
      if (toDelete.length > 0) {
        supabase.from('tickets').delete().in('id', toDelete).then(({ error }) => {
          if (error) console.error('Ticket delete error:', error);
        });
      }

      return next;
    });
  }, []);

  return { tickets, setTickets, setTicketsState };
}
