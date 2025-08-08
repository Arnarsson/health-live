// API route to ingest Health Auto Export data.
// Accepts JSON payload with fields `{metrics, workouts}` and optional others.
// Requires an Authorization header with a Bearer token equal to process.env.HAE_TOKEN.
// Stores payload and derived metrics into Supabase.

import { createClient } from '@supabase/supabase-js';

/**
 * Create a Supabase client for server-side use. If the environment variables
 * `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE` are missing the handler will
 * function without attempting to write to Supabase. This allows the API
 * to be deployed for demo purposes without a database.
 */
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    return null;
  }
  return createClient(url, key);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Verify token
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;
  if (!token || token !== process.env.HAE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Parse body
  const { metrics, workouts, ...rest } = req.body || {};
  if (!metrics && !workouts) {
    return res.status(400).json({ error: 'Request body must include metrics or workouts' });
  }
  const ingestDate = new Date().toISOString();
  const record = {
    ingest_date: ingestDate,
    metrics: metrics || null,
    workouts: workouts || null,
    payload: rest || null,
  };
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      // Insert record into `health_metrics` table
      const { error } = await supabase.from('health_metrics').insert(record);
      if (error) {
        console.error('Supabase insert error', error);
        // continue execution even if DB insert fails
      }
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
