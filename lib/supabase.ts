import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 브라우저(클라이언트) 용 — anon key
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 서버 전용 — service role key (RLS 우회, Server Action/API Route에서만 사용)
export function createServerClient() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
