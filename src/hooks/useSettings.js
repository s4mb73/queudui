import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const DEFAULT_SETTINGS = {
  gmailAccounts: [],
  openAiKey: '',
  aycdApiKey: '',
};

export function settingsToDb(s) {
  // Only gmail_accounts and open_ai_key are real columns.
  // Everything else (aycdApiKey, salesPlatform_*, etc) goes into extra jsonb.
  const { gmailAccounts, openAiKey, ...extra } = s;
  return {
    id: 'user_settings',
    gmail_accounts: gmailAccounts || [],
    open_ai_key: openAiKey || '',
    extra: extra || {},
  };
}

export function dbToSettings(row) {
  return {
    gmailAccounts: row.gmail_accounts || [],
    openAiKey: row.open_ai_key || '',
    ...(row.extra || {}),
  };
}

export function useSettings(initialData = DEFAULT_SETTINGS) {
  const [settings, setSettingsState] = useState(initialData);

  const setSettings = useCallback((updater) => {
    setSettingsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      supabase.from('settings').upsert(settingsToDb(next)).then(({ error }) => {
        if (error) console.error('Settings error:', error);
      });
      return next;
    });
  }, []);

  return { settings, setSettings, setSettingsState };
}