const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/studysync';
const pool = new Pool({ connectionString });

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

async function initializeDatabase() {
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
}

async function resetDatabase() {
  await pool.query('TRUNCATE TABLE study_groups RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
}

async function seedDevelopmentData() {
  const users = [
    ['demo@studysync.local', 'demo123', 'Demo User'],
    ['mentor@studysync.local', 'mentor123', 'Study Mentor']
  ];

  for (const [email, password, name] of users) {
    await pool.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [email, hashPassword(password), name],
    );
  }

  const groups = [
    ['Algorithms Lab', 'Practice arrays, recursion and graphs together.'],
    ['Exam Revision', 'Shared notes, flashcards, and challenge questions.'],
    ['Project Planning', 'Coordinate the next sprint and deliverables.']
  ];

  for (const [name, description] of groups) {
    await pool.query(
      `INSERT INTO study_groups (name, description)
       VALUES ($1, $2)
       ON CONFLICT (name) DO NOTHING`,
      [name, description],
    );
  }
}

async function getUserByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function getGroups() {
  const result = await pool.query(
    'SELECT id, name, description, created_at FROM study_groups ORDER BY created_at DESC, id DESC',
  );
  return result.rows;
}

async function createGroup({ name, description = '' }) {
  const cleanName = String(name || '').trim();
  const cleanDescription = String(description || '').trim();

  if (!cleanName) {
    throw new Error('Group name is required.');
  }

  const result = await pool.query(
    `INSERT INTO study_groups (name, description)
     VALUES ($1, $2)
     RETURNING id, name, description, created_at`,
    [cleanName.slice(0, 120), cleanDescription.slice(0, 500)],
  );

  return result.rows[0];
}

async function deleteGroup(id) {
  const result = await pool.query('DELETE FROM study_groups WHERE id = $1', [id]);
  return result.rowCount > 0;
}

module.exports = {
  pool,
  hashPassword,
  initializeDatabase,
  resetDatabase,
  seedDevelopmentData,
  getUserByEmail,
  getGroups,
  createGroup,
  deleteGroup,
  connectionString,
};
