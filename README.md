# ระบบบันทึกกิจกรรมหน้าเสาธง (NKW Student Care) v4.5.10
# NKW-Student-Care

ระบบบันทึกกิจกรรมหน้าเสาธง (เช็คชื่อนักเรียน) สำหรับโรงเรียนน้ำคำวิทยา พัฒนาด้วย Expo (React Native) + tRPC + Supabase

## 🛠 Tech Stack
- **Frontend**: Expo (React Native), Lucide Icons, React Query (via tRPC)
- **Backend**: tRPC (Node.js/Next.js structure), Supabase (PostgreSQL + Auth + Storage)
- **Styling**: Vanilla React Native StyleSheet
- **Database**: Supabase PostgreSQL with RLS Policies

---

## 📈 Development Progress (Log)

### 2026-05-11
- **Expo Push Notifications (v4.5.11)**:
    - [x] เพิ่มคอลัมน์ `push_token` ในฐานข้อมูลตาราง `teachers` เพื่อรองรับการส่งแจ้งเตือนรายบุคคล
    - [x] อัปเดตฝั่ง Client (`app/login.tsx`, `lib/notifications.ts`) ให้ขอสิทธิ์และลงทะเบียน Expo Push Token โดยอัตโนมัติเมื่อเข้าสู่ระบบสำเร็จ
    - [x] ปรับปรุง API `saveAttendance` ให้ส่ง Push Notification เข้ามือถือ/เว็บของ Admin ทันทีเมื่อมีการเช็คชื่อห้องเรียนเสร็จสิ้น
    - [x] เพิ่ม API endpoint `updatePushToken` สำหรับให้แอปพลิเคชันบันทึก token ล่าสุดของผู้ใช้

### 2026-05-10
- **Bug Fixes (Session & Display)**:
    - [x] **v4.5.10**: แก้ไขปัญหา "รายชื่อนักเรียนไม่แสดง" โดยปรับปรุงการเก็บ Session Token ใน AsyncStorage ให้ถูกต้อง
    - [x] แก้ไขข้อผิดพลาดของ Component ที่ไม่ได้นิยาม (ConfirmModal) ในหน้า Admin
- **LINE Messaging API**:
    - [x] อัปเกรดระบบแจ้งเตือนจาก LINE Notify เป็น **LINE Messaging API (Push Message)** เพื่อความเสถียรและฟีเจอร์ที่มากขึ้น
    - [x] เพิ่มระบบ **"ส่งสรุปรายวัน/รายช่วงเวลา"** เข้า LINE โดย Admin สามารถกดส่งได้เองจากหน้าบันทึกข้อมูล
    - [x] ลงชื่อผู้รายงานอัตโนมัติเป็น "นายธวัชชัย แก่นจักร์"
- **Strict Validation**:
    - [x] บล็อกการบันทึกซ้ำ (1 ห้อง 1 ครั้ง 1 ช่วงเวลา) เพื่อป้องกันข้อมูลทับซ้อน
- **UI/UX Enhancement**:
    - [x] ปรับปรุงการแสดงชื่อผู้รายงานใน LINE message ให้เป็น "ผู้บันทึก: {ชื่อ}" เหมือนกันสำหรับทั้งครูและแอดมิน
    - [x] ยืนยันการใช้ AppAlertProvider สำหรับ modal ทุกครั้งที่มีข้อความเตือน
    - [x] ยืนยันการปิด modal อัตโนมัติหลัง login สำเร็จใน 5 วินาที

### 2026-05-09
- **Excel/CSV Import (Students)**:
    - รองรับหัวคอลัมน์ภาษาไทยที่พบบ่อยขึ้น เช่น `เลขประจำตัวนักเรียน`, `รหัสประจำตัวนักเรียน`, `ชื่อ`, `ชื่อ-สกุล`, `ลำดับที่`
    - รักษาเลขนำหน้า (leading zeros) ของรหัสนักเรียนได้ดีขึ้นด้วยการอ่านค่าจากรูปแบบที่แสดงในไฟล์
    - หากไฟล์ไม่มีคอลัมน์ห้องเรียน สามารถเลือก “ตัวกรองห้อง” ในแท็บนักเรียนก่อน แล้วนำเข้าเพื่อใช้ห้องนั้นเป็นค่าเริ่มต้น
- **Role-Based Access Control (Viewer)**:
    - [x] เพิ่มบทบาท **"ผู้เข้าชม" (Viewer)** สำหรับบัญชี `admin1` และ `admin2`
    - [x] บล็อกการแก้ไขข้อมูล (Check-in) สำหรับผู้เข้าชม ทั้งในระดับ UI และ Backend
    - [x] หน้า Settings จำกัดให้ครูทั่วไปแก้ไขได้เฉพาะสีธีม (Local) ส่วน Admin แก้ไขข้อมูลโรงเรียนได้ทั้งหมด
