# Project TODO - ระบบเช็คและติดตามนักเรียนเข้าร่วมกิจกรรมหน้าเสาธง

## Setup & Configuration

- [x] ปรับธีมสีขาว-ส้ม-ดำ ใน theme.config.js
- [x] สร้างโลโก้แอพ (student attendance icon)
- [x] อัปเดต app.config.ts ชื่อแอพ: เช็คชื่อหน้าเสาธง
- [x] ตั้งค่า Backend API และ Database schema

## Database & Backend

- [x] สร้าง Database schema (teachers, students, classrooms, attendance, periods, statuslist, config)
- [x] นำเข้าข้อมูลจาก Excel (Students, Classrooms, Periods, StatusList, Config, Teachers)
- [x] สร้าง API: teacherLogin
- [x] สร้าง API: classrooms
- [x] สร้าง API: studentsByClassroom
- [x] สร้าง API: getAttendance
- [x] สร้าง API: getAttendanceByDatePeriod
- [x] สร้าง API: saveAttendance
- [x] สร้าง API: periods, statusList, appConfig
- [x] สร้าง API: getAllTeachers, createTeacher, updateTeacher, deleteTeacher
- [x] สร้าง API: allPeriods, updatePeriodStatus
- [x] สร้าง API: attendanceHistory, weeklyStats, monthlyStats
- [x] เพิ่ม role และ notifyTime ใน teachers table

## Screens

- [x] LoginScreen - หน้าเข้าสู่ระบบ
- [x] AttendanceScreen - ฟอร์มเช็คชื่อนักเรียน (Tab 1) + DatePicker + ค้นหา + หมายเหตุ
- [x] ClassroomSummaryScreen - สรุปตามห้องเรียน (Tab 2)
- [x] OverallSummaryScreen - สรุปภาพรวมทั้งโรงเรียน (Tab 3)
- [x] HistoryScreen - ประวัติการเช็คชื่อ + กราฟสถิติ (Tab 4)
- [x] AdminScreen - จัดการผู้ใช้ + เปิด/ปิดช่วงเวลา (Tab 5 - admin only)
- [x] ProfileScreen - โปรไฟล์ + ตั้งค่าแจ้งเตือน + ออกจากระบบ (Tab 6)

## Components

- [x] AppHeader - Header component พร้อมชื่อระบบ
- [x] DatePickerModal - เลือกวันที่ย้อนหลัง
- [x] PeriodSelector - ปุ่มเลือกช่วงเวลา (เช้า/บ่าย)
- [x] StatusBadge - แสดงสถานะ (มา/ขาด/สาย/ลา/ป่วย)

## Features

- [x] ระบบ Login/Logout พร้อม session (AsyncStorage)
- [x] เช็คชื่อนักเรียนรายห้อง (บันทึก/แก้ไข)
- [x] เลือกวันที่ย้อนหลัง (DatePickerModal)
- [x] ค้นหานักเรียนในหน้าเช็คชื่อ
- [x] หมายเหตุรายบุคคล
- [x] สรุปสถิติตามห้องเรียน
- [x] สรุปภาพรวมทั้งโรงเรียน + อัตราการเข้าเรียน
- [x] ประวัติการเช็คชื่อ + กราฟสถิติรายสัปดาห์
- [x] ระบบ Admin - จัดการผู้ใช้ (เพิ่ม/แก้ไข/ปิดใช้งาน)
- [x] ระบบ Admin - เปิด/ปิดช่วงเวลาการเช็คชื่อ
- [x] จำกัดสิทธิ์ครูตามห้องเรียนที่กำหนด
- [x] Tab Admin ซ่อนสำหรับผู้ใช้ที่ไม่ใช่ admin
- [x] Push Notification (ตั้งเวลาแจ้งเตือนรายวัน)
- [x] หน้าโปรไฟล์ + ตั้งค่าการแจ้งเตือน
- [x] แสดงวันที่ภาษาไทย (พ.ศ.)

## Bug Fixes

- [x] แสดงชื่อห้องเรียน m1-1 → ม.1/1 ในหน้าโปรไฟล์และทั่วทั้งแอพ
- [x] อัปเดตเวอร์ชันแอพเป็น 4.0

## New Features (Round 3)

- [x] Export PDF รายงานการเช็คชื่อจากหน้าประวัติ
- [x] Export PDF รายงานสรุปห้องเรียน
- [x] Admin: แก้ไขบันทึกการเช็คชื่อย้อนหลัง (เปลี่ยนสถานะ/หมายเหตุ)
- [x] Admin: ลบบันทึกการเช็คชื่อย้อนหลัง
- [x] Admin: จัดการนักเรียน - เพิ่มนักเรียนใหม่
- [x] Admin: จัดการนักเรียน - แก้ไขข้อมูลนักเรียน
- [x] Admin: จัดการนักเรียน - ย้ายห้องนักเรียน
- [x] Admin: จัดการนักเรียน - ลบนักเรียน

## Bug Fixes (Round 4)

- [x] แก้ไข Gradle build error: react-native-gesture-handler compileReleaseJavaWithJavac

## New Features (Round 5)

- [x] Export PDF จริงด้วย expo-print (render HTML เป็น PDF พร้อมตารางรายชื่อ)
- [x] Export PDF จากหน้าประวัติ (HistoryScreen)
- [x] Export PDF จากหน้าสรุปห้อง (ClassroomSummaryScreen)
- [x] Dashboard ภาพรวมรายวัน - หน้าแรกแสดงสถิติวันนี้ทุกห้องแบบ card grid
- [x] แจ้งเตือนนักเรียนขาดเรียนบ่อย - ตรวจสอบและแจ้งเตือนเมื่อขาดเกินจำนวนที่กำหนด
- [x] Admin: ตั้งค่าจำนวนครั้งขาดเรียนที่จะแจ้งเตือน

## Bug Fixes (Round 6)

- [x] แก้ไข Gradle build error ถาวร: react-native-gesture-handler AGP incompatibility (attempt 2)

## Bug Fixes (Round 7)

- [ ] Upgrade Expo SDK ~54.0.32 และ gesture-handler เพื่อแก้ AGP 8.11.0 conflict ถาวร
