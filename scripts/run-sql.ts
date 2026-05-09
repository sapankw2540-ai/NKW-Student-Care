import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function run() {
  const query = process.argv[2];
  if (!query) {
    console.error('Query missing');
    process.exit(1);
  }

  try {
    console.log('Running query:', query);
    const result = await sql.unsafe(query);
    console.log('✅ Result:', result);
  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await sql.end();
  }
}

run();
