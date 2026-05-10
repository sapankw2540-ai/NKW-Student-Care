---
name: thai-school-attendance-app
description: "Build a Thai school student attendance mobile app (Expo/React Native) from an HTML prototype and an Excel database file. Use this skill when the user provides: (1) an HTML file or ZIP containing a web-based attendance system, (2) an Excel (.xlsx) file with student/classroom/teacher data, and wants a mobile app with white-orange-black theme, login, check-in, classroom summary, and overall summary screens."
---

# Thai School Attendance Mobile App

Build a complete Expo (React Native) mobile attendance app from an HTML prototype and Excel data file. The app targets Thai schools with a white-orange-black color theme.

## Workflow Overview

1. Analyze HTML prototype and Excel data
2. Initialize Expo project + create design.md
3. Set up database schema and seed from Excel
4. Build Backend API (tRPC)
5. Build all screens
6. Branding (logo, theme) and checkpoint

---

## Phase 1: Analyze Source Files

### HTML Prototype

Unzip the archive and read the main HTML file (usually `blank.html` inside `*_files/` directory):

```bash
cd /home/ubuntu/upload && unzip -q "Archive.zip"
find . -name "blank.html" | head -5
```

Key things to extract:
- **School name** — header/title area
- **Periods** — เช้า / บ่าย toggle buttons
- **Status options** — มา, ขาด, สาย, ลา, ป่วย and their hex colors
- **Screens** — Login, Attendance modal, Classroom summary, Overall summary table
- **Config values** — ภาคเรียน, ปีการศึกษา

### Excel File

```python
import openpyxl
wb = openpyxl.load_workbook('/home/ubuntu/upload/filename.xlsx')
print(wb.sheetnames)
for sheet in wb.sheetnames:
    ws = wb[sheet]
    for row in ws.iter_rows(max_row=3, values_only=True):
        print(row)
```

Standard sheets to expect:

| Sheet | Key Columns |
|-------|-------------|
| Students | student_id, prefix, firstname, lastname, classroom_id, number |
| Classrooms | id, name, level, teacher_id |
| Teachers | id, username, password, name, classroom_id |
| Periods | id, name, status (1=active) |
| StatusList | id, label, color |
| Config | key, value (schoolName, semester, academicYear) |

Save findings to `/home/ubuntu/project_analysis.md`.

---

## Phase 2: Initialize Project + Design

Use `webdev_init_project` with `features: db, server, user`.

### Theme Colors (`theme.config.js`)

```js
const themeColors = {
  primary:    { light: '#F97316', dark: '#F97316' },
  background: { light: '#FFFFFF', dark: '#1C1917' },
  surface:    { light: '#FFF7ED', dark: '#292524' },
  foreground: { light: '#1C1917', dark: '#FAFAF9' },
  muted:      { light: '#78716C', dark: '#A8A29E' },
  border:     { light: '#E7E5E4', dark: '#44403C' },
  success:    { light: '#16A34A', dark: '#4ADE80' },
  warning:    { light: '#CA8A04', dark: '#FBBF24' },
  error:      { light: '#DC2626', dark: '#F87171' },
};
```

### Screens (design.md)

| Screen | Tab | Purpose |
|--------|-----|---------|
| Login | — | Teacher auth, orange background, school logo |
| Attendance | Tab 1 (เช็คชื่อ) | Classroom cards → tap → check-in modal |
| Classroom Summary | Tab 2 (สรุปห้อง) | Per-room stats + student list |
| Overall Summary | Tab 3 (ภาพรวม) | School-wide table + attendance rate bar |

---

## Phase 3: Database Schema + Seed

Read `server/README.md` first. Create `drizzle/schema.ts`:

```typescript
// classrooms: id (text PK), name, level, teacherId
// teachers: id (text PK), username, password, name, classroomId
// students: id (text PK), prefix, firstname, lastname, classroomId, number
// periods: id (text PK), name, status (int, 1=active)
// statusList: id (text PK), label, color
// attendance: id (serial PK), date (text), period (text), roomId, teacher, students (jsonb), createdAt, updatedAt
// appConfig: key (text PK), value
```

Run: `pnpm db:push`

### Seeding from Excel

Generate SQL with Python (handles Thai text correctly):

```python
import openpyxl, json
wb = openpyxl.load_workbook('/home/ubuntu/upload/filename.xlsx')

# Example: Students
ws = wb['Students']
rows = list(ws.iter_rows(min_row=2, values_only=True))
sql_parts = []
for row in rows:
    sid, prefix, first, last, cid, num = row[0], row[1], row[2], row[3], row[4], row[5]
    # Escape single quotes
    first = str(first).replace("'", "''")
    last = str(last).replace("'", "''")
    sql_parts.append(f"('{sid}', '{prefix}', '{first}', '{last}', '{cid}', {num})")

sql = "INSERT INTO students (id, prefix, firstname, lastname, classroom_id, number) VALUES\n"
sql += ",\n".join(sql_parts) + ";"
with open('/tmp/students_sql.sql', 'w', encoding='utf-8') as f:
    f.write(sql)
```

