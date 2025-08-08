// API route to return a time series of ingested metrics.
// Accepts an optional `range` query (e.g. '60d', '30d') specifying the number of days to include.
// If Supabase configuration is missing this route returns an empty array.

import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    return null;
  }
  return createClient(url, key);
}

function parseRange(range) {
  if (!range || typeof range !== 'string') return null;
  const match = range.match(/(\d+)([dwmy])/);
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const now = new Date();
  const date = new Date(now);
  switch (unit) {
    case 'd':
      date.setDate(now.getDate() - amount);
      break;
    case 'w':
      date.setDate(now.getDate() - amount * 7);
      break;
    case 'm':
      date.setMonth(now.getMonth() - amount);
      break;
    case 'y':
      date.setFullYear(now.getFullYear() - amount);
      break;
    default:
      return null;
  }
  return date.toISOString();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const range = req.query.range || '60d';
  const since = parseRange(range);
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(200).json({ data: [] });
    }
    let query = supabase
      .from('health_metrics')
      .select('ingest_date, metrics, workouts')
      .order('ingest_date', { ascending: true });
    if (since) {
      query = query.gte('ingest_date', since);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Supabase fetch error', error);
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(200).json({ data: data || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
