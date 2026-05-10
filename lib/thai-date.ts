// Thai date utilities

export const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export const THAI_SHORT_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.",
  "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.",
  "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const THAI_DAYS = [
  "อาทิตย์", "จันทร์", "อังคาร", "พุธ",
  "พฤหัสบดี", "ศุกร์", "เสาร์",
];

export function toThaiDate(date: Date): string {
  const day = date.getDate();
  const month = THAI_MONTHS[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} พ.ศ. ${year}`;
}

export function toThaiDateShort(date: Date): string {
  const day = date.getDate();
  const month = THAI_SHORT_MONTHS[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

export function toThaiDateFull(date: Date): string {
  const day = date.getDate();
  const month = THAI_MONTHS[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} พ.ศ. ${year}`;
}

export function toThaiDateNumeric(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear() + 543;
  return `${d}/${m}/${y}`;
}

export function toThaiDateWithDay(date: Date): string {
  const dayName = THAI_DAYS[date.getDay()];
  const day = date.getDate();
  const month = THAI_MONTHS[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `วัน${dayName}ที่ ${day} ${month} พ.ศ. ${year}`;
}

export function formatDateForApi(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateFromApi(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isToday(dateStr: string): boolean {
  const today = formatDateForApi(new Date());
  return dateStr === today;
}

/**
 * Convert classroom ID to Thai display format
 * e.g. "m1-1" → "ม.1/1", "m6-3" → "ม.6/3"
 */
export function formatClassroomId(id: string): string {
  if (!id) return "";
  // Match pattern like m1-1, m6-3, M1-1 etc.
  const match = id.trim().toLowerCase().match(/^m(\d+)-(\d+)$/);
  if (match) {
    return `ม.${match[1]}/${match[2]}`;
  }
  // Return original if pattern doesn't match
  return id;
}

/**
 * Format a comma-separated list of classroom IDs to Thai display
 * e.g. "m1-1,m2-1" → "ม.1/1, ม.2/1"
 */
export function formatClassroomIds(ids: string): string {
  if (!ids || !ids.trim()) return "";
  return ids
    .split(",")
    .map((id) => formatClassroomId(id.trim()))
    .filter(Boolean)
    .join(", ");
}
