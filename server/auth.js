const bcrypt = require('bcryptjs');
const session = require('express-session');
const { pool } = require('./db');

// Seed the first HR admin from env vars if no admin account exists yet.
async function seedAdminIfNeeded() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM hr_users');
  if (rows[0].n > 0) return;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.warn(
      '[auth] No HR admin account exists and ADMIN_USERNAME/ADMIN_PASSWORD are not set in .env — ' +
        'the admin roster view will be inaccessible until one is created.'
    );
    return;
  }
  const hash = bcrypt.hashSync(password, 12);
  await pool.query('INSERT INTO hr_users (username, password_hash, created_at) VALUES ($1, $2, $3)', [
    username,
    hash,
    new Date().toISOString(),
  ]);
  console.log(`[auth] Seeded initial HR admin account "${username}".`);
}

function sessionMiddleware() {
  return session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminUsername) return next();
  return res.status(401).json({ error: 'Not signed in.' });
}

async function verifyAdminLogin(username, password) {
  const { rows } = await pool.query('SELECT * FROM hr_users WHERE username = $1', [username]);
  const row = rows[0];
  if (!row) return false;
  return bcrypt.compareSync(password, row.password_hash);
}

module.exports = { seedAdminIfNeeded, sessionMiddleware, requireAdmin, verifyAdminLogin };
