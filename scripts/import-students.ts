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
    const filePath = path.join(process.cwd(), 'รายชื่อนักเรียน.txt');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    console.log('Reading students list...');

    const studentsToImport = [];
    const classroomsToImport = new Set<string>();

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('เลขที่')) continue;

      const parts = line.split('\t');
      if (parts.length < 4) continue;

      const no = parseInt(parts[0]);
      const student_id = parts[1].trim();
      const name = parts[2].trim();
      const className = parts[3].trim(); // e.g. ม.1/1

      // Map "ม.1/1" to "m1-1"
      const classroomId = className
        .replace('ม.', 'm')
        .replace('/', '-');

      studentsToImport.push({
        no,
        student_id,
        name,
        classroomId,
        className
      });

      classroomsToImport.add(className);
    }

    console.log(`Found ${studentsToImport.length} students across ${classroomsToImport.size} classrooms.`);

    // 1. Ensure classrooms exist
    for (const className of Array.from(classroomsToImport)) {
      const classroomId = className
        .replace('ม.', 'm')
        .replace('/', '-');
      
      console.log(`Checking classroom: ${className} (${classroomId})`);
      await sql`
        INSERT INTO classrooms (id, name, status)
        VALUES (${classroomId}, ${className}, 1)
        ON CONFLICT (id) DO NOTHING
      `;
    }

    // 2. Import students
    console.log(`Importing students...`);
    for (const student of studentsToImport) {
      await sql`
        INSERT INTO students (student_id, classroom_id, no, name, status)
        VALUES (${student.student_id}, ${student.classroomId}, ${student.no}, ${student.name}, 1)
        ON CONFLICT (student_id) DO UPDATE SET
          name = ${student.name},
          classroom_id = ${student.classroomId},
          no = ${student.no}
      `;
    }

    console.log('✅ All students imported successfully.');

  } catch (e) {
    console.error('❌ Failed to import students:', e);
  } finally {
    await sql.end();
  }
}

run();
