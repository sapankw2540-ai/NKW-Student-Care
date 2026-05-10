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
    // On web, open print dialog with the specific HTML content
    await Print.printAsync({ html });
    return;
  }

  const { uri } = await Print.printToFileAsync({
    html,
    margins: { left: 20, top: 20, right: 20, bottom: 20 },
  });

  await shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `แชร์ ${filename}`,
    UTI: ".pdf",
  });
}
