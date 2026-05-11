import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useTeacherAuth } from "@/lib/teacher-auth";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useSchoolConfig } from "@/lib/school-config";
import { getThemePalette, ThemePalette } from "@/constants/theme-palettes";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LoadingModal, LoadingStatus } from "@/components/loading-modal";
import { registerForPushNotificationsAsync } from "@/lib/notifications";

const REMEMBER_ME_KEY = "remembered_teacher_credentials";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>("idle");
  const [loadingVisible, setLoadingVisible] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  
  const { config } = useSchoolConfig();
  const palette = getThemePalette(config.themeColor);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { setTeacher } = useTeacherAuth();
  const pushTokenMutation = trpc.updatePushToken.useMutation();

  // Load remembered credentials on mount
  useEffect(() => {
    const loadRemembered = async () => {
      try {
        const stored = await AsyncStorage.getItem(REMEMBER_ME_KEY);
        if (stored) {
          const { u, p } = JSON.parse(stored);
          setUsername(u);
          setPassword(p);
          setRememberMe(true);
        }
      } catch (e) {
        console.error("Failed to load remembered credentials");
      }
    };
    loadRemembered();
  }, []);

  const loginMutation = trpc.teacherLogin.useMutation({
    onSuccess: async (data) => {
      setLoadingStatus("success");
      setLoadingMessage("เข้าสู่ระบบสำเร็จ");
      setLoginError(null);
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_ME_KEY, JSON.stringify({ u: username, p: password }));
      } else {
        await AsyncStorage.removeItem(REMEMBER_ME_KEY);
      }
      await setTeacher({ ...data.teacher, token: data.token });
      
      // Register for push notifications
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          pushTokenMutation.mutate({ token });
        }
      } catch (err) {
        console.error("Push token error", err);
      }
    },
    onError: (error) => {
      setLoadingStatus("idle");
      setLoadingVisible(false);
      setLoginError(error.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    },
  });

  const handleLogin = () => {
    setLoginError(null);
    if (!username.trim() || !password.trim()) {
      setLoginError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }
    setLoadingStatus("loading");
    setLoadingVisible(true);
    setLoadingMessage("กำลังตรวจสอบข้อมูล...");
    loginMutation.mutate({ username: username.trim(), password: password.trim() });
  };

  const handleCloseLoading = () => {
    setLoadingVisible(false);
    if (loadingStatus === "success") {
      router.replace("/");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LoadingModal 
        visible={loadingVisible} 
        status={loadingStatus}
        message={loadingMessage} 
        onClose={handleCloseLoading}
        autoCloseMs={loadingStatus === "success" ? 3000 : undefined}
        autoCloseOn={["success"]}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            {config.schoolLogoUrl ? (
              <Image source={{ uri: config.schoolLogoUrl }} style={styles.logoImage} />
            ) : (
              <IconSymbol name="person.circle.fill" size={80} color={palette.primary} />
            )}
          </View>
          <Text style={styles.title}>ระบบบันทึกกิจกรรมหน้าเสาธง{"\n"}(NKW Student Care)</Text>
          <Text style={styles.subtitle}>กรุณาเข้าสู่ระบบเพื่อดำเนินการ</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>ชื่อผู้ใช้</Text>
            <View style={styles.inputWrapper}>
              <IconSymbol name="person.fill" size={20} color="#78716C" />
              <TextInput
                style={styles.input}
                placeholder="กรอกชื่อผู้ใช้"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>รหัสผ่าน</Text>
            <View style={styles.inputWrapper}>
              <IconSymbol name="lock.fill" size={20} color="#78716C" />
              <TextInput
                style={styles.input}
                placeholder="กรอกรหัสผ่าน"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <IconSymbol 
                  name={showPassword ? "eye.slash.fill" : "eye.fill"} 
                  size={20} 
                  color="#78716C" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Remember Me Checkbox */}
          <TouchableOpacity 
            style={styles.rememberMeRow} 
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, rememberMe && { backgroundColor: palette.primary, borderColor: palette.primary }]}>
              {rememberMe && <IconSymbol name="checkmark" size={12} color="#FFFFFF" />}
            </View>
            <Text style={styles.rememberMeLabel}>จดจำรหัสผ่าน</Text>
          </TouchableOpacity>

          {loginError && (
            <View style={styles.errorContainer}>
              <IconSymbol name="exclamationmark.circle.fill" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{loginError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.loginButton, loginMutation.isPending && styles.disabledButton]}
            onPress={handleLogin}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>เข้าสู่ระบบ</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerSubText}>{config.schoolName} {config.province}</Text>
          <Text style={styles.footerSubText}>ภาคเรียนที่ {config.semester} ปีการศึกษา {config.academicYear}</Text>
          <Text style={styles.devText}>Developed by นายธวัชชัย แก่นจักร์ ครู โรงเรียนน้ำคำวิทยา</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    overflow: 'hidden',
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1C1917",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#78716C",
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#44403C",
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F4",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: "#E7E5E4",
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#1C1917",
  },
  rememberMeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    marginLeft: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  rememberMeLabel: {
    fontSize: 14,
    color: "#4B5563",
    fontWeight: "500",
  },
  eyeBtn: {
    padding: 4,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    marginTop: 8,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  loginButton: {
    backgroundColor: palette.primary,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  footer: {
    marginTop: 40,
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#44403C",
    marginBottom: 2,
  },
  footerSubText: {
    fontSize: 12,
    color: "#78716C",
  },
  devText: {
    fontSize: 10,
    color: "#D6D3D1",
    marginTop: 4,
  },
});
