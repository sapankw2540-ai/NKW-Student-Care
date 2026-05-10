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
        version VARCHAR(20) DEFAULT 'v4.5.10',
        logo_url TEXT,
        line_channel_access_token TEXT,
        line_target_id TEXT,
        CONSTRAINT single_row CHECK (id = 1)
      )
    `;

    // 7. RLS and Storage Setup
    console.log('Setting up storage bucket and RLS policies...');
    try {
      await sql.unsafe(`
        INSERT INTO storage.buckets (id, name, public) 
        VALUES ('logos', 'logos', true)
        ON CONFLICT (id) DO NOTHING;
      `);
      
      const tables = ['teachers', 'classrooms', 'students', 'attendance', 'periods', 'school_config'];
      for (const table of tables) {
        await sql.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
        await sql.unsafe(`DROP POLICY IF EXISTS "Public Access" ON ${table};`);
        await sql.unsafe(`CREATE POLICY "Public Access" ON ${table} FOR ALL USING (true);`);
      }
    } catch (e) {
      console.warn('⚠️ RLS/Storage setup warning:', e);
    }

    // 8. Initial Data
    console.log('Inserting initial data...');
    
    // Classrooms
    const classrooms = [
      { id: 'm1-1', name: 'ม.1/1' }, { id: 'm2-1', name: 'ม.2/1' },
      { id: 'm3-1', name: 'ม.3/1' }, { id: 'm4-1', name: 'ม.4/1' },
      { id: 'm5-1', name: 'ม.5/1' }, { id: 'm6-1', name: 'ม.6/1' }
    ];
    for (const c of classrooms) {
      await sql`INSERT INTO classrooms (id, name) VALUES (${c.id}, ${c.name}) ON CONFLICT (id) DO NOTHING`;
    }

    // Periods
    await sql`INSERT INTO periods (id, name) VALUES ('morning', 'กิจกรรมหน้าเสาธง') ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO periods (id, name) VALUES ('afternoon', 'กิจกรรมก่อนเรียนคาบบ่าย') ON CONFLICT (id) DO NOTHING`;

    // Teachers
    const teachers = [
      { name: 'Admin NKW', username: 'admin', password: 'password123', role: 'admin', classrooms: 'm1-1,m2-1,m3-1,m4-1,m5-1,m6-1' },
      { name: 'นายกิตติพงษ์ บุญสาร', username: 'admin1', password: '1234', role: 'admin', classrooms: 'm1-1,m2-1,m3-1,m4-1,m5-1,m6-1' },
      { name: 'นางสาววลัยลักษณ์ หาญสิงห์', username: 'admin2', password: '1234', role: 'admin', classrooms: 'm1-1,m2-1,m3-1,m4-1,m5-1,m6-1' },
      { name: 'นางสาวนัฐกานต์ ขอเจริญ', username: 'teacher101', password: '1234', role: 'teacher', classrooms: 'm1-1' },
      { name: 'นางสาวจันทิมา ศรีด้วง', username: 'teacher201', password: '1234', role: 'teacher', classrooms: 'm2-1' },
      { name: 'นางสาวลภัสรดา จิตภักดี', username: 'teacher301', password: '1234', role: 'teacher', classrooms: 'm3-1' },
      { name: 'นายกัมปนาท คันศร', username: 'teacher401', password: '1234', role: 'teacher', classrooms: 'm4-1' },
      { name: 'นายชาตรี ทันตา', username: 'teacher501', password: '1234', role: 'teacher', classrooms: 'm5-1' },
      { name: 'นายธวัชชัย แก่นจักร์', username: 'teacher601', password: '1234', role: 'teacher', classrooms: 'm6-1' }
    ];
    for (const t of teachers) {
      await sql`
        INSERT INTO teachers (name, username, password, role, classroom_ids) 
        VALUES (${t.name}, ${t.username}, ${t.password}, ${t.role}, ${t.classrooms}) 
        ON CONFLICT (username) DO NOTHING
      `;
    }

    // Students (Simplified batch for main classes)
    const studentsData = [
      // M.1/1
      { student_id: '01496', name: 'เด็กชายชนาวิน คณะวาปี', no: 1, classroom_id: 'm1-1' },
      { student_id: '01479', name: 'เด็กชายชนินทร์ เชื่อมบุญมา', no: 2, classroom_id: 'm1-1' },
      { student_id: '01497', name: 'เด็กชายชิณภัทร บุญหวาน', no: 3, classroom_id: 'm1-1' },
      { student_id: '01498', name: 'เด็กชายปารเมศ วิเศษไสย์', no: 4, classroom_id: 'm1-1' },
      // M.2/1
      { student_id: '01477', name: 'เด็กชายกฤษฎา กาละพันธ์', no: 1, classroom_id: 'm2-1' },
      { student_id: '01478', name: 'เด็กชายกฤษดากรณ์ มิ่งสอน', no: 2, classroom_id: 'm2-1' },
      // M.3/1
      { student_id: '01455', name: 'เด็กชายจักรภัทร ตาละ', no: 1, classroom_id: 'm3-1' },
      { student_id: '01456', name: 'เด็กชายฐานะพงษ์ ขันแก้ว', no: 2, classroom_id: 'm3-1' },
      // M.4/1
      { student_id: '01425', name: 'นายณรงค์ศักดิ์ เกษตะระ', no: 1, classroom_id: 'm4-1' },
      // M.5/1
      { student_id: '01393', name: 'นายขวัญชัย เสมอเชื้อ', no: 1, classroom_id: 'm5-1' },
      // M.6/1
      { student_id: '01367', name: 'นายชนะชัย พันธ์ขาว', no: 1, classroom_id: 'm6-1' }
    ];

    for (const s of studentsData) {
      await sql`
        INSERT INTO students (student_id, name, no, classroom_id) 
        VALUES (${s.student_id}, ${s.name}, ${s.no}, ${s.classroom_id}) 
        ON CONFLICT (student_id) DO NOTHING
      `;
    }

    await sql`
      INSERT INTO school_config (id, school_name, province, semester, academic_year, version) 
      VALUES (1, 'โรงเรียนน้ำคำวิทยา', 'จังหวัดศรีสะเกษ', '1', '2569', 'v4.5.10')
      ON CONFLICT (id) DO NOTHING
    `;

    console.log('✅ Supabase database update completed successfully!');

  } catch (error) {
    console.error('❌ Update failed:', error);
  } finally {
    await sql.end();
    process.exit();
  }
}

setup();
