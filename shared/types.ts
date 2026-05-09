/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// ===== Attendance App Types =====

export interface TeacherSession {
  id: number;
  name: string;
  username: string;
  classroomIds: string | null;
  role: "teacher" | "admin" | "viewer";
  notifyTime?: string | null;
}

export interface StudentAttendanceEntry {
  student_id: string;
  status: string;
  reason: string;
}

export interface AttendanceSummary {
  roomId: string;
  roomName: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  sick: number;
  checked: boolean;
}
