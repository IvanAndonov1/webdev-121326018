const path = require('node:path');
const bcrypt = require('bcrypt');
const express = require('express');
const session = require('express-session');
const { createPool, initializeDatabase, seedDatabase } = require('./db.js');

function createApp({ pool = createPool() } = {}) {
  const app = express();

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'development-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 4,
      },
    })
  );

  app.use(express.static(path.join(__dirname, '../public')));

  function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    next();
  }

  function requireAuthPage(req, res, next) {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }
    next();
  }

  app.get('/', (req, res) => {
    if (req.session && req.session.userId) {
      return res.redirect('/study-groups');
    }
    return res.redirect('/login');
  });

  app.get('/login', (req, res) => {
    if (req.session && req.session.userId) {
      return res.redirect('/study-groups');
    }
    return res.sendFile(path.join(__dirname, '../public/login.html'));
  });

  app.get('/study-groups', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/groups.html'));
  });

  app.get('/api/me', (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    return res.json({ user: { id: req.session.userId, name: req.session.userName } });
  });

  app.post('/api/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
      const userResult = await pool.query(
        'SELECT id, email, full_name, password_hash FROM users WHERE email = $1',
        [email]
      );
      const user = userResult.rows[0];

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      req.session.userId = user.id;
      req.session.userName = user.full_name;
      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.full_name,
        },
      });
    } catch (error) {
      return res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  });

  app.post('/api/logout', (req, res) => {
    if (!req.session) {
      return res.status(200).json({ success: true });
    }

    req.session.destroy((error) => {
      if (error) {
        return res.status(500).json({ error: 'Unable to log out.' });
      }
      return res.json({ success: true });
    });
  });

  app.get('/api/groups', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `
          SELECT
            sg.id,
            sg.name,
            sg.description,
            sg.meeting_day,
            sg.meeting_time,
            sg.max_members,
            c.code AS course_code,
            c.title AS course_title,
            COUNT(DISTINCT gm.user_id) AS member_count,
            BOOL_OR(gm.user_id = $1) AS is_member
          FROM study_groups sg
          JOIN courses c ON c.id = sg.course_id
          LEFT JOIN group_memberships gm ON gm.group_id = sg.id
          GROUP BY sg.id, c.code, c.title
          ORDER BY c.code, sg.name;
        `,
        [req.session.userId]
      );

      const groups = result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        meetingDay: row.meeting_day,
        meetingTime: row.meeting_time,
        maxMembers: Number(row.max_members),
        courseCode: row.course_code,
        courseTitle: row.course_title,
        memberCount: Number(row.member_count),
        isMember: row.is_member,
      }));

      return res.json(groups);
    } catch (error) {
      return res.status(500).json({ error: 'Unable to load study groups.' });
    }
  });

  return app;
}

module.exports = {
  createApp,
  createPool,
  initializeDatabase,
  seedDatabase,
};
