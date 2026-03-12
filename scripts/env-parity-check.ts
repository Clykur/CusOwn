#!/usr/bin/env ts-node

/**
 * Environment parity checker for Supabase + Next.js system.
 * Compares RLS policies between staging and production projects.
 *
 * Requires:
 * - SUPABASE_STAGING_URL
 * - SUPABASE_STAGING_SERVICE_ROLE_KEY
 * - SUPABASE_PRODUCTION_URL
 * - SUPABASE_PRODUCTION_SERVICE_ROLE_KEY
 */

/* eslint-disable no-console */

import 'ts-node/register';
import { createClient } from '@supabase/supabase-js';

type ProjectEnv = 'staging' | 'production';

interface ProjectConfig {
  url: string;
  serviceRoleKey: string;
}

function getConfig(prefix: ProjectEnv): ProjectConfig {
  const upper = prefix.toUpperCase();
  const url = process.env[`SUPABASE_${upper}_URL`];
  const key = process.env[`SUPABASE_${upper}_SERVICE_ROLE_KEY`];
  if (!url || !key) {
    throw new Error(`Missing SUPABASE_${upper}_URL or SUPABASE_${upper}_SERVICE_ROLE_KEY`);
  }
  return { url, serviceRoleKey: key };
}

async function fetchPolicies(client: ReturnType<typeof createClient>) {
  const { data, error } = await client
    .from('pg_policies' as any)
    .select('schemaname, tablename, policyname, cmd');
  if (error) throw error;
  return data ?? [];
}

async function main() {
  const stagingCfg = getConfig('staging');
  const prodCfg = getConfig('production');

  const staging = createClient(stagingCfg.url, stagingCfg.serviceRoleKey, {
    auth: { persistSession: false },
  });
  const prod = createClient(prodCfg.url, prodCfg.serviceRoleKey, {
    auth: { persistSession: false },
  });

  const [stagingPolicies, prodPolicies] = await Promise.all([
    fetchPolicies(staging),
    fetchPolicies(prod),
  ]);

  const normalize = (rows: any[]) =>
    rows.map((r) => `${r.schemaname}.${r.tablename}:${r.policyname}:${r.cmd}`).sort();

  const sSet = new Set(normalize(stagingPolicies));
  const pSet = new Set(normalize(prodPolicies));

  const onlyStaging = [...sSet].filter((x) => !pSet.has(x));
  const onlyProd = [...pSet].filter((x) => !sSet.has(x));

  console.log(
    JSON.stringify(
      {
        rls_only_in_staging: onlyStaging,
        rls_only_in_production: onlyProd,
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
