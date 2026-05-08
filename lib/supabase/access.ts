import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export interface DbAccess {
  db: SupabaseClient;
  userId: string | null;
  isAuthenticated: boolean;
}

export async function getDbAccess(): Promise<DbAccess | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error && error.message !== 'Auth session missing!') {
    console.warn('[Supabase] Failed to resolve authenticated user:', error.message);
  }

  if (user) {
    return {
      db: supabase,
      userId: user.id,
      isAuthenticated: true,
    };
  }

  return null;
}
