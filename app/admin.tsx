import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Switch,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AppHeader } from "@/components/app-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useTeacherAuth } from "@/lib/teacher-auth";
import { router } from "expo-router";
import { formatClassroomId, formatClassroomIds, formatDateForApi, toThaiDateShort, toThaiDateNumeric } from "@/lib/thai-date";
import { DatePickerModal } from "@/components/date-picker-modal";
import { LoadingModal, LoadingStatus } from "@/components/loading-modal";
import { useAppAlert } from "@/components/app-alert-provider";
import * as DocumentPicker from "expo-document-picker";
import * as XLSX from "xlsx";
import { Platform } from "react-native";

type AdminTab = "teachers" | "periods" | "students" | "records";

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\uFEFF/g, "") // BOM
    .trim()
    .toLowerCase();
}

function normalizeCellText(value: unknown): string {
  return String(value ?? "").replace(/\uFEFF/g, "").trim();
}

function parseClassroomId(value: unknown): string {
  const raw = normalizeCellText(value);
  if (!raw) return "";

  const lower = raw.toLowerCase();
  // already in canonical form like m1-1
  if (/^m\d+-\d+$/.test(lower)) return lower;

  // Thai display like "ม.1/1" or "ม.1/01"
  const thaiMatch = lower.match(/^ม\.?\s*(\d+)\s*\/\s*(\d+)$/);
  if (thaiMatch) return `m${Number(thaiMatch[1])}-${Number(thaiMatch[2])}`;

  // Short like "1/1"
  const shortMatch = lower.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (shortMatch) return `m${Number(shortMatch[1])}-${Number(shortMatch[2])}`;

  return raw;
}

// ===== Teacher Form =====
interface TeacherFormData {
  id?: number;
  name: string;
  username: string;
  password: string;
  role: "teacher" | "admin" | "viewer";
  classroomIds: string;
  notifyTime: string;
}

const emptyTeacherForm: TeacherFormData = {
  name: "",
  username: "",
  password: "",
  role: "teacher",
  classroomIds: "",
  notifyTime: "07:30",
};

// ===== Student Form =====
interface StudentFormData {
  id?: number;
  studentId: string;
  classroomId: string;
  no: number;
  name: string;
}

const emptyStudentForm: StudentFormData = {
  studentId: "",
  classroomId: "",
  no: 1,
  name: "",
};

const PERIOD_NAMES: Record<string, string> = {
  morning: "กิจกรรมหน้าเสาธง",
  noon: "กลางวัน",
  afternoon: "กิจกรรมก่อนเรียนคาบบ่าย",
  evening: "บ่าย",
};

const STATUS_OPTIONS = [
  { label: "มา", color: "#16A34A", bg: "#DCFCE7" },
  { label: "ขาด", color: "#DC2626", bg: "#FEE2E2" },
  { label: "สาย", color: "#CA8A04", bg: "#FEF9C3" },
  { label: "ลา", color: "#2563EB", bg: "#DBEAFE" },
  { label: "ป่วย", color: "#9333EA", bg: "#F3E8FF" },
];

