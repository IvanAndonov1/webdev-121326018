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

test('AC-8 the database change is visible in a later authenticated request', async (t) => {
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

test('AC-9 removing a database row makes it disappear from the list', async (t) => {
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
    const validGroup = await db.createGroup({ name: 'Valid Group', description: '' });
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

