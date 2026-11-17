const fs = require('node:fs/promises');
const path = require('node:path');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/study_groups_dev';

function createPool(connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL) {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
  });
}

async function runMigrations(pool) {
  const migrationSql = await fs.readFile(path.join(__dirname, '../db/migrations/001_init.sql'), 'utf8');
  await pool.query(migrationSql);
}

async function seedDatabase(pool) {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const mentorPassword = await bcrypt.hash('Mentor123!', 10);

  await pool.query(`
    INSERT INTO courses (code, title) VALUES
      ('CS101', 'Intro to Algorithms'),
      ('MATH210', 'Discrete Mathematics'),
      ('BIO250', 'Cell Biology')
    ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title;
  `);

  await pool.query(`
    INSERT INTO users (email, password_hash, full_name) VALUES
      ('student@example.com', $1, 'Ava Student'),
      ('mentor@example.com', $2, 'Mila Mentor')
    ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          full_name = EXCLUDED.full_name;
  `, [passwordHash, mentorPassword]);

  const groupSeed = [
    {
      courseCode: 'CS101',
      name: 'Algorithms Sprint Session',
      description: 'Daily review of sorting, graphs, and interview-style problems.',
      day: 'Tuesday',
      time: '18:00',
      maxMembers: 6,
    },
    {
      courseCode: 'MATH210',
      name: 'Proofs and Practice Lab',
      description: 'Work through proof templates and worksheet questions together.',
      day: 'Wednesday',
      time: '17:30',
      maxMembers: 5,
    },
    {
      courseCode: 'BIO250',
      name: 'Exam Prep Cell Biology',
      description: 'Recap cell structures, pathways, and key diagrams before the quiz.',
      day: 'Thursday',
      time: '19:00',
      maxMembers: 4,
    },
  ];

  for (const group of groupSeed) {
    const courseResult = await pool.query('SELECT id FROM courses WHERE code = $1', [group.courseCode]);
    const courseId = courseResult.rows[0].id;
    const userResult = await pool.query("SELECT id FROM users WHERE email = 'student@example.com'");
    const ownerId = userResult.rows[0].id;

    await pool.query(`
      INSERT INTO study_groups (course_id, created_by, name, description, meeting_day, meeting_time, max_members)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (course_id, name) DO UPDATE
        SET description = EXCLUDED.description,
            meeting_day = EXCLUDED.meeting_day,
            meeting_time = EXCLUDED.meeting_time,
            max_members = EXCLUDED.max_members;
    `, [courseId, ownerId, group.name, group.description, group.day, group.time, group.maxMembers]);

    const groupResult = await pool.query(
      'SELECT id FROM study_groups WHERE course_id = $1 AND name = $2',
      [courseId, group.name]
    );
    const groupId = groupResult.rows[0].id;

    await pool.query(`
      INSERT INTO group_memberships (user_id, group_id, role)
      VALUES ($1, $2, 'owner')
      ON CONFLICT (user_id, group_id) DO NOTHING;
    `, [ownerId, groupId]);

    const mentor = await pool.query("SELECT id FROM users WHERE email = 'mentor@example.com'");
    if (mentor.rows[0]) {
      await pool.query(`
        INSERT INTO group_memberships (user_id, group_id, role)
        VALUES ($1, $2, 'mentor')
        ON CONFLICT (user_id, group_id) DO NOTHING;
      `, [mentor.rows[0].id, groupId]);
    }
  }
}

async function initializeDatabase(pool) {
  await runMigrations(pool);
}

module.exports = {
  DEFAULT_DATABASE_URL,
  createPool,
  initializeDatabase,
  seedDatabase,
};