export default function AdminScreen() {
  const { teacher } = useTeacherAuth();
  const appAlert = useAppAlert();
  const [activeTab, setActiveTab] = useState<AdminTab>("teachers");

  // Teacher modal state
  const [teacherModalVisible, setTeacherModalVisible] = useState(false);
  const [teacherForm, setTeacherForm] = useState<TeacherFormData>(emptyTeacherForm);
  const [isEditingTeacher, setIsEditingTeacher] = useState(false);

  // Student modal state
  const [studentModalVisible, setStudentModalVisible] = useState(false);
  const [studentForm, setStudentForm] = useState<StudentFormData>(emptyStudentForm);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [studentFilterRoom, setStudentFilterRoom] = useState("all");

  // Attendance edit state
  const [recordsDate, setRecordsDate] = useState(formatDateForApi(new Date()));
  const [recordsRoomFilter, setRecordsRoomFilter] = useState("all");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editAttendanceModal, setEditAttendanceModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<{
    id: number;
    date: string;
    period: string;
    roomId: string;
    teacher: string;
    students: Array<{ student_id: string; status: string; reason: string }>;
  } | null>(null);

  // Manual Report state
  const [summaryEndDate, setSummaryEndDate] = useState(formatDateForApi(new Date()));
  const [summaryPeriod, setSummaryPeriod] = useState<string | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Loading modal state
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>("idle");
  const [loadingVisible, setLoadingVisible] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  // Redirect non-admin
  React.useEffect(() => {
    if (teacher && teacher.role !== "admin") {
      appAlert.show({ title: "ไม่มีสิทธิ์", message: "เฉพาะผู้ดูแลระบบเท่านั้น", type: "error" });
      router.replace("/(tabs)");
    }
  }, [appAlert, teacher]);

  const utils = trpc.useUtils();

  // ===== Teachers =====
  const { data: teachers = [], isLoading: loadingTeachers, refetch: refetchTeachers } = trpc.getAllTeachers.useQuery();
  const createTeacherMutation = trpc.createTeacher.useMutation({
    onSuccess: () => {
      setLoadingStatus("success");
      setLoadingMessage("เพิ่มผู้ใช้เรียบร้อยแล้ว");
      setTeacherModalVisible(false);
      refetchTeachers();
    },
    onError: (e) => {
      setLoadingStatus("error");
      setLoadingMessage(e.message);
    },
  });
  const updateTeacherMutation = trpc.updateTeacher.useMutation({
    onSuccess: () => {
      setLoadingStatus("success");
      setLoadingMessage("แก้ไขผู้ใช้เรียบร้อยแล้ว");
      setTeacherModalVisible(false);
      refetchTeachers();
    },
    onError: (e) => {
      setLoadingStatus("error");
      setLoadingMessage(e.message);
    },
  });
  const deleteTeacherMutation = trpc.deleteTeacher.useMutation({
    onSuccess: () => {
      setLoadingStatus("success");
      setLoadingMessage("ปิดใช้งานบัญชีเรียบร้อยแล้ว");
      refetchTeachers();
    },
    onError: (e) => {
      setLoadingStatus("error");
      setLoadingMessage(e.message);
    },
  });

  // ===== Periods =====
  const { data: allPeriods = [], isLoading: loadingPeriods, refetch: refetchPeriods } = trpc.allPeriods.useQuery();
  const updatePeriodMutation = trpc.updatePeriodStatus.useMutation({
    onSuccess: () => refetchPeriods(),
    onError: (e) => appAlert.show({ title: "เกิดข้อผิดพลาด", message: e.message, type: "error" }),
  });

  // ===== Classrooms =====
  const { data: classrooms = [] } = trpc.classrooms.useQuery();

  // ===== Students =====
  const { data: allStudents = [], isLoading: loadingStudents, refetch: refetchStudents } = trpc.getAllStudents.useQuery();
  const createStudentMutation = trpc.createStudent.useMutation({
    onSuccess: () => {
      setLoadingStatus("success");
      setLoadingMessage("เพิ่มนักเรียนเรียบร้อยแล้ว");
      setStudentModalVisible(false);
      refetchStudents();
    },
    onError: (e) => {
      setLoadingStatus("error");
      setLoadingMessage(e.message);
    },
  });
  const updateStudentMutation = trpc.updateStudent.useMutation({
    onSuccess: () => {
      setLoadingStatus("success");
      setLoadingMessage("แก้ไขข้อมูลนักเรียนเรียบร้อยแล้ว");
      setStudentModalVisible(false);
      refetchStudents();
    },
    onError: (e) => {
      setLoadingStatus("error");
      setLoadingMessage(e.message);
    },
  });

  const deleteStudentMutation = trpc.deleteStudent.useMutation({
    onSuccess: () => {
      setLoadingStatus("success");
      setLoadingMessage("ลบข้อมูลนักเรียนเรียบร้อยแล้ว");
      refetchStudents();
    },
    onError: (e) => {
      setLoadingStatus("error");
      setLoadingMessage(e.message);
    },
  });
  
  const importStudentsMutation = trpc.importStudents.useMutation({
    onSuccess: (data) => {
      setLoadingStatus("success");
      setLoadingMessage(`นำเข้าข้อมูลเรียบร้อยแล้ว (${data.count} คน)`);
      refetchStudents();
    },
    onError: (e) => {
      setLoadingStatus("error");
      setLoadingMessage(e.message);
    },
  });

  const sendSummaryMutation = trpc.sendDailySummary.useMutation({
    onSuccess: () => {
      setLoadingStatus("success");
      setLoadingMessage("ส่งสรุปรายงานเข้า LINE เรียบร้อยแล้ว");
    },
    onError: (e) => {
      setLoadingStatus("error");
      setLoadingMessage(e.message);
    },
  });

  const handleSendSummary = () => {
    setLoadingStatus("loading");
    setLoadingVisible(true);
    setLoadingMessage("กำลังคำนวณและส่งสรุป...");
    sendSummaryMutation.mutate({ 
      startDate: recordsDate, 
      endDate: summaryEndDate, 
      period: summaryPeriod || undefined 
    });
  };

  // ===== Attendance Records =====
  // Get 30-day range for records
  const recordsEndDate = recordsDate;
  const recordsStartDate = recordsDate;
  const { data: attendanceRecords = [], isLoading: loadingRecords, refetch: refetchRecords } = trpc.getAttendanceByDateRange.useQuery({
    startDate: recordsStartDate,
    endDate: recordsEndDate,
    roomId: recordsRoomFilter !== "all" ? recordsRoomFilter : undefined,
  });
  const updateAttendanceMutation = trpc.updateAttendanceRecord.useMutation({
    onSuccess: () => {
      setLoadingVisible(false);
      appAlert.show({
        title: "สำเร็จ",
        message: "แก้ไขบันทึกเรียบร้อยแล้ว",
        type: "success",
        autoCloseMs: 3000,
      });
      setEditAttendanceModal(false);
      refetchRecords();
    },
    onError: (e) => {
      setLoadingStatus("error");
      setLoadingMessage(e.message);
    },
  });
  const deleteAttendanceMutation = trpc.deleteAttendance.useMutation({
    onSuccess: () => {
      setLoadingVisible(false);
      appAlert.show({
        title: "สำเร็จ",
        message: "ลบบันทึกเรียบร้อยแล้ว",
        type: "success",
        autoCloseMs: 3000,
      });
      setEditAttendanceModal(false);
      refetchRecords();
    },
    onError: (e) => {
      setLoadingStatus("error");
      setLoadingMessage(e.message);
    },
  });

  // ===== Teacher handlers =====
  const openAddTeacher = () => {
    setTeacherForm(emptyTeacherForm);
    setIsEditingTeacher(false);
    setTeacherModalVisible(true);
  };

  const openEditTeacher = (t: typeof teachers[0]) => {
    setTeacherForm({
      id: t.id,
      name: t.name,
      username: t.username,
      password: "",
      role: t.role as "teacher" | "admin" | "viewer",
      classroomIds: t.classroomIds ?? "",
    });
    setIsEditingTeacher(true);
    setTeacherModalVisible(true);
  };

  const handleSaveTeacher = () => {
    if (!teacherForm.name.trim() || !teacherForm.username.trim()) {
      appAlert.show({ title: "แจ้งเตือน", message: "กรุณากรอกชื่อและชื่อผู้ใช้", type: "info" });
      return;
    }
    if (!isEditingTeacher && !teacherForm.password.trim()) {
      appAlert.show({ title: "แจ้งเตือน", message: "กรุณากรอกรหัสผ่าน", type: "info" });
      return;
    }
    if (isEditingTeacher && teacherForm.id) {
      updateTeacherMutation.mutate({
        id: teacherForm.id,
        name: teacherForm.name.trim(),
        username: teacherForm.username.trim(),
        password: teacherForm.password.trim() || undefined,
        role: teacherForm.role,
        classroomIds: teacherForm.classroomIds,
      });
    } else {
      createTeacherMutation.mutate({
        name: teacherForm.name.trim(),
        username: teacherForm.username.trim(),
        password: teacherForm.password.trim(),
        role: teacherForm.role,
        classroomIds: teacherForm.classroomIds,
      });
    }
  };

  const handleDeleteTeacher = (id: number, name: string) => {
    const message = `ต้องการปิดใช้งานบัญชี "${name}" หรือไม่? ข้อมูลจะไม่ถูกลบออกจากฐานข้อมูล แต่จะไม่สามารถเข้าสู่ระบบได้`;

    appAlert.show({
      title: "ยืนยันการลบ",
      message,
      type: "info",
      actions: [
        { label: "ยกเลิก", variant: "secondary" },
        {
          label: "ปิดใช้งาน",
          variant: "danger",
          onPress: () => {
            setLoadingStatus("loading");
            setLoadingVisible(true);
            setLoadingMessage("กำลังดำเนินการ...");
            deleteTeacherMutation.mutate({ id });
          },
        },
      ],
    });
  };

  const handleResetPassword = (t: typeof teachers[0]) => {
    appAlert.show({
      title: "รีเซ็ตรหัสผ่าน",
      message: `ต้องการรีเซ็ตรหัสผ่านของ "${t.name}" เป็น "123456" หรือไม่?`,
      type: "info",
      actions: [
        { label: "ยกเลิก", variant: "secondary" },
        {
          label: "รีเซ็ต",
          variant: "primary",
          onPress: () => {
            setLoadingStatus("loading");
            setLoadingVisible(true);
            setLoadingMessage("กำลังรีเซ็ต...");
            updateTeacherMutation.mutate({
              id: t.id,
              name: t.name,
              username: t.username,
              password: "123456",
              role: t.role as "teacher" | "admin" | "viewer",
              classroomIds: t.classroomIds || "",
            });
          },
        },
      ],
    });
  };

  const toggleClassroom = (roomId: string) => {
    const ids = teacherForm.classroomIds.split(",").map((r) => r.trim()).filter(Boolean);
    const idx = ids.indexOf(roomId);
    if (idx >= 0) ids.splice(idx, 1);
    else ids.push(roomId);
    setTeacherForm((prev) => ({ ...prev, classroomIds: ids.join(",") }));
  };

  const isClassroomSelected = (roomId: string) =>
    teacherForm.classroomIds.split(",").map((r) => r.trim()).includes(roomId);

  // ===== Student handlers =====
  const openAddStudent = () => {
    const nextNo = allStudents.filter((s) => s.classroomId === (studentFilterRoom !== "all" ? studentFilterRoom : classrooms[0]?.id)).length + 1;
    setStudentForm({
      ...emptyStudentForm,
      classroomId: studentFilterRoom !== "all" ? studentFilterRoom : (classrooms[0]?.id ?? ""),
      no: nextNo,
    });
    setIsEditingStudent(false);
    setStudentModalVisible(true);
  };

  const openEditStudent = (s: typeof allStudents[0]) => {
    setStudentForm({
      id: s.id,
      studentId: s.studentId,
      classroomId: s.classroomId,
      no: s.no,
      name: s.name,
    });
    setIsEditingStudent(true);
    setStudentModalVisible(true);
  };

  const handleSaveStudent = () => {
    if (!studentForm.name.trim() || !studentForm.studentId.trim() || !studentForm.classroomId) {
      appAlert.show({ title: "แจ้งเตือน", message: "กรุณากรอกข้อมูลให้ครบถ้วน", type: "info" });
      return;
    }
    if (isEditingStudent && studentForm.id) {
      updateStudentMutation.mutate({
        id: studentForm.id,
        studentId: studentForm.studentId.trim(),
        classroomId: studentForm.classroomId,
        no: studentForm.no,
        name: studentForm.name.trim(),
      });
    } else {
      createStudentMutation.mutate({
        studentId: studentForm.studentId.trim(),
        classroomId: studentForm.classroomId,
        no: studentForm.no,
        name: studentForm.name.trim(),
      });
    }
  };

  const handleDeleteStudent = (id: number, name: string) => {
    const message = `ต้องการลบ "${name}" ออกจากระบบหรือไม่?`;

    appAlert.show({
      title: "ยืนยันการลบ",
      message,
      type: "info",
      actions: [
        { label: "ยกเลิก", variant: "secondary" },
        {
          label: "ลบ",
          variant: "danger",
          onPress: () => {
            setLoadingStatus("loading");
            setLoadingVisible(true);
            setLoadingMessage("กำลังลบ...");
            deleteStudentMutation.mutate({ id });
          },
        },
      ],
    });
  };

  const handleImportStudents = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/csv"
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setLoadingStatus("loading");
      setLoadingVisible(true);
      setLoadingMessage("กำลังอ่านไฟล์...");

      const asset = result.assets[0];
      let arrayBuffer: ArrayBuffer;

      if (Platform.OS === 'web' && asset.file) {
        arrayBuffer = await asset.file.arrayBuffer();
      } else {
        const response = await fetch(asset.uri);
        arrayBuffer = await response.arrayBuffer();
      }

      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
        raw: false, // preserve displayed text (helps keep leading zeros)
      }) as any[];

      const defaultClassroomId = studentFilterRoom !== "all" ? studentFilterRoom : "";

      const studentsToImportRaw = jsonData
        .map((row, index) => {
          const normalized: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row ?? {})) {
            const nk = normalizeHeader(k);
            if (nk) normalized[nk] = v;
          }

          const studentId =
            normalizeCellText(
              normalized["studentid"] ??
                normalized["student_id"] ??
                normalized["รหัสนักเรียน"] ??
                normalized["รหัสประจำตัวนักเรียน"] ??
                normalized["เลขประจำตัวนักเรียน"] ??
                normalized["เลขประจำตัว"] ??
                ""
            ) ||
            // fallback: find a key that looks like student id
            (() => {
              const key = Object.keys(normalized).find((h) => h.includes("เลขประจำตัว") || h.includes("รหัสประจำตัว") || h.includes("student"));
              return normalizeCellText(key ? normalized[key] : "");
            })();

          const noRaw =
            normalized["no"] ??
            normalized["เลขที่"] ??
            normalized["ลำดับ"] ??
            normalized["ลำดับที่"] ??
            "";
          const no = Number(String(noRaw).trim()) || 0;

          const name =
            normalizeCellText(
              normalized["name"] ??
                normalized["ชื่อ-นามสกุล"] ??
                normalized["ชื่อ นามสกุล"] ??
                normalized["ชื่อสกุล"] ??
                normalized["ชื่อ-สกุล"] ??
                normalized["ชื่อนามสกุล"] ??
                normalized["ชื่อ"] ??
                ""
            ) ||
            // fallback: find a key that looks like name
            (() => {
              const key = Object.keys(normalized).find((h) => h.includes("ชื่อ"));
              return normalizeCellText(key ? normalized[key] : "");
            })();

          const classroomIdFromRow =
            parseClassroomId(
              normalized["classroomid"] ??
                normalized["classroom_id"] ??
                normalized["รหัสห้องเรียน"] ??
                normalized["ห้องเรียน"] ??
                normalized["ห้อง"] ??
                ""
            ) ||
            // fallback: find a key that looks like classroom
            (() => {
              const key = Object.keys(normalized).find((h) => h.includes("ห้อง") || h.includes("classroom"));
              return parseClassroomId(key ? normalized[key] : "");
            })();

          const classroomId = classroomIdFromRow || defaultClassroomId;

          return { studentId, classroomId, no: no > 0 ? no : index + 1, name };
        })
        .filter((s) => s.studentId && s.classroomId && s.name);

      // Dedupe by studentId (keep first occurrence)
      const seen = new Set<string>();
      const studentsToImport = studentsToImportRaw.filter((s) => {
        const key = s.studentId.trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (studentsToImport.length === 0) {
        setLoadingStatus("error");
        setLoadingMessage(
          defaultClassroomId
            ? "ไม่พบข้อมูลนักเรียนในไฟล์ (ตรวจสอบชื่อคอลัมน์ เช่น เลขประจำตัวนักเรียน/ชื่อ/เลขที่)"
            : "ไม่พบข้อมูลนักเรียนในไฟล์ (ตรวจสอบชื่อคอลัมน์ และกรุณาเลือกห้องก่อนนำเข้า หรือใส่คอลัมน์ห้องเรียน/รหัสห้องเรียน)"
        );
        return;
      }

      setLoadingMessage("กำลังนำเข้าข้อมูล...");
      importStudentsMutation.mutate({ students: studentsToImport });

    } catch (err: any) {
      setLoadingStatus("error");
      setLoadingMessage("เกิดข้อผิดพลาดในการอ่านไฟล์: " + err.message);
    }
  };

  const filteredStudents = studentFilterRoom === "all"
    ? allStudents
    : allStudents.filter((s) => s.classroomId === studentFilterRoom);

  // ===== Attendance record handlers =====
  const openEditAttendance = (record: typeof attendanceRecords[0]) => {
    const students = (record.students as Array<{ student_id: string; status: string; reason: string }>) ?? [];
    setEditingRecord({
      id: record.id,
      date: record.date,
      period: record.period,
      roomId: record.roomId,
      teacher: record.teacher,
      students,
    });
    setEditAttendanceModal(true);
  };

  const handleDeleteRecord = (id: number, date: string, roomId: string) => {
    appAlert.show({
      title: "ยืนยันการลบ",
      message: `ต้องการลบบันทึกการเช็คชื่อ ${formatClassroomId(roomId)} วันที่ ${toThaiDateShort(new Date(date + "T00:00:00"))} หรือไม่?`,
      type: "info",
      actions: [
        { label: "ยกเลิก", variant: "secondary" },
        {
          label: "ลบ",
          variant: "danger",
          onPress: () => {
            setLoadingStatus("loading");
            setLoadingVisible(true);
            setLoadingMessage("กำลังลบ...");
            deleteAttendanceMutation.mutate({ id });
          },
        },
      ],
    });
  };

  const updateStudentStatus = (studentId: string, status: string) => {
    if (!editingRecord) return;
    setEditingRecord((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        students: prev.students.map((s) =>
          s.student_id === studentId ? { ...s, status } : s
        ),
      };
    });
  };

  const updateStudentReason = (studentId: string, reason: string) => {
    if (!editingRecord) return;
    setEditingRecord((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        students: prev.students.map((s) =>
          s.student_id === studentId ? { ...s, reason } : s
        ),
      };
    });
  };

  const handleSaveAttendance = () => {
    if (!editingRecord || !teacher) return;
    setLoadingStatus("loading");
    setLoadingVisible(true);
    setLoadingMessage("กำลังบันทึก...");
    updateAttendanceMutation.mutate({
      id: editingRecord.id,
      teacher: teacher.username,
      students: editingRecord.students,
    });
  };

  // Get student name lookup
  const studentNameMap: Record<string, string> = {};
  for (const s of allStudents) {
    studentNameMap[s.studentId] = s.name;
  }

  return (
    <View style={styles.container}>
      <AppHeader title="ผู้ดูแลระบบ" />
      <ScreenContainer edges={[]} className="flex-1">
        {/* Tab bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBarScroll} contentContainerStyle={styles.tabBar}>
          {([
            { key: "teachers", label: "ผู้ใช้งาน", icon: "person.fill" },
            { key: "students", label: "นักเรียน", icon: "graduationcap.fill" },
            { key: "periods", label: "ช่วงเวลา", icon: "clock.fill" },
            { key: "records", label: "บันทึก", icon: "doc.text.fill" },
          ] as { key: AdminTab; label: string; icon: any }[]).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <IconSymbol name={tab.icon} size={15} color={activeTab === tab.key ? "#F97316" : "#78716C"} />
              <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ===== Teachers Tab ===== */}
        {activeTab === "teachers" && (
          <View style={styles.tabContent}>
            <View style={styles.tabContentHeader}>
              <Text style={styles.tabContentTitle}>ผู้ใช้งาน ({teachers.filter((t) => t.status === 1).length} คน)</Text>
              <TouchableOpacity style={styles.addButton} onPress={openAddTeacher} activeOpacity={0.8}>
                <IconSymbol name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.addButtonText}>เพิ่มผู้ใช้</Text>
              </TouchableOpacity>
            </View>
            {loadingTeachers ? (
              <ActivityIndicator size="large" color="#F97316" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={teachers}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <View style={[styles.teacherCard, item.status === 0 && styles.teacherCardDisabled]}>
                    <View style={styles.teacherInfo}>
                      <View style={styles.teacherAvatar}>
                        <Text style={styles.teacherAvatarText}>{item.name.charAt(0)}</Text>
                      </View>
                      <View style={styles.teacherDetails}>
                        <View style={styles.teacherNameRow}>
                          <Text style={styles.teacherName}>{item.name}</Text>
                          <View style={[styles.roleBadge, item.role === "admin" && styles.roleBadgeAdmin, item.role === "viewer" && { backgroundColor: "#F3F4F6" }]}>
                            <Text style={[styles.roleBadgeText, item.role === "admin" && styles.roleBadgeTextAdmin, item.role === "viewer" && { color: "#78716C" }]}>
                              {item.role === "admin" ? "แอดมิน" : item.role === "viewer" ? "ผู้เข้าชม" : "ครู"}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.teacherUsername}>@{item.username}</Text>
                        {item.classroomIds ? (
                          <Text style={styles.teacherRooms} numberOfLines={1}>
                            ห้อง: {formatClassroomIds(item.classroomIds)}
                          </Text>
                        ) : item.role !== "admin" ? (
                          <Text style={styles.teacherRoomsNone}>ยังไม่ได้กำหนดห้อง</Text>
                        ) : (
                          <Text style={styles.teacherRooms}>ดูแลทุกห้อง</Text>
                        )}
                      </View>
                    </View>
                    {item.status === 1 && (item.id !== teacher?.id) && (
                      <View style={styles.teacherActions}>
                        <TouchableOpacity 
                          style={styles.resetBtn} 
                          onPress={() => handleResetPassword(item)} 
                          activeOpacity={0.8}
                        >
                          <IconSymbol name="key.fill" size={14} color="#0EA5E9" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.editBtn} onPress={() => openEditTeacher(item)} activeOpacity={0.8}>
                          <IconSymbol name="pencil" size={14} color="#F97316" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteTeacher(item.id, item.name)} activeOpacity={0.8}>
                          <IconSymbol name="trash" size={14} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    )}
                    {item.status === 0 && (
                      <View style={styles.disabledBadge}>
                        <Text style={styles.disabledBadgeText}>ปิดใช้งาน</Text>
                      </View>
                    )}
                  </View>
                )}
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>
        )}

        {/* ===== Students Tab ===== */}
        {activeTab === "students" && (
          <View style={styles.tabContent}>
            <View style={styles.tabContentHeader}>
              <Text style={styles.tabContentTitle}>นักเรียน ({filteredStudents.length} คน)</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={styles.importButton} onPress={handleImportStudents} activeOpacity={0.8}>
                  <IconSymbol name="arrow.down.doc.fill" size={16} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>นำเข้า</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addButton} onPress={openAddStudent} activeOpacity={0.8}>
                  <IconSymbol name="plus" size={16} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>เพิ่มนักเรียน</Text>
                </TouchableOpacity>
              </View>
            </View>
            {/* Room filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, studentFilterRoom === "all" && styles.filterChipActive]}
                onPress={() => setStudentFilterRoom("all")}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, studentFilterRoom === "all" && styles.filterChipTextActive]}>ทั้งหมด</Text>
              </TouchableOpacity>
              {classrooms.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.filterChip, studentFilterRoom === c.id && styles.filterChipActive]}
                  onPress={() => setStudentFilterRoom(c.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, studentFilterRoom === c.id && styles.filterChipTextActive]}>
                    {formatClassroomId(c.id)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {loadingStudents ? (
              <ActivityIndicator size="large" color="#F97316" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={filteredStudents}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <View style={styles.studentCard}>
                    <View style={styles.studentNoBox}>
                      <Text style={styles.studentNo}>{item.no}</Text>
                    </View>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{item.name}</Text>
                      <Text style={styles.studentMeta}>
                        {formatClassroomId(item.classroomId)} • รหัส {item.studentId}
                      </Text>
                    </View>
                    <View style={styles.teacherActions}>
                      <TouchableOpacity style={styles.editBtn} onPress={() => openEditStudent(item)} activeOpacity={0.8}>
                        <IconSymbol name="pencil" size={14} color="#F97316" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteStudent(item.id, item.name)} activeOpacity={0.8}>
                        <IconSymbol name="trash" size={14} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>ไม่มีข้อมูลนักเรียน</Text>
                  </View>
                }
              />
            )}
          </View>
        )}

        {/* ===== Periods Tab ===== */}
        {activeTab === "periods" && (
          <ScrollView contentContainerStyle={styles.periodsContent}>
            <Text style={styles.periodsTitle}>กำหนดช่วงเวลาการเช็คชื่อ</Text>
            <Text style={styles.periodsSubtitle}>เปิด/ปิดช่วงเวลาที่ต้องการให้ครูสามารถบันทึกการเช็คชื่อได้</Text>
            {loadingPeriods ? (
              <ActivityIndicator size="large" color="#F97316" style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.periodsList}>
                {allPeriods.map((period) => (
                  <View key={period.id} style={styles.periodCard}>
                    <View style={styles.periodInfo}>
                      <View style={[styles.periodIcon, { backgroundColor: period.status === 1 ? "#FFF7ED" : "#F3F4F6" }]}>
                        <IconSymbol name="clock.fill" size={20} color={period.status === 1 ? "#F97316" : "#9CA3AF"} />
                      </View>
                      <View>
                        <Text style={styles.periodName}>{PERIOD_NAMES[period.id] ?? period.name}</Text>
                        <Text style={styles.periodId}>ID: {period.id}</Text>
                      </View>
                    </View>
                    <Switch
                      value={period.status === 1}
                      onValueChange={(val) => updatePeriodMutation.mutate({ id: period.id, status: val ? 1 : 0 })}
                      trackColor={{ false: "#E5E7EB", true: "#FED7AA" }}
                      thumbColor={period.status === 1 ? "#F97316" : "#9CA3AF"}
                    />
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* ===== Records Tab ===== */}
        {activeTab === "records" && (
          <View style={styles.tabContent}>
            <FlatList
              data={attendanceRecords}
              keyExtractor={(item) => String(item.id)}
              ListHeaderComponent={
                <View>
                  {/* Date + Room filter */}
                  <View style={styles.recordsFilterBar}>
                    <TouchableOpacity 
                      style={styles.recordsDateRow}
                      onPress={() => setShowDatePicker(true)}
                      activeOpacity={0.7}
                    >
                      <IconSymbol name="calendar" size={16} color="#F97316" />
                      <Text style={styles.recordsDateText}>
                        {toThaiDateNumeric(new Date(recordsDate + "T00:00:00"))}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* LINE Summary Section */}
                  <View style={[styles.summaryCard, { backgroundColor: "#FDFCFB", borderColor: "#FED7AA" }]}>
                    <View style={styles.summaryHeader}>
                      <IconSymbol name="bell.fill" size={20} color="#F97316" />
                      <Text style={[styles.summaryTitle, { color: "#9A3412" }]}>ส่งสรุปรายงานการบันทึก (LINE)</Text>
                    </View>
                    
                    <View style={styles.summaryForm}>
                      <View style={styles.rangeRow}>
                        <View style={styles.rangeCol}>
                          <Text style={styles.rangeLabel}>ตั้งแต่วันที่</Text>
                          <TouchableOpacity style={styles.rangeBtn} onPress={() => setShowDatePicker(true)}>
                            <Text style={styles.rangeBtnText}>{toThaiDateShort(new Date(recordsDate + "T00:00:00"))}</Text>
                            <IconSymbol name="calendar" size={14} color="#F97316" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.rangeCol}>
                          <Text style={styles.rangeLabel}>ถึงวันที่</Text>
                          <TouchableOpacity style={styles.rangeBtn} onPress={() => setShowEndDatePicker(true)}>
                            <Text style={styles.rangeBtnText}>{toThaiDateShort(new Date(summaryEndDate + "T00:00:00"))}</Text>
                            <IconSymbol name="calendar" size={14} color="#F97316" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.periodRow}>
                        <Text style={styles.rangeLabel}>กิจกรรม/ช่วงเวลา</Text>
                        <View style={styles.periodChips}>
                          <TouchableOpacity 
                            style={[styles.periodChip, summaryPeriod === null && styles.periodChipActive]} 
                            onPress={() => setSummaryPeriod(null)}
                          >
                            <Text style={[styles.periodChipText, summaryPeriod === null && styles.periodChipTextActive]}>ทั้งหมด</Text>
                          </TouchableOpacity>
                          {allPeriods.filter(p => p.status === 1).map(p => (
                            <TouchableOpacity 
                              key={p.id}
                              style={[styles.periodChip, summaryPeriod === p.id && styles.periodChipActive]} 
                              onPress={() => setSummaryPeriod(p.id)}
                            >
                              <Text style={[styles.periodChipText, summaryPeriod === p.id && styles.periodChipTextActive]}>{p.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      <TouchableOpacity 
                        style={[styles.mainSendBtn, { backgroundColor: "#F97316" }]} 
                        onPress={handleSendSummary}
                        activeOpacity={0.8}
                      >
                        <IconSymbol name="paperplane.fill" size={16} color="#FFFFFF" />
                        <Text style={styles.mainSendBtnText}>ส่งรายงานเข้า LINE Messaging</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.summaryHint, { color: "#9A3412" }]}>* ข้อมูลจะสรุปยอดรวมและอัตราส่วนร้อยละตามช่วงเวลาที่เลือก</Text>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
                    <TouchableOpacity
                      style={[styles.filterChip, recordsRoomFilter === "all" && styles.filterChipActive]}
                      onPress={() => setRecordsRoomFilter("all")}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.filterChipText, recordsRoomFilter === "all" && styles.filterChipTextActive]}>ทุกห้อง</Text>
                    </TouchableOpacity>
                    {classrooms.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.filterChip, recordsRoomFilter === c.id && styles.filterChipActive]}
                        onPress={() => setRecordsRoomFilter(c.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.filterChipText, recordsRoomFilter === c.id && styles.filterChipTextActive]}>
                          {formatClassroomId(c.id)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {loadingRecords && (
                    <ActivityIndicator size="large" color="#F97316" style={{ marginTop: 40 }} />
                  )}
                </View>
              }
              renderItem={({ item }) => {
                const studs = (item.students as Array<{ student_id: string; status: string; reason: string }>) ?? [];
                const presentCount = studs.filter((s) => s.status === "มา").length;
                const absentCount = studs.filter((s) => s.status === "ขาด").length;
                return (
                  <View style={styles.recordCard}>
                    <View style={styles.recordHeader}>
                      <View style={styles.recordInfo}>
                        <Text style={styles.recordRoom}>{formatClassroomId(item.roomId)}</Text>
                          <Text style={styles.recordMeta}>
                            {toThaiDateNumeric(new Date(item.date + "T00:00:00"))} • {PERIOD_NAMES[item.period] ?? item.period}
                          </Text>
                          <Text style={styles.recordTeacher}>ผู้บันทึก: {item.teacher}</Text>
                        </View>
                        <View style={styles.recordStats}>
                          <View style={styles.recordStatBadge}>
                            <Text style={[styles.recordStatText, { color: "#16A34A" }]}>มา {presentCount}</Text>
                          </View>
                          <View style={[styles.recordStatBadge, { backgroundColor: "#FEE2E2" }]}>
                            <Text style={[styles.recordStatText, { color: "#DC2626" }]}>ขาด {absentCount}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.recordActions}>
                        <TouchableOpacity
                          style={styles.recordEditBtn}
                          onPress={() => openEditAttendance(item)}
                          activeOpacity={0.8}
                        >
                          <IconSymbol name="pencil" size={13} color="#F97316" />
                          <Text style={styles.recordEditBtnText}>แก้ไข</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.recordDeleteBtn}
                          onPress={() => handleDeleteRecord(item.id, item.date, item.roomId)}
                          activeOpacity={0.8}
                        >
                          <IconSymbol name="trash" size={13} color="#DC2626" />
                          <Text style={styles.recordDeleteBtnText}>ลบ</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>ไม่มีบันทึกในวันที่เลือก</Text>
                  </View>
                }
              />
          </View>
        )}
        <DatePickerModal
          visible={showEndDatePicker}
          selectedDate={summaryEndDate}
          onClose={() => setShowEndDatePicker(false)}
          onSelect={(date) => {
            setSummaryEndDate(date);
            setShowEndDatePicker(false);
          }}
        />
      </ScreenContainer>

      {/* ===== Teacher Form Modal ===== */}
      <Modal visible={teacherModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTeacherModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEditingTeacher ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setTeacherModalVisible(false)}>
              <IconSymbol name="xmark" size={20} color="#1C1917" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>ชื่อ-นามสกุล *</Text>
              <TextInput style={styles.formInput} value={teacherForm.name} onChangeText={(t) => setTeacherForm((p) => ({ ...p, name: t }))} placeholder="เช่น นายสมชาย ใจดี" placeholderTextColor="#A8A29E" returnKeyType="next" />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>ชื่อผู้ใช้ *</Text>
              <TextInput style={styles.formInput} value={teacherForm.username} onChangeText={(t) => setTeacherForm((p) => ({ ...p, username: t }))} placeholder="เช่น somchai" placeholderTextColor="#A8A29E" autoCapitalize="none" returnKeyType="next" />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>{isEditingTeacher ? "รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)" : "รหัสผ่าน *"}</Text>
              <TextInput style={styles.formInput} value={teacherForm.password} onChangeText={(t) => setTeacherForm((p) => ({ ...p, password: t }))} placeholder="รหัสผ่าน" placeholderTextColor="#A8A29E" secureTextEntry returnKeyType="next" />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>บทบาท</Text>
              <View style={styles.roleRow}>
                {(["teacher", "admin", "viewer"] as const).map((r) => (
                  <TouchableOpacity key={r} style={[styles.roleBtn, teacherForm.role === r && styles.roleBtnActive]} onPress={() => setTeacherForm((p) => ({ ...p, role: r }))} activeOpacity={0.8}>
                    <Text style={[styles.roleBtnText, teacherForm.role === r && styles.roleBtnTextActive]}>
                      {r === "admin" ? "ผู้ดูแลระบบ" : r === "viewer" ? "ผู้เข้าชม" : "ครู"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {teacherForm.role === "teacher" && (
              <View style={styles.formField}>
                <Text style={styles.formLabel}>ห้องเรียนที่รับผิดชอบ</Text>
                <Text style={styles.formHint}>เลือกห้องที่ครูคนนี้สามารถเช็คชื่อได้ (ไม่เลือก = ทุกห้อง)</Text>
                <View style={styles.classroomGrid}>
                  {classrooms.map((c) => (
                    <TouchableOpacity key={c.id} style={[styles.classroomChip, isClassroomSelected(c.id) && styles.classroomChipActive]} onPress={() => toggleClassroom(c.id)} activeOpacity={0.8}>
                      <Text style={[styles.classroomChipText, isClassroomSelected(c.id) && styles.classroomChipTextActive]}>{formatClassroomId(c.id)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.saveBtn, (createTeacherMutation.isPending || updateTeacherMutation.isPending) && styles.saveBtnDisabled]}
              onPress={handleSaveTeacher}
              disabled={createTeacherMutation.isPending || updateTeacherMutation.isPending}
              activeOpacity={0.8}
            >
              {(createTeacherMutation.isPending || updateTeacherMutation.isPending) ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{isEditingTeacher ? "บันทึกการแก้ไข" : "เพิ่มผู้ใช้"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== Student Form Modal ===== */}
      <Modal visible={studentModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setStudentModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEditingStudent ? "แก้ไขข้อมูลนักเรียน" : "เพิ่มนักเรียนใหม่"}</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setStudentModalVisible(false)}>
              <IconSymbol name="xmark" size={20} color="#1C1917" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>ชื่อ-นามสกุล *</Text>
              <TextInput style={styles.formInput} value={studentForm.name} onChangeText={(t) => setStudentForm((p) => ({ ...p, name: t }))} placeholder="เช่น เด็กชายสมชาย ใจดี" placeholderTextColor="#A8A29E" returnKeyType="next" />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>รหัสนักเรียน *</Text>
              <TextInput style={styles.formInput} value={studentForm.studentId} onChangeText={(t) => setStudentForm((p) => ({ ...p, studentId: t }))} placeholder="เช่น 12345" placeholderTextColor="#A8A29E" keyboardType="numeric" returnKeyType="next" />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>เลขที่</Text>
              <TextInput style={styles.formInput} value={String(studentForm.no)} onChangeText={(t) => setStudentForm((p) => ({ ...p, no: parseInt(t) || 1 }))} keyboardType="numeric" returnKeyType="next" />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>ห้องเรียน *</Text>
              <View style={styles.classroomGrid}>
                {classrooms.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.classroomChip, studentForm.classroomId === c.id && styles.classroomChipActive]}
                    onPress={() => setStudentForm((p) => ({ ...p, classroomId: c.id }))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.classroomChipText, studentForm.classroomId === c.id && styles.classroomChipTextActive]}>
                      {formatClassroomId(c.id)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.saveBtn, (createStudentMutation.isPending || updateStudentMutation.isPending) && styles.saveBtnDisabled]}
              onPress={handleSaveStudent}
              disabled={createStudentMutation.isPending || updateStudentMutation.isPending}
              activeOpacity={0.8}
            >
              {(createStudentMutation.isPending || updateStudentMutation.isPending) ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{isEditingStudent ? "บันทึกการแก้ไข" : "เพิ่มนักเรียน"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== Edit Attendance Modal ===== */}
      <Modal visible={editAttendanceModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditAttendanceModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>แก้ไขบันทึกการเช็คชื่อ</Text>
              {editingRecord && (
                <Text style={styles.modalSubtitle}>
                  {formatClassroomId(editingRecord.roomId)} • {toThaiDateShort(new Date(editingRecord.date + "T00:00:00"))} • {PERIOD_NAMES[editingRecord.period] ?? editingRecord.period}
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setEditAttendanceModal(false)}>
              <IconSymbol name="xmark" size={20} color="#1C1917" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            {editingRecord?.students.map((s) => (
              <View key={s.student_id} style={styles.editStudentRow}>
                <View style={styles.editStudentInfo}>
                  <Text style={styles.editStudentName}>{studentNameMap[s.student_id] ?? s.student_id}</Text>
                  <Text style={styles.editStudentId}>รหัส {s.student_id}</Text>
                </View>
                <View style={styles.editStatusRow}>
                  {STATUS_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.label}
                      style={[styles.editStatusBtn, s.status === opt.label && { backgroundColor: opt.bg, borderColor: opt.color }]}
                      onPress={() => updateStudentStatus(s.student_id, opt.label)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.editStatusBtnText, s.status === opt.label && { color: opt.color }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {(s.status === "ขาด" || s.status === "สาย" || s.status === "ลา" || s.status === "ป่วย") && (
                  <TextInput
                    style={styles.editReasonInput}
                    value={s.reason}
                    onChangeText={(t) => updateStudentReason(s.student_id, t)}
                    placeholder="หมายเหตุ (ถ้ามี)"
                    placeholderTextColor="#A8A29E"
                    returnKeyType="done"
                  />
                )}
              </View>
            ))}
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.saveBtn, updateAttendanceMutation.isPending && styles.saveBtnDisabled]}
              onPress={handleSaveAttendance}
              disabled={updateAttendanceMutation.isPending}
              activeOpacity={0.8}
            >
              {updateAttendanceMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>บันทึกการแก้ไข</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <LoadingModal
        visible={loadingVisible}
        status={loadingStatus}
        message={loadingMessage}
        onClose={() => setLoadingVisible(false)}
      />



      <DatePickerModal
        visible={showDatePicker}
        selectedDate={recordsDate}
        onClose={() => setShowDatePicker(false)}
        onSelect={(date) => {
          setRecordsDate(date);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  tabBarScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: "#E7E5E4" },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: "#FFFFFF",
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  tabBtnActive: { backgroundColor: "#FFF7ED" },
  tabBtnText: { fontSize: 13, fontWeight: "600", color: "#78716C" },
  tabBtnTextActive: { color: "#F97316" },
  tabContent: { flex: 1 },
  tabContentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabContentTitle: { fontSize: 14, fontWeight: "600", color: "#78716C" },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F97316",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  filterScroll: { flexGrow: 0, zIndex: 10, elevation: 5, marginTop: 0, marginBottom: 20, minHeight: 44 },
  filterRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: "row" },
  filterChip: { 
    height: 38, 
    paddingHorizontal: 14, 
    borderRadius: 19, 
    backgroundColor: "#F3F4F6", 
    borderWidth: 1.5, 
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: { backgroundColor: "#FFF7ED", borderColor: "#F97316" },
  filterChipText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  filterChipTextActive: { color: "#F97316" },
  listContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 32, gap: 10 },
  importButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#10B981", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4 },
  // Teacher card
  teacherCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teacherCardDisabled: { opacity: 0.5 },
  teacherInfo: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  teacherAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#FFF7ED", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#FED7AA",
  },
  teacherAvatarText: { fontSize: 18, fontWeight: "700", color: "#F97316" },
  teacherDetails: { flex: 1 },
  teacherNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  teacherName: { fontSize: 14, fontWeight: "700", color: "#1C1917" },
  roleBadge: { backgroundColor: "#F3F4F6", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  roleBadgeAdmin: { backgroundColor: "#FFF7ED" },
  roleBadgeText: { fontSize: 10, fontWeight: "600", color: "#6B7280" },
  roleBadgeTextAdmin: { color: "#F97316" },
  teacherUsername: { fontSize: 12, color: "#78716C" },
  teacherRooms: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  teacherRoomsNone: { fontSize: 11, color: "#EF4444", marginTop: 2 },
  teacherActions: { flexDirection: "row", gap: 8 },
  resetBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#E0F2FE", alignItems: "center", justifyContent: "center" },
  editBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#FFF7ED", alignItems: "center", justifyContent: "center" },
  deleteBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
  disabledBadge: { backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  disabledBadgeText: { fontSize: 11, color: "#9CA3AF", fontWeight: "600" },
  // Student card
  studentCard: {
    backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#E7E5E4",
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  studentNoBox: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: "#FFF7ED", alignItems: "center", justifyContent: "center",
  },
  studentNo: { fontSize: 13, fontWeight: "700", color: "#F97316" },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: "600", color: "#1C1917" },
  studentMeta: { fontSize: 11, color: "#78716C", marginTop: 2 },
  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyStateText: { fontSize: 14, color: "#9CA3AF" },
  // Periods
  periodsContent: { padding: 16 },
  periodsTitle: { fontSize: 16, fontWeight: "700", color: "#1C1917", marginBottom: 4 },
  periodsSubtitle: { fontSize: 13, color: "#78716C", marginBottom: 20, lineHeight: 18 },
  periodsList: { gap: 12 },
  periodCard: {
    backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#E7E5E4",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  periodInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  periodIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  periodName: { fontSize: 16, fontWeight: "700", color: "#1C1917" },
  periodId: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  // Records
  recordsFilterBar: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  recordsDateRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF7ED", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, alignSelf: "flex-start" },
  recordsDateText: { fontSize: 14, fontWeight: "700", color: "#1C1917" },
  recordsDateInput: {
    flex: 1, borderWidth: 1.5, borderColor: "#E7E5E4", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: "#1C1917",
  },
  recordCard: {
    backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#E7E5E4",
  },
  recordHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  recordInfo: { flex: 1 },
  recordRoom: { fontSize: 15, fontWeight: "700", color: "#1C1917" },
  recordMeta: { fontSize: 12, color: "#78716C", marginTop: 2 },
  recordTeacher: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  recordStats: { gap: 4, alignItems: "flex-end" },
  recordStatBadge: { backgroundColor: "#DCFCE7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  recordStatText: { fontSize: 11, fontWeight: "600" },
  recordActions: { flexDirection: "row", gap: 8 },
  recordEditBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    paddingVertical: 8, borderRadius: 8, backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#FED7AA",
  },
  recordEditBtnText: { fontSize: 13, fontWeight: "600", color: "#F97316" },
  recordDeleteBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    paddingVertical: 8, borderRadius: 8, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA",
  },
  recordDeleteBtnText: { fontSize: 13, fontWeight: "600", color: "#DC2626" },
  // Modal
  modalContainer: { flex: 1, backgroundColor: "#FFFFFF" },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#F97316", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  modalSubtitle: { fontSize: 12, color: "#FFF7ED", marginTop: 2 },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  formContent: { padding: 20, paddingBottom: 32 },
  formField: { marginBottom: 18 },
  formLabel: { fontSize: 13, fontWeight: "600", color: "#1C1917", marginBottom: 6 },
  formHint: { fontSize: 11, color: "#78716C", marginBottom: 8 },
  formInput: {
    borderWidth: 1.5, borderColor: "#E7E5E4", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#1C1917", backgroundColor: "#FAFAFA",
  },
  roleRow: { flexDirection: "row", gap: 10 },
  roleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "#F3F4F6", alignItems: "center" },
  roleBtnActive: { backgroundColor: "#FFF7ED", borderWidth: 1.5, borderColor: "#F97316" },
  roleBtnText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  roleBtnTextActive: { color: "#F97316" },
  classroomGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  classroomChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "transparent" },
  classroomChipActive: { backgroundColor: "#FFF7ED", borderColor: "#F97316" },
  classroomChipText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  classroomChipTextActive: { color: "#F97316" },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: "#E7E5E4" },
  saveBtn: { backgroundColor: "#F97316", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  // Edit attendance
  editStudentRow: {
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  editStudentInfo: { marginBottom: 8 },
  editStudentName: { fontSize: 14, fontWeight: "600", color: "#1C1917" },
  editStudentId: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  editStatusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  editStatusBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "transparent",
  },
  editStatusBtnText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  editReasonInput: {
    marginTop: 8, borderWidth: 1.5, borderColor: "#E7E5E4", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: "#1C1917",
  },
  // Summary Card Styles
  summaryCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#166534",
  },
  summaryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 80,
    alignItems: "center",
  },
  summaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  summaryHint: {
    fontSize: 11,
    color: "#166534",
    marginTop: 8,
    opacity: 0.7,
  },
  summaryForm: {
    marginTop: 8,
    gap: 16,
  },
  rangeRow: {
    flexDirection: "row",
    gap: 12,
  },
  rangeCol: {
    flex: 1,
    gap: 6,
  },
  rangeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#44403C",
  },
  rangeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FED7AA",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  rangeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1C1917",
  },
  periodRow: {
    gap: 8,
  },
  periodChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  periodChip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E5E4",
    alignItems: "center",
    justifyContent: "center",
  },
  periodChipActive: {
    backgroundColor: "#FFF7ED",
    borderColor: "#F97316",
  },
  periodChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#78716C",
  },
  periodChipTextActive: {
    color: "#F97316",
  },
  mainSendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
    marginTop: 4,
    shadowColor: "#F97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  mainSendBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
