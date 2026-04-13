import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface DbAccess {
  db: SupabaseClient;
  userId: string | null;
  isAuthenticated: boolean;
}

export async function getDbAccess(): Promise<DbAccess | null> {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error && error.message !== "Auth session missing!") {
    console.warn("[Supabase] Failed to resolve authenticated user:", error.message);
  }

  if (user) {
    return {
      db: supabase,
      userId: user.id,
      isAuthenticated: true,
    };
  }

  const devUserId = process.env.DEV_SUPABASE_USER_ID?.trim() ?? null;
  if (devUserId && adminSupabase) {
    return {
      db: adminSupabase,
      userId: devUserId,
      isAuthenticated: false,
    };
  }

  return null;
}
