/**
 * PDF Export Utility
 * Uses expo-print to generate real PDF files from attendance data
 */
import * as Print from "expo-print";
import { shareAsync } from "expo-sharing";
import { Platform } from "react-native";
import { toThaiDateWithDay } from "./thai-date";

export interface AttendanceRecord {
  studentId: string;
  studentName: string;
  classroomId: string;
  status: string;
  note?: string | null;
}

export interface ClassroomSummaryData {
  classroomId: string;
  classroomName: string;
  date: string;
  period: string;
  records: AttendanceRecord[];
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  sick: number;
}

export interface HistoryReportData {
  title: string;
  dateRange: string;
  classroomName: string;
  rows: {
    date: string;
    period: string;
    present: number;
    absent: number;
    late: number;
    leave: number;
    sick: number;
    total: number;
    rate: string;
    recorder: string;
  }[];
}

export interface OfficialReportData {
  department: string;
  refNo: string;
  date: string;
  subject: string;
  to: string;
  attachments: string;
  bodyText: string;
  reporters: {
    name: string;
    position: string;
  }[];
  director: {
    name: string;
    position: string;
  };
  table1: {
    no: number;
    room: string;
    name: string;
    absentCount: number;
    checkCount: number;
    percentage: string;
  }[];
  table2: {
    no: number;
    room: string;
    checkCount: number;
    absentCount: number;
  }[];
  dateRange: string;
  logoUrl?: string;
  // Chart Data
  trendData?: {
    date: string;
    present: number;
    absent: number;
  }[];
  gradeStats?: Record<string, {
    present: number;
    absent: number;
    late: number;
    leave: number;
    sick: number;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  present: "มา",
  absent: "ขาด",
  late: "สาย",
  leave: "ลา",
  sick: "ป่วย",
};

const STATUS_COLORS: Record<string, string> = {
  present: "#22c55e",
  absent: "#ef4444",
  late: "#f59e0b",
  leave: "#3b82f6",
  sick: "#a855f7",
};

const SCHOOL_NAME = "โรงเรียนน้ำคำวิทยา";
const SYSTEM_NAME = "ระบบเช็คและติดตามนักเรียนเข้าร่วมกิจกรรมหน้าเสาธง";

/**
 * Generate HTML for classroom attendance report
 */
export function generateClassroomReportHtml(data: ClassroomSummaryData): string {
  const thaiDate = toThaiDateWithDay(new Date(data.date));
  const attendanceRate =
    data.totalStudents > 0
      ? ((data.present / data.totalStudents) * 100).toFixed(1)
      : "0.0";

  const rows = data.records
    .map(
      (r, i) => `
      <tr style="background: ${i % 2 === 0 ? "#fff" : "#f9fafb"}">
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-align: center;">${i + 1}</td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${r.studentId}</td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${r.studentName}</td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-align: center;">
          <span style="
            background: ${STATUS_COLORS[r.status] || "#6b7280"}22;
            color: ${STATUS_COLORS[r.status] || "#6b7280"};
            padding: 2px 10px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 13px;
          ">${STATUS_LABELS[r.status] || r.status}</span>
        </td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">${r.note || "-"}</td>
      </tr>
    `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page { 
      size: A4; 
      margin: 2.5cm; 
    }
    * { 
      font-family: 'Sarabun', 'Tahoma', sans-serif; 
      box-sizing: border-box; 
      -webkit-print-color-adjust: exact;
    }
    body { 
      margin: 0; 
      padding: 0; 
      color: #111; 
      font-size: 14px; 
      line-height: 1.5;
    }
    .header { 
      text-align: center; 
      margin-bottom: 30px; 
      border-bottom: 2px solid #f97316; 
      padding-bottom: 20px; 
    }
    .school-name { font-size: 22px; font-weight: bold; color: #f97316; margin: 0 0 5px; }
    .system-name { font-size: 14px; color: #6b7280; margin: 0 0 10px; }
    .report-title { font-size: 18px; font-weight: bold; color: #111; margin: 0; }
    .meta { 
      display: flex; 
      gap: 30px; 
      justify-content: center; 
      margin-top: 12px; 
      font-size: 14px; 
      color: #374151; 
    }
    .summary-grid { 
      display: flex; 
      gap: 10px; 
      margin: 20px 0; 
    }
    .summary-card { 
      flex: 1; 
      padding: 10px; 
      border-radius: 8px; 
      text-align: center; 
      border: 1px solid #e5e7eb;
    }
    .summary-card .num { font-size: 20px; font-weight: bold; }
    .summary-card .label { font-size: 11px; margin-top: 2px; font-weight: 600; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 10px; 
      table-layout: fixed;
    }
    th { 
      background: #f97316; 
      color: white; 
      padding: 12px 8px; 
      text-align: left; 
      font-size: 13px; 
      border: 1px solid #ea580c; 
    }
    td { 
      padding: 10px 8px; 
      border: 1px solid #e5e7eb; 
      word-wrap: break-word;
    }
    tr { page-break-inside: avoid; }
    .footer { 
      margin-top: 40px; 
      text-align: right; 
      font-size: 12px; 
      color: #9ca3af; 
      border-top: 1px solid #f3f4f6;
      padding-top: 10px;
    }
    @media print {
      @page { size: A4; margin: 2.5cm; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <p class="school-name">${SCHOOL_NAME}</p>
    <p class="system-name">${SYSTEM_NAME}</p>
    <p class="report-title">รายงานการเช็คชื่อ ห้อง ${data.classroomName}</p>
    <div class="meta">
      <span>📅 ${thaiDate}</span>
      <span>⏰ ช่วง${data.period}</span>
      <span>📊 อัตราเข้าเรียน ${attendanceRate}%</span>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card" style="background:#f0fdf4;">
      <div class="num" style="color:#16a34a;">${data.present}</div>
      <div class="label" style="color:#16a34a;">มา</div>
    </div>
    <div class="summary-card" style="background:#fef2f2;">
      <div class="num" style="color:#dc2626;">${data.absent}</div>
      <div class="label" style="color:#dc2626;">ขาด</div>
    </div>
    <div class="summary-card" style="background:#fffbeb;">
      <div class="num" style="color:#d97706;">${data.late}</div>
      <div class="label" style="color:#d97706;">สาย</div>
    </div>
    <div class="summary-card" style="background:#eff6ff;">
      <div class="num" style="color:#2563eb;">${data.leave}</div>
      <div class="label" style="color:#2563eb;">ลา</div>
    </div>
    <div class="summary-card" style="background:#faf5ff;">
      <div class="num" style="color:#9333ea;">${data.sick}</div>
      <div class="label" style="color:#9333ea;">ป่วย</div>
    </div>
    <div class="summary-card" style="background:#f9fafb;">
      <div class="num" style="color:#374151;">${data.totalStudents}</div>
      <div class="label" style="color:#374151;">ทั้งหมด</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px; text-align:center;">ที่</th>
        <th style="width:80px;">เลขที่</th>
        <th>ชื่อ-สกุล</th>
        <th style="width:100px; text-align:center;">สถานะ</th>
        <th>หมายเหตุ</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">
    พิมพ์เมื่อ: ${new Date().toLocaleDateString("th-TH")} ${new Date().toLocaleTimeString("th-TH")} น. | พัฒนาโดย NKW Student Care
  </div>
</body>
</html>`;
}

/**
 * Helper to convert Arabic numerals to Thai numerals
 */
export function toThaiNumerals(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  const arabic = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const thai = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];
  return str.split("").map(char => {
    const idx = arabic.indexOf(char);
    return idx >= 0 ? thai[idx] : char;
  }).join("");
}

/**
 * Generate HTML for official government memo report (บันทึกข้อความ)
 */
export function generateOfficialReportHtml(data: OfficialReportData): string {
  const table1Rows = data.table1.map((r, idx) => `
    <tr class="${idx % 2 === 0 ? 'odd-row' : 'even-row'}">
      <td style="text-align:center;">${toThaiNumerals(r.no)}</td>
      <td style="text-align:center;">${toThaiNumerals(r.room)}</td>
      <td>${r.name}</td>
      <td style="text-align:center;">${toThaiNumerals(r.absentCount)} / ${toThaiNumerals(r.checkCount)}</td>
      <td style="text-align:center;">${toThaiNumerals(r.percentage)}%</td>
    </tr>
  `).join("");

  const table2Rows = data.table2.map((r, idx) => `
    <tr class="${idx % 2 === 0 ? 'odd-row' : 'even-row'}">
      <td style="text-align:center;">${toThaiNumerals(r.no)}</td>
      <td style="text-align:center;">${toThaiNumerals(r.room)}</td>
      <td style="text-align:center;">${toThaiNumerals(r.checkCount)}</td>
      <td style="text-align:center;">${toThaiNumerals(r.absentCount)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>พรีวิวบันทึกข้อความ (เลขไทย) — NKW Student Care</title>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    /* ===== SCREEN ===== */
    html, body { margin: 0; padding: 0; background: #4B5563; font-family: 'Sarabun', sans-serif; }
    .pages-wrapper { display: flex; flex-direction: column; align-items: center; gap: 32px; padding: 32px 0 64px; font-size: 13pt; }
    .page {
      background: #fff;
      width: 21cm;
      min-height: 29.7cm;
      padding: 2.5cm 2cm 2cm 3cm;
      box-sizing: border-box;
      box-shadow: 0 4px 32px rgba(0,0,0,0.4);
      position: relative;
      font-size: inherit;
      line-height: 1.5;
      color: #000;
    }
    .page-label {
      position: absolute; top: -26px; left: 0;
      color: #D1D5DB; font-size: 12px; font-weight: 600;
    }

    /* ===== MEMO ===== */
    .garuda { width: 1.5cm; height: 1.7cm; display: block; }
    .memo-title { font-size: 24pt; font-weight: bold; text-align: center; margin-top: -1.3cm; margin-bottom: 0.4cm; }
    .memo-header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 0.8cm; }
    .memo-row { display: flex; margin-bottom: 6px; align-items: flex-start; }
    .memo-label { font-weight: bold; min-width: 1.8cm; flex-shrink: 0; white-space: nowrap; }
    .memo-field { flex: 1; }
    .memo-content { text-align: justify; text-justify: inter-character; }
    .memo-para { margin-bottom: 0.4cm; line-height: 1.6; text-align: justify; text-justify: inter-character; }
    .memo-indent { display: inline-block; width: 2.5cm; }
    .signature-section { margin-top: 1.5cm; display: flex; justify-content: space-between; }
    .sig-block { width: 48%; text-align: center; display: flex; flex-direction: column; align-items: center; }

    /* Uniform dotted lines */
    .dot-line {
      border-bottom: 1.5px dashed #000;
      margin-top: 0.8cm;
      width: 100%;
      display: block;
    }
    .sig-dots { letter-spacing: 2px; color: #000; }

    /* ===== TABLES ===== */
    .table-container { }
    .table-title { font-weight: bold; text-align: center; margin-bottom: 0.2cm; font-size: 15pt; }
    .table-subtitle { text-align: center; margin-bottom: 0.8cm; font-size: 15pt; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0.8cm; font-size: 13pt; }
    th { background-color: #D1D5DB; border: 1px solid #000; padding: 6px 8px; font-weight: bold; text-align: center; }
    td { border: 1px solid #000; padding: 5px 8px; vertical-align: middle; white-space: nowrap; }
    .odd-row td { background-color: #FFFFFF; }
    .even-row td { background-color: #F3F4F6; }
    .note { font-size: 12pt; margin-top: 0.3cm; }

    /* ===== CHARTS ===== */
    .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 1cm; }
    .chart-box { border: 1px solid #E5E7EB; padding: 10px; border-radius: 8px; text-align: center; }
    .chart-title-sm { font-size: 14pt; font-weight: bold; margin-bottom: 5px; }
    .trend-box { margin-top: 1.5cm; border: 1px solid #E5E7EB; padding: 20px; border-radius: 8px; }

    /* ===== PRINT BAR ===== */
    .print-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 999;
      background: #111827; padding: 8px 20px;
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    }
    .print-bar-title { color: #9CA3AF; font-size: 13px; flex: 1; }
    .btn {
      border: none; padding: 7px 16px; border-radius: 8px;
      font-size: 14px; font-weight: 700; cursor: pointer;
      font-family: 'Sarabun', sans-serif; color: #fff;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .btn-print { background: #F97316; }
    .btn-print:hover { background: #EA580C; }
    .btn-fs { background: #374151; font-size: 18px; padding: 5px 14px; }
    .btn-fs:hover { background: #4B5563; }
    .fs-display { color: #E5E7EB; font-size: 13px; min-width: 40px; text-align: center; }
    body { padding-top: 56px; }

    /* ===== PRINT SETTINGS ===== */
    @media print {
      @page {
        size: A4;
        margin: 0 !important;
      }
      html, body { background: white; padding: 0; margin: 0 !important; }
      .print-bar { display: none !important; }
      .pages-wrapper { gap: 0; padding: 0; margin: 0 !important; }
      .page {
        box-shadow: none;
        width: 100%;
        min-height: 100vh;
        page-break-after: always;
        padding: 2.5cm 2cm 2cm 3cm;
        margin: 0 !important;
      }
      .page:last-child { page-break-after: avoid; }
      .page-label { display: none; }
    }
  </style>
</head>
<body>

<!-- ===== PRINT BAR ===== -->
<div class="print-bar">
  <span class="print-bar-title">🖨️ พรีวิว: บันทึกข้อความ (เลขไทย) — NKW Student Care</span>
  <button class="btn btn-fs" id="btnFsDown" title="ลดขนาดตัวอักษร">A−</button>
  <span class="fs-display" id="fsDisplay">13pt</span>
  <button class="btn btn-fs" id="btnFsUp" title="เพิ่มขนาดตัวอักษร">A+</button>
  <button class="btn btn-print" onclick="doPrint()">🖨️ พิมพ์ / บันทึก PDF</button>
</div>

<div class="pages-wrapper" id="pagesWrapper">

  <!-- ===== PAGE 1: MEMO ===== -->
  <div class="page">
    <div class="page-label">หน้าที่ ๑ — บันทึกข้อความ</div>

    <img src="${data.logoUrl || 'https://www.thailibrary.in.th/wp-content/uploads/2013/04/482457_10200601494981789_1825578775_n.jpg'}"
         class="garuda" />
    <div class="memo-title">บันทึกข้อความ</div>

    <div class="memo-header">
      <div class="memo-row">
        <span class="memo-label">ส่วนราชการ</span>
        <span class="memo-field">&nbsp;&nbsp;${data.department}</span>
        <span style="font-weight:bold; flex-shrink:0; margin-right:0.3cm;">โทร</span>
        <span style="white-space:nowrap;">๐๔๕-๘๒๖-๗๓๖</span>
      </div>
      <div class="memo-row">
        <span class="memo-label">ที่</span>
        <span class="memo-field" id="fieldRefNo">${toThaiNumerals(data.refNo)}</span>
      </div>
      <div class="memo-row" style="margin-top: -0.8cm; margin-left: 50%; font-weight: normal;">
        <span style="min-width: 1.2cm;">วันที่</span>
        <span id="fieldDate">${toThaiNumerals(data.date)}</span>
      </div>
      <div class="memo-row">
        <span class="memo-label">เรื่อง</span>
        <span class="memo-field">${toThaiNumerals(data.subject)}</span>
      </div>
    </div>

    <div class="memo-content">
      <div class="memo-para"><b>เรียน</b> &nbsp;&nbsp; ${data.to}</div>
      <div class="memo-para" style="display: flex; align-items: flex-start;">
        <span style="font-weight: bold; min-width: 3.5cm; flex-shrink: 0;">สิ่งที่ส่งมาด้วย</span>
        <span>${toThaiNumerals(data.attachments)}</span>
      </div>
      <div class="memo-para">
        <span class="memo-indent"></span>${toThaiNumerals(data.bodyText)}
      </div>
      <div class="memo-para">
        <span class="memo-indent"></span>บัดนี้ งานกิจการนักเรียนและผู้ดูแลระบบสถิติการเข้าร่วมกิจกรรมของนักเรียนได้สรุปข้อมูลเรียบร้อยแล้ว จึงได้นำเสนอข้อมูลต่อผู้บริหาร รายละเอียดดังแนบมาพร้อมนี้
      </div>
      <div class="memo-para" style="margin-left:2.5cm;">จึงเรียนมาเพื่อโปรดทราบ</div>
    </div>

    <div class="signature-section">
      <div class="sig-block">
        <div style="margin-bottom: 0.2cm;">ลงชื่อ......................................................</div>
        <div style="margin-top: 0.1cm;">(${(data.reporters[0]?.name || "").split(' ').join(' &nbsp; ')})</div>
        <div style="margin-top: 0.1cm;">${data.reporters[0]?.position || "ครูที่ปรึกษา"}</div>
      </div>
      <div class="sig-block">
        <div style="margin-bottom: 0.2cm;">ลงชื่อ......................................................</div>
        <div style="margin-top: 0.1cm;">(${(data.reporters[1]?.name || "............................................").split(' ').join(' &nbsp; ')})</div>
        <div style="margin-top: 0.1cm;">${data.reporters[1]?.position || "หัวหน้ากลุ่มบริหารกิจการนักเรียน"}</div>
      </div>
    </div>

    <div style="margin-top:1.2cm;">
      <div style="font-weight:bold;">ความเห็นรองผู้อำนวยการ</div>
      <span class="dot-line"></span>

      <div style="margin-top:1.2cm; text-align:center; margin-left:50%;">
        <div style="margin-bottom: 0.2cm;">ลงชื่อ......................................................</div>
        <div style="margin-top:0.3cm;">(${(data.director?.name || "............................................").split(' ').join(' &nbsp; ')})</div>
        <div>${data.director?.position || "ผู้อำนวยการโรงเรียนน้ำคำวิทยา"}</div>
      </div>
    </div>
    <!-- พื้นที่ว่างด้านล่างกระดาษประมาณ 3 บรรทัด -->
    <div style="height: 1.5cm;"></div>
  </div>

  <!-- ===== PAGE 2: TABLES ===== -->
  <div class="page">
    <div class="page-label">หน้าที่ ๒ — ตารางสถิติ</div>

    <div class="table-container">
      <div class="table-title">สรุปสถิติการเข้าร่วมกิจกรรมหน้าเสาธงและกิจกรรมก่อนเรียนคาบบ่าย</div>
      <div class="table-subtitle">ระหว่างวันที่ ${toThaiNumerals(data.dateRange)}</div>

      <div style="font-weight:bold; margin-bottom:0.3cm;">ตารางที่ ๑: รายชื่อนักเรียนที่ขาด (เรียงจาก "ขาด" มาก → น้อย)</div>
      <table>
        <thead>
          <tr>
            <th style="width:1.2cm;">ลำดับ</th>
            <th style="width:1.8cm;">ห้อง</th>
            <th>ชื่อ - สกุล</th>
            <th style="width:3.5cm;">จำนวนครั้ง(ขาด) / ที่เช็ค</th>
            <th style="width:1.8cm;">ร้อยละ (%)</th>
          </tr>
        </thead>
        <tbody>
          ${table1Rows}
        </tbody>
      </table>

      <div style="font-weight:bold; margin-bottom:0.3cm; margin-top:0.8cm;">ตารางที่ ๒: สรุปแยกตามห้องเรียน</div>
      <table>
        <thead>
          <tr>
            <th style="width:1.2cm;">ลำดับ</th>
            <th style="width:4.5cm;">ห้องเรียน</th>
            <th style="width:4cm;">จำนวนครั้งที่เช็ค</th>
            <th>จำนวนครั้ง(ขาด)</th>
          </tr>
        </thead>
        <tbody>
          ${table2Rows}
        </tbody>
      </table>
      <div class="note">* หมายเหตุ: "จำนวนครั้ง" หมายถึง นับจำนวนขาดทั้งรอบเช้าและรอบบ่าย</div>
    </div>
  </div>

  <!-- ===== PAGE 3: CHARTS ===== -->
  <div class="page">
    <div class="page-label">หน้าที่ ๓ — แผนภูมิสถิติ</div>
    <div class="table-title">สรุปแผนภูมิสถิติการเข้าร่วมกิจกรรม</div>
    <div class="table-subtitle">ระหว่างวันที่ ${toThaiNumerals(data.dateRange)} (รวมเช้า-บ่าย)</div>

    <div style="font-weight: bold; font-size: 16pt; margin-bottom: 0.5cm;">สรุปแยกตามระดับชั้น (รวมเช้า-บ่าย)</div>
    <div class="chart-grid">
      ${Object.keys(data.gradeStats || {}).sort().map(grade => {
        const safeId = grade.replace(/[^a-zA-Z0-9]/g, '_');
        return `
        <div class="chart-box">
          <div class="chart-title-sm">ระดับชั้น ${toThaiNumerals(grade)}</div>
          <canvas id="pie-${safeId}" style="max-height: 180px;"></canvas>
        </div>
        `;
      }).join("")}
    </div>

    <div class="trend-box">
      <div style="font-weight: bold; font-size: 16pt; margin-bottom: 1cm; text-align: center;">กราฟแนวโน้มการมาและการขาด (รายวัน รวมเช้า-บ่าย)</div>
      <canvas id="trend-chart" style="height: 250px;"></canvas>
    </div>
  </div>

</div>

<script>
  function toThai(n) {
    if (n === null || n === undefined) return "";
    var s = String(n);
    var a = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    var t = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];
    return s.split("").map(function(c) {
      var i = a.indexOf(c);
      return i >= 0 ? t[i] : c;
    }).join("");
  }

  let fontSize = 13;
  const MIN_FS = 10, MAX_FS = 24;
  const wrapper = document.getElementById('pagesWrapper');
  const display = document.getElementById('fsDisplay');

  function applyFs() {
    wrapper.style.fontSize = fontSize + 'pt';
    display.textContent = fontSize + 'pt';
  }
  document.getElementById('btnFsUp').addEventListener('click', () => {
    if (fontSize < MAX_FS) { fontSize += 1; applyFs(); }
  });
  document.getElementById('btnFsDown').addEventListener('click', () => {
    if (fontSize > MIN_FS) { fontSize -= 1; applyFs(); }
  });

  function doPrint() {
    const origTitle = document.title;
    document.title = '';
    window.print();
    setTimeout(() => {
      document.title = origTitle;
    }, 1000);
  }

  var colors = { present: '#10B981', absent: '#EF4444', late: '#F59E0B', leave: '#3B82F6', sick: '#8B5CF6' };
  var gradeData = ${JSON.stringify(data.gradeStats || {})};
  var trendData = ${JSON.stringify(data.trendData || [])};

  Object.keys(gradeData).forEach(function(grade) {
    var safeId = grade.replace(/[^a-zA-Z0-9]/g, '_');
    var canvas = document.getElementById('pie-' + safeId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var d = gradeData[grade];
    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['มา', 'ขาด', 'สาย', 'ลา', 'ป่วย'],
        datasets: [{ data: [d.present, d.absent, d.late, d.leave, d.sick], backgroundColor: [colors.present, colors.absent, colors.late, colors.leave, colors.sick] }]
      },
      options: { 
        plugins: { 
          legend: { position: 'bottom', labels: { font: { family: 'Sarabun', size: 10 } } },
          tooltip: { callbacks: { label: function(ctx) { return ctx.label + ': ' + toThai(ctx.raw); } } }
        }, 
        animation: false 
      }
    });
  });

  if (trendData.length > 0) {
    new Chart(document.getElementById('trend-chart').getContext('2d'), {
      type: 'line',
      data: {
        labels: trendData.map(function(t) { return t.date; }),
        datasets: [
          { label: 'มา', data: trendData.map(function(t) { return t.present; }), borderColor: colors.present, fill: false, tension: 0.3 },
          { label: 'ขาด', data: trendData.map(function(t) { return t.absent; }), borderColor: colors.absent, fill: false, tension: 0.3 }
        ]
      },
      options: { 
        plugins: { 
          legend: { labels: { font: { family: 'Sarabun' } } },
          tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ': ' + toThai(ctx.raw); } } }
        }, 
        scales: {
          y: { ticks: { font: { family: 'Sarabun' }, callback: function(v) { return toThai(v); } } },
          x: { ticks: { font: { family: 'Sarabun' }, callback: function(v) { return toThai(this.getLabelForValue(v)); } } }
        },
        animation: false 
      }
    });
  }
</script>
</body>
</html>`;
}

/**
 * Generate HTML for history/summary report
 */
export function generateHistoryReportHtml(data: HistoryReportData): string {
  const rows = data.rows
    .map(
      (r, i) => `
      <tr style="background: ${i % 2 === 0 ? "#fff" : "#f9fafb"}">
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${r.date}</td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-align:center;">${r.period}</td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-align:center; color:#16a34a; font-weight:600;">${r.present}</td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-align:center; color:#dc2626; font-weight:600;">${r.absent}</td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-align:center; color:#d97706;">${r.late}</td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-align:center; color:#2563eb;">${r.leave}</td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-align:center; color:#9333ea;">${r.sick}</td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-align:center;">${r.total}</td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-align:center; font-weight:600; color:#f97316;">${r.rate}</td>
      </tr>
    `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page { 
      size: A4; 
      margin: 2.5cm; 
    }
    * { 
      font-family: 'Sarabun', 'Tahoma', sans-serif; 
      box-sizing: border-box; 
      -webkit-print-color-adjust: exact;
    }
    body { 
      margin: 0; 
      padding: 0; 
      color: #111; 
      font-size: 13px; 
      line-height: 1.4;
    }
    .header { 
      text-align: center; 
      margin-bottom: 25px; 
      border-bottom: 2px solid #f97316; 
      padding-bottom: 15px; 
    }
    .school-name { font-size: 22px; font-weight: bold; color: #f97316; margin: 0 0 4px; }
    .system-name { font-size: 13px; color: #6b7280; margin: 0 0 8px; }
    .report-title { font-size: 17px; font-weight: bold; color: #111; margin: 0; }
    .meta { font-size: 14px; color: #374151; margin-top: 10px; font-weight: 500; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 15px; 
      table-layout: fixed;
    }
    th { 
      background: #f97316; 
      color: white; 
      padding: 10px 6px; 
      text-align: center; 
      font-size: 12px; 
      border: 1px solid #ea580c; 
    }
    td { 
      padding: 8px 6px; 
      border: 1px solid #e5e7eb; 
      word-wrap: break-word;
    }
    tr { page-break-inside: avoid; }
    .footer { 
      margin-top: 30px; 
      text-align: right; 
      font-size: 11px; 
      color: #9ca3af; 
      border-top: 1px solid #f3f4f6;
      padding-top: 8px;
    }
    @media print {
      @page { size: A4; margin: 2.5cm; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <p class="school-name">${SCHOOL_NAME}</p>
    <p class="system-name">${SYSTEM_NAME}</p>
    <p class="report-title">${data.title}</p>
    <p class="meta">ห้อง ${data.classroomName} | ${data.dateRange}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>วันที่</th>
        <th>ช่วงเวลา</th>
        <th style="color:#bbf7d0;">มา</th>
        <th style="color:#fecaca;">ขาด</th>
        <th style="color:#fde68a;">สาย</th>
        <th style="color:#bfdbfe;">ลา</th>
        <th style="color:#e9d5ff;">ป่วย</th>
        <th>ทั้งหมด</th>
        <th>อัตรา%</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">
    พิมพ์เมื่อ: ${new Date().toLocaleString("th-TH")} | เวอร์ชัน v4.5.10
  </div>
</body>
</html>`;
}

/**
 * Export PDF and share it
 */
export async function exportPdfAndShare(
  html: string,
  filename: string
): Promise<void> {
  if (Platform.OS === "web") {
    // Open the report in a new tab for previewing
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
    return;
  }

  const { uri } = await Print.printToFileAsync({
    html,
    margins: { left: 0, top: 0, right: 0, bottom: 0 },
  });

  await shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `แชร์ ${filename}`,
    UTI: ".pdf",
  });
}