Use `webdev_execute_sql` to run the generated SQL.

**Attendance `students` column** stores JSON array:
```json
[{"id": "S001", "name": "ด.ช.สมชาย ใจดี", "number": 1, "status": "มา"}]
```

---

## Phase 4: Backend API (tRPC)

Create `server/routers.ts`. Required procedures:

| Procedure | Type | Description |
|-----------|------|-------------|
| `teacherLogin` | mutation | Verify credentials, return teacher info |
| `classrooms` | query | All classrooms |
| `studentsByClassroom` | query | Students for classroomId |
| `periods` | query | Active periods (status=1) |
| `statusList` | query | All status options |
| `appConfig` | query | School name, semester, year |
| `getAttendance` | query | Attendance for date+period+roomId |
| `getAttendanceByDatePeriod` | query | All rooms for date+period |
| `saveAttendance` | mutation | Upsert attendance record |

See `references/api-patterns.md` for full implementation.

---

## Phase 5: Screens

### Shared Utilities

**`lib/thai-date.ts`**:
```typescript
export function toThaiDateWithDay(date: Date): string {
  const days = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const y = date.getFullYear() + 543;
  return `วัน${days[date.getDay()]}ที่ ${date.getDate()} ${months[date.getMonth()]} ${y}`;
}
export function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

**`lib/teacher-auth.tsx`** — Context with AsyncStorage:
- Store: `{ id, name, username, classroomId }`
- Expose: `teacher`, `login(username, password)`, `logout()`, `isLoading`
- Wrap in `app/_layout.tsx`

**`components/app-header.tsx`** — Header with school logo, title, logout button.

### Status Colors (consistent across all screens)

| Status | Text Color | Background |
|--------|-----------|------------|
| มา | #16A34A | #DCFCE7 |
| ขาด | #DC2626 | #FEE2E2 |
| สาย | #CA8A04 | #FEF9C3 |
| ลา | #2563EB | #DBEAFE |
| ป่วย | #9333EA | #F3E8FF |

### Tab Icons

Add to `components/ui/icon-symbol.tsx` **before** using in tabs:

```typescript
"checkmark.circle.fill": "check-circle",
"list.bullet": "list",
"chart.bar.fill": "bar-chart",
"calendar": "calendar-today",
"person.3.fill": "group",
"xmark.circle.fill": "cancel",
"clock.fill": "access-time",
"doc.text": "description",
"info.circle": "info",
"arrow.right.square": "logout",
```

### Screen Specs

See `references/screen-specs.md` for detailed component layout and logic.

---

## Phase 6: Branding + Checkpoint

### Logo from URL

```bash
curl -L "<LOGO_URL>" -o /home/ubuntu/webdev-static-assets/school-logo.png
```

Resize with Pillow (keep all files **under 1000 KB**):

```python
from PIL import Image
img = Image.open('/home/ubuntu/webdev-static-assets/school-logo.png').convert('RGBA')

def on_white(img, size):
    bg = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    r = img.resize((size, size), Image.LANCZOS)
    bg.paste(r, (0, 0), r)
    return bg.convert('RGB')

project = '/home/ubuntu/<project_name>'
on_white(img, 512).save(f'{project}/assets/images/icon.png', optimize=True)
on_white(img, 512).save(f'{project}/assets/images/splash-icon.png', optimize=True)
on_white(img, 64).save(f'{project}/assets/images/favicon.png', optimize=True)
img.resize((512, 512), Image.LANCZOS).save(f'{project}/assets/images/android-icon-foreground.png', optimize=True)
```

Upload and update `app.config.ts`:
```bash
manus-upload-file /home/ubuntu/webdev-static-assets/school-logo.png
# → returns CDN URL
```

```typescript
// app.config.ts
appName: "เช็คชื่อหน้าเสาธง",
logoUrl: "<CDN_URL>",
```

### Checkpoint

Verify icon sizes < 1000 KB, then `webdev_save_checkpoint`.

---

## Common Issues

| Issue | Fix |
|-------|-----|
| Checkpoint fails (files >1 MB) | Resize icons to 512×512 with Pillow |
| TypeScript union type comparison error | Cast: `(item[key] as number) > 0` |
| Tab icon crash on startup | Add icon mapping to `icon-symbol.tsx` before tab layout |
| Thai text garbled in SQL | Use `str.replace("'", "''")` for escaping; write SQL file with `encoding='utf-8'` |
| Attendance not saving | Ensure `students` column is `jsonb` in schema; `JSON.stringify()` before insert |
