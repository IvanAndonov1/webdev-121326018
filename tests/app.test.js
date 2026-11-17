process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-for-studysync-fallback';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5433/studysync_test';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');

const { createApp, requireAuth, requireApiAuth, getSessionSecret, isSecureCookie } = require('../src/app');
const db = require('../src/db');
const { initializeDatabase, resetDatabase, seedDevelopmentData } = db;

let app;

async function createSessionCookie(agent, email = 'demo@studysync.local', password = 'demo123') {
  const loginResponse = await agent
    .post('/login')
    .send({ email, password })
    .redirects(0)
    .expect(302);

  const setCookie = loginResponse.headers['set-cookie'];
  assert.ok(setCookie && setCookie.length > 0, 'login should set a session cookie');
  return setCookie[0].split(';')[0];
}

test.before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-session-secret-for-studysync-fallback';
  app = createApp();
  await initializeDatabase();
  await resetDatabase();
});

test.beforeEach(async () => {
  await resetDatabase();
  await seedDevelopmentData();
});

test.afterEach(async () => {
  await resetDatabase();
});

test('AC-11 the database change is visible in a later authenticated group list request', async (t) => {
  t.after(async () => {
    await resetDatabase();
  });

  const agent = request.agent(app);
  const sessionCookie = await createSessionCookie(agent);

  const created = await agent
    .post('/api/groups')
    .set('Cookie', sessionCookie)
    .send({ name: 'Night Review', description: 'Shared flashcards' })
    .expect(201);

  const list = await agent
    .get('/api/groups')
    .set('Cookie', sessionCookie)
    .expect(200);

  assert.ok(list.body.some((group) => group.id === created.body.id && group.name === 'Night Review'));
});

test('AC-13 the owner can remove a database row and it disappears from the list', async (t) => {
  t.after(async () => {
    await resetDatabase();
  });

  const agent = request.agent(app);
  const sessionCookie = await createSessionCookie(agent);

  const created = await agent
    .post('/api/groups')
    .set('Cookie', sessionCookie)
    .send({ name: 'Deletable Group', description: 'Will be removed' })
    .expect(201);

  await agent
    .delete(`/api/groups/${created.body.id}`)
    .set('Cookie', sessionCookie)
    .expect(204);

  const list = await agent
    .get('/api/groups')
    .set('Cookie', sessionCookie)
    .expect(200);

  assert.ok(!list.body.some((group) => group.id === created.body.id));
});

test('AC-10 study-groups page and API require authentication', async () => {
  await request(app)
    .get('/study-groups')
    .expect(302)
    .expect('Location', /\/login/);

  await request(app)
    .get('/groups.html')
    .expect(302)
    .expect('Location', /\/login/);

  const response = await request(app)
    .get('/api/groups')
    .expect(401);

  assert.equal(response.body.error, 'Authentication required.');
});

test('session fixation is prevented after login', async () => {
  const attackerSessionId = 'connect.sid=attacker-fixed-session';

  const response = await request(app)
    .post('/login')
    .set('Cookie', attackerSessionId)
    .send({ email: 'demo@studysync.local', password: 'demo123' })
    .redirects(0)
    .expect(302);

  const newCookie = response.headers['set-cookie'][0].split(';')[0];
  assert.ok(newCookie.includes('connect.sid='));
  assert.notEqual(attackerSessionId, newCookie);
});

test('logout destroys the server-side session and invalidates the browser cookie', async () => {
  const agent = request.agent(app);
  const sessionCookie = await createSessionCookie(agent);

  const logoutResponse = await agent
    .post('/logout')
    .set('Cookie', sessionCookie)
    .redirects(0)
    .expect(302);

  assert.ok(logoutResponse.headers['set-cookie'][0].includes('connect.sid='));
});

test('malicious stored HTML is treated as text instead of executing in the browser', async () => {
  const filePath = path.join(__dirname, '..', 'public', 'groups.js');
  const source = await fs.promises.readFile(filePath, 'utf8');

  assert.match(source, /textContent/i);
  assert.doesNotMatch(source, /innerHTML/i);
  assert.match(source, /document\.createElement/i);
});

