# health-live

This project provides a minimal backend and database schema for ingesting
Health Auto Export (HAE) data and serving it to a client dashboard. It
implements two Next.js API routes:

- `POST /api/hae/ingest`: accepts health metrics and workouts exported from
  HAE. Requires an `Authorization: Bearer <token>` header matching
  the `HAE_TOKEN` environment variable. Stores the payload in a Supabase
  table (`health_metrics`).

- `GET /api/timeseries?range=60d`: returns a time‑ordered list of ingested
  records. The optional `range` query controls how far back to look
  (`30d`, `60d`, `12w`, `6m`, etc). Without Supabase credentials this
  route returns an empty array, which makes it safe to deploy before
  configuring your database.

## Setup and deployment

1. **Create a Supabase project**. Note your project URL and the
   *Service Role* API key (found under *Project Settings → API*).
2. Run the migration in `supabase_migration.sql` using the SQL editor or
   `supabase db query` to create the `health_metrics` table.
3. **Configure environment variables** in your deployment platform:
   - `HAE_TOKEN`: a secret token that HAE will send in the
     Authorization header.
   - `SUPABASE_URL`: your Supabase project URL.
   - `SUPABASE_SERVICE_ROLE`: the service role key for database writes.
4. Deploy to Vercel (or similar) using this repository. The API
   endpoints will be available under your deployment domain.

## Notes

This code is intentionally minimal. The ingest endpoint stores the
entire incoming JSON payload in the database so that it can later be
analysed and summarised. The `timeseries` endpoint simply returns the
stored records; you can extend this to compute recovery scores,
exertion values and other metrics on the fly.
