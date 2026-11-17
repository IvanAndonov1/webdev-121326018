require('dotenv').config();

const { createApp } = require('./src/app');
const { initializeDatabase, seedDevelopmentData } = require('./src/db');

async function start() {
  await initializeDatabase();

  if (process.env.NODE_ENV !== 'production') {
    await seedDevelopmentData();
  }

  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`StudySync running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start StudySync:', error.message);
  process.exit(1);
});
