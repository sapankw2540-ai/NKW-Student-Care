import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AppHeader } from "@/components/app-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { DatePickerModal } from "@/components/date-picker-modal";
import type { StudentAttendanceEntry } from "@/shared/types";
import { usePeriod } from "@/lib/period-context";
import { toThaiDateWithDay, formatClassroomId } from "@/lib/thai-date";
import { useSchoolConfig } from "@/lib/school-config";
import { getThemePalette, ThemePalette } from "@/constants/theme-palettes";


const STATUS_OPTIONS = [
  { label: "มา", color: "#059669", bg: "#D1FAE5" },
  { label: "ขาด", color: "#BE123C", bg: "#FFE4E6" },
  { label: "สาย", color: "#B45309", bg: "#FFEDD5" },
  { label: "ลา", color: "#4338CA", bg: "#E0E7FF" },
  { label: "ป่วย", color: "#BE185D", bg: "#FCE7F3" },
];

interface RoomSummary {
  roomId: string;
  roomName: string;
  total: number;
  มา: number;
  ขาด: number;
  สาย: number;
  ลา: number;
  ป่วย: number;
  checked: boolean;
  teacher: string;
}

export default function OverallSummaryScreen() {
  const { config } = useSchoolConfig();
  const { selectedDate, setSelectedDate, selectedPeriod, setIsPageLoading } = usePeriod();
  const palette = getThemePalette(config.themeColor);
  const styles = React.useMemo(() => createStyles(palette), [palette]);

  const StatCard = ({
    label,
    value,
    color,
    bg,
    icon,
  }: {
    label: string;
    value: number;
    color: string;
    bg: string;
    icon: string;
  }) => (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <IconSymbol name={icon as any} size={20} color={color} />
      <Text style={[styles.statCardValue, { color }]}>{value}</Text>
      <Text style={[styles.statCardLabel, { color }]}>{label}</Text>
    </View>
  );


  const [showDatePicker, setShowDatePicker] = useState(false);


  const { data: classrooms = [] } = trpc.classrooms.useQuery();
  const { data: periods = [] } = trpc.periods.useQuery();
  const { data: attendanceList = [], isLoading } = trpc.getAttendanceByDatePeriod.useQuery(
    { date: selectedDate, period: selectedPeriod || "" },
    { enabled: !!selectedDate && !!selectedPeriod }
  );

  // Sync loading state to global period context
  React.useEffect(() => {
    setIsPageLoading(isLoading);
  }, [isLoading, setIsPageLoading]);



  // Build summary per room
  const roomSummaries: RoomSummary[] = classrooms.map((c) => {
    const record = attendanceList.find((a) => a.roomId === c.id);
    if (!record) {
      return {
        roomId: c.id,
        roomName: formatClassroomId(c.name),
        total: 0,
        มา: 0,
        ขาด: 0,
        สาย: 0,
        ลา: 0,
        ป่วย: 0,
        checked: false,
        teacher: "-",
      };
    }
    const entries = record.students as StudentAttendanceEntry[];
    const counts = { มา: 0, ขาด: 0, สาย: 0, ลา: 0, ป่วย: 0 };
    for (const e of entries) {
      if (e.status in counts) counts[e.status as keyof typeof counts]++;
    }
    return {
      roomId: c.id,
      roomName: formatClassroomId(c.name),
      total: entries.length,
      ...counts,
      checked: true,
      teacher: record.teacher,
    };
  });

  // Grand totals
  const grandTotal = roomSummaries.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      มา: acc.มา + r.มา,
      ขาด: acc.ขาด + r.ขาด,
      สาย: acc.สาย + r.สาย,
      ลา: acc.ลา + r.ลา,
      ป่วย: acc.ป่วย + r.ป่วย,
      checked: acc.checked + (r.checked ? 1 : 0),
    }),
    { total: 0, มา: 0, ขาด: 0, สาย: 0, ลา: 0, ป่วย: 0, checked: 0 }
  );

  const attendanceRate =
    grandTotal.total > 0
      ? Math.round((grandTotal.มา / grandTotal.total) * 100)
      : 0;

  const renderRoomRow = ({ item }: { item: RoomSummary }) => (
    <View style={[styles.roomRow, !item.checked && styles.roomRowUnchecked]}>
      <View style={styles.roomNameCol}>
        <View style={[styles.roomDot, { backgroundColor: item.checked ? "#F97316" : "#E7E5E4" }]} />
        <Text style={styles.roomNameText}>{item.roomName}</Text>
      </View>
      <Text style={styles.roomTotalText}>{item.checked ? item.total : "-"}</Text>
      {STATUS_OPTIONS.map((s) => (
        <Text
          key={s.label}
          style={[
            styles.roomStatText,
            item.checked && (item[s.label as keyof RoomSummary] as number) > 0
              ? { color: s.color, fontWeight: "700" }
              : { color: "#9CA3AF" },
          ]}
        >
          {item.checked ? (item[s.label as keyof RoomSummary] as number) : "-"}
        </Text>
      ))}
      {!item.checked && (
        <View style={styles.uncheckedTag}>
          <Text style={styles.uncheckedTagText}>ยังไม่เช็ค</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <AppHeader title="สรุปภาพรวมทั้งโรงเรียน" />
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
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Grand Total Cards */}
            <View style={styles.grandTotalSection}>
              <Text style={styles.sectionTitle}>ยอดรวมทั้งโรงเรียน</Text>
              <View style={styles.statsRow}>
                <StatCard
                  label="ทั้งหมด"
                  value={grandTotal.total}
                  color="#1C1917"
                  bg="#F3F4F6"
                  icon="person.3.fill"
                />
                <StatCard
                  label="มาเรียน"
                  value={grandTotal.มา}
                  color="#16A34A"
                  bg="#DCFCE7"
                  icon="checkmark.circle.fill"
                />
                <StatCard
                  label="ขาดเรียน"
                  value={grandTotal.ขาด}
                  color="#DC2626"
                  bg="#FEE2E2"
                  icon="xmark.circle.fill"
                />
              </View>
              <View style={styles.statsRow}>
                <StatCard
                  label="มาสาย"
                  value={grandTotal.สาย}
                  color="#CA8A04"
                  bg="#FEF9C3"
                  icon="clock.fill"
                />
                <StatCard
                  label="ลาหยุด"
                  value={grandTotal.ลา}
                  color="#2563EB"
                  bg="#DBEAFE"
                  icon="doc.text"
                />
                <StatCard
                  label="ลาป่วย"
                  value={grandTotal.ป่วย}
                  color="#9333EA"
                  bg="#F3E8FF"
                  icon="info.circle"
                />
              </View>

              {/* Attendance Rate Bar */}
              <View style={styles.rateCard}>
                <View style={styles.rateHeader}>
                  <Text style={styles.rateLabel}>อัตราการเข้าเรียน</Text>
                  <Text style={styles.rateValue}>{attendanceRate}%</Text>
                </View>
                <View style={styles.rateBarBg}>
                  <View style={[styles.rateBarFill, { width: `${attendanceRate}%` }]} />
                </View>
                <View style={styles.rateFooter}>
                  <Text style={styles.rateFooterText}>
                    เช็คแล้ว {grandTotal.checked}/{classrooms.length} ห้อง
                  </Text>
                </View>
              </View>
            </View>

            {/* Room-by-Room Table */}
            <View style={styles.tableSection}>
              <Text style={styles.sectionTitle}>สรุปรายห้องเรียน</Text>
              <View style={styles.tableContainer}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.roomNameCol]}>ห้อง</Text>
                  <Text style={styles.tableHeaderText}>รวม</Text>
                  {STATUS_OPTIONS.map((s) => (
                    <Text
                      key={s.label}
                      style={[styles.tableHeaderText, { color: s.color }]}
                    >
                      {s.label}
                    </Text>
                  ))}
                </View>

                {/* Table Rows */}
                <FlatList
                  data={roomSummaries}
                  keyExtractor={(item) => item.roomId}
                  renderItem={renderRoomRow}
                  scrollEnabled={false}
                />

                {/* Total Row */}
                <View style={styles.totalRow}>
                  <Text style={[styles.totalRowText, styles.roomNameCol, { color: "#F97316" }]}>
                    รวมทั้งหมด
                  </Text>
                  <Text style={[styles.totalRowText, { color: "#1C1917" }]}>{grandTotal.total}</Text>
                  {STATUS_OPTIONS.map((s) => (
                    <Text
                      key={s.label}
                      style={[styles.totalRowText, { color: s.color }]}
                    >
                      {grandTotal[s.label as keyof typeof grandTotal] as number}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        )}
        <DatePickerModal
          visible={showDatePicker}
          selectedDate={selectedDate}
          onClose={() => setShowDatePicker(false)}
          onSelect={(date) => {
            setSelectedDate(date);
          }}
        />
      </ScreenContainer>
    </View>
  );
}



