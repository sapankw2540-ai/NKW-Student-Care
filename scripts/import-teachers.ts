import postgres from 'postgres';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function run() {
  try {
    const filePath = path.join(process.cwd(), 'รายชื่อครู.txt');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    console.log('Reading teachers list...');

    // Get all classrooms to assign to admins
    const classrooms = await sql`SELECT id FROM classrooms`;
    const allClassroomIds = classrooms.map(c => c.id).join(',');

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('ชื่อ - สกุล')) continue;

      const parts = line.split('\t');
      if (parts.length < 3) continue;

      const name = parts[0].trim();
      const username = parts[1].trim();
      const password = parts[2].trim();

      let role: 'teacher' | 'admin' | 'viewer' = 'teacher';
      let classroomIds = '';

      if (username === 'admin1' || username === 'admin2') {
        role = 'viewer';
        classroomIds = allClassroomIds;
      } else if (username.startsWith('admin')) {
        role = 'admin';
        classroomIds = allClassroomIds;
      } else if (username.startsWith('teacher')) {
        role = 'teacher';
        // Extract the digit after 'teacher'
        // teacher501 -> 5
        const match = username.match(/teacher(\d)/);
        if (match) {
          const level = match[1];
          classroomIds = `m${level}-1`;
        }
      }

      console.log(`Importing: ${name} (${username}) - Role: ${role}, Classes: ${classroomIds}`);

      await sql`
        INSERT INTO teachers (name, username, password, status, role, classroom_ids)
        VALUES (${name}, ${username}, ${password}, 1, ${role}, ${classroomIds})
        ON CONFLICT (username) DO UPDATE SET
          name = ${name},
          password = ${password},
          role = ${role},
          classroom_ids = ${classroomIds}
      `;
    }

    console.log('✅ All teachers imported successfully.');

  } catch (e) {
    console.error('❌ Failed to import teachers:', e);
  } finally {
    await sql.end();
  }
}

run();
