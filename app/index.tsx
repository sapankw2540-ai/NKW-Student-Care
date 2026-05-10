import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useFocusEffect } from "expo-router";

import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AppHeader } from "@/components/app-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { DatePickerModal } from "@/components/date-picker-modal";
import { trpc } from "@/lib/trpc";
import { useTeacherAuth } from "@/lib/teacher-auth";
import { formatDateForApi, toThaiDateWithDay, formatClassroomId } from "@/lib/thai-date";
import type { StudentAttendanceEntry } from "@/shared/types";
import { useSchoolConfig } from "@/lib/school-config";
import { getThemePalette, ThemePalette } from "@/constants/theme-palettes";
import { LoadingModal, LoadingStatus } from "@/components/loading-modal";
import { useAppAlert } from "@/components/app-alert-provider";
import { usePeriod } from "@/lib/period-context";



const STATUS_OPTIONS = [
  { label: "มา", color: "#16A34A", bg: "#DCFCE7" },
  { label: "ขาด", color: "#DC2626", bg: "#FEE2E2" },
  { label: "สาย", color: "#CA8A04", bg: "#FEF9C3" },
  { label: "ลา", color: "#2563EB", bg: "#DBEAFE" },
  { label: "ป่วย", color: "#9333EA", bg: "#F3E8FF" },
];

function getStatusStyle(status: string) {
  return STATUS_OPTIONS.find((s) => s.label === status) ?? STATUS_OPTIONS[0];
}

