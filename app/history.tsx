import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { generateHistoryReportHtml, exportPdfAndShare } from "@/lib/pdf-export";
import { ScreenContainer } from "@/components/screen-container";
import { AppHeader } from "@/components/app-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useTeacherAuth } from "@/lib/teacher-auth";
import { toThaiDateWithDay, formatDateForApi, formatClassroomId } from "@/lib/thai-date";
import type { StudentAttendanceEntry } from "@/shared/types";
import { useAppAlert } from "@/components/app-alert-provider";
import { useSchoolConfig } from "@/lib/school-config";
import { getThemePalette, ThemePalette } from "@/constants/theme-palettes";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const STATUS_OPTIONS = [
  { label: "มา", color: "#16A34A", bg: "#DCFCE7" },
  { label: "ขาด", color: "#DC2626", bg: "#FEE2E2" },
  { label: "สาย", color: "#CA8A04", bg: "#FEF9C3" },
  { label: "ลา", color: "#2563EB", bg: "#DBEAFE" },
  { label: "ป่วย", color: "#9333EA", bg: "#F3E8FF" },
];

type RangeMode = "week" | "month";

function getDateRange(mode: RangeMode, offset: number) {
  const today = new Date();
  if (mode === "week") {
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7) + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: formatDateForApi(monday),
      end: formatDateForApi(sunday > today && offset === 0 ? today : sunday),
      label: offset === 0 ? "สัปดาห์นี้" : `${offset} สัปดาห์ก่อน`,
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

export default function HistoryScreen() {
  const { config } = useSchoolConfig();
  const { teacher } = useTeacherAuth();
  const palette = getThemePalette(config.themeColor);
  const styles = React.useMemo(() => createStyles(palette), [palette]);
  const appAlert = useAppAlert();
  const [rangeMode, setRangeMode] = useState<RangeMode>("week");
  const [rangeOffset, setRangeOffset] = useState(0);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const { data: classrooms = [] } = trpc.classrooms.useQuery();
  const { data: periods = [] } = trpc.periods.useQuery();

  // Determine visible rooms
  const allowedRooms = teacher?.role !== "admin" && teacher?.classroomIds
    ? teacher.classroomIds.split(",").map((r) => r.trim()).filter(Boolean)
    : null;
  const visibleClassrooms = allowedRooms
    ? classrooms.filter((c) => allowedRooms.includes(c.id))
    : classrooms;

  // Auto-select first room
  React.useEffect(() => {
    if (!selectedRoomId && visibleClassrooms.length > 0) {
      setSelectedRoomId(visibleClassrooms[0].id);
    }
  }, [visibleClassrooms]);

  const range = useMemo(() => getDateRange(rangeMode, rangeOffset), [rangeMode, rangeOffset]);

  const { data: historyData = [], isLoading } = trpc.getAttendanceHistory.useQuery(
    { roomId: selectedRoomId ?? "", startDate: range.start, endDate: range.end },
    { enabled: !!selectedRoomId }
  );

  const { data: statsData = [] } = trpc.getAttendanceStats.useQuery(
    { startDate: range.start, endDate: range.end }
  );

  // Compute per-day summary for the selected room
  const daySummaries = useMemo(() => {
    return historyData.map((record) => {
      const entries = record.students as StudentAttendanceEntry[];
      const counts = { มา: 0, ขาด: 0, สาย: 0, ลา: 0, ป่วย: 0 };
      for (const e of entries) {
        if (e.status in counts) counts[e.status as keyof typeof counts]++;
      }
      const total = entries.length;
      const rate = total > 0 ? Math.round((counts.มา / total) * 100) : 0;
      return { ...record, counts, total, rate };
    });
  }, [historyData]);

  // Compute bar chart data (attendance rate per day)
  const chartData = useMemo(() => {
    const maxBars = 7;
    const data = daySummaries.slice(-maxBars);
    return data.map((d) => ({
      date: d.date,
      rate: d.rate,
      present: d.counts.มา,
      total: d.total,
    }));
  }, [daySummaries]);

  // Aggregate totals
  const totals = useMemo(() => {
    const t = { มา: 0, ขาด: 0, สาย: 0, ลา: 0, ป่วย: 0, total: 0 };
    for (const d of daySummaries) {
      t.มา += d.counts.มา;
      t.ขาด += d.counts.ขาด;
      t.สาย += d.counts.สาย;
      t.ลา += d.counts.ลา;
      t.ป่วย += d.counts.ป่วย;
      t.total += d.total;
    }
    return t;
  }, [daySummaries]);

  const avgRate = totals.total > 0 ? Math.round((totals.มา / totals.total) * 100) : 0;

  const handleExport = async () => {
    try {
      const rawRoomName = visibleClassrooms.find((c) => c.id === selectedRoomId)?.name ?? selectedRoomId ?? "";
      const roomName = formatClassroomId(rawRoomName);
      const rows = daySummaries.map((d) => ({
        date: d.date,
        period: d.period ?? "-",
        present: d.counts.มา,
        absent: d.counts.ขาด,
        late: d.counts.สาย,
        leave: d.counts.ลา,
        sick: d.counts.ป่วย,
        total: d.total,
        rate: `${d.rate}%`,
      }));
      const html = generateHistoryReportHtml({
        title: `รายงานการเช็คชื่อ - ${roomName}`,
        dateRange: `${range.label} (${range.start} ถึง ${range.end})`,
        classroomName: roomName,
        rows,
      });
      await exportPdfAndShare(html, `รายงาน_${roomName}_${range.label}.pdf`);
    } catch (err) {
      appAlert.show({ title: "เกิดข้อผิดพลาด", message: "ไม่สามารถสร้าง PDF ได้", type: "error" });
    }
  };

  const maxRate = Math.max(...chartData.map((d) => d.rate), 1);

  return (
    <View style={styles.container}>
      <AppHeader title="ประวัติการเช็คชื่อ" />
      <ScreenContainer edges={[]} className="flex-1">
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Range mode selector */}
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

          {/* Range navigation */}
          <View style={styles.rangeNav}>
            <TouchableOpacity style={styles.navBtn} onPress={() => setRangeOffset((o) => o - 1)}>
              <IconSymbol name="chevron.left" size={20} color={palette.primary} />
            </TouchableOpacity>
            <Text style={styles.rangeLabel}>{range.label}</Text>
            <TouchableOpacity
              style={[styles.navBtn, rangeOffset >= 0 && styles.navBtnDisabled]}
              onPress={() => setRangeOffset((o) => Math.min(0, o + 1))}
              disabled={rangeOffset >= 0}
            >
              <IconSymbol name="chevron.right" size={20} color={rangeOffset >= 0 ? "#D1D5DB" : palette.primary} />
            </TouchableOpacity>
          </View>

          {/* Room selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomScroll} contentContainerStyle={styles.roomScrollContent}>
            {visibleClassrooms.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.roomChip, selectedRoomId === c.id && styles.roomChipActive]}
                onPress={() => setSelectedRoomId(c.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.roomChipText, selectedRoomId === c.id && styles.roomChipTextActive]}>
                  {formatClassroomId(c.name)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {isLoading ? (
            <ActivityIndicator size="large" color={palette.primary} style={{ marginTop: 40 }} />
          ) : daySummaries.length === 0 ? (
            <View style={styles.emptyBox}>
              <IconSymbol name="calendar" size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>ไม่มีข้อมูลในช่วงนี้</Text>
            </View>
          ) : (
            <>
              {/* Summary cards */}
              <View style={styles.summarySection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>สรุปรวม</Text>
                  <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.8}>
                    <IconSymbol name="square.and.arrow.up" size={14} color={palette.primary} />
                    <Text style={styles.exportBtnText}>ส่งออก</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.statsGrid}>
                  {STATUS_OPTIONS.map((s) => (
                    <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
                      <Text style={[styles.statCount, { color: s.color }]}>{totals[s.label as keyof typeof totals]}</Text>
                      <Text style={[styles.statLabel, { color: s.color }]}>{s.label}</Text>
                    </View>
                  ))}
                </View>
                {/* Attendance rate bar */}
                <View style={styles.rateRow}>
                  <Text style={styles.rateLabel}>อัตราการมาเรียน</Text>
                  <Text style={styles.rateValue}>{avgRate}%</Text>
                </View>
                <View style={styles.rateBarBg}>
                  <View style={[styles.rateBarFill, { width: `${avgRate}%` }]} />
                </View>
              </View>

              {/* Bar chart */}
              {chartData.length > 0 && (
                <View style={styles.chartSection}>
                  <Text style={styles.sectionTitle}>แนวโน้มการมาเรียน (% ต่อวัน)</Text>
                  <View style={styles.chartContainer}>
                    <View style={styles.gridLines}>
                      <View style={[styles.gridLine, { bottom: "100%" }]}><Text style={styles.gridLabel}>100%</Text></View>
                      <View style={[styles.gridLine, { bottom: "80%" }]} />
                      <View style={[styles.gridLine, { bottom: "50%" }]}><Text style={styles.gridLabel}>50%</Text></View>
                      <View style={[styles.gridLine, { bottom: "20%" }]} />
                    </View>
                    <View style={styles.barChart}>
                      {chartData.map((d, i) => {
                        const barH = 120 * (d.rate / 100);
                        const dateObj = new Date(d.date + "T00:00:00");
                        const dayNames = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
                        const isToday = d.date === formatDateForApi(new Date());
                        
                        return (
                          <View key={d.date} style={styles.barCol}>
                            <View style={styles.barWrapper}>
                              <View style={[
                                styles.bar, 
                                { 
                                  height: barH, 
                                  backgroundColor: d.rate >= 80 ? "#16A34A" : d.rate >= 60 ? "#F59E0B" : "#EF4444",
                                  borderWidth: isToday ? 2 : 0,
                                  borderColor: "#1C1917"
                                }
                              ]} />
                            </View>
                            <Text style={[styles.barLabel, isToday && styles.todayLabel]}>{dayNames[dateObj.getDay()]}</Text>
                            <Text style={[styles.barDate, isToday && styles.todayDate]}>{dateObj.getDate()}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}

              {/* Daily records */}
              <View style={styles.dailySection}>
                <Text style={styles.sectionTitle}>รายวัน</Text>
                {daySummaries.map((d) => (
                  <View key={`${d.date}-${d.period}`} style={styles.dayCard}>
                    <View style={styles.dayCardHeader}>
                      <View>
                        <Text style={styles.dayDate}>{toThaiDateWithDay(new Date(d.date + "T00:00:00"))}</Text>
                        <Text style={styles.dayPeriod}>ช่วง: {periods.find((p) => p.id === d.period)?.name ?? d.period}</Text>
                      </View>
                      <View style={[styles.rateBadge, { backgroundColor: d.rate >= 80 ? "#DCFCE7" : d.rate >= 60 ? "#FEF9C3" : "#FEE2E2" }]}>
                        <Text style={[styles.rateBadgeText, { color: d.rate >= 80 ? "#16A34A" : d.rate >= 60 ? "#CA8A04" : "#DC2626" }]}>
                          {d.rate}%
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dayStats}>
                      {STATUS_OPTIONS.map((s) => (
                        <View key={s.label} style={[styles.dayChip, { backgroundColor: s.bg }]}>
                          <Text style={[styles.dayChipLabel, { color: s.color }]}>{s.label}</Text>
                          <Text style={[styles.dayChipCount, { color: s.color }]}>{d.counts[s.label as keyof typeof d.counts]}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </ScreenContainer>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: { padding: 16, paddingBottom: 32 },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: "#F3F4F6", alignItems: "center" },
  modeBtnActive: { backgroundColor: palette.primary },
  modeBtnText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  modeBtnTextActive: { color: "#FFFFFF" },
  rangeNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" },
  navBtnDisabled: { backgroundColor: "#F3F4F6" },
  rangeLabel: { fontSize: 15, fontWeight: "700", color: "#1C1917" },
  roomScroll: { marginBottom: 16 },
  roomScrollContent: { gap: 8, paddingRight: 4 },
  roomChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "transparent" },
  roomChipActive: { backgroundColor: palette.surface, borderColor: palette.primary },
  roomChipText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  roomChipTextActive: { color: palette.primary },
  emptyBox: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { color: "#9CA3AF", fontSize: 15 },
  summarySection: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E7E5E4", marginBottom: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1C1917", marginBottom: 12 },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: palette.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  exportBtnText: { fontSize: 12, fontWeight: "600", color: palette.primary },
  statsGrid: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  statCard: { flex: 1, minWidth: 56, alignItems: "center", paddingVertical: 10, borderRadius: 10 },
  statCount: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11, fontWeight: "600" },
  rateRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  rateLabel: { fontSize: 13, color: "#78716C" },
  rateValue: { fontSize: 13, fontWeight: "700", color: palette.primary },
  rateBarBg: { height: 8, backgroundColor: "#F3F4F6", borderRadius: 4, overflow: "hidden" },
  rateBarFill: { height: 8, backgroundColor: palette.primary, borderRadius: 4 },
  chartSection: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E7E5E4", marginBottom: 16 },
  chartContainer: { height: 160, marginTop: 10, position: "relative" },
  gridLines: { position: "absolute", left: 0, right: 0, top: 0, bottom: 40, justifyContent: "space-between" },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "#F3F4F6" },
  gridLabel: { position: "absolute", left: -24, top: -7, fontSize: 9, color: "#9CA3AF", width: 22, textAlign: "right" },
  barChart: { flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingBottom: 40 },
  barCol: { alignItems: "center", width: 40 },
  barWrapper: { height: 120, justifyContent: "flex-end", width: 14 },
  bar: { width: "100%", borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barLabel: { fontSize: 11, fontWeight: "600", color: "#6B7280", marginTop: 8 },
  barDate: { fontSize: 10, color: "#9CA3AF" },
  todayLabel: { color: palette.primary },
  todayDate: { color: palette.primary, fontWeight: "700" },
  dailySection: { gap: 10 },
  dayCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E7E5E4" },
  dayCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  dayDate: { fontSize: 14, fontWeight: "600", color: "#1C1917" },
  dayPeriod: { fontSize: 12, color: "#78716C", marginTop: 2 },
  rateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rateBadgeText: { fontSize: 13, fontWeight: "700" },
  dayStats: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  dayChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  dayChipLabel: { fontSize: 11, fontWeight: "600" },
  dayChipCount: { fontSize: 12, fontWeight: "700" },
});
