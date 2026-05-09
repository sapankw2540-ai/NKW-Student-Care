# ระบบบันทึกกิจกรรมหน้าเสาธง (NKW Student Care) v4.5.9

ระบบบันทึกกิจกรรมหน้าเสาธง (เช็คชื่อนักเรียน) สำหรับโรงเรียนน้ำคำวิทยา พัฒนาด้วย Expo (React Native) + tRPC + Supabase

## 🛠 Tech Stack
- **Frontend**: Expo (React Native), Lucide Icons, React Query (via tRPC)
- **Backend**: tRPC (Node.js/Next.js structure), Supabase (PostgreSQL + Auth + Storage)
- **Styling**: Vanilla React Native StyleSheet
- **Database**: Supabase PostgreSQL with RLS Policies

---

## 📈 Development Progress (Log)

### 2026-05-09
- **Excel/CSV Import (Students)**:
    - รองรับหัวคอลัมน์ภาษาไทยที่พบบ่อยขึ้น เช่น `เลขประจำตัวนักเรียน`, `รหัสประจำตัวนักเรียน`, `ชื่อ`, `ชื่อ-สกุล`, `ลำดับที่`
    - รักษาเลขนำหน้า (leading zeros) ของรหัสนักเรียนได้ดีขึ้นด้วยการอ่านค่าจากรูปแบบที่แสดงในไฟล์
    - หากไฟล์ไม่มีคอลัมน์ห้องเรียน สามารถเลือก “ตัวกรองห้อง” ในแท็บนักเรียนก่อน แล้วนำเข้าเพื่อใช้ห้องนั้นเป็นค่าเริ่มต้น

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

## 🚀 Current Status: Stable (v4.5.9-rc1)
- [x] ระบบ Login (Teacher/Admin)
- [x] หน้าเช็คชื่อ (Morning/Noon/Evening)
- [x] Dashboard สรุปภาพรวม
- [x] สรุปรายห้องเรียน
- [x] ประวัติการเช็คชื่อย้อนหลัง
- [x] ระบบจัดการข้อมูล (Admin Panel)

---

## 📋 Next Steps
4. **Notifications**: ตรวจสอบและพัฒนา Web Push Notifications หรือแจ้งเตือนผ่านช่องทางอื่น (เช่น Line Notify)
5. **System Audit**: ทดสอบการใช้งานจริง (UAT) และเก็บ Feedback เพื่อปรับปรุงระบบให้สมบูรณ์ยิ่งขึ้น

---

> **Note to Assistants**: โปรดอ่านไฟล์นี้ก่อนเริ่มงาน และบันทึกความคืบหน้าใหม่ลงในส่วน "Development Progress (Log)" ทุกครั้งหลังจากเสร็จสิ้นภารกิจ เพื่อให้ประวัติการพัฒนามีความต่อเนื่อง