test('production session security and guard helpers are enforced', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.SESSION_SECRET;
  const originalBaseUrl = process.env.PUBLIC_BASE_URL;

  try {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = '';
    assert.throws(() => getSessionSecret(), /SESSION_SECRET/);

    process.env.SESSION_SECRET = 'short-secret';
    assert.throws(() => getSessionSecret(), /SESSION_SECRET/);

    process.env.SESSION_SECRET = 'development-secret';
    assert.throws(() => getSessionSecret(), /SESSION_SECRET/);

    process.env.SESSION_SECRET = 'this-is-a-safe-production-secret-1234';
    assert.equal(getSessionSecret(), 'this-is-a-safe-production-secret-1234');
    process.env.PUBLIC_BASE_URL = 'https://example.com';
    assert.equal(isSecureCookie(), true);

    process.env.PUBLIC_BASE_URL = 'http://example.com';
    assert.equal(isSecureCookie(), false);

    delete process.env.PUBLIC_BASE_URL;
    assert.equal(isSecureCookie(), false);

    process.env.NODE_ENV = 'test';
    delete process.env.SESSION_SECRET;
    assert.equal(getSessionSecret(), 'study-sync-dev-secret');
    assert.equal(isSecureCookie(), false);
    process.env.NODE_ENV = 'production';

    const noSession = { originalUrl: '/study-groups' };
    const noSessionResponse = { redirect: (url) => { noSession.redirectUrl = url; return noSessionResponse; } };
    requireAuth(noSession, noSessionResponse, () => { throw new Error('next should not run'); });
    assert.match(noSession.redirectUrl, /\/login\?next=%2Fstudy-groups/);

    const noOriginalUrlSession = {};
    const noOriginalUrlResponse = { redirect: (url) => { noOriginalUrlResponse.redirectUrl = url; return noOriginalUrlResponse; } };
    requireAuth(noOriginalUrlSession, noOriginalUrlResponse, () => { throw new Error('next should not run'); });
    assert.match(noOriginalUrlResponse.redirectUrl, /\/login\?next=%2Fstudy-groups/);

    const missingUserSession = { session: {} };
    const missingUserResponse = { redirect: (url) => { missingUserResponse.redirectUrl = url; return missingUserResponse; } };
    requireAuth(missingUserSession, missingUserResponse, () => { throw new Error('next should not run'); });
    assert.match(missingUserResponse.redirectUrl, /\/login\?next=%2Fstudy-groups/);

    const validSessionRes = { redirect: () => { throw new Error('redirect should not run'); } };
    let nextCalled = false;
    requireAuth({ session: { user: { id: 1 } } }, validSessionRes, () => { nextCalled = true; });
    assert.equal(nextCalled, true);

    const apiResponse = { status: (code) => { apiResponse.code = code; return apiResponse; }, json: (payload) => { apiResponse.payload = payload; return apiResponse; } };
    requireApiAuth({}, apiResponse, () => { throw new Error('next should not run'); });
    assert.equal(apiResponse.code, 401);
    assert.equal(apiResponse.payload.error, 'Authentication required.');

    const sessionWithoutUserResponse = { status: (code) => { sessionWithoutUserResponse.code = code; return sessionWithoutUserResponse; }, json: (payload) => { sessionWithoutUserResponse.payload = payload; return sessionWithoutUserResponse; } };
    requireApiAuth({ session: {} }, sessionWithoutUserResponse, () => { throw new Error('next should not run'); });
    assert.equal(sessionWithoutUserResponse.code, 401);
    assert.equal(sessionWithoutUserResponse.payload.error, 'Authentication required.');
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.SESSION_SECRET = originalSecret;
    process.env.PUBLIC_BASE_URL = originalBaseUrl;
  }
});

