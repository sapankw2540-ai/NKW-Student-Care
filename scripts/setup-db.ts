import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL || DATABASE_URL.includes('[YOUR-PASSWORD]')) {
  console.error('❌ Error: DATABASE_URL is not set correctly in .env file.');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function setup() {
  console.log('🚀 Starting Supabase Database Setup...');
  
  try {
    // 1. Teachers
    console.log('Creating teachers table...');
    await sql`
      CREATE TABLE IF NOT EXISTS teachers (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(100) NOT NULL,
        status INTEGER DEFAULT 1,
        role VARCHAR(20) DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin')),
        classroom_ids TEXT,
        notify_time VARCHAR(5) DEFAULT '07:30',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 2. Classrooms
    console.log('Creating classrooms table...');
    await sql`
      CREATE TABLE IF NOT EXISTS classrooms (
        id VARCHAR(20) PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        status INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 3. Students
    console.log('Creating students table...');
    await sql`
      CREATE TABLE IF NOT EXISTS students (
        id BIGSERIAL PRIMARY KEY,
        student_id VARCHAR(20) NOT NULL UNIQUE,
        classroom_id VARCHAR(20) NOT NULL REFERENCES classrooms(id),
        no INTEGER NOT NULL,
        name VARCHAR(200) NOT NULL,
        status INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 4. Attendance
    console.log('Creating attendance table...');
    await sql`
      CREATE TABLE IF NOT EXISTS attendance (
        id BIGSERIAL PRIMARY KEY,
        student_id VARCHAR(20) NOT NULL,
        classroom_id VARCHAR(20) NOT NULL REFERENCES classrooms(id),
        period_id VARCHAR(20),
        date DATE NOT NULL,
        status_name VARCHAR(50),
        teacher_id BIGINT REFERENCES teachers(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(student_id, date, period_id)
      )
    `;

    // 5. Periods
    console.log('Creating periods table...');
    await sql`
      CREATE TABLE IF NOT EXISTS periods (
        id VARCHAR(20) PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        status INTEGER DEFAULT 1
      )
    `;

    // 6. School Config
    console.log('Creating school_config table...');
    await sql`
      CREATE TABLE IF NOT EXISTS school_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        school_name VARCHAR(200) DEFAULT 'โรงเรียนน้ำคำวิทยา',
        province VARCHAR(100) DEFAULT 'จังหวัดศรีสะเกษ',
        semester VARCHAR(10) DEFAULT '1',
        academic_year VARCHAR(10) DEFAULT '2569',
        version VARCHAR(20) DEFAULT 'v4.5.9',
        logo_url TEXT,
        CONSTRAINT single_row CHECK (id = 1)
      )
    `;

    // 7. Storage Bucket (Using unsafe because it's a cross-schema call)
    console.log('Setting up storage bucket and RLS policies...');
    try {
      await sql.unsafe(`
        INSERT INTO storage.buckets (id, name, public) 
        VALUES ('logos', 'logos', true)
        ON CONFLICT (id) DO NOTHING;
      `);
      
      await sql.unsafe(`
        DROP POLICY IF EXISTS "Public Access" ON storage.objects;
        CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
      `);

      await sql.unsafe(`
        DROP POLICY IF EXISTS "Allow Upload" ON storage.objects;
        CREATE POLICY "Allow Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos');
      `);
      
      await sql.unsafe(`
        DROP POLICY IF EXISTS "Allow Update" ON storage.objects;
        CREATE POLICY "Allow Update" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'logos');
      `);

      // 7.1 Table RLS Policies (Allow everything for anon/public for now)
      const tables = ['teachers', 'classrooms', 'students', 'attendance', 'periods', 'school_config'];
      for (const table of tables) {
        await sql.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
        await sql.unsafe(`DROP POLICY IF EXISTS "Public Select" ON ${table};`);
        await sql.unsafe(`CREATE POLICY "Public Select" ON ${table} FOR SELECT USING (true);`);
        await sql.unsafe(`DROP POLICY IF EXISTS "Public Insert" ON ${table};`);
        await sql.unsafe(`CREATE POLICY "Public Insert" ON ${table} FOR INSERT WITH CHECK (true);`);
        await sql.unsafe(`DROP POLICY IF EXISTS "Public Update" ON ${table};`);
        await sql.unsafe(`CREATE POLICY "Public Update" ON ${table} FOR UPDATE USING (true);`);
        await sql.unsafe(`DROP POLICY IF EXISTS "Public Delete" ON ${table};`);
        await sql.unsafe(`CREATE POLICY "Public Delete" ON ${table} FOR DELETE USING (true);`);
      }
      
    } catch (e) {
      console.warn('⚠️ RLS/Storage setup warning:', e);
    }

    // 8. Initial Data
    console.log('Inserting initial data...');
    await sql`
      INSERT INTO classrooms (id, name, status) VALUES
        ('m1-1', 'ม.1/1', 1),
        ('m1-2', 'ม.1/2', 1),
        ('m2-1', 'ม.2/1', 1),
        ('m2-2', 'ม.2/2', 1)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO periods (id, name, status) VALUES
        ('morning', 'เช้า', 1),
        ('afternoon', 'บ่าย', 1)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO teachers (name, username, password, status, role, classroom_ids) VALUES
        ('Admin User', 'admin', 'admin123', 1, 'admin', 'm1-1,m1-2,m2-1,m2-2')
      ON CONFLICT (username) DO NOTHING
    `;
    await sql`
      INSERT INTO school_config (id, school_name, province, semester, academic_year, version) 
      VALUES (1, 'โรงเรียนน้ำคำวิทยา', 'จังหวัดศรีสะเกษ', '1', '2569', 'v4.5.9')
      ON CONFLICT (id) DO NOTHING
    `;

    console.log('✅ All tables and initial data setup successfully!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await sql.end();
    process.exit();
  }
}

setup();
