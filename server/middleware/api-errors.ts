import { type Express, type NextFunction, type Request, type Response } from 'express';

import { log } from '../lib/logger.js';

export function registerApiErrorHandlers(app: Express) {
  app.use('/api/*', (req, res) => {
    log.warn(`404 Not Found: ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Not Found', message: `La route ${req.path} n'existe pas.` });
  });

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    log.error(`Global error caught for ${req.method} ${req.path}`, err);
    const status = err.status || err.statusCode || 500;

    if (req.path.startsWith('/api')) {
      return res.status(status).json({
        error: 'Internal Server Error',
        message: err.message || String(err),
        path: req.path
      });
    }

    res.status(status).send(`Something went wrong: ${err.message || String(err)}`);
  });
}
