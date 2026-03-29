import { type Express, type NextFunction, type Request, type Response } from 'express';

const COOKIE_NAME = 'site_access_token';

export function registerSiteAuth(app: Express) {
  const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const sitePassword = process.env.SITE_PASSWORD;
    const reqPath = req.path;
    const isApiRequest = reqPath.startsWith('/api') || reqPath.includes('/api/');
    const isPublicPath = isApiRequest || reqPath.includes('/login') || reqPath.includes('/status');

    if (!sitePassword || isPublicPath) return next();

    const cookies = req.headers.cookie || '';
    const match = cookies.match(new RegExp(`(^| )${COOKIE_NAME}=([^;]+)`));
    const token = match ? match[2] : null;
    if (token === sitePassword) return next();

    if (!isApiRequest) {
      return res.status(401).send(`<!DOCTYPE html><html><body><form onsubmit="event.preventDefault(); fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:this.pw.value})}).then(r => r.ok ? window.location.reload() : alert('Nop'))"><input type="password" name="pw" placeholder="Code" required autoFocus><button type="submit">Entrer</button></form></body></html>`);
    }

    res.status(401).json({ error: 'Unauthenticated' });
  };

  app.use(authMiddleware);

  app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.SITE_PASSWORD) {
      res.setHeader('Set-Cookie', `${COOKIE_NAME}=${password}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`);
      return res.json({ success: true });
    }

    res.status(401).json({ error: 'Refuse' });
  });
}
