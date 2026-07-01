// Factory module initializing and exposing Supabase JS clients for browser, server, and authenticated request contexts.
import { createClient } from '@supabase/supabase-js';

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;


export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);


export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })
  : (null as any);


let browserClient: any;

export function createBrowserSupabaseClient() {
  if (!isSupabaseConfigured) return null as any;
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl!, supabaseAnonKey!);
  }
  return browserClient;
}



export function createAuthenticatedClient(accessToken: string) {
  if (!isSupabaseConfigured) return null as any;
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: {
        // Explicitly override client request headers to use the user's JWT access token for security checks.
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}
