import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

function dbToEvent(row) {
  return {
    id:        row.id,
    name:      row.name,
    venue:     row.venue || '',
    date:      row.date || '',
    time:      row.time || '',
    category:  row.category || 'Concert',
    createdAt: row.created_at,
  };
}

function dbToTicket(row) {
  return {
    id:             row.id,
    eventId:        row.event_id || '',
    event:          row.event || '',
    buyingPlatform: row.buying_platform || 'Ticketmaster',
    date:           row.date || '',
    time:           row.time || '',
    venue:          row.venue || '',
    section:        row.section || '',
    row:            row.row || '',
    seats:          row.seats || '',
    qty:            row.qty || 1,
    qtyAvailable:   row.qty_available ?? row.qty ?? 1,
    cost:           parseFloat(row.cost) || 0,
    costPerTicket:  parseFloat(row.cost_per_ticket) || 0,
    orderRef:       row.order_ref || '',
    accountEmail:   row.account_email || '',
    status:         row.status || 'Unsold',
    restrictions:   row.restrictions || '',
    isStanding:     row.is_standing || false,
    listedOn:       row.listed_on || '',
    notes:          row.notes || '',
    addedAt:        row.added_at,
  };
}

function ticketToDb(t) {
  return {
    id:              t.id,
    event_id:        t.eventId || null,
    event:           t.event || '',
    buying_platform: t.buyingPlatform || 'Ticketmaster',
    date:            t.date || '',
    time:            t.time || '',
    venue:           t.venue || '',
    section:         t.section || '',
    row:             t.row || '',
    seats:           t.seats || '',
    qty:             parseInt(t.qty) || 1,
    qty_available:   t.qtyAvailable ?? t.qty ?? 1,
    cost:            parseFloat(t.cost) || 0,
    cost_per_ticket: parseFloat(t.costPerTicket) || 0,
    order_ref:       t.orderRef || '',
    account_email:   t.accountEmail || '',
    status:          t.status || 'Unsold',
    restrictions:    t.restrictions || '',
    is_standing:     t.isStanding || false,
    listed_on:       t.listedOn || '',
    notes:           t.notes || '',
  };
}

function dbToSale(row, ticketIdsBySaleId) {
  return {
    id:              row.id,
    eventId:         row.event_id || '',
    sellingPlatform: row.selling_platform || '',
    orderId:         row.order_id || '',
    qtySold:         row.qty_sold || 1,
    salePrice:       parseFloat(row.sale_price) || 0,
    salePriceEach:   parseFloat(row.sale_price_each) || 0,
    saleStatus:      row.sale_status || 'Pending',
    section:         row.section || '',
    row:             row.row || '',
    seats:           row.seats || '',
    date:            row.date || '',
    customerEmail:   row.customer_email || '',
    customerPhone:   row.customer_phone || '',
    notes:           row.notes || '',
    recordedAt:      row.recorded_at,
    ticketIds:       ticketIdsBySaleId?.[row.id] || [],
  };
}

function saleToDb(s) {
  return {
    id:               s.id,
    event_id:         s.eventId || null,
    selling_platform: s.sellingPlatform || '',
    order_id:         s.orderId || '',
    qty_sold:         parseInt(s.qtySold) || 1,
    sale_price:       parseFloat(s.salePrice) || 0,
    sale_price_each:  parseFloat(s.salePriceEach) || 0,
    sale_status:      s.saleStatus || 'Pending',
    section:          s.section || '',
    row:              s.row || '',
    seats:            s.seats || '',
    date:             s.date || '',
    customer_email:   s.customerEmail || '',
    customer_phone:   s.customerPhone || '',
    notes:            s.notes || '',
  };
}

const POLL_INTERVAL_MS = 30_000;

