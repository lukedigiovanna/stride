import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ygxetvlkqwbsuyxlmkuf.supabase.co" as string;
const supabaseAnonKey = "sb_publishable_tMCmN_v-WBjjMHz1vXlFpw_RAGbQTPI" as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local'
  );
}

/**
 * The singleton Supabase client used throughout the app.
 *
 * Currently untyped — the generic Database parameter is omitted because
 * the hand-written stub in database.types.ts doesn't fully satisfy Supabase's
 * internal generic constraints. Replace with a properly generated client once
 * the Supabase CLI is available:
 *
 *   npx supabase gen types typescript --project-id <YOUR_PROJECT_ID> \
 *     > src/lib/database.types.ts
 *
 * Then re-add: createClient<Database>(url, key)
 *
 * All query results are cast to our own domain types (src/types/index.ts)
 * throughout the codebase, so type safety is maintained at the app layer.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