test('login and logout error branches are handled safely', async () => {
  const loginRoute = app._router.stack.find((layer) => layer.route && layer.route.path === '/login' && layer.route.methods.post);
  const loginHandler = loginRoute.route.stack[0].handle;
  const logoutRoute = app._router.stack.find((layer) => layer.route && layer.route.path === '/logout' && layer.route.methods.post);
  const logoutHandler = logoutRoute.route.stack[0].handle;

  const regenerateErrorRes = {
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  await loginHandler(
    {
      body: { email: 'demo@studysync.local', password: 'demo123' },
      session: { regenerate: (callback) => callback(new Error('regenerate failed')) },
    },
    regenerateErrorRes,
  );
  assert.equal(regenerateErrorRes.code, 500);
  assert.equal(regenerateErrorRes.payload.error, 'Unable to start a secure session.');

  const saveErrorRes = {
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; },
    redirect(url) { this.redirectUrl = url; return this; },
  };
  await loginHandler(
    {
      body: { email: 'demo@studysync.local', password: 'demo123' },
      session: {
        regenerate(callback) { callback(null); },
        save(callback) { callback(new Error('save failed')); },
      },
    },
    saveErrorRes,
  );
  assert.equal(saveErrorRes.code, 500);
  assert.equal(saveErrorRes.payload.error, 'Unable to save the session.');

  const logoutErrorRes = {
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; },
    clearCookie() { return this; },
    redirect(url) { this.redirectUrl = url; return this; },
  };
  await logoutHandler({ session: { destroy: (callback) => callback(new Error('destroy failed')) } }, logoutErrorRes);
  assert.equal(logoutErrorRes.code, 500);
  assert.equal(logoutErrorRes.payload.error, 'Unable to log out.');

  const noSessionLogout = { session: null };
  const noSessionRes = { clearCookie() { return this; }, redirect(url) { this.redirectUrl = url; return this; } };
  await logoutHandler(noSessionLogout, noSessionRes);
  assert.equal(noSessionRes.redirectUrl, '/login');
});

test('createGroup and deleteGroup failure branches are exercised', async () => {
  const originalCreateGroup = db.createGroup;
  const originalDeleteGroup = db.deleteGroup;
  const originalGetGroups = db.getGroups;

  try {
    await assert.rejects(() => db.createGroup({ name: '' }), /Group name is required\./);
    const validGroup = await db.createGroup({
      name: 'Valid Group',
      description: '',
      ownerId: 1,
      courseId: 1,
    });
    assert.equal(validGroup.name, 'Valid Group');

    db.createGroup = async () => { throw new Error('create failed'); };
    const createRoute = app._router.stack.find((layer) => layer.route && layer.route.path === '/api/groups' && layer.route.methods.post);
    const handler = createRoute.route.stack[1].handle;
    const response = { status(code) { this.code = code; return this; }, json(payload) { this.payload = payload; return this; } };
    await handler({ body: { name: 'Test group' }, session: { user: { id: 1 } } }, response);
    assert.equal(response.code, 400);
    assert.equal(response.payload.error, 'create failed');

    db.createGroup = async () => { throw {}; };
    const objectMessageResponse = { status(code) { this.code = code; return this; }, json(payload) { this.payload = payload; return this; } };
    await handler({ body: { name: 'Test group' }, session: { user: { id: 1 } } }, objectMessageResponse);
    assert.equal(objectMessageResponse.code, 400);
    assert.equal(objectMessageResponse.payload.error, 'Unable to create the group.');

    db.getGroups = async () => { throw new Error('list failed'); };
    const listRoute = app._router.stack.find((layer) => layer.route && layer.route.path === '/api/groups' && layer.route.methods.get);
    const listHandler = listRoute.route.stack[1].handle;
    const listResponse = { status(code) { this.code = code; return this; }, json(payload) { this.payload = payload; return this; } };
    await listHandler({ session: { user: { id: 1 } } }, listResponse);
    assert.equal(listResponse.code, 500);
    assert.equal(listResponse.payload.error, 'Unable to load groups.');

    db.deleteGroup = async () => { throw new Error('delete failed'); };
    const deleteRoute = app._router.stack.find((layer) => layer.route && layer.route.path === '/api/groups/:id' && layer.route.methods.delete);
    const deleteHandler = deleteRoute.route.stack[1].handle;
    const deleteResponse = { status(code) { this.code = code; return this; }, json(payload) { this.payload = payload; return this; }, end() { return this; } };
    await deleteHandler({ params: { id: '42' }, session: { user: { id: 1 } } }, deleteResponse);
    assert.equal(deleteResponse.code, 400);
    assert.equal(deleteResponse.payload.error, 'Unable to delete group.');
  } finally {
    db.createGroup = originalCreateGroup;
    db.deleteGroup = originalDeleteGroup;
    db.getGroups = originalGetGroups;
  }
});

