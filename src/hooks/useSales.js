import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function dbToSale(row) {
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

export function saleToDb(s) {
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

export function useSales(initialData = []) {
  const [sales, setSalesState] = useState(initialData);

  const setSales = useCallback((updater) => {
    setSalesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;

      const prevIds = new Set(prev.map(s => s.id));
      const nextIds = new Set(next.map(s => s.id));

      // Upsert new records only (status updates handled separately via updateSale)
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

  // Update a single sale field (e.g. saleStatus) and persist to Supabase
  const updateSale = useCallback((saleId, patch) => {
    setSalesState(prev => {
      const next = prev.map(s => s.id === saleId ? { ...s, ...patch } : s);
      const updated = next.find(s => s.id === saleId);
      if (updated) {
        supabase.from('sales').update(saleToDb(updated)).eq('id', saleId).then(({ error }) => {
          if (error) console.error('Sale update error:', error);
        });
      }
      return next;
    });
  }, []);

  return { sales, setSales, updateSale, setSalesState };
}
