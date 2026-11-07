import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s); setUser(s?.user ?? null);
      setIsSuperAdmin(s?.user?.email?.toLowerCase() === "a65398716@gmail.com");
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session); setUser(data.session?.user ?? null);
      setIsSuperAdmin(data.session?.user?.email?.toLowerCase() === "a65398716@gmail.com");
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, user, loading, isSuperAdmin };
}
