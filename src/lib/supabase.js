import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://imzbjosuqtoeyvnhzkpf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ysGq_YDAI-7r_sjWy2lXCw_XaDEwO2T';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
