require('dotenv').config();
const path = require('path');
const express = require('express');

const { initSchema } = require('./db');
const { seedAdminIfNeeded, sessionMiddleware } = require('./auth');
const contentRoutes = require('./routes/content');
const candidateRoutes = require('./routes/candidates');
const adminRoutes = require('./routes/admin');

async function main() {
  await initSchema();
  await seedAdminIfNeeded();

  const app = express();
  app.set('trust proxy', 1); // needed behind Render/Cloudflare so secure cookies + req.ip work
  app.use(express.json({ limit: '2mb' }));
  app.use(sessionMiddleware());

  app.use('/api/content', contentRoutes);
  app.use('/api/candidates', candidateRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(express.static(path.join(__dirname, '..', 'public')));

  // SPA fallback so /?email=... and any client-side route still loads the app shell.
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`WAS Faculty Recruitment Portal running at http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