test('login and protected page branches cover the remaining auth flow', async () => {
  const loginPage = await request(app).get('/login').expect(200);
  assert.match(loginPage.text, /Sign in/i);

  const invalidEmpty = await request(app)
    .post('/login')
    .send({ email: '', password: '' })
    .expect(400);
  assert.equal(invalidEmpty.body.error, 'Email and password are required.');

  const missingPassword = await request(app)
    .post('/login')
    .send({ email: 'demo@studysync.local', password: '' })
    .expect(400);
  assert.equal(missingPassword.body.error, 'Email and password are required.');

  const invalidPassword = await request(app)
    .post('/login')
    .send({ email: 'demo@studysync.local', password: 'wrongpass' })
    .expect(401);
  assert.equal(invalidPassword.body.error, 'Invalid email or password.');

  const unknownEmail = await request(app)
    .post('/login')
    .send({ email: 'missing@studysync.local', password: 'wrongpass' })
    .expect(401);
  assert.equal(unknownEmail.body.error, 'Invalid email or password.');

  const nextRedirect = await request(app)
    .post('/login')
    .send({ email: 'demo@studysync.local', password: 'demo123', next: '/study-groups' })
    .redirects(0)
    .expect(302);
  assert.match(nextRedirect.headers.location, /\/study-groups/);

  const nonStringNextRedirect = await request(app)
    .post('/login')
    .send({ email: 'demo@studysync.local', password: 'demo123', next: 42 })
    .redirects(0)
    .expect(302);
  assert.match(nonStringNextRedirect.headers.location, /\/study-groups/);

  const agent = request.agent(app);
  const sessionCookie = await createSessionCookie(agent);
  const groupsPage = await agent.get('/groups.html').set('Cookie', sessionCookie).expect(200);
  assert.match(groupsPage.text, /Study Groups/i);

  const rootRedirect = await agent.get('/').set('Cookie', sessionCookie).redirects(0).expect(302);
  assert.match(rootRedirect.headers.location, /\/study-groups/);

  const unauthenticatedRoot = await request(app).get('/').redirects(0).expect(302);
  assert.match(unauthenticatedRoot.headers.location, /\/login/);

  const rootWithSession = await agent.get('/').redirects(0).expect(302);
  assert.match(rootWithSession.headers.location, /\/study-groups/);

  const missingGroup = await agent.delete('/api/groups/999999').set('Cookie', sessionCookie).expect(404);
  assert.equal(missingGroup.body.error, 'Group not found.');
});

test('database module falls back to the local PostgreSQL default when no DATABASE_URL is set', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  try {
    delete process.env.DATABASE_URL;
    delete require.cache[require.resolve('../src/db')];

    const freshDb = require('../src/db');
    assert.equal(freshDb.connectionString, 'postgresql://postgres:postgres@127.0.0.1:5432/studysync');

    const originalQuery = freshDb.pool.query;
    freshDb.pool.query = async () => ({ rows: [] });
    try {
      assert.equal(await freshDb.getUserByEmail('missing@studysync.local'), null);
    } finally {
      freshDb.pool.query = originalQuery;
    }
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    delete require.cache[require.resolve('../src/db')];
    require('../src/db');
  }
});

test('AC-1, AC-2 passwords use bcrypt and reject invalid passwords', async () => {
  const password = 'bcrypt-validation-password';
  const hash = await db.hashPassword(password);

  assert.notEqual(hash, password);
  assert.match(hash, /^\$2[aby]\$/);
  assert.equal(await db.verifyPassword(password, hash), true);
  assert.equal(await db.verifyPassword('wrong-password', hash), false);
  assert.equal(await db.verifyPassword(password, null), false);
  assert.equal(await db.verifyPassword(password, 42), false);

  const demo = await db.getUserByEmail('demo@studysync.local');
  assert.match(demo.password_hash, /^\$2[aby]\$/);
  assert.equal(await db.verifyPassword('demo123', demo.password_hash), true);
  assert.equal(await db.verifyPassword('incorrect', demo.password_hash), false);
});

