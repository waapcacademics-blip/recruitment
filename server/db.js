const { Pool } = require('pg');

// Supabase (or any hosted Postgres) via DATABASE_URL. Using an external DB
// instead of a local SQLite file means the app can run on hosts with an
// ephemeral filesystem (free tiers on Render, etc.) without losing data.
if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL is not set — add your Supabase connection string to .env');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      candidate_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      current_stage TEXT NOT NULL,
      completed_count INTEGER NOT NULL DEFAULT 0,
      flags_total INTEGER NOT NULL DEFAULT 0,
      state TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hr_users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invites (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      sent_at TEXT NOT NULL
    );
  `);
}

module.exports = { pool, initSchema };
