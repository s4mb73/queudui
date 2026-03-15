import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Tickets ──────────────────────────────────────────────────────────────────

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

function ticketToDb(t) {
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

// ── Sales ────────────────────────────────────────────────────────────────────

function dbToSale(row) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    eventName: row.event_name,
    category: row.category,
    qtySold: row.qty_sold,
    salePrice: parseFloat(row.sale_price) || 0,
    fees: parseFloat(row.fees) || 0,
    profit: parseFloat(row.profit) || 0,
    costPer: parseFloat(row.cost_per) || 0,
    platform: row.platform,
    date: row.date,
    notes: row.notes || '',
    recordedAt: row.recorded_at,
  };
}

function saleToDb(s) {
  return {
    id: s.id,
    ticket_id: s.ticketId,
    event_name: s.eventName,
    category: s.category,
    qty_sold: parseInt(s.qtySold) || 1,
    sale_price: parseFloat(s.salePrice) || 0,
    fees: parseFloat(s.fees) || 0,
    profit: parseFloat(s.profit) || 0,
    cost_per: parseFloat(s.costPer) || 0,
    platform: s.platform,
    date: s.date,
    notes: s.notes || '',
  };
}

// ── Main hook ────────────────────────────────────────────────────────────────

export function useQueudData() {
  const [tickets, setTicketsState] = useState([]);
  const [sales, setSalesState] = useState([]);
  const [settings, setSettingsState] = useState({ gmailAccounts: [], openAiKey: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load all data on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [{ data: t, error: te }, { data: s, error: se }, { data: st, error: ste }] = await Promise.all([
          supabase.from('tickets').select('*').order('added_at', { ascending: false }),
          supabase.from('sales').select('*').order('recorded_at', { ascending: false }),
          supabase.from('settings').select('*').eq('id', 'user_settings').single(),
        ]);
        if (te) throw te;
        if (se) throw se;
        setTicketsState((t || []).map(dbToTicket));
        setSalesState((s || []).map(dbToSale));
        if (st) setSettingsState({ gmailAccounts: st.gmail_accounts || [], openAiKey: st.open_ai_key || '' });
      } catch (e) {
        console.error('Load error:', e);
        setError(e.message);
      }
      setLoading(false);
    }
    load();
  }, []);

  // ── Tickets ──────────────────────────────────────────────────────────────

  const setTickets = useCallback(async (updater) => {
    setTicketsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;

      // Find added/updated tickets
      const prevIds = new Set(prev.map(t => t.id));
      const nextIds = new Set(next.map(t => t.id));

      // Upsert new or changed
      const toUpsert = next.filter(t => {
        if (!prevIds.has(t.id)) return true;
        const old = prev.find(p => p.id === t.id);
        return JSON.stringify(t) !== JSON.stringify(old);
      });

      // Delete removed
      const toDelete = [...prevIds].filter(id => !nextIds.has(id));

      if (toUpsert.length > 0) {
        supabase.from('tickets').upsert(toUpsert.map(ticketToDb)).then(({ error }) => {
          if (error) console.error('Upsert error:', error);
        });
      }
      if (toDelete.length > 0) {
        supabase.from('tickets').delete().in('id', toDelete).then(({ error }) => {
          if (error) console.error('Delete error:', error);
        });
      }

      return next;
    });
  }, []);

  // ── Sales ────────────────────────────────────────────────────────────────

  const setSales = useCallback(async (updater) => {
    setSalesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;

      const prevIds = new Set(prev.map(s => s.id));
      const nextIds = new Set(next.map(s => s.id));

      const toUpsert = next.filter(s => !prevIds.has(s.id));
      const toDelete = [...prevIds].filter(id => !nextIds.has(id));

      if (toUpsert.length > 0) {
        supabase.from('sales').upsert(toUpsert.map(saleToDb)).then(({ error }) => {
          if (error) console.error('Sale upsert error:', error);
        });
      }
      if (toDelete.length > 0) {
        supabase.from('sales').delete().in('id', toDelete).then(({ error }) => {
          if (error) console.error('Sale delete error:', error);
        });
      }

      return next;
    });
  }, []);

  // ── Settings ─────────────────────────────────────────────────────────────

  const setSettings = useCallback((updater) => {
    setSettingsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      supabase.from('settings').upsert({
        id: 'user_settings',
        gmail_accounts: next.gmailAccounts || [],
        open_ai_key: next.openAiKey || '',
      }).then(({ error }) => {
        if (error) console.error('Settings error:', error);
      });
      return next;
    });
  }, []);

  return { tickets, setTickets, sales, setSales, settings, setSettings, loading, error };
}