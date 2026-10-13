import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// A frontend csak a publikus anon kulcsot használhatja. Service-role kulcsot soha ne tegyél ide.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
