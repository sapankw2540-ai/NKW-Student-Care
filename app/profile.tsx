import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AppHeader } from "@/components/app-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTeacherAuth } from "@/lib/teacher-auth";
import { useSchoolConfig } from "@/lib/school-config";
import { getThemePalette, ThemePalette } from "@/constants/theme-palettes";

import { formatClassroomId } from "@/lib/thai-date";
import { trpc } from "@/lib/trpc";
import { TimePickerModal } from "@/components/time-picker-modal";
import {
  scheduleDailyAttendanceReminder,
  cancelAttendanceReminders,
  getScheduledReminders,
  requestNotificationPermission,
} from "@/lib/notifications";
import { useAppAlert } from "@/components/app-alert-provider";

export default function ProfileScreen() {
  const { config } = useSchoolConfig();
  const palette = getThemePalette(config.themeColor);
  const styles = React.useMemo(() => createStyles(palette), [palette]);
  const { teacher, setTeacher, logout } = useTeacherAuth();

  const appAlert = useAppAlert();
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyTime, setNotifyTime] = useState(teacher?.notifyTime ?? "07:30");
  const [loadingNotify, setLoadingNotify] = useState(false);
  const [checkingReminders, setCheckingReminders] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Change password state
  const [passModalVisible, setPassModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPass, setIsChangingPass] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      appAlert.show({ title: "ข้อมูลไม่ครบ", message: "กรุณากรอกรหัสผ่านใหม่ให้ครบถ้วน", type: "info" });
      return;
    }
    if (newPassword !== confirmPassword) {
      appAlert.show({ title: "รหัสผ่านไม่ตรงกัน", message: "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน", type: "error" });
      return;
    }
    if (newPassword.length < 6) {
      appAlert.show({ title: "รหัสผ่านสั้นเกินไป", message: "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร", type: "info" });
      return;
    }

    setIsChangingPass(true);
    try {
      if (teacher) {
        await updateTeacherMutation.mutateAsync({
          id: teacher.id,
          name: teacher.name,
          username: teacher.username,
          role: teacher.role,
          classroomIds: teacher.classroomIds || "",
          notifyTime: teacher.notifyTime,
          password: newPassword,
        });
        
        appAlert.show({ 
          title: "สำเร็จ", 
          message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว", 
          type: "success",
          autoCloseMs: 3000,
          onDismiss: () => {
            setPassModalVisible(false);
            setNewPassword("");
            setConfirmPassword("");
          }
        });
      }
    } catch (error: any) {
      appAlert.show({ title: "ล้มเหลว", message: error.message || "ไม่สามารถเปลี่ยนรหัสผ่านได้", type: "error" });
    } finally {
      setIsChangingPass(false);
    }
  };

  // Check if reminder is already scheduled
  useEffect(() => {
    if (Platform.OS !== "web") {
      getScheduledReminders().then((reminders) => {
        setNotifyEnabled(reminders.length > 0);
        setCheckingReminders(false);
      });
    } else {
      setCheckingReminders(false);
    }
  }, []);

  const updateTeacherMutation = trpc.updateTeacher.useMutation({
    onSuccess: (_, vars) => {
      if (teacher) {
        setTeacher({
          ...teacher,
          notifyTime: vars.notifyTime ?? teacher.notifyTime,
          token: teacher.token,
        });
      }
    },
  });

  const handleToggleNotify = async (val: boolean) => {
    if (Platform.OS === "web") {
      appAlert.show({ title: "แจ้งเตือน", message: "การแจ้งเตือนไม่รองรับบนเว็บ กรุณาใช้แอพบนมือถือ", type: "info" });
      return;
    }
    setLoadingNotify(true);
    try {
      if (val) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          appAlert.show({ title: "ไม่ได้รับอนุญาต", message: "กรุณาเปิดสิทธิ์การแจ้งเตือนในการตั้งค่าของอุปกรณ์", type: "error" });
          setLoadingNotify(false);
          return;
        }
        const [h, m] = notifyTime.split(":").map(Number);
        const id = await scheduleDailyAttendanceReminder(h, m);
        if (id) {
          setNotifyEnabled(true);
          appAlert.show({ title: "เปิดการแจ้งเตือนแล้ว", message: `จะแจ้งเตือนทุกวันเวลา ${notifyTime} น.`, type: "success", autoCloseMs: 2500 });
          // Save notify time to server
          if (teacher) {
            await updateTeacherMutation.mutateAsync({
              id: teacher.id,
              name: teacher.name,
              username: teacher.username,
              role: teacher.role,
              classroomIds: teacher.classroomIds ?? "",
              notifyTime,
            });
          }
        }
      } else {
        await cancelAttendanceReminders();
        setNotifyEnabled(false);
        appAlert.show({ title: "ปิดการแจ้งเตือนแล้ว", message: "ปิดการแจ้งเตือนเรียบร้อยแล้ว", type: "info", autoCloseMs: 2000 });
      }
    } catch (error) {
      appAlert.show({ title: "เกิดข้อผิดพลาด", message: "ไม่สามารถตั้งค่าการแจ้งเตือนได้นะครับ", type: "error" });
    }
    setLoadingNotify(false);
  };

  const handleUpdateNotifyTime = async (newTime?: string) => {
    const timeToSave = typeof newTime === "string" ? newTime : notifyTime;
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeToSave)) {
      appAlert.show({ title: "รูปแบบเวลาไม่ถูกต้อง", message: "กรุณาใช้รูปแบบ HH:MM", type: "error" });
      return;
    }
    
    setLoadingNotify(true);
    try {
      if (teacher) {
        await updateTeacherMutation.mutateAsync({
          id: teacher.id,
          name: teacher.name,
          username: teacher.username,
          role: teacher.role,
          classroomIds: teacher.classroomIds || "",
          notifyTime: timeToSave,
        });

        // Re-schedule reminder with new time
        if (notifyEnabled && Platform.OS !== "web") {
          await cancelAttendanceReminders();
          const [h, m] = timeToSave.split(":").map(Number);
          await scheduleDailyAttendanceReminder(h, m);
        }
        
        setNotifyTime(timeToSave);
        appAlert.show({ title: "สำเร็จ", message: "อัปเดตเวลาแจ้งเตือนเรียบร้อยแล้ว", type: "success", autoCloseMs: 2000 });
      }
    } catch (error) {
      appAlert.show({ title: "เกิดข้อผิดพลาด", message: "ไม่สามารถอัปเดตเวลาได้", type: "error" });
    } finally {
      setLoadingNotify(false);
    }
  };

  const handleLogout = async () => {
    const ok = await appAlert.confirm({
      title: "ออกจากระบบ",
      message: "ต้องการออกจากระบบหรือไม่?",
      danger: true,
      confirmLabel: "ออกจากระบบ",
    });
    if (!ok) return;
    if (notifyEnabled && Platform.OS !== "web") {
      await cancelAttendanceReminders();
    }
    await logout();
  };

  return (
    <View style={styles.container}>
      <AppHeader title="โปรไฟล์" />
      <ScreenContainer edges={[]} className="flex-1">
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{teacher?.name?.charAt(0) ?? "?"}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{teacher?.name}</Text>
              <Text style={styles.profileUsername}>@{teacher?.username}</Text>
              <View style={[styles.roleBadge, teacher?.role === "admin" && styles.roleBadgeAdmin]}>
                <Text style={[styles.roleBadgeText, teacher?.role === "admin" && styles.roleBadgeTextAdmin]}>
                  {teacher?.role === "admin" ? "ผู้ดูแลระบบ" : "ครู"}
                </Text>
              </View>
            </View>
          </View>

          {/* Assigned classrooms */}
          {teacher?.role !== "admin" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ห้องเรียนที่รับผิดชอบ</Text>
              {teacher?.classroomIds ? (
                <View style={styles.roomsRow}>
                  {teacher.classroomIds.split(",").map((r) => r.trim()).filter(Boolean).map((r) => (
                    <View key={r} style={styles.roomChip}>
                      <Text style={styles.roomChipText}>{formatClassroomId(r)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.allRoomsText}>ดูแลทุกห้องเรียน</Text>
              )}
            </View>
          )}

          {/* Notification Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>การแจ้งเตือน</Text>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <IconSymbol name="bell.fill" size={18} color={palette.primary} />
                <View>
                  <Text style={styles.settingLabel}>แจ้งเตือนก่อนเช็คชื่อ</Text>
                  <Text style={styles.settingDesc}>แจ้งเตือนทุกวันตามเวลาที่กำหนด</Text>
                </View>
              </View>
              {checkingReminders || loadingNotify ? (
                <ActivityIndicator size="small" color={palette.primary} />
              ) : (
                <Switch
                  value={notifyEnabled}
                  onValueChange={handleToggleNotify}
                  trackColor={{ false: "#E5E7EB", true: palette.border }}
                  thumbColor={notifyEnabled ? palette.primary : "#9CA3AF"}
                />
              )}
            </View>
            {notifyEnabled && (
              <View style={styles.notifyTimeRow}>
                <Text style={styles.notifyTimeLabel}>เวลาแจ้งเตือน</Text>
                <TouchableOpacity 
                  style={styles.notifyTimeInput}
                  onPress={() => setShowTimePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.timeInputText}>{notifyTime}</Text>
                  <IconSymbol name="clock.fill" size={16} color={palette.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Security / Password */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ความปลอดภัย</Text>
            <TouchableOpacity 
              style={styles.settingRow} 
              onPress={() => setPassModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingInfo}>
                <IconSymbol name="lock.fill" size={18} color={palette.primary} />
                <View>
                  <Text style={styles.settingLabel}>เปลี่ยนรหัสผ่าน</Text>
                  <Text style={styles.settingDesc}>เปลี่ยนรหัสผ่านสำหรับการเข้าสู่ระบบ</Text>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#A8A29E" />
            </TouchableOpacity>
          </View>

          {/* App Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>เกี่ยวกับแอพ</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ชื่อแอพ</Text>
              <Text style={styles.infoValue}>ระบบบันทึกกิจกรรมหน้าเสาธง (NKW Student Care)</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>เวอร์ชัน</Text>
              <Text style={styles.infoValue}>{config.version}</Text>
            </View>

          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
            <IconSymbol name="arrow.right.square.fill" size={18} color="#DC2626" />
            <Text style={styles.logoutButtonText}>ออกจากระบบ</Text>
          </TouchableOpacity>
        </ScrollView>

        <TimePickerModal
          visible={showTimePicker}
          selectedTime={notifyTime}
          onClose={() => setShowTimePicker(false)}
          onSelect={(time) => {
            handleUpdateNotifyTime(time);
          }}
        />
      </ScreenContainer>

      {/* Change Password Modal - Using View instead of Modal to allow AppAlert to overlap on top */}
      {passModalVisible && (
        <View style={styles.absoluteOverlay}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>เปลี่ยนรหัสผ่านใหม่(อย่างน้อย 6 ตัว)</Text>
              
              <View style={styles.formField}>
                <Text style={styles.inputLabel}>รหัสผ่านใหม่</Text>
                <TextInput
                  style={styles.modalInput}
                  secureTextEntry
                  placeholder="รหัสผ่านใหม่"
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.inputLabel}>ยืนยันรหัสผ่านใหม่</Text>
                <TextInput
                  style={styles.modalInput}
                  secureTextEntry
                  placeholder="ยืนยันรหัสผ่านใหม่"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setPassModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>ยกเลิก</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.submitBtn, { backgroundColor: palette.primary }]} 
                  onPress={handleChangePassword}
                  disabled={isChangingPass}
                >
                  {isChangingPass ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>บันทึก</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}



const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  absoluteOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalContent: { backgroundColor: "#FFF", borderRadius: 24, padding: 24, gap: 16 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#1C1917", textAlign: "center", marginBottom: 8 },
  formField: { gap: 8 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: "#44403C" },
  modalInput: { backgroundColor: "#F5F5F4", borderRadius: 12, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: "#E7E5E4", fontSize: 16 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F4" },
  cancelBtnText: { color: "#78716C", fontWeight: "700" },
  submitBtn: { flex: 2, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  submitBtnText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  profileCard: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: palette.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 28, fontWeight: "700", color: "#FFFFFF" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: "700", color: "#1C1917", marginBottom: 2 },
  profileUsername: { fontSize: 13, color: "#78716C", marginBottom: 6 },
  roleBadge: { alignSelf: "flex-start", backgroundColor: "#F3F4F6", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  roleBadgeAdmin: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  roleBadgeText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  roleBadgeTextAdmin: { color: palette.primary },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#1C1917", marginBottom: 12 },
  roomsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roomChip: { backgroundColor: palette.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: palette.border },
  roomChipText: { fontSize: 13, fontWeight: "600", color: palette.primary },
  allRoomsText: { fontSize: 13, color: "#78716C" },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: "600", color: "#1C1917" },
  settingDesc: { fontSize: 11, color: "#78716C", marginTop: 1 },
  notifyTimeRow: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  notifyTimeLabel: { fontSize: 13, fontWeight: "600", color: "#78716C", marginBottom: 8 },
  notifyTimeInput: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F9FAFB", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB" },
  timeInputText: { fontSize: 16, fontWeight: "700", color: "#1C1917" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  infoLabel: { fontSize: 13, color: "#78716C" },
  infoValue: { fontSize: 13, fontWeight: "600", color: "#1C1917" },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  logoutButtonText: { color: "#DC2626", fontWeight: "700", fontSize: 15 },
});
