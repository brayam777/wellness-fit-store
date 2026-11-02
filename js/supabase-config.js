// Pinned to a specific version instead of the floating "@2" — esm.sh had a
// broken build of @supabase/postgrest-js under the latest 2.x resolution
// (2.112.2), which silently took down every page that imports supabase-js
// through this file. Pinning avoids getting broken again by a future upstream
// release; bump deliberately and test if you ever need a newer version.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.111.0';

// Standalone Supabase project for Wellness Fit Store, under the
// barayamgamer@gmail.com Supabase account.
const SUPABASE_URL = 'https://vxeokiiwdsbwodlriadm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SW-vmqabZBpebIXjgQSjQQ__xCNmggO';

export const isConfigured = SUPABASE_URL !== 'PENDING_SETUP';

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { flowType: 'implicit' } })
  : null;
