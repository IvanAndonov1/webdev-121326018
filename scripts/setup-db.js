const { Client } = require('pg');
const { createPool, initializeDatabase, seedDatabase } = require('../src/db.js');

const urls = [
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/study_groups_dev',
  process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/study_groups_test',
];

function parseConnectionString(connectionString) {
  const parsed = new URL(connectionString);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    user: parsed.username || 'postgres',
    password: parsed.password || 'postgres',
    database: parsed.pathname.replace('/', ''),
  };
}

async function ensureDatabaseExists(connectionString) {
  const info = parseConnectionString(connectionString);
  const adminClient = new Client({
    host: info.host,
    port: info.port,
    user: info.user,
    password: info.password,
    database: 'postgres',
  });

  await adminClient.connect();
  const result = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [info.database]);

  if (result.rowCount === 0) {
    await adminClient.query(`CREATE DATABASE "${info.database}"`);
  }

  await adminClient.end();
}

async function main() {
  for (const url of urls) {
    await ensureDatabaseExists(url);
    const pool = createPool(url);
    await initializeDatabase(pool);
    await seedDatabase(pool);
    await pool.end();
  }

  console.log('Database setup complete.');
}

main().catch((error) => {
  console.error('Database setup failed:', error);
  process.exit(1);
});