- **Line Notify Integration**:
    - [x] เพิ่มระบบส่งสรุปยอดการเช็คชื่อเข้ากลุ่ม LINE อัตโนมัติหลังกดบันทึก
    - [x] สามารถตั้งค่า LINE Token ได้จากหน้าจอ Settings (เฉพาะ Admin)
    - [x] สรุปยอด มา, ขาด, สาย, ลา, ป่วย พร้อมระบุผู้บันทึกในข้อความเดียว

### 2026-05-04
- **Backend API Fixes**:
    - เพิ่ม `getFrequentAbsentees` สำหรับระบบแจ้งเตือนขาดเรียนบ่อย
    - เพิ่ม `ping` และ `version` (v1.0.1) สำหรับตรวจสอบการ Update ของ Server
    - บังคับ Restart Server โดยการเปลี่ยนรูปแบบการ Import และเพิ่ม Heartbeat log
    - ทำความสะอาด Code โดยลบ Procedure ที่ซ้ำซ้อนออก
- **Security & Auth**:
    - [x] **JWT Authentication**: เปลี่ยนระบบจาก dummy session เป็นระบบ JWT ที่มีความปลอดภัยสูง โดยใช้ `jose` ในการ Sign และ Verify Token
    - [x] **Role-Based Access Control (RBAC)**: แบ่งระดับการเข้าถึง API เป็น `public`, `protected` และ `adminOnly` เพื่อป้องกันการเข้าถึงข้อมูลโดยไม่ได้รับอนุญาต
    - [x] **Enhanced updateTeacher**: จำกัดให้ครูแก้ไขได้เฉพาะโปรไฟล์ตัวเอง ส่วนแอดมินแก้ไขได้ทุกคนและเปลี่ยนบทบาท/ห้องเรียนได้
- **UI/UX Enhancement**:
    - [x] **Premium Graphs**: ปรับปรุงกราฟในหน้า History ให้สวยงามขึ้น เพิ่มเส้นตาราง (Grid Lines), เส้นบอกระดับ 50%/100%, และดีไซน์แท่งกราฟแบบโค้งมน (Rounded) พร้อมไฮไลท์วันที่ปัจจุบัน
    - [x] ย้ายการตั้งค่า "เวลาแจ้งเตือน (HH:MM)" ไปไว้ในหน้าโปรไฟล์ส่วนตัว (รองรับ Mobile)
- **Bug Fixes**:
    - แก้ไข TypeError ใน `formatClassroomId`
    - แก้ไขหน้าแอดมินแสดงผล "มา 0 ขาด 0"
- **Data Management**:
    - [x] **Excel/CSV Import**: เพิ่มปุ่ม "นำเข้า" ในหน้าจัดการนักเรียน (Admin) โดยรองรับไฟล์ .xlsx และ .csv เพื่อประมวลผลข้อมูลลงฐานข้อมูลแบบ Bulk Insert ผ่านไลบรารี `xlsx` และ `expo-document-picker`
    - [x] **Bulk Export Testing**: ฟีเจอร์ Import รองรับการโหลดข้อมูลขนาดใหญ่เพื่อใช้สร้าง Data สำหรับการทดสอบฟีเจอร์ PDF Export ในสถานการณ์จริง

---

## 🚀 Current Status: Stable (v4.5.11)
- [x] ระบบ Login (Teacher/Admin)
- [x] หน้าเช็คชื่อ (Morning/Noon/Evening)
- [x] Dashboard สรุปภาพรวม
- [x] สรุปรายห้องเรียน
- [x] ประวัติการเช็คชื่อย้อนหลัง
- [x] ระบบจัดการข้อมูล (Admin Panel)
- [x] ระบบแจ้งเตือน (LINE Messaging API & Expo Push Notifications)

---

## 📋 Next Steps
1. **System Audit**: ทดสอบการใช้งานจริง (UAT) และเก็บ Feedback เพื่อปรับปรุงระบบให้สมบูรณ์ยิ่งขึ้น

---

> **Note to Assistants**: โปรดอ่านไฟล์นี้ก่อนเริ่มงาน และบันทึกความคืบหน้าใหม่ลงในส่วน "Development Progress (Log)" ทุกครั้งหลังจากเสร็จสิ้นภารกิจ เพื่อให้ประวัติการพัฒนามีความต่อเนื่อง