export default function AttendanceScreen() {
  const { teacher } = useTeacherAuth();
  const { config } = useSchoolConfig();
  const { selectedDate, setSelectedDate, selectedPeriod, setIsPageLoading } = usePeriod();
  const palette = getThemePalette(config.themeColor);
  const styles = useMemo(() => createStyles(palette), [palette]);



  const [checkModalVisible, setCheckModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<{ id: string; name: string } | null>(null);
  const [studentStatuses, setStudentStatuses] = useState<Record<string, StudentAttendanceEntry>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>("idle");
  const [loadingVisible, setLoadingVisible] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const alert = useAppAlert();

  const utils = trpc.useUtils();


  const { data: classrooms = [], isLoading: loadingClassrooms } = trpc.classrooms.useQuery();
  const { data: periods = [] } = trpc.periods.useQuery();

  // Filter classrooms based on teacher's assigned rooms (if not admin)
  const allowedRooms = teacher?.role !== "admin" && teacher?.classroomIds
    ? teacher.classroomIds.split(",").map((r) => r.trim()).filter(Boolean)
    : null;
  const visibleClassrooms = allowedRooms
    ? classrooms.filter((c) => allowedRooms.includes(c.id))
    : classrooms;

  const { data: attendanceList = [], refetch: refetchAttendance, isLoading: loadingAttendance } =
    trpc.getAttendanceByDatePeriod.useQuery(
      { date: selectedDate, period: selectedPeriod || "" },
      { enabled: !!selectedDate && !!selectedPeriod }
    );

  // Sync loading state to global period context
  useEffect(() => {
    setIsPageLoading(loadingClassrooms || loadingAttendance);
  }, [loadingClassrooms, loadingAttendance, setIsPageLoading]);


  useFocusEffect(
    useCallback(() => {
      refetchAttendance();
    }, [refetchAttendance, selectedDate, selectedPeriod])
  );


  const { data: roomStudents = [], isLoading: loadingStudents } = trpc.studentsByClassroom.useQuery(
    { classroomId: selectedRoom?.id ?? "" },
    { enabled: !!selectedRoom }
  );

  const { data: existingAttendance } = trpc.getAttendance.useQuery(
    { date: selectedDate, period: selectedPeriod || "", roomId: selectedRoom?.id ?? "" },
    { enabled: !!selectedRoom && !!selectedDate && !!selectedPeriod }
  );

  const isRoomChecked = useCallback((roomId: string) => {
    return attendanceList.some(a => a.roomId === roomId);
  }, [attendanceList]);

  const canEdit = useMemo(() => {
    if (!teacher || teacher.role === "viewer") return false;
    if (teacher.role === "admin") return true;
    if (!selectedRoom) return true;
    return !isRoomChecked(selectedRoom.id);
  }, [teacher, selectedRoom, isRoomChecked]);

  const saveMutation = trpc.saveAttendance.useMutation({
    onSuccess: () => {
      setLoadingStatus("success");
      setLoadingMessage("บันทึกการเช็คชื่อเรียบร้อยแล้ว");
      utils.getAttendance.invalidate();
      utils.getAttendanceByDatePeriod.invalidate();
    },
    onError: (err) => {
      setLoadingStatus("error");
      setLoadingMessage(err.message);
    },
  });

  const openCheckModal = useCallback((room: { id: string; name: string }) => {
    setSelectedRoom(room);
    setStudentStatuses({});
    setSearchQuery("");
    setExpandedNotes({});
    setCheckModalVisible(true);
  }, []);

  // Pre-fill existing attendance when modal opens
  React.useEffect(() => {
    if (existingAttendance && checkModalVisible && selectedRoom) {
      const entries = existingAttendance.students as StudentAttendanceEntry[];
      const map: Record<string, StudentAttendanceEntry> = {};
      for (const e of entries) map[e.student_id] = e;
      setStudentStatuses(map);
    }
  }, [existingAttendance, checkModalVisible, selectedRoom]);

  // Initialize all students to "มา" when students load and no existing data
  React.useEffect(() => {
    if (roomStudents.length > 0 && checkModalVisible && Object.keys(studentStatuses).length === 0 && !existingAttendance) {
      const map: Record<string, StudentAttendanceEntry> = {};
      for (const s of roomStudents) {
        map[s.studentId] = { student_id: s.studentId, status: "มา", reason: "" };
      }
      setStudentStatuses(map);
    }
  }, [roomStudents, checkModalVisible, existingAttendance]);

  const setStudentStatus = (studentId: string, status: string) => {
    setStudentStatuses((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], student_id: studentId, status, reason: prev[studentId]?.reason ?? "" },
    }));
  };

  const setStudentReason = (studentId: string, reason: string) => {
    setStudentStatuses((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], student_id: studentId, status: prev[studentId]?.status ?? "มา", reason },
    }));
  };

  const toggleNote = (studentId: string) => {
    setExpandedNotes((prev) => ({ ...prev, [studentId]: !prev[studentId] }));
  };

  const handleSave = () => {
    if (!selectedRoom || !teacher) return;
    
    setLoadingStatus("loading");
    setLoadingVisible(true);
    setLoadingMessage("กำลังบันทึกข้อมูล...");

    const studentsData = roomStudents.map((s) => ({
      student_id: s.studentId,
      status: studentStatuses[s.studentId]?.status ?? "มา",
      reason: studentStatuses[s.studentId]?.reason ?? "",
    }));

    saveMutation.mutate({
      date: selectedDate,
      period: selectedPeriod || "",
      roomId: selectedRoom.id,
      teacher: teacher.username,
      students: studentsData,
    });

  };

  const handleCloseLoading = () => {
    setLoadingVisible(false);
    if (loadingStatus === "success") {
      setCheckModalVisible(false);
      setSearchQuery("");
    }
  };


  const getAttendanceSummary = (roomId: string) => {
    const record = attendanceList.find((a) => a.roomId === roomId);
    if (!record) return null;
    const entries = record.students as StudentAttendanceEntry[];
    const counts = { มา: 0, ขาด: 0, สาย: 0, ลา: 0, ป่วย: 0 };
    for (const e of entries) {
      if (e.status in counts) counts[e.status as keyof typeof counts]++;
    }
    return { total: entries.length, ...counts };
  };

  // Filter students by search
  const filteredStudents = searchQuery.trim()
    ? roomStudents.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(s.no).includes(searchQuery)
      )
    : roomStudents;

  const renderClassroomItem = ({ item }: { item: { id: string; name: string } }) => {
    const checked = isRoomChecked(item.id);
    const summary = getAttendanceSummary(item.id);
    const handlePress = () => {
      if (checked && teacher?.role !== "admin") {
        alert.show({
          title: "บันทึกข้อมูลแล้ว",
          message: "มีการบันทึกข้อมูลแล้ว หากต้องการแก้ไข กรุณาแจ้งงานกิจการนักเรียน",
          type: "info"
        });
        return;
      }
      openCheckModal(item);
    };

    return (
      <View style={styles.classroomCard}>
        <View style={styles.cardHeader}>
          <View style={styles.roomBadge}>
            <Text style={styles.roomBadgeText}>{formatClassroomId(item.name)}</Text>
          </View>
          {checked ? (
            <View style={styles.checkedBadge}>
              <IconSymbol name="checkmark.circle.fill" size={14} color="#16A34A" />
              <Text style={styles.checkedText}>เช็คแล้ว</Text>
            </View>
          ) : (
            <View style={styles.notCheckedBadge}>
              <Text style={styles.notCheckedText}>ยังไม่เช็ค</Text>
            </View>
          )}
        </View>
        {summary && (
          <View style={styles.summaryRow}>
            {STATUS_OPTIONS.map((s) => (
              <SummaryChip key={s.label} label={s.label} count={summary[s.label as keyof typeof summary] as number} color={s.color} bg={s.bg} />
            ))}
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.checkButton, 
            checked && styles.checkButtonEdit,
            checked && teacher?.role !== "admin" && { backgroundColor: "#A8A29E" },
            teacher?.role === "viewer" && { backgroundColor: "#A8A29E" }
          ]}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <IconSymbol 
            name={teacher?.role === "viewer" || (checked && teacher?.role !== "admin") ? "eye.fill" : (checked ? "pencil" : "checkmark.circle.fill")} 
            size={16} 
            color="#FFFFFF" 
          />
          <Text style={styles.checkButtonText}>
            {teacher?.role === "viewer" || (checked && teacher?.role !== "admin") ? "ดูรายละเอียด" : (checked ? "แก้ไขการเช็คชื่อ" : "เช็คชื่อ")}
          </Text>
        </TouchableOpacity>
      </View>
    );

  };

  return (
    <View style={styles.container}>
      <AppHeader title="ฟอร์มเช็คชื่อ" />
      <ScreenContainer edges={[]} className="flex-1">
        {/* Date and Period Info */}
        <View style={styles.filterBar}>
          <TouchableOpacity style={styles.dateRow} onPress={() => setDatePickerVisible(true)} activeOpacity={0.7}>
            <IconSymbol name="calendar" size={16} color={palette.primary} />
            <Text style={styles.dateText}>
              {toThaiDateWithDay(new Date(selectedDate + "T00:00:00"))} • {periods.find(p => p.id === selectedPeriod)?.name ?? (selectedPeriod === "morning" ? "กิจกรรมหน้าเสาธง" : "กิจกรรมก่อนเรียนคาบบ่าย")}
            </Text>
            <IconSymbol name="chevron.down" size={14} color="#78716C" />
          </TouchableOpacity>
        </View>

        {/* Classroom List */}
        {loadingClassrooms || loadingAttendance ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : (
          <FlatList
            data={visibleClassrooms}
            keyExtractor={(item) => item.id}
            renderItem={renderClassroomItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={loadingAttendance} onRefresh={refetchAttendance} tintColor={palette.primary} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>ไม่พบข้อมูลห้องเรียน</Text>
              </View>
            }
          />
        )}
      </ScreenContainer>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={datePickerVisible}
        selectedDate={selectedDate}
        onSelect={(date) => { setSelectedDate(date); refetchAttendance(); }}
        onClose={() => setDatePickerVisible(false)}
      />

      {/* Check Attendance Modal */}
      <Modal
        visible={checkModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCheckModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>เช็คชื่อ {formatClassroomId(selectedRoom?.name ?? "")}</Text>
              <Text style={styles.modalSubtitle}>
                {toThaiDateWithDay(new Date(selectedDate + "T00:00:00"))} •{" "}
                {periods.find((p) => p.id === selectedPeriod)?.name ?? (selectedPeriod === "morning" ? "กิจกรรมหน้าเสาธง" : "กิจกรรมก่อนเรียนคาบบ่าย")}
              </Text>
            </View>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setCheckModalVisible(false)}>
              <IconSymbol name="xmark" size={20} color="#1C1917" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <IconSymbol name="magnifyingglass" size={16} color="#78716C" />
            <TextInput
              style={styles.searchInput}
              placeholder="ค้นหาชื่อหรือเลขที่..."
              placeholderTextColor="#A8A29E"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <IconSymbol name="xmark.circle.fill" size={16} color="#A8A29E" />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Select All (Hide for viewer) */}
          {teacher?.role !== "viewer" && (
            <View style={styles.quickSelectRow}>
              <Text style={styles.quickSelectLabel}>เลือกทั้งหมด:</Text>
              {STATUS_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s.label}
                  style={[styles.quickSelectBtn, { backgroundColor: s.bg }]}
                  onPress={() => {
                    const map: Record<string, StudentAttendanceEntry> = { ...studentStatuses };
                    for (const st of roomStudents) {
                      map[st.studentId] = { student_id: st.studentId, status: s.label, reason: studentStatuses[st.studentId]?.reason ?? "" };
                    }
                    setStudentStatuses(map);
                  }}
                >
                  <Text style={[styles.quickSelectBtnText, { color: s.color }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Student count info */}
          {searchQuery.trim() ? (
            <View style={styles.searchResultInfo}>
              <Text style={styles.searchResultText}>พบ {filteredStudents.length} จาก {roomStudents.length} คน</Text>
            </View>
          ) : null}

          {/* Permission Notice */}
          {!canEdit && (
            <View style={styles.readOnlyNotice}>
              <IconSymbol name="info.circle" size={14} color="#B45309" />
              <Text style={styles.readOnlyNoticeText}>
                ห้องเรียนนี้ได้มีการบันทึกการเช็คชื่อแล้ว ไม่อนุญาตให้บันทึกซ้ำ
              </Text>
            </View>
          )}

          {/* Student List */}
          {loadingStudents ? (
            <ActivityIndicator size="large" color={palette.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filteredStudents}
              keyExtractor={(item) => item.studentId}
              renderItem={({ item }) => {
                const entry = studentStatuses[item.studentId];
                const currentStatus = entry?.status ?? "มา";
                const statusStyle = getStatusStyle(currentStatus);
                const noteExpanded = expandedNotes[item.studentId] ?? false;
                const hasNote = (entry?.reason ?? "").length > 0;
                return (
                  <View style={styles.studentRow}>
                    <View style={styles.studentRowTop}>
                      <View style={styles.studentInfo}>
                        <Text style={styles.studentNo}>{item.no}</Text>
                        <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusScrollView}>
                        <View style={styles.statusButtons}>
                          {STATUS_OPTIONS.map((s) => (
                            <TouchableOpacity
                              key={s.label}
                              style={[
                                styles.statusBtn,
                                { backgroundColor: currentStatus === s.label ? s.bg : "#F3F4F6" },
                                !canEdit && { opacity: 0.8 }
                              ]}
                              onPress={() => canEdit && setStudentStatus(item.studentId, s.label)}
                              disabled={!canEdit}
                            >
                              <Text style={[styles.statusBtnText, { color: currentStatus === s.label ? s.color : "#6B7280" }]}>
                                {s.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                          {/* Note toggle button */}
                          <TouchableOpacity
                            style={[styles.noteBtn, hasNote && styles.noteBtnActive]}
                            onPress={() => (canEdit || hasNote) && toggleNote(item.studentId)}
                          >
                            <IconSymbol name="doc.text" size={14} color={hasNote ? palette.primary : "#9CA3AF"} />
                          </TouchableOpacity>
                        </View>
                      </ScrollView>
                    </View>
                    {/* Note input (expandable) */}
                    {noteExpanded && (
                      <View style={styles.noteInputRow}>
                        <TextInput
                          style={styles.noteInput}
                          placeholder="หมายเหตุ เช่น ลาป่วย มีใบรับรองแพทย์..."
                          placeholderTextColor="#A8A29E"
                          value={entry?.reason ?? ""}
                          onChangeText={(text) => setStudentReason(item.studentId, text)}
                          multiline
                          returnKeyType="done"
                        />
                      </View>
                    )}
                  </View>
                );
              }}
              contentContainerStyle={styles.studentListContent}
            />
          )}

          {/* Save Button (Hide for viewer or if already checked for non-admins) */}
          {canEdit && (
            <View style={styles.modalFooter}>

              <TouchableOpacity
                style={[styles.saveButton, saveMutation.isPending && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saveMutation.isPending}
                activeOpacity={0.8}
              >
                {saveMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <IconSymbol name="checkmark.circle.fill" size={18} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>บันทึกการเช็คชื่อ</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      <LoadingModal
        visible={loadingVisible}
        status={loadingStatus}
        message={loadingMessage}
        onClose={handleCloseLoading}
      />
    </View>
  );
}

function SummaryChip({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  const getIcon = (l: string) => {
    switch (l) {
      case "มา": return "checkmark.circle.fill";
      case "ขาด": return "xmark.circle.fill";
      case "สาย": return "clock.fill";
      case "ลา": return "person.fill";
      case "ป่วย": return "pills.fill";
      default: return "circle.fill";
    }
  };

  return (
    <View style={[styles.summaryChip, { backgroundColor: bg }]}>
      <IconSymbol name={getIcon(label) as any} size={10} color={color} />
      <Text style={[styles.summaryChipLabel, { color }]}>{label}</Text>
      <Text style={[styles.summaryChipCount, { color }]}>{count}</Text>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  filterBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E7E5E4",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.primary + "40", // 25% opacity
    alignSelf: "flex-start",
  },
  dateText: { fontSize: 14, fontWeight: "600", color: "#1C1917" },
  periodRow: { flexDirection: "row", gap: 8 },
  periodButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  periodButtonActive: { backgroundColor: palette.surface, borderColor: palette.primary },
  periodButtonText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  periodButtonTextActive: { color: palette.primary },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, gap: 12 },
  classroomCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  roomBadge: { backgroundColor: palette.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  roomBadgeText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  checkedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#DCFCE7", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  checkedText: { color: "#16A34A", fontSize: 12, fontWeight: "600" },
  notCheckedBadge: { backgroundColor: "#FEE2E2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  notCheckedText: { color: "#DC2626", fontSize: 12, fontWeight: "600" },
  summaryRow: { flexDirection: "row", gap: 6, marginBottom: 12, flexWrap: "wrap" },
  summaryChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  summaryChipLabel: { fontSize: 11, fontWeight: "600" },
  summaryChipCount: { fontSize: 12, fontWeight: "700" },
  checkButton: {
    backgroundColor: palette.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  checkButtonEdit: { backgroundColor: "#78716C" },
  checkButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  emptyContainer: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#78716C", fontSize: 15 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: "#FFFFFF" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: palette.header,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  modalSubtitle: { fontSize: 12, color: palette.surface, marginTop: 2 },
  modalCloseButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#E7E5E4",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1C1917", paddingVertical: 0 },
  searchResultInfo: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: palette.surface },
  searchResultText: { fontSize: 13, color: "#78716C", fontWeight: "600" },
  readOnlyNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    padding: 12,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  readOnlyNoticeText: {
    color: "#B45309",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  quickSelectRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: "#E7E5E4",
    gap: 8,
    flexWrap: "wrap",
  },
  quickSelectLabel: { fontSize: 13, fontWeight: "600", color: "#78716C" },
  quickSelectBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  quickSelectBtnText: { fontSize: 13, fontWeight: "700" },
  studentListContent: { paddingBottom: 20 },
  studentRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  studentRowTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  studentInfo: { flexDirection: "row", alignItems: "center", width: 155, gap: 8 },
  studentNo: { fontSize: 13, color: "#78716C", width: 24, textAlign: "center" },
  studentName: { fontSize: 14, fontWeight: "500", color: "#1C1917", flex: 1 },
  statusScrollView: { flex: 1 },
  statusButtons: { flexDirection: "row", gap: 6, paddingRight: 8, alignItems: "center" },
  statusBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statusBtnText: { fontSize: 13, fontWeight: "600" },
  noteBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  noteBtnActive: { backgroundColor: palette.surface },
  noteInputRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  noteInput: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.primary + "40",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#1C1917",
    minHeight: 40,
  },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: "#E7E5E4", backgroundColor: "#FFFFFF" },
  saveButton: {
    backgroundColor: palette.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});

// For backward compatibility or static styles
const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  summaryChipLabel: { fontSize: 11, fontWeight: "600" },
  summaryChipCount: { fontSize: 12, fontWeight: "700" },
});
