import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { env } from './config/env';
import { logger } from './utils/logger';

console.log('🚀 [ChefApp] Server is booting...');

// Routes
import healthRoutes from './routes/health.routes';
import chatRoutes from './routes/chat.routes';
import crawlRoutes from './routes/crawl.routes';
import { getDatabase } from './database/factory';

const app = express();
const db = getDatabase();

// Middlewares
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  frameguard: false // Cho phép render trong Iframe
}));
app.use(cors({ origin: '*' })); // Allow all for dev
app.use(express.json({ limit: '50mb' }));
app.use(pinoHttp({ logger }));

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/crawl', crawlRoutes);

// Legacy routes mapping for zero-breaking changes
app.get('/api/health-check', (req, res) => res.redirect(307, '/api/health/check'));
app.get('/api/list-models', (req, res) => res.redirect(307, '/api/chat/models'));

// Static/Vite Setup
const startApp = async () => {
  console.log('🚀 [ChefApp] Starting App Lifecycle...');
  try {
    logger.info('📦 Connecting to database...');
    await db.connect();
    logger.info('✅ Database connected.');

    if (env.NODE_ENV !== 'production') {
      logger.info('🛠️ Starting Vite in middleware mode...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`🚀 Server logic migrated! Running at http://localhost:${env.PORT}`);
  });
  } catch (error) {
    logger.error('❌ Failed to start server: %o', error);
    process.exit(1);
  }
};

startApp();
