// Factory module initializing and exposing Supabase JS clients for browser, server, and authenticated request contexts.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createBrowserClient } from '@supabase/ssr';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;


export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);


export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })
  : null;


let browserClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase not configured');
  }
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
}



export function createAuthenticatedClient(accessToken: string): SupabaseClient {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase not configured');
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
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
