import express, { type Express } from 'express';

import { MAX_PAYLOAD } from '../lib/config.js';

export function registerRequestHardening(app: Express) {
  app.use(express.json({ limit: MAX_PAYLOAD }));
  app.use(express.urlencoded({ limit: MAX_PAYLOAD, extended: true }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    next();
  });
}
