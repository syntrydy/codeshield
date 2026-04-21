import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// TODO: replace `unknown` with the generated Database type once schema is defined
export const supabase = createClient<Record<string, unknown>>(supabaseUrl, supabasePublishableKey);
