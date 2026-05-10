import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AppHeader } from "@/components/app-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useTeacherAuth } from "@/lib/teacher-auth";
import { formatDateForApi, formatClassroomId } from "@/lib/thai-date";
import { generateHistoryReportHtml, exportPdfAndShare } from "@/lib/pdf-export";
import { useAppAlert } from "@/components/app-alert-provider";
import { useSchoolConfig } from "@/lib/school-config";
import { getThemePalette, ThemePalette } from "@/constants/theme-palettes";

type RangeMode = "week" | "month";

function getDateRange(mode: RangeMode, offset: number) {
  const today = new Date();
  if (mode === "week") {
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7) + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const THAI_DAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    return {
      start: formatDateForApi(monday),
      end: formatDateForApi(sunday > today && offset === 0 ? today : sunday),
      label: offset === 0 ? "สัปดาห์นี้" : `${Math.abs(offset)} สัปดาห์ก่อน`,
    };
  } else {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return {
      start: formatDateForApi(d),
      end: formatDateForApi(end > today && offset === 0 ? today : end),
      label: `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`,
    };
  }
}

export default function AbsentAlertScreen() {
  const { config } = useSchoolConfig();
  const palette = getThemePalette(config.themeColor);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { teacher } = useTeacherAuth();
  const appAlert = useAppAlert();
  const [rangeMode, setRangeMode] = useState<RangeMode>("week");
  const [rangeOffset, setRangeOffset] = useState(0);
  const [threshold, setThreshold] = useState(3);
  const [refreshing, setRefreshing] = useState(false);

  const range = useMemo(() => getDateRange(rangeMode, rangeOffset), [rangeMode, rangeOffset]);

  const allowedRooms = teacher?.role !== "admin" && teacher?.classroomIds
    ? teacher.classroomIds.split(",").map((r) => r.trim()).filter(Boolean)
    : null;

  const { data: classrooms = [] } = trpc.classrooms.useQuery();
  const visibleClassrooms = allowedRooms
    ? classrooms.filter((c) => allowedRooms.includes(c.id))
    : classrooms;

  const { data: absentees = [], isLoading, refetch } = trpc.getFrequentAbsentees.useQuery({
    startDate: range.start,
    endDate: range.end,
    threshold,
  });

  const filteredAbsentees = allowedRooms
    ? absentees.filter((a) => allowedRooms.includes(a.classroomId))
    : absentees;

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleExport = async () => {
    if (filteredAbsentees.length === 0) return;
    try {
      const rows = filteredAbsentees.map((a) => ({
        date: formatClassroomId(a.classroomId),
        period: formatClassroomId(a.classroomId),
        present: 0,
        absent: a.count,
        late: 0,
        leave: 0,
        sick: 0,
        total: a.count,
        rate: `${a.count} ครั้ง`,
      }));
      const html = generateHistoryReportHtml({
        title: `รายงานนักเรียนขาดเรียนบ่อย (≥${threshold} ครั้ง)`,
        dateRange: `${range.label} (${range.start} ถึง ${range.end})`,
        classroomName: "ทุกห้องเรียน",
        rows: filteredAbsentees.map((a) => ({
          date: a.studentId,
          period: a.name,
          present: 0,
          absent: a.count,
          late: 0,
          leave: 0,
          sick: 0,
          total: a.count,
          rate: `${formatClassroomId(a.classroomId)}`,
        })),
      });
      await exportPdfAndShare(html, `ขาดบ่อย_${range.label}.pdf`);
    } catch {
      appAlert.show({ title: "เกิดข้อผิดพลาด", message: "ไม่สามารถสร้าง PDF ได้", type: "error" });
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="แจ้งเตือนขาดเรียน" />
      <ScreenContainer edges={[]} className="flex-1">
        {/* Filter Bar */}
        <View style={styles.filterBar}>
          {/* Range Mode */}
          <View style={styles.modeRow}>
            {(["week", "month"] as RangeMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, rangeMode === m && styles.modeBtnActive]}
                onPress={() => { setRangeMode(m); setRangeOffset(0); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.modeBtnText, rangeMode === m && styles.modeBtnTextActive]}>
                  {m === "week" ? "รายสัปดาห์" : "รายเดือน"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Navigation */}
          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => setRangeOffset((o) => o - 1)}
              activeOpacity={0.8}
            >
              <IconSymbol name="chevron.left" size={16} color={palette.primary} />
            </TouchableOpacity>
            <Text style={styles.rangeLabel}>{range.label}</Text>
            <TouchableOpacity
              style={[styles.navBtn, rangeOffset >= 0 && styles.navBtnDisabled]}
              onPress={() => rangeOffset < 0 && setRangeOffset((o) => o + 1)}
              activeOpacity={0.8}
            >
              <IconSymbol name="chevron.right" size={16} color={rangeOffset >= 0 ? "#D4D4D4" : palette.primary} />
            </TouchableOpacity>
          </View>

          {/* Threshold */}
          <View style={styles.thresholdRow}>
            <Text style={styles.thresholdLabel}>แจ้งเตือนเมื่อขาด ≥</Text>
            <View style={styles.thresholdControl}>
              <TouchableOpacity
                style={styles.thresholdBtn}
                onPress={() => setThreshold((t) => Math.max(1, t - 1))}
                activeOpacity={0.8}
              >
                <Text style={styles.thresholdBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.thresholdValue}>{threshold}</Text>
              <TouchableOpacity
                style={styles.thresholdBtn}
                onPress={() => setThreshold((t) => t + 1)}
                activeOpacity={0.8}
              >
                <Text style={styles.thresholdBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.thresholdLabel}>ครั้ง</Text>
          </View>
        </View>

        {/* Header Row */}
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>
            พบ {filteredAbsentees.length} คน ที่ขาดเรียน ≥{threshold} ครั้ง
          </Text>
          {filteredAbsentees.length > 0 && (
            <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.8}>
              <IconSymbol name="square.and.arrow.up" size={13} color={palette.primary} />
              <Text style={styles.exportBtnText}>PDF</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : filteredAbsentees.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol name="checkmark.circle.fill" size={56} color="#DCFCE7" />
            <Text style={styles.emptyTitle}>ไม่พบนักเรียนขาดเรียนบ่อย</Text>
            <Text style={styles.emptySubtitle}>ยังไม่มีนักเรียนที่ขาดเรียน ≥{threshold} ครั้ง{"\n"}ในช่วง{range.label}</Text>
          </View>
        ) : (
          <FlatList
            data={filteredAbsentees}
            keyExtractor={(item) => item.studentId}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => (
              <View style={styles.studentCard}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{item.name}</Text>
                  <Text style={styles.studentMeta}>
                    {formatClassroomId(item.classroomId)} • รหัส {item.studentId}
                  </Text>
                </View>
                <View style={[
                  styles.countBadge,
                  { backgroundColor: item.count >= 5 ? "#FEE2E2" : item.count >= 3 ? "#FEF9C3" : "#F3F4F6" }
                ]}>
                  <Text style={[
                    styles.countText,
                    { color: item.count >= 5 ? "#DC2626" : item.count >= 3 ? "#CA8A04" : "#78716C" }
                  ]}>
                    {item.count}
                  </Text>
                  <Text style={[
                    styles.countLabel,
                    { color: item.count >= 5 ? "#DC2626" : item.count >= 3 ? "#CA8A04" : "#78716C" }
                  ]}>
                    ครั้ง
                  </Text>
                </View>
              </View>
            )}
          />
        )}
      </ScreenContainer>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  filterBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 10, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modeBtn: { 
    flex: 1, 
    paddingVertical: 10, 
    borderRadius: 12, 
    backgroundColor: "#F5F5F4", 
    alignItems: "center", 
    justifyContent: "center" 
  },
  modeBtnActive: { backgroundColor: palette.primary },
  modeBtnText: { fontSize: 13, fontWeight: "700", color: "#78716C" },
  modeBtnTextActive: { color: "#FFFFFF" },
  navRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  navBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: palette.surface, justifyContent: "center", alignItems: "center" },
  navBtnDisabled: { backgroundColor: "#F3F4F6" },
  rangeLabel: { flex: 1, textAlign: "center", fontSize: 14, fontWeight: "700", color: "#1C1917" },
  thresholdRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  thresholdLabel: { fontSize: 13, color: "#78716C", fontWeight: "500" },
  thresholdControl: { flexDirection: "row", alignItems: "center", gap: 0, backgroundColor: "#F3F4F6", borderRadius: 8, overflow: "hidden" },
  thresholdBtn: { width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  thresholdBtnText: { fontSize: 18, fontWeight: "700", color: palette.primary },
  thresholdValue: { minWidth: 28, textAlign: "center", fontSize: 15, fontWeight: "700", color: "#1C1917" },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  listHeaderText: { fontSize: 13, fontWeight: "600", color: "#78716C" },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: palette.surface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  exportBtnText: { fontSize: 12, fontWeight: "600", color: palette.primary },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#1C1917" },
  emptySubtitle: { fontSize: 13, color: "#78716C", textAlign: "center", lineHeight: 20 },
  listContent: { padding: 16, gap: 10, paddingBottom: 32 },
  studentCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E7E5E4", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: palette.surface, justifyContent: "center", alignItems: "center" },
  rankText: { fontSize: 12, fontWeight: "700", color: palette.primary },
  studentInfo: { flex: 1, gap: 2 },
  studentName: { fontSize: 14, fontWeight: "700", color: "#1C1917" },
  studentMeta: { fontSize: 12, color: "#78716C" },
  countBadge: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, minWidth: 52 },
  countText: { fontSize: 20, fontWeight: "700", lineHeight: 24 },
  countLabel: { fontSize: 10, fontWeight: "600" },
});