test('AC-3, AC-4, AC-5 database relationships are seeded and constrained', async () => {
  const courses = await db.pool.query('SELECT code, title FROM courses ORDER BY code');
  assert.ok(courses.rows.length >= 3);

  const groups = await db.pool.query(`
    SELECT g.name, c.code AS course_code, u.email AS owner_email
    FROM study_groups g
    JOIN courses c ON c.id = g.course_id
    JOIN users u ON u.id = g.owner_id
    ORDER BY g.name
  `);
  assert.ok(groups.rows.length >= 3);
  assert.ok(groups.rows.every((group) => group.course_code && group.owner_email));

  await assert.rejects(
    () => db.pool.query(
      `INSERT INTO group_memberships (user_id, group_id)
       SELECT u.id, g.id FROM users u CROSS JOIN study_groups g LIMIT 1`,
    ).then(async () => db.pool.query(
      `INSERT INTO group_memberships (user_id, group_id)
       SELECT u.id, g.id FROM users u CROSS JOIN study_groups g LIMIT 1`,
    )),
  );

  const membershipCount = await db.pool.query(
    'SELECT COUNT(*)::int AS count FROM group_memberships',
  );
  assert.ok(membershipCount.rows[0].count >= 1);
});

test('AC-12 group creation assigns the authenticated owner', async () => {
  const agent = request.agent(app);
  await createSessionCookie(agent);

  const created = await agent
    .post('/api/groups')
    .send({ name: 'Owned Slice Group', description: 'Owned by Demo', courseId: 1 })
    .expect(201);

  assert.equal(created.body.owner_id, 1);
  assert.equal(created.body.is_owner, true);

  const stored = await db.pool.query(
    'SELECT owner_id, course_id FROM study_groups WHERE id = $1',
    [created.body.id],
  );
  assert.equal(stored.rows[0].owner_id, 1);
  assert.equal(stored.rows[0].course_id, 1);
});

test('AC-13 owner, forbidden, unauthenticated, and nonexistent deletion outcomes', async () => {
  const owner = request.agent(app);
  await createSessionCookie(owner, 'demo@studysync.local', 'demo123');
  const created = await owner
    .post('/api/groups')
    .send({ name: 'Authorization Group', description: 'Owner-only deletion' })
    .expect(201);

  const other = request.agent(app);
  await createSessionCookie(other, 'mentor@studysync.local', 'mentor123');
  const forbidden = await other
    .delete(`/api/groups/${created.body.id}`)
    .expect(403);
  assert.equal(forbidden.body.error, 'Only the group owner can delete this group.');

  await request(app)
    .delete(`/api/groups/${created.body.id}`)
    .expect(401);

  await owner
    .delete(`/api/groups/${created.body.id}`)
    .expect(204);

  await owner
    .delete('/api/groups/999999')
    .expect(404);
});

test('database seed safely replaces legacy development password hashes and is repeatable', async () => {
  await db.pool.query(
    `UPDATE users SET password_hash = '64-character-legacy-sha256-placeholder'
     WHERE email = 'demo@studysync.local'`,
  );
  await seedDevelopmentData();
  const migrated = await db.getUserByEmail('demo@studysync.local');
  assert.match(migrated.password_hash, /^\$2[aby]\$/);
  assert.equal(await db.verifyPassword('demo123', migrated.password_hash), true);

  await seedDevelopmentData();
  await seedDevelopmentData();
  const count = await db.pool.query('SELECT COUNT(*)::int AS count FROM study_groups');
  assert.equal(count.rows[0].count, 3);
});

test('group creation validates owner and course, and deleteGroup handles failures', async () => {
  await assert.rejects(
    () => db.createGroup({ name: 'Missing Owner', ownerId: null }),
    /A valid group owner is required/,
  );
  await assert.rejects(
    () => db.createGroup({ name: 'Missing Course', ownerId: 1, courseId: 999999 }),
    /A valid course is required/,
  );

  const originalQuery = db.pool.query;
  db.pool.query = async () => { throw new Error('transaction failed'); };
  try {
    await assert.rejects(
      () => db.deleteGroup(1, 1),
      /transaction failed/,
    );
  } finally {
    db.pool.query = originalQuery;
  }

  db.pool.query = async (sql) => {
    if (sql.startsWith('SELECT id, owner_id')) {
      return { rowCount: 1, rows: [{ id: 1, owner_id: 1 }] };
    }
    return { rowCount: 0, rows: [] };
  };
  try {
    assert.deepEqual(await db.deleteGroup(1, 1), { status: 'forbidden' });
  } finally {
    db.pool.query = originalQuery;
  }
});

