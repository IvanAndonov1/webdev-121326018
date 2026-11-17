const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/studysync';
const pool = new Pool({ connectionString });

const BCRYPT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(String(password), BCRYPT_ROUNDS);
}

async function verifyPassword(password, hash) {
  if (!hash || typeof hash !== 'string') return false;
  return bcrypt.compare(String(password), hash);
}

async function initializeDatabase() {
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
}

async function resetDatabase() {
  await pool.query('TRUNCATE TABLE group_memberships, study_groups, courses, users RESTART IDENTITY CASCADE');
}

async function seedDevelopmentData() {
  const users = [
    ['demo@studysync.local', 'demo123', 'Demo User'],
    ['mentor@studysync.local', 'mentor123', 'Study Mentor']
  ];

  for (const [email, password, name] of users) {
    const hash = await hashPassword(password);
    const existing = await getUserByEmail(email);
    if (!existing) {
      await pool.query(
        `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)`,
        [email, hash, name],
      );
    } else if (!(await verifyPassword(password, existing.password_hash))) {
      await pool.query(
        `UPDATE users SET password_hash = $1, name = $2 WHERE email = $3`,
        [hash, name, email],
      );
    }
  }

  const courses = [
    ['CS101', 'Computer Science Foundations'],
    ['MATH201', 'Discrete Mathematics'],
    ['PROJ301', 'Software Project Practice'],
  ];
  for (const [code, title] of courses) {
    await pool.query(
      `INSERT INTO courses (code, title) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`,
      [code, title],
    );
  }

  const demo = await getUserByEmail('demo@studysync.local');
  const mentor = await getUserByEmail('mentor@studysync.local');
  const groups = [
    ['CS101', 'Algorithms Lab', 'Practice arrays, recursion and graphs together.', demo.id],
    ['MATH201', 'Exam Revision', 'Shared notes, flashcards, and challenge questions.', mentor.id],
    ['PROJ301', 'Project Planning', 'Coordinate the next sprint and deliverables.', demo.id],
  ];

  for (const [courseCode, name, description, ownerId] of groups) {
    const existing = await pool.query(
      `SELECT g.id
       FROM study_groups g
       JOIN courses c ON c.id = g.course_id
       WHERE c.code = $1 AND g.name = $2`,
      [courseCode, name],
    );
    if (existing.rowCount === 0) {
      await pool.query(
        `INSERT INTO study_groups (course_id, owner_id, name, description)
         VALUES (
           (SELECT id FROM courses WHERE code = $1),
           $4,
           $2,
           $3
         )`,
        [courseCode, name, description, ownerId],
      );
    }
  }

  await pool.query(
    `INSERT INTO group_memberships (user_id, group_id, role)
     SELECT u.id, g.id, 'member'
     FROM users u
     JOIN study_groups g ON g.owner_id = u.id
     ON CONFLICT (user_id, group_id) DO NOTHING`,
  );
}

async function getUserByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function getGroups() {
  const result = await pool.query(
    `SELECT g.id, g.name, g.description, g.created_at,
            g.owner_id, u.name AS owner_name,
            c.code AS course_code, c.title AS course_title
     FROM study_groups g
     JOIN users u ON u.id = g.owner_id
     JOIN courses c ON c.id = g.course_id
     ORDER BY g.created_at DESC, g.id DESC`,
  );
  return result.rows;
}

async function createGroup({ name, description = '', ownerId, courseId }) {
  const cleanName = String(name || '').trim();
  const cleanDescription = String(description || '').trim();

  if (!cleanName) {
    throw new Error('Group name is required.');
  }

  if (!Number.isInteger(Number(ownerId)) || Number(ownerId) < 1) {
    throw new Error('A valid group owner is required.');
  }

  const courseResult = courseId
    ? await pool.query('SELECT id FROM courses WHERE id = $1', [courseId])
    : await pool.query('SELECT id FROM courses ORDER BY id LIMIT 1');
  const course = courseResult.rows[0];
  if (!course) throw new Error('A valid course is required.');

  const result = await pool.query(
    `INSERT INTO study_groups (course_id, owner_id, name, description)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, description, created_at, course_id, owner_id`,
    [course.id, ownerId, cleanName.slice(0, 120), cleanDescription.slice(0, 500)],
  );

  await pool.query(
    `INSERT INTO group_memberships (user_id, group_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT (user_id, group_id) DO NOTHING`,
    [ownerId, result.rows[0].id],
  );

  return result.rows[0];
}

async function deleteGroup(id, ownerId) {
  const group = await pool.query(
    'SELECT id, owner_id FROM study_groups WHERE id = $1',
    [id],
  );
  if (group.rowCount === 0) {
    return { status: 'not-found' };
  }
  if (Number(group.rows[0].owner_id) !== Number(ownerId)) {
    return { status: 'forbidden' };
  }
  const deleted = await pool.query(
    'DELETE FROM study_groups WHERE id = $1 AND owner_id = $2 RETURNING id',
    [id, ownerId],
  );
  return deleted.rowCount > 0
    ? { status: 'deleted' }
    : { status: 'forbidden' };
}

module.exports = {
  pool,
  hashPassword,
  verifyPassword,
  initializeDatabase,
  resetDatabase,
  seedDevelopmentData,
  getUserByEmail,
  getGroups,
  createGroup,
  deleteGroup,
  connectionString,
};
