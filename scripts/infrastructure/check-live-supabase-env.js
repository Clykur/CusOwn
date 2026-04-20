#!/usr/bin/env node
/**
 * Exit 0 if NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY look like a real Supabase project.
 * Exit 1 if missing, placeholder, or invalid URL (same merge order as scripts/test-utils.ts).
 * Used by scripts/run-all-tests.sh to skip e2e/integration when no live DB is configured.
 */
const path = require('path');
const dotenv = require('dotenv');

const root = process.cwd();
dotenv.config({ path: path.join(root, '.env.test') });
dotenv.config({ path: path.join(root, '.env.local') });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function isLive() {
  if (!url || !key) return false;
  if (/placeholder/i.test(url) || /placeholder/i.test(key)) return false;
  if (key === 'placeholder-service-role-key' || key === 'placeholder-anon-key') return false;
  try {
    const { hostname } = new URL(url);
    if (!hostname || hostname === 'placeholder.supabase.co') return false;
  } catch {
    return false;
  }
  return true;
}

process.exit(isLive() ? 0 : 1);
