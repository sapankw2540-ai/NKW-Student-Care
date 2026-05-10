import { generateOfficialReportHtml, OfficialReportData } from "./lib/pdf-export";
import * as fs from "fs";
import * as path from "path";

const mockData: OfficialReportData = {
  department: "กลุ่มบริหารกิจการนักเรียน โรงเรียนน้ำคำวิทยา",
  refNo: "__/๒๕๖๘",
  date: "๗ กรกฎาคม พ.ศ. ๒๕๖๘",
  subject: "รายงานผลสถิติการเข้าร่วมกิจกรรมหน้าเสาธงและเข้าแถวตอนเที่ยงประจำวันที่ ๓๐ มิถุนายน - ๔ กรกฎาคม พ.ศ. ๒๕๖๘",
  to: "ผู้อำนวยการโรงเรียนน้ำคำวิทยา",
  attachments: "รายงานสถิติการเข้าร่วมกิจกรรมของนักเรียนชั้น ม.๑ - ม.๖ จำนวน ๑ ชุด",
  bodyText: "ด้วยกลุ่มบริหารกิจการนักเรียน ได้จัดทำแบบสถิติการเข้าร่วมกิจกรรมหน้าเสาธงและเข้าแถวตอนเที่ยงของนักเรียน ตามระบบการดูแลช่วยเหลือเหลือนักเรียน ระหว่างวันที่ ๓๐ มิถุนายน - ๔ กรกฎาคม พ.ศ. ๒๕๖๘ รวมทั้งสิ้น ๕ วัน จากข้อมูลนักเรียนระดับชั้นมัธยมศึกษาปีที่ ๑ ถึง ระดับชั้นมัธยมศึกษาปีที่ ๖ ภาคเรียนที่ ๑ ปีการศึกษา ๒๕๖๘",
  reporters: [
    { name: "นายธวัชชัย แก่นจันทร์", position: "ผู้รายงาน" },
    { name: "นายกัมปนาท คันศร", position: "หัวหน้ากลุ่มบริหารกิจการนักเรียน" }
  ],
  director: {
    name: "นางสาววลัยลักษณ์ หาญสิงห์",
    position: "รองผู้อำนวยการโรงเรียนน้ำคำวิทยา"
  },
  table1: [
    { no: 1, room: "ม.6", name: "ธนวัฒน์ ผาชัน", absentCount: 14, checkCount: 14, percentage: "100.00" },
    { no: 2, room: "ม.6", name: "ธะนะชัย ไชยรัตน์", absentCount: 14, checkCount: 14, percentage: "100.00" },
    { no: 3, room: "ม.6", name: "ศุภสิทธิ์ ชาวเกวียน", absentCount: 14, checkCount: 14, percentage: "100.00" },
    { no: 4, room: "ม.6", name: "อชิรวิทย์ อาบทอง", absentCount: 14, checkCount: 14, percentage: "100.00" },
    { no: 5, room: "ม.6", name: "ภานุวัฒน์ พรมดี", absentCount: 12, checkCount: 14, percentage: "85.71" },
    { no: 6, room: "ม.4", name: "ตะวัน รุ่งสว่าง", absentCount: 12, checkCount: 12, percentage: "100.00" }
  ],
  table2: [
    { no: 1, room: "ม.6", checkCount: 140, absentCount: 45 },
    { no: 2, room: "ม.5", checkCount: 135, absentCount: 30 },
    { no: 3, room: "ม.4", checkCount: 128, absentCount: 22 },
    { no: 4, room: "ม.2", checkCount: 142, absentCount: 18 }
  ],
  dateRange: "๓๐ มิถุนายน - ๔ กรกฎาคม พ.ศ. ๒๕๖๘"
};

const html = generateOfficialReportHtml(mockData);
// Output path for browser preview
const outputPath = path.join(process.cwd(), "report_preview.html");
fs.writeFileSync(outputPath, html);
console.log("Preview generated at: " + outputPath);
