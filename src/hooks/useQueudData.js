import { useState, useEffect, useCallback, useRef } from 'react';
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
    ticketIds: row.ticket_ids || [],
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
    saleStatus: row.sale_status || 'Pending',
    section: row.section || '',
    row: row.row || '',
    seats: row.seats || '',
    recordedAt: row.recorded_at,
  };
}

function saleToDb(s) {
  return {
    id: s.id,
    ticket_id: s.ticketId,
    ticket_ids: s.ticketIds || [s.ticketId],
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
    sale_status: s.saleStatus || 'Pending',
    section: s.section || '',
    row: s.row || '',
    seats: s.seats || '',
  };
}

// ── Main hook ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useQueudData() {
  const [tickets, setTicketsState] = useState([]);
  const [sales, setSalesState] = useState([]);
  const [settings, setSettingsState] = useState({ gmailAccounts: [], openAiKey: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Track last-seen IDs so polling only applies server-side changes,
  // not local mutations the user just made
  const localMutationIds = useRef(new Set()); // IDs mutated locally this session

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [
          { data: t, error: te },
          { data: s, error: se },
          { data: st, error: ste },
        ] = await Promise.all([
          supabase.from('tickets').select('*').order('added_at', { ascending: false }),
          supabase.from('sales').select('*').order('recorded_at', { ascending: false }),
          supabase.from('settings').select('*').eq('id', 'user_settings').single(),
        ]);
        if (te) throw te;
        if (se) throw se;
        setTicketsState((t || []).map(dbToTicket));
        setSalesState((s || []).map(dbToSale));
        if (st) {
          setSettingsState({
            gmailAccounts: st.gmail_accounts || [],
            openAiKey: st.open_ai_key || '',
            aycdApiKey: st.aycd_api_key || '',
          });
        }
      } catch (e) {
        console.error('Load error:', e);
        setError(e.message);
      }
      setLoading(false);
    }
    load();
  }, []);

  // ── Background polling — picks up server-synced sales & ticket status changes ──
  // Runs every 30s. Only updates state for records that are NEW (not in current
  // state) or whose status has changed by the server (not a local mutation).
  useEffect(() => {
    if (loading) return; // don't start polling until initial load is done

    const interval = setInterval(async () => {
      try {
        const [{ data: t }, { data: s }] = await Promise.all([
          supabase.from('tickets').select('*').order('added_at', { ascending: false }),
          supabase.from('sales').select('*').order('recorded_at', { ascending: false }),
        ]);

        if (t) {
          setTicketsState(prev => {
            const prevMap = new Map(prev.map(x => [x.id, x]));
            const incoming = (t || []).map(dbToTicket);
            let changed = false;
            const merged = incoming.map(row => {
              const existing = prevMap.get(row.id);
              if (!existing) { changed = true; return row; } // new ticket from server
              // Only apply server status if this wasn't mutated locally this session
              if (!localMutationIds.current.has(row.id) && existing.status !== row.status) {
                changed = true;
                return { ...existing, status: row.status, qtyAvailable: row.qtyAvailable };
              }
              return existing; // keep local version
            });
            // Also keep any local-only tickets not yet persisted (shouldn't happen but safe)
            const incomingIds = new Set(incoming.map(r => r.id));
            prev.filter(p => !incomingIds.has(p.id)).forEach(p => { merged.push(p); changed = true; });
            return changed ? merged : prev;
          });
        }

        if (s) {
          setSalesState(prev => {
            const prevIds = new Set(prev.map(x => x.id));
            const incoming = (s || []).map(dbToSale);
            const newSales = incoming.filter(r => !prevIds.has(r.id));
            // Also check for status upgrades on existing sales (e.g. Pending → Delivered)
            const upgraded = incoming.filter(r => {
              if (!prevIds.has(r.id)) return false;
              const existing = prev.find(p => p.id === r.id);
              return existing && existing.saleStatus !== r.saleStatus && !localMutationIds.current.has(r.id);
            });
            if (newSales.length === 0 && upgraded.length === 0) return prev;
            const upgradedIds = new Set(upgraded.map(r => r.id));
            return [
              ...prev.filter(p => !upgradedIds.has(p.id)),
              ...upgraded,
              ...newSales,
            ].sort((a, b) => new Date(b.recordedAt || 0) - new Date(a.recordedAt || 0));
          });
        }
      } catch (e) {
        // Polling errors are non-fatal — just log
        console.warn('[poll] Supabase poll error:', e.message);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loading]);

  // ── Tickets ────────────────────────────────────────────────────────────────

  const setTickets = useCallback(async (updater) => {
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

      // Mark locally mutated IDs so polling doesn't overwrite them
      toUpsert.forEach(t => localMutationIds.current.add(t.id));
      toDelete.forEach(id => localMutationIds.current.delete(id));

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

  // ── Sales ──────────────────────────────────────────────────────────────────

  const setSales = useCallback(async (updater) => {
    setSalesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;

      const prevIds = new Set(prev.map(s => s.id));
      const nextIds = new Set(next.map(s => s.id));

      // Upsert new records AND status changes (e.g. user manually changed status)
      const toUpsert = next.filter(s => {
        if (!prevIds.has(s.id)) return true;
        const old = prev.find(p => p.id === s.id);
        return old && old.saleStatus !== s.saleStatus;
      });
      const toDelete = [...prevIds].filter(id => !nextIds.has(id));

      toUpsert.forEach(s => localMutationIds.current.add(s.id));
      toDelete.forEach(id => localMutationIds.current.delete(id));

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

  // ── Settings ───────────────────────────────────────────────────────────────

  const setSettings = useCallback((updater) => {
    setSettingsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      supabase.from('settings').upsert({
        id: 'user_settings',
        gmail_accounts: next.gmailAccounts || [],
        open_ai_key: next.openAiKey || '',
        aycd_api_key: next.aycdApiKey || '',
      }).then(({ error }) => {
        if (error) console.error('Settings error:', error);
      });
      return next;
    });
  }, []);

  return { tickets, setTickets, sales, setSales, settings, setSettings, loading, error };
}