export function useQueudData() {
  const [events, setEventsState]     = useState([]);
  const [tickets, setTicketsState]   = useState([]);
  const [sales, setSalesState]       = useState([]);
  const [settings, setSettingsState] = useState({ gmailAccounts: [], openAiKey: '', extra: {} });
  const [loading, setLoading]        = useState(true);
  const [error, setError]            = useState(null);

  const localMutationIds = useRef(new Set());

  async function loadSaleTicketMap() {
    const { data, error } = await supabase.from('sale_tickets').select('sale_id, ticket_id');
    if (error) { console.warn('sale_tickets load error:', error.message); return {}; }
    const map = {};
    (data || []).forEach(({ sale_id, ticket_id }) => {
      if (!map[sale_id]) map[sale_id] = [];
      map[sale_id].push(ticket_id);
    });
    return map;
  }

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [
          { data: ev, error: eve },
          { data: t,  error: te  },
          { data: s,  error: se  },
          { data: st             },
          stMap,
        ] = await Promise.all([
          supabase.from('events').select('*').order('date', { ascending: true }),
          supabase.from('tickets').select('*').order('added_at', { ascending: false }),
          supabase.from('sales').select('*').order('recorded_at', { ascending: false }),
          supabase.from('settings').select('*').eq('id', 'user_settings').single(),
          loadSaleTicketMap(),
        ]);

        if (eve) throw eve;
        if (te)  throw te;
        if (se)  throw se;

        setEventsState((ev || []).map(dbToEvent));
        setTicketsState((t  || []).map(dbToTicket));
        setSalesState((s   || []).map(row => dbToSale(row, stMap)));

        if (st) {
          const extra = st.extra || {};
          setSettingsState({
            gmailAccounts: st.gmail_accounts || [],
            openAiKey:     extra.open_ai_key  || '',
            aycdApiKey:    extra.aycd_api_key || '',
            extra,
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

  // ── Background polling ────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;

    const interval = setInterval(async () => {
      try {
        const [{ data: t }, { data: s }, stMap] = await Promise.all([
          supabase.from('tickets').select('*').order('added_at', { ascending: false }),
          supabase.from('sales').select('*').order('recorded_at', { ascending: false }),
          loadSaleTicketMap(),
        ]);

        if (t) {
          setTicketsState(prev => {
            const prevMap = new Map(prev.map(x => [x.id, x]));
            const incoming = (t || []).map(dbToTicket);
            let changed = false;
            const merged = incoming.map(row => {
              const existing = prevMap.get(row.id);
              if (!existing) { changed = true; return row; }
              if (!localMutationIds.current.has(row.id) && existing.status !== row.status) {
                changed = true;
                return { ...existing, status: row.status, qtyAvailable: row.qtyAvailable };
              }
              return existing;
            });
            const incomingIds = new Set(incoming.map(r => r.id));
            prev.filter(p => !incomingIds.has(p.id)).forEach(p => { merged.push(p); changed = true; });
            return changed ? merged : prev;
          });
        }

        if (s) {
          setSalesState(prev => {
            const prevIds = new Set(prev.map(x => x.id));
            const incoming = (s || []).map(row => dbToSale(row, stMap));
            const newSales = incoming.filter(r => !prevIds.has(r.id));
            const upgraded = incoming.filter(r => {
              if (!prevIds.has(r.id)) return false;
              const existing = prev.find(p => p.id === r.id);
              return existing && existing.saleStatus !== r.saleStatus
                && !localMutationIds.current.has(r.id);
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
        console.warn('[poll] error:', e.message);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loading]);

  // ── Events CRUD ───────────────────────────────────────────────────────────

  const findOrCreateEvent = useCallback(async ({ name, venue, date, time, category }) => {
    const venueNorm = (venue || '').split(',')[0].trim();

    const existing = events.find(e =>
      e.date === date &&
      e.name.toLowerCase() === name.toLowerCase() &&
      e.venue.toLowerCase() === venueNorm.toLowerCase()
    );
    if (existing) return existing.id;

    const { data: found } = await supabase
      .from('events')
      .select('id')
      .ilike('name', name)
      .eq('date', date)
      .ilike('venue', venueNorm)
      .single();

    if (found) {
      setEventsState(prev => prev.find(e => e.id === found.id)
        ? prev
        : [...prev, { id: found.id, name, venue: venueNorm, date, time, category }]
      );
      return found.id;
    }

    const newId = Math.random().toString(36).slice(2, 10);
    const { error } = await supabase.from('events').insert({
      id: newId, name, venue: venueNorm, date, time,
      category: category || 'Concert',
    });
    if (error) { console.error('Event create error:', error); return null; }

    setEventsState(prev => [...prev, { id: newId, name, venue: venueNorm, date, time, category }]);
    return newId;
  }, [events]);

  // ── Tickets CRUD ──────────────────────────────────────────────────────────

  const setTickets = useCallback(async (updater) => {
    setTicketsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const prevIds = new Set(prev.map(t => t.id));
      const nextIds = new Set(next.map(t => t.id));

      const toUpsert = next.filter(t => {
        if (!prevIds.has(t.id)) return true;
        const old = prev.find(p => p.id === t.id);
        return JSON.stringify(ticketToDb(t)) !== JSON.stringify(ticketToDb(old));
      });
      const toDelete = [...prevIds].filter(id => !nextIds.has(id));

      toUpsert.forEach(t => localMutationIds.current.add(t.id));
      toDelete.forEach(id => localMutationIds.current.delete(id));

      if (toUpsert.length > 0) {
        supabase.from('tickets').upsert(toUpsert.map(ticketToDb)).then(({ error }) => {
          if (error) {
            console.error('Ticket upsert error:', error);
          } else {
            // Clear mutation lock once DB confirms — allows poll to pick up future server changes
            toUpsert.forEach(t => localMutationIds.current.delete(t.id));
          }
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

  // ── Sales CRUD ────────────────────────────────────────────────────────────

  const setSales = useCallback(async (updater) => {
    setSalesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const prevIds = new Set(prev.map(s => s.id));
      const nextIds = new Set(next.map(s => s.id));

      const toUpsert = next.filter(s => {
        if (!prevIds.has(s.id)) return true;
        const old = prev.find(p => p.id === s.id);
        return old && (
          old.saleStatus !== s.saleStatus ||
          old.customerEmail !== s.customerEmail ||
          old.customerPhone !== s.customerPhone
        );
      });
      const toDelete = [...prevIds].filter(id => !nextIds.has(id));

      toUpsert.forEach(s => localMutationIds.current.add(s.id));
      toDelete.forEach(id => localMutationIds.current.delete(id));

      if (toUpsert.length > 0) {
        supabase.from('sales').upsert(toUpsert.map(saleToDb)).then(({ error }) => {
          if (error) {
            console.error('Sale upsert error:', error);
          } else {
            // Clear mutation lock once DB confirms
            toUpsert.forEach(s => localMutationIds.current.delete(s.id));
          }
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

  // ── Update a single sale field ────────────────────────────────────────────

  const updateSale = useCallback((saleId, patch) => {
    setSalesState(prev => prev.map(s => s.id === saleId ? { ...s, ...patch } : s));
    localMutationIds.current.add(saleId);

    const dbPatch = {};
    if (patch.saleStatus    !== undefined) dbPatch.sale_status    = patch.saleStatus;
    if (patch.customerEmail !== undefined) dbPatch.customer_email = patch.customerEmail;
    if (patch.customerPhone !== undefined) dbPatch.customer_phone = patch.customerPhone;

    if (Object.keys(dbPatch).length > 0) {
      supabase.from('sales').update(dbPatch).eq('id', saleId).then(({ error }) => {
        if (error) {
          console.error('updateSale error:', error);
        } else {
          // Clear mutation lock once DB confirms
          localMutationIds.current.delete(saleId);
        }
      });
    }
  }, []);

  // ── Link tickets to a sale ────────────────────────────────────────────────

  const linkTicketsToSale = useCallback(async (saleId, ticketIds) => {
    const rows = ticketIds.map(tid => ({ sale_id: saleId, ticket_id: tid }));
    const { error } = await supabase.from('sale_tickets').upsert(rows);
    if (error) { console.error('Link error:', error); return; }

    const { error: ticketError } = await supabase
      .from('tickets')
      .update({ status: 'Sold', qty_available: 0 })
      .in('id', ticketIds);
    if (ticketError) console.error('Ticket status error:', ticketError);

    setSalesState(prev => prev.map(s =>
      s.id === saleId
        ? { ...s, ticketIds: [...new Set([...(s.ticketIds || []), ...ticketIds])] }
        : s
    ));

    setTicketsState(prev => prev.map(t =>
      ticketIds.includes(t.id) ? { ...t, status: 'Sold', qtyAvailable: 0 } : t
    ));

    ticketIds.forEach(id => localMutationIds.current.add(id));
    localMutationIds.current.add(saleId);
  }, []);

  // ── Settings ──────────────────────────────────────────────────────────────

  const setSettings = useCallback((updater) => {
    setSettingsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      const prevExtra = prev.extra || {};
      const nextExtra = {
        ...prevExtra,
        ...(next.openAiKey  !== undefined ? { open_ai_key:  next.openAiKey  } : {}),
        ...(next.aycdApiKey !== undefined ? { aycd_api_key: next.aycdApiKey } : {}),
        ...Object.fromEntries(
          Object.entries(next.extra || {}).filter(([k]) =>
            k.startsWith('salesPlatform_') ||
            k.startsWith('ticketPlatform_') ||
            k.startsWith('sync_')
          )
        ),
      };

      supabase.from('settings').upsert({
        id: 'user_settings',
        gmail_accounts: next.gmailAccounts || [],
        extra: nextExtra,
      }).then(({ error }) => {
        if (error) console.error('Settings error:', error);
      });

      return { ...next, extra: nextExtra };
    });
  }, []);

  return {
    events,
    tickets,  setTickets,
    sales,    setSales,    updateSale,
    settings, setSettings,
    findOrCreateEvent,
    linkTicketsToSale,
    loading, error,
  };
}