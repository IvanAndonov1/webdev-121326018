#!/usr/bin/env node
require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/studysync';
const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query(schema);
  console.log(`Database schema ready for ${connectionString.replace(/:[^@]+@/, ':***@')}`);
  await client.end();
}

main().catch((error) => {
  console.error('Database setup failed:', error.message);
  process.exit(1);
});
