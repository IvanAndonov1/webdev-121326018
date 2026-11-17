const path = require('node:path');
const express = require('express');
const session = require('express-session');
const db = require('./db');

function getSessionSecret() {
  if (process.env.NODE_ENV === 'production') {
    const secret = process.env.SESSION_SECRET || '';
    if (!secret || secret === 'development-secret' || secret.length < 32) {
      throw new Error('SESSION_SECRET must be set to a secure value in production.');
    }
    return secret;
  }

  return process.env.SESSION_SECRET || 'study-sync-dev-secret';
}

function isSecureCookie() {
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }

  const publicBaseUrl = process.env.PUBLIC_BASE_URL || '';
  return /^https:/i.test(publicBaseUrl);
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    const nextUrl = encodeURIComponent(req.originalUrl || '/study-groups');
    return res.redirect(`/login?next=${nextUrl}`);
  }
  return next();
}

function requireApiAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  return next();
}

function createApp() {
  const app = express();
  const publicDir = path.join(__dirname, '..', 'public');

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    session({
      name: 'connect.sid',
      secret: getSessionSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureCookie(),
        maxAge: 60 * 60 * 1000,
      },
      rolling: true,
    }),
  );

  app.get('/login', (req, res) => {
    res.sendFile(path.join(publicDir, 'login.html'));
  });

  app.post('/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await db.getUserByEmail(email);
    const passwordHash = db.hashPassword(password);

    if (!user || user.password_hash !== passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        return res.status(500).json({ error: 'Unable to start a secure session.' });
      }

      req.session.user = { id: user.id, email: user.email, name: user.name };
      req.session.save((saveError) => {
        if (saveError) {
          return res.status(500).json({ error: 'Unable to save the session.' });
        }

        const redirectUrl = typeof req.body?.next === 'string' && req.body.next ? req.body.next : '/study-groups';
        return res.redirect(redirectUrl);
      });
    });
  });

  app.post('/logout', (req, res) => {
    const destroy = () => {
      res.clearCookie('connect.sid', { path: '/' });
      return res.redirect('/login');
    };

    if (!req.session) {
      return destroy();
    }

    req.session.destroy((error) => {
      if (error) {
        return res.status(500).json({ error: 'Unable to log out.' });
      }
      return destroy();
    });
  });

  app.get(['/study-groups', '/groups.html'], requireAuth, (req, res) => {
    res.sendFile(path.join(publicDir, 'groups.html'));
  });

  app.use(express.static(publicDir));

  app.get('/api/groups', requireApiAuth, async (req, res) => {
    try {
      const groups = await db.getGroups();
      return res.json(groups);
    } catch (error) {
      return res.status(500).json({ error: 'Unable to load groups.' });
    }
  });

  app.post('/api/groups', requireApiAuth, async (req, res) => {
    try {
      const group = await db.createGroup({
        name: req.body?.name,
        description: req.body?.description || '',
      });
      return res.status(201).json(group);
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Unable to create the group.' });
    }
  });

  app.delete('/api/groups/:id', requireApiAuth, async (req, res) => {
    try {
      const deleted = await db.deleteGroup(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Group not found.' });
      }
      return res.status(204).end();
    } catch (error) {
      return res.status(400).json({ error: 'Unable to delete group.' });
    }
  });

  app.get('/', (req, res) => {
    const target = req.session && req.session.user ? '/study-groups' : '/login';
    return res.redirect(target);
  });

  return app;
}

module.exports = { createApp, requireAuth, requireApiAuth, getSessionSecret, isSecureCookie };
