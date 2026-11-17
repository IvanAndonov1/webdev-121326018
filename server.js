const dotenv = require('dotenv');
dotenv.config();

const { createApp, createPool, initializeDatabase, seedDatabase } = require('./src/app.js');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/study_groups_dev';
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const pool = createPool(DATABASE_URL);
  await initializeDatabase(pool);
  await seedDatabase(pool);

  const app = createApp({ pool });

  app.listen(PORT, () => {
    console.log(`Study Groups app listening on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start the app:', error);
  process.exit(1);
});
