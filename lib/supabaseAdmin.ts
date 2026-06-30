// Administrative Supabase client using service role key to bypass RLS policies for backend workflows.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseAdminConfigured = !!(supabaseUrl && supabaseServiceKey);

// Instantiates a client with elevated service role credentials. Run only in internal server environments.
export const supabaseAdmin = isSupabaseAdminConfigured
  ? createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })
  : (null as any);
