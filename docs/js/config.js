/**
 * Supabase connection settings.
 *
 * PUBLISHABLE KEY (`sb_publishable_...`)
 * The modern replacement for the legacy `anon` key, which Supabase deprecates
 * at the end of 2026. It is DESIGNED to ship in client-side code — the docs
 * describe it as safe to expose in web pages, source code and CI. It carries
 * low privileges on its own.
 *
 * Your data is protected by Row Level Security, not by hiding this key. When a
 * user signs in via Supabase Auth the Postgres role becomes `authenticated`,
 * which is what the `auth.uid()` policies in supabase/schema.sql match on.
 * With RLS disabled, this key would expose every table.
 *
 * NEVER put either of these here:
 *   - the secret key (`sb_secret_...`) — bypasses RLS entirely
 *   - the postgres connection string — superuser access to the database
 */
export const SUPABASE_URL = 'https://pwvishvqfofaehnqzupc.supabase.co';

// Project Settings > API Keys > Publishable key
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5cOdMSic3QYOJsvKrYxpEA_JkiedPER';

/** Where the compiled plan manifest lives, relative to index.html. */
export const PLANS_URL = './data/plans.json';

export const isConfigured = () =>
  !SUPABASE_URL.includes('YOUR-PROJECT-REF') &&
  !SUPABASE_PUBLISHABLE_KEY.includes('YOUR_KEY_HERE');
