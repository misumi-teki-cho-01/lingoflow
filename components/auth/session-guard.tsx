"use client";
import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function SessionGuard() {
  const router = useRouter();

  useEffect(() => {
    const remember = localStorage.getItem('lingo-remember');
    const active = sessionStorage.getItem('lingo-active');

    if (remember === '0' && !active) {
      // Session-only mode + new browser session → sign out
      const supabase = createClient();
      supabase.auth.signOut().then(() => {
        localStorage.removeItem('lingo-remember');
        router.replace('/');
      });
    } else if (remember === '0') {
      // Ensure session marker stays present
      sessionStorage.setItem('lingo-active', '1');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
