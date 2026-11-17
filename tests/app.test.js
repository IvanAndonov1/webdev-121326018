const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, createPool, initializeDatabase, seedDatabase } = require('../src/app.js');

const DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/study_groups_test';

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { response, json };
}

test('AC-8 a seeded student can sign in and view study groups', async () => {
  const pool = createPool(DATABASE_URL);
  await initializeDatabase(pool);
  await seedDatabase(pool);
  const app = createApp({ pool });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const login = await fetchJson(`http://127.0.0.1:${port}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'student@example.com', password: 'Password123!' }),
    });

    assert.equal(login.response.status, 200, 'login should succeed for the seeded student');
    const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie, 'the session cookie should be set');

    const groups = await fetchJson(`http://127.0.0.1:${port}/api/groups`, {
      headers: { Cookie: cookie },
    });

    assert.equal(groups.response.status, 200, 'the authenticated student should receive study groups');
    assert.ok(groups.json.length >= 3, 'the list should include seeded database records');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});

test('AC-9 invalid credentials and unauthenticated access are rejected', async () => {
  const pool = createPool(DATABASE_URL);
  await initializeDatabase(pool);
  await seedDatabase(pool);
  const app = createApp({ pool });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const badLogin = await fetchJson(`http://127.0.0.1:${port}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'student@example.com', password: 'wrong-password' }),
    });

    assert.equal(badLogin.response.status, 401, 'invalid credentials should be rejected');
    assert.match(String(badLogin.json.error), /invalid|password/i, 'clear error text must be returned');

    const blocked = await fetchJson(`http://127.0.0.1:${port}/api/groups`);
    assert.equal(blocked.response.status, 401, 'unauthenticated users should not read protected groups');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});

test('AC-10 database changes are reflected in a refresh after login', async () => {
  const pool = createPool(DATABASE_URL);
  await initializeDatabase(pool);
  await seedDatabase(pool);
  const app = createApp({ pool });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const login = await fetchJson(`http://127.0.0.1:${port}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'student@example.com', password: 'Password123!' }),
    });

    const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
    await pool.query("UPDATE study_groups SET name = 'Algorithms Sprint Lab' WHERE name = 'Algorithms Sprint Session'");

    const refreshed = await fetchJson(`http://127.0.0.1:${port}/api/groups`, {
      headers: { Cookie: cookie },
    });

    assert.equal(refreshed.response.status, 200, 'authenticated refreshes must keep working after a DB change');
    assert.ok(refreshed.json.some((group) => group.name === 'Algorithms Sprint Lab'), 'the updated database record should appear in the response');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
