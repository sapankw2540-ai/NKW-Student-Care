import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AppHeader } from "@/components/app-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useTeacherAuth } from "@/lib/teacher-auth";
import { usePeriod } from "@/lib/period-context";

import { formatDateForApi, toThaiDateWithDay, formatClassroomId } from "@/lib/thai-date";
import { DatePickerModal } from "@/components/date-picker-modal";
import { generateHistoryReportHtml, exportPdfAndShare } from "@/lib/pdf-export";
import { useAppAlert } from "@/components/app-alert-provider";
import { useSchoolConfig } from "@/lib/school-config";
import { getThemePalette, ThemePalette } from "@/constants/theme-palettes";

const STATUS_COLORS = {
  present: { label: "มา", color: "#059669", bg: "#D1FAE5" },
  absent: { label: "ขาด", color: "#BE123C", bg: "#FFE4E6" },
  late: { label: "สาย", color: "#B45309", bg: "#FFEDD5" },
  leave: { label: "ลา", color: "#4338CA", bg: "#E0E7FF" },
  sick: { label: "ป่วย", color: "#BE185D", bg: "#FCE7F3" },
};



export default function DashboardScreen() {
  const { teacher } = useTeacherAuth();
  const { config } = useSchoolConfig();
  const { selectedDate, setSelectedDate, selectedPeriod, setIsPageLoading } = usePeriod();
  const palette = getThemePalette(config.themeColor);
  const styles = useMemo(() => createStyles(palette), [palette]);

  const RateBar = ({ rate }: { rate: number | null }) => {
    if (rate === null) return null;
    const color = rate >= 90 ? "#16A34A" : rate >= 75 ? "#CA8A04" : "#DC2626";
    return (
      <View style={styles.rateBarContainer}>
        <View style={[styles.rateBarFill, { width: `${rate}%` as any, backgroundColor: color }]} />
        <Text style={[styles.rateText, { color }]}>{rate}%</Text>
      </View>
    );
  };


  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: periods = [] } = trpc.periods.useQuery();

  const { data: overview = [], isLoading, refetch } = trpc.getDailyOverview.useQuery(
    { date: selectedDate, period: selectedPeriod || "" },
    { enabled: !!selectedDate && !!selectedPeriod }
  );

  // Sync loading state to global period context
  React.useEffect(() => {
    setIsPageLoading(isLoading);
  }, [isLoading, setIsPageLoading]);


  // Filter by teacher's classrooms if not admin
  const allowedRooms = teacher?.role !== "admin" && teacher?.classroomIds
    ? teacher.classroomIds.split(",").map((r) => r.trim()).filter(Boolean)
    : null;
  const visibleOverview = allowedRooms
    ? overview.filter((o) => allowedRooms.includes(o.classroomId))
    : overview;

  const totals = useMemo(() => {
    const t = { total: 0, present: 0, absent: 0, late: 0, leave: 0, sick: 0, recorded: 0 };
    for (const o of visibleOverview) {
      t.total += o.total;
      t.present += o.present;
      t.absent += o.absent;
      t.late += o.late;
      t.leave += o.leave;
      t.sick += o.sick;
      if (o.hasData) t.recorded++;
    }
    return t;
  }, [visibleOverview]);

  const overallRate = totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : null;

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleExportAll = async () => {
    if (visibleOverview.length === 0) return;
    try {
      const periodName = periods.find((p) => p.id === selectedPeriod)?.name ?? selectedPeriod;
      const rows = visibleOverview.map((o) => ({
        date: formatClassroomId(o.classroomName),
        period: periodName,
        present: o.present,
        absent: o.absent,
        late: o.late,
        leave: o.leave,
        sick: o.sick,
        total: o.total,
        rate: o.rate !== null ? `${o.rate}%` : "ยังไม่เช็ค",
      }));
      const html = generateHistoryReportHtml({
        title: `สรุปภาพรวมทุกห้อง - ${toThaiDateWithDay(new Date(selectedDate + "T00:00:00"))}`,
        dateRange: `${toThaiDateWithDay(new Date(selectedDate + "T00:00:00"))} • ${periodName}`,
        classroomName: "ทุกห้องเรียน",
        rows,
      });
      await exportPdfAndShare(html, `ภาพรวม_${selectedDate}_${periodName}.pdf`);
    } catch {
      // @ts-ignore
      appAlert.show({ title: "เกิดข้อผิดพลาด", message: "ไม่สามารถสร้าง PDF ได้", type: "error" });
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Dashboard" />
      <ScreenContainer edges={[]} className="flex-1">
        {/* Filters */}
        <View style={styles.filterBar}>
          <TouchableOpacity
            style={styles.dateRow}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <IconSymbol name="calendar" size={16} color={palette.primary} />
            <Text style={styles.dateText}>
              {toThaiDateWithDay(new Date(selectedDate + "T00:00:00"))} • {periods.find(p => p.id === selectedPeriod)?.name ?? selectedPeriod}
            </Text>
            <IconSymbol name="chevron.down" size={14} color="#78716C" />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F97316" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
          >
            {/* Overall Summary Card */}
            <View style={styles.overallCard}>
              <View style={styles.overallHeader}>
                <View>
                  <Text style={styles.overallTitle}>สรุปภาพรวม</Text>
                  <Text style={styles.overallSub}>
                    {totals.recorded}/{visibleOverview.length} ห้องที่เช็คแล้ว
                  </Text>
                </View>
                <TouchableOpacity style={styles.exportBtn} onPress={handleExportAll} activeOpacity={0.8}>
                  <IconSymbol name="square.and.arrow.up" size={14} color="#F97316" />
                  <Text style={styles.exportBtnText}>PDF</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.overallStats}>
                {Object.entries(STATUS_COLORS).map(([key, s]) => (
                  <View key={key} style={[styles.overallStatItem, { backgroundColor: s.bg }]}>
                    <Text style={[styles.overallStatCount, { color: s.color }]}>
                      {key === "present" ? totals.present
                        : key === "absent" ? totals.absent
                        : key === "late" ? totals.late
                        : key === "leave" ? totals.leave
                        : totals.sick}
                    </Text>
                    <Text style={[styles.overallStatLabel, { color: s.color }]}>{s.label}</Text>
                  </View>
                ))}
              </View>
              {overallRate !== null && (
                <View style={styles.overallRateRow}>
                  <Text style={styles.overallRateLabel}>อัตราการมาเรียนรวม</Text>
                  <RateBar rate={overallRate} />
                </View>
              )}
            </View>

            {/* Per-Classroom Cards */}
            <Text style={styles.sectionTitle}>รายห้องเรียน</Text>
            {visibleOverview.map((o) => (
              <View key={o.classroomId} style={[styles.classCard, !o.hasData && styles.classCardEmpty]}>
                <View style={styles.classCardHeader}>
                  <View style={styles.classNameRow}>
                    <IconSymbol name="person.3.fill" size={16} color={o.hasData ? "#F97316" : "#A8A29E"} />
                    <Text style={[styles.className, !o.hasData && styles.classNameEmpty]}>
                      {formatClassroomId(o.classroomName)}
                    </Text>
                  </View>
                  {o.hasData ? (
                    <View style={styles.rateChip}>
                      <Text style={[
                        styles.rateChipText,
                        { color: (o.rate ?? 0) >= 90 ? "#16A34A" : (o.rate ?? 0) >= 75 ? "#CA8A04" : "#DC2626" }
                      ]}>
                        {o.rate}%
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.noDataChip}>
                      <Text style={styles.noDataChipText}>ยังไม่เช็ค</Text>
                    </View>
                  )}
                </View>

                {o.hasData ? (
                  <>
                    <RateBar rate={o.rate} />
                    <View style={styles.classStats}>
                      <View style={styles.classStat}>
                        <Text style={styles.classStatCount}>{o.total}</Text>
                        <Text style={styles.classStatLabel}>ทั้งหมด</Text>
                      </View>
                      <View style={[styles.classStat, { backgroundColor: "#DCFCE7" }]}>
                        <Text style={[styles.classStatCount, { color: "#16A34A" }]}>{o.present}</Text>
                        <Text style={[styles.classStatLabel, { color: "#16A34A" }]}>มา</Text>
                      </View>
                      <View style={[styles.classStat, { backgroundColor: "#FEE2E2" }]}>
                        <Text style={[styles.classStatCount, { color: "#DC2626" }]}>{o.absent}</Text>
                        <Text style={[styles.classStatLabel, { color: "#DC2626" }]}>ขาด</Text>
                      </View>
                      <View style={[styles.classStat, { backgroundColor: "#FEF9C3" }]}>
                        <Text style={[styles.classStatCount, { color: "#CA8A04" }]}>{o.late}</Text>
                        <Text style={[styles.classStatLabel, { color: "#CA8A04" }]}>สาย</Text>
                      </View>
                      <View style={[styles.classStat, { backgroundColor: "#DBEAFE" }]}>
                        <Text style={[styles.classStatCount, { color: "#2563EB" }]}>{o.leave}</Text>
                        <Text style={[styles.classStatLabel, { color: "#2563EB" }]}>ลา</Text>
                      </View>
                      <View style={[styles.classStat, { backgroundColor: "#F3E8FF" }]}>
                        <Text style={[styles.classStatCount, { color: "#9333EA" }]}>{o.sick}</Text>
                        <Text style={[styles.classStatLabel, { color: "#9333EA" }]}>ป่วย</Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <Text style={styles.noDataText}>นักเรียน {o.total} คน • ยังไม่ได้เช็คชื่อ</Text>
                )}
              </View>
            ))}

            {visibleOverview.length === 0 && (
              <View style={styles.emptyContainer}>
                <IconSymbol name="chart.bar.fill" size={48} color="#E7E5E4" />
                <Text style={styles.emptyTitle}>ไม่มีข้อมูล</Text>
                <Text style={styles.emptySubtitle}>ยังไม่มีข้อมูลสำหรับวันที่เลือก</Text>
              </View>
            )}
          </ScrollView>
        )}

        <DatePickerModal
          visible={showDatePicker}
          selectedDate={selectedDate}
          onClose={() => setShowDatePicker(false)}
          onSelect={(date) => {
            setSelectedDate(date);
            setShowDatePicker(false);
          }}
        />
      </ScreenContainer>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  filterBar: { 
    paddingHorizontal: 16, 
    paddingTop: 12, 
    paddingBottom: 8, 
    backgroundColor: "#FFFFFF", 
    borderBottomWidth: 1, 
    borderBottomColor: "#E7E5E4" 
  },
  dateRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8, 
    backgroundColor: palette.surface, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: palette.primary + "40", // 25% opacity
    alignSelf: "flex-start" 
  },
  dateText: { fontSize: 13, fontWeight: "600", color: "#1C1917" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 32 },
  overallCard: { backgroundColor: "#1C1917", borderRadius: 16, padding: 16, gap: 12 },
  overallHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  overallTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  overallSub: { fontSize: 12, color: "#A8A29E", marginTop: 2 },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#292524", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  exportBtnText: { fontSize: 12, fontWeight: "600", color: palette.primary },
  overallStats: { flexDirection: "row", gap: 6 },
  overallStatItem: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10 },
  overallStatCount: { fontSize: 18, fontWeight: "700" },
  overallStatLabel: { fontSize: 10, fontWeight: "600" },
  overallRateRow: { gap: 6 },
  overallRateLabel: { fontSize: 12, color: "#A8A29E" },
  rateBarContainer: { flexDirection: "row", alignItems: "center", gap: 8, height: 8 },
  rateBarFill: { height: 8, borderRadius: 4, minWidth: 4 },
  rateText: { fontSize: 12, fontWeight: "700", minWidth: 36 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#1C1917", marginTop: 4 },
  classCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: "#E7E5E4", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  classCardEmpty: { backgroundColor: "#FAFAF9", borderColor: "#F3F4F6" },
  classCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  classNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  className: { fontSize: 15, fontWeight: "700", color: "#1C1917" },
  classNameEmpty: { color: "#A8A29E" },
  rateChip: { backgroundColor: palette.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  rateChipText: { fontSize: 12, fontWeight: "700" },
  noDataChip: { backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  noDataChipText: { fontSize: 11, color: "#A8A29E", fontWeight: "600" },
  classStats: { flexDirection: "row", gap: 6 },
  classStat: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8, backgroundColor: "#F9FAFB" },
  classStatCount: { fontSize: 16, fontWeight: "700", color: "#1C1917" },
  classStatLabel: { fontSize: 10, fontWeight: "600", color: "#78716C" },
  noDataText: { fontSize: 13, color: "#A8A29E" },
  emptyContainer: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#1C1917" },
  emptySubtitle: { fontSize: 13, color: "#78716C" },
});
