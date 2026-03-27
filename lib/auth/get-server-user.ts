import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/config/env';

export async function getServerUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(env.supabase.url!, env.supabase.anonKey!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: '', ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
