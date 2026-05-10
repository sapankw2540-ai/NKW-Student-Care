import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTeacherAuth } from "@/lib/teacher-auth";
import { useSchoolConfig } from "@/lib/school-config";
import { getThemePalette } from "@/constants/theme-palettes";

interface AppHeaderProps {
  title?: string;
  showLogout?: boolean;
}

export function AppHeader({ title, showLogout = true }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { teacher, logout } = useTeacherAuth();
  const { config } = useSchoolConfig();
  const palette = getThemePalette(config.themeColor);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View 
      className="app-header-container print:hidden"
      style={[styles.container, { paddingTop: insets.top + 8, backgroundColor: palette.header }]}
    >
      <View style={styles.content}>
        <View style={styles.left}>
          {config.schoolLogoUrl ? (
            <Image
              source={{ uri: config.schoolLogoUrl }}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.logo, { alignItems: 'center', justifyContent: 'center' }]}>
              <IconSymbol name="graduationcap.fill" size={20} color={palette.primary} />
            </View>
          )}
          <View style={styles.titleGroup}>
            <Text style={styles.schoolName} numberOfLines={1}>
              {config.schoolName}
            </Text>
            <Text style={[styles.systemName, { color: palette.surface }]}>
              {title || `ระบบบันทึกกิจกรรมหน้าเสาธง (NKW Student Care) ${config.version}`}
            </Text>
            <Text style={styles.subInfo}>
              ภาคเรียนที่ {config.semester} ปีการศึกษา {config.academicYear}
            </Text>
          </View>
        </View>
        <View style={styles.right}>
          {teacher && (
            <Text style={styles.teacherName} numberOfLines={1}>
              {teacher.name.length > 12 ? teacher.name.substring(0, 12) + "..." : teacher.name}
            </Text>
          )}
          {showLogout && (
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <IconSymbol name="arrow.right.square.fill" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    marginRight: 10,
  },
  titleGroup: {
    flex: 1,
  },
  schoolName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 18,
  },
  systemName: {
    fontSize: 11,
    color: "#FED7AA",
    lineHeight: 16,
    fontWeight: "600",
  },
  subInfo: {
    fontSize: 9,
    color: "#FFFFFF",
    opacity: 0.8,
    marginTop: 1,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  teacherName: {
    fontSize: 12,
    color: "#FFF7ED",
    maxWidth: 100,
  },
  logoutButton: {
    padding: 4,
  },
});
