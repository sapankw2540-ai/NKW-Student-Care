import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View, Platform } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useSchoolConfig } from "@/lib/school-config";
import { getThemePalette } from "@/constants/theme-palettes";
import { usePeriod, Period } from "@/lib/period-context";

interface PeriodSelectionModalProps {
  visible: boolean;
  onSelect: (period: Period) => void;
  onClose: () => void;
}

export function PeriodSelectionModal({ visible, onSelect, onClose }: PeriodSelectionModalProps) {
  const { config } = useSchoolConfig();
  const palette = getThemePalette(config.themeColor);

  const options: { id: Period; name: string; desc: string }[] = [
    { 
      id: "morning", 
      name: "กิจกรรมหน้าเสาธง", 
      desc: "ช่วงเช้า (08:10 - 08:40 น.)",
    },
    { 
      id: "afternoon", 
      name: "กิจกรรมก่อนเรียนคาบบ่าย", 
      desc: "ช่วงบ่าย (12:30 - 13:00 น.)",
    },
  ];

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: palette.surface }]}>
              <IconSymbol name="clock.fill" size={36} color={palette.primary} />
            </View>
            <Text style={styles.title}>เลือกช่วงเวลา</Text>
            <Text style={styles.subtitle}>กรุณาเลือกช่วงเวลาที่คุณต้องการดำเนินการ</Text>
          </View>

          <View style={styles.options}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.optionBtn, 
                  { 
                    backgroundColor: palette.primary,
                    borderColor: palette.primary,
                  }
                ]}
                onPress={() => onSelect(opt.id)}
                activeOpacity={0.8}
              >
                <View style={styles.optContent}>
                  <Text style={[styles.optName, { color: "#FFFFFF" }]}>{opt.name}</Text>
                  <Text style={[styles.optDesc, { color: "rgba(255,255,255,0.8)" }]}>{opt.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.footerHintRow}>
            <IconSymbol name="info.circle.fill" size={14} color="#A8A29E" />
            <Text style={styles.footerHint}>ข้อมูลจะถูกบันทึกแยกตามช่วงเวลาที่เลือก</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(28, 25, 23, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    maxWidth: 400,
    borderRadius: 32,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 15,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1C1917",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#78716C",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  options: {
    width: "100%",
    gap: 16,
    marginBottom: 24,
  },
  optionBtn: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  optContent: {
    alignItems: "center",
  },
  optName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
    textAlign: "center",
  },
  optDesc: {
    fontSize: 13,
    color: "#78716C",
    fontWeight: "500",
  },
  footerHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerHint: {
    fontSize: 12,
    color: "#A8A29E",
    fontWeight: "600",
  },
});