const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  grandTotalSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#78716C",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  statCardValue: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  statCardLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  rateCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: palette.primary + "30",
  },
  rateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  rateLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1917",
  },
  rateValue: {
    fontSize: 20,
    fontWeight: "800",
    color: palette.primary,
  },
  rateBarBg: {
    height: 8,
    backgroundColor: "#E7E5E4",
    borderRadius: 4,
    overflow: "hidden",
  },
  rateBarFill: {
    height: "100%",
    backgroundColor: palette.primary,
    borderRadius: 4,
  },
  rateFooter: {
    marginTop: 6,
  },
  rateFooterText: {
    fontSize: 12,
    color: "#78716C",
  },
  tableSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    overflow: "hidden",
  },
  tableContainer: {
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  roomRowUnchecked: {
    backgroundColor: "#FAFAFA",
  },
  roomNameCol: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roomDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roomNameText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1C1917",
  },
  roomTotalText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#1C1917",
    textAlign: "center",
  },
  roomStatText: {
    flex: 1,
    fontSize: 13,
    textAlign: "center",
  },
  uncheckedTag: {
    position: "absolute",
    right: 8,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  uncheckedTagText: {
    fontSize: 10,
    color: "#DC2626",
    fontWeight: "600",
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 2,
    borderTopColor: palette.primary,
  },
  totalRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
});
