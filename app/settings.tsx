import React, { useState, useMemo } from 'react';
import { ScrollView, Text, View, TouchableOpacity, TextInput, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { AppHeader } from '@/components/app-header';
import { useSchoolConfig } from '@/lib/school-config';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getThemePalette, ThemePalette } from '@/constants/theme-palettes';
import * as ImagePicker from 'expo-image-picker';
import { trpc } from '@/lib/trpc';
import { useTeacherAuth } from '@/lib/teacher-auth';
import { LoadingModal, LoadingStatus } from '@/components/loading-modal';
import { useAppAlert } from '@/components/app-alert-provider';

const THEME_COLORS = {
  orange: { primary: '#F97316', name: 'ส้ม', bg: '#FFF7ED' },
  blue: { primary: '#2563EB', name: 'น้ำเงิน', bg: '#DBEAFE' },
  green: { primary: '#16A34A', name: 'เขียว', bg: '#DCFCE7' },
  purple: { primary: '#9333EA', name: 'ม่วง', bg: '#F3E8FF' },
} as const;

export default function SettingsScreen() {
  const { config, setConfig } = useSchoolConfig();
  const { teacher } = useTeacherAuth();
  const appAlert = useAppAlert();
  const isAdmin = teacher?.role === 'admin';
  const palette = getThemePalette(config.themeColor);
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [schoolName, setSchoolName] = useState(config.schoolName);
  const [province, setProvince] = useState(config.province || '');
  const [semester, setSemester] = useState(config.semester);
  const [academicYear, setAcademicYear] = useState(config.academicYear);
  const [version, setVersion] = useState(config.version);
  const [selectedTheme, setSelectedTheme] = useState<'orange' | 'blue' | 'green' | 'purple'>(config.themeColor);
  const [logoUrl, setLogoUrl] = useState(config.schoolLogoUrl || '');
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [lineChannelAccessToken, setLineChannelAccessToken] = useState(config.lineChannelAccessToken || '');
  const [lineTargetId, setLineTargetId] = useState(config.lineTargetId || '');
  
  // Modal states
  const [loadStatus, setLoadStatus] = useState<LoadingStatus>('idle');
  const [loadMessage, setLoadMessage] = useState('');
  const [showLineConfig, setShowLineConfig] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const uploadMutation = trpc.uploadLogo.useMutation();

  const handleSave = async () => {
    if (!schoolName.trim()) {
      appAlert.show({ title: 'ข้อผิดพลาด', message: 'กรุณากรอกชื่อโรงเรียน', type: 'error' });
      return;
    }

    try {
      setLoadStatus('loading');
      setLoadMessage(logoBase64 ? 'กำลังอัปโหลดรูปภาพ...' : 'กำลังบันทึกข้อมูล...');
      
      let finalLogoUrl = logoUrl;

      // 1. Upload Logo if changed
      if (logoBase64) {
        const fileName = `logo_${Date.now()}.png`;
        const uploadResult = await uploadMutation.mutateAsync({
          base64: logoBase64,
          fileName: fileName,
        });
        finalLogoUrl = uploadResult.url;
        setLoadMessage('อัปโหลดรูปสำเร็จ กำลังบันทึกข้อมูล...');
      }

      // 2. Save Config
      await setConfig({
        ...config,
        schoolName: schoolName.trim(),
        province: province.trim(),
        semester: semester.trim(),
        academicYear: academicYear.trim(),
        version: version.trim(),
        themeColor: selectedTheme,
        schoolLogoUrl: finalLogoUrl || undefined,
        lineChannelAccessToken: lineChannelAccessToken.trim(),
        lineTargetId: lineTargetId.trim(),
      });
      
      setLogoBase64(null);
      setLogoUrl(finalLogoUrl);
      
      setLoadStatus('success');
      setLoadMessage('บันทึกการตั้งค่าเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Save error:', error);
      setLoadStatus('error');
      setLoadMessage('ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setLogoUrl(result.assets[0].uri);
        setLogoBase64(result.assets[0].base64);
      }
    } catch (error) {
      appAlert.show({ title: 'ข้อผิดพลาด', message: 'ไม่สามารถเลือกรูปภาพได้', type: 'error' });
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="ตั้งค่าระบบ" />
      
      <LoadingModal 
        visible={loadStatus !== 'idle'} 
        status={loadStatus} 
        message={loadMessage}
        onClose={() => setLoadStatus('idle')}
      />

      <ScreenContainer edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* School Basic Info Section (Only for Admin) */}
          {isAdmin && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ข้อมูลพื้นฐาน</Text>
              
              <View style={styles.logoSection}>
                <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7} style={styles.logoContainer}>
                  {logoUrl ? (
                    <Image source={{ uri: logoUrl }} style={styles.logoImage} />
                  ) : (
                    <View style={styles.logoPlaceholder}>
                      <IconSymbol name="photo.fill" size={40} color="#A8A29E" />
                      <Text style={styles.logoPlaceholderText}>เลือกตราโรงเรียน</Text>
                    </View>
                  )}
                  <View style={styles.editBadge}>
                    <IconSymbol name="pencil" size={12} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
                {logoBase64 && <Text style={styles.hint}>มีรูปภาพใหม่ที่ยังไม่ได้บันทึก</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>ชื่อโรงเรียน</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    placeholder="กรุณากรอกชื่อโรงเรียน"
                    value={schoolName}
                    onChangeText={setSchoolName}
                    style={styles.input}
                    placeholderTextColor="#A8A29E"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>จังหวัด</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    placeholder="กรุณากรอกจังหวัด"
                    value={province}
                    onChangeText={setProvince}
                    style={styles.input}
                    placeholderTextColor="#A8A29E"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>ภาคเรียนที่</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      placeholder="เช่น 1"
                      value={semester}
                      onChangeText={setSemester}
                      style={styles.input}
                      placeholderTextColor="#A8A29E"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>ปีการศึกษา</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      placeholder="เช่น 2569"
                      value={academicYear}
                      onChangeText={setAcademicYear}
                      style={styles.input}
                      placeholderTextColor="#A8A29E"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>เวอร์ชันระบบ</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    placeholder="เช่น v4.5.9"
                    value={version}
                    onChangeText={setVersion}
                    style={styles.input}
                    placeholderTextColor="#A8A29E"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <TouchableOpacity 
                  style={styles.lineHeader} 
                  onPress={() => setShowLineConfig(!showLineConfig)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sectionTitle}>LINE Messaging API</Text>
                  <IconSymbol 
                    name={showLineConfig ? "chevron.up" : "chevron.down"} 
                    size={20} 
                    color="#1C1917" 
                  />
                </TouchableOpacity>

                {showLineConfig && (
                  <View style={styles.lineConfigContent}>
                    <Text style={styles.label}>Channel Access Token</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        placeholder="Channel Access Token"
                        value={lineChannelAccessToken}
                        onChangeText={setLineChannelAccessToken}
                        style={[styles.input, { flex: 1 }]}
                        placeholderTextColor="#A8A29E"
                        autoCapitalize="none"
                        secureTextEntry={!showToken}
                        multiline={showToken}
                      />
                      <TouchableOpacity onPress={() => setShowToken(!showToken)} style={styles.eyeBtn}>
                        <IconSymbol name={showToken ? "eye.slash.fill" : "eye.fill"} size={20} color="#78716C" />
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.label, { marginTop: 12 }]}>Target ID (User/Group/Room)</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        placeholder="Target ID (User/Group/Room)"
                        value={lineTargetId}
                        onChangeText={setLineTargetId}
                        style={styles.input}
                        placeholderTextColor="#A8A29E"
                        autoCapitalize="none"
                      />
                    </View>
                    <Text style={styles.hint}>* ใช้สำหรับส่งข้อความสรุปการเช็คชื่อผ่าน Messaging API</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Theme Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ธีมสีของระบบ</Text>
            <View style={styles.themeGrid}>
              {(Object.entries(THEME_COLORS) as Array<[keyof typeof THEME_COLORS, typeof THEME_COLORS['orange']]>).map(
                ([key, theme]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setSelectedTheme(key)}
                    activeOpacity={0.8}
                    style={[
                      styles.themeItem,
                      selectedTheme === key && { borderColor: theme.primary, backgroundColor: theme.bg }
                    ]}
                  >
                    <View style={[styles.colorCircle, { backgroundColor: theme.primary }]} />
                    <Text style={[styles.themeName, selectedTheme === key && { color: theme.primary }]}>
                      {theme.name}
                    </Text>
                    {selectedTheme === key && (
                      <IconSymbol name="checkmark.circle.fill" size={16} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>



          <View style={styles.footerInfo}>
            <Text style={styles.versionText}>{config.schoolName} {config.version}</Text>
            <Text style={styles.devText}>Developed by นายธวัชชัย แก่นจักร์ ครู โรงเรียนน้ำคำวิทยา</Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={loadStatus === 'loading'}
            activeOpacity={0.8}
            style={[styles.saveButton, loadStatus === 'loading' && styles.saveButtonDisabled]}
          >
            {loadStatus === 'loading' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <IconSymbol name="checkmark.circle.fill" size={18} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>{isAdmin ? "บันทึกการตั้งค่า" : "บันทึกสีธีม"}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    gap: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1917',
    marginBottom: 4,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F4',
    borderWidth: 2,
    borderColor: '#E7E5E4',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  logoImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  logoPlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  logoPlaceholderText: {
    fontSize: 12,
    color: '#78716C',
    fontWeight: '600',
  },
  editBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  themeCircleActive: {
    borderWidth: 3,
    borderColor: palette.primary,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#44403C',
    marginLeft: 4,
  },
  inputWrapper: {
    backgroundColor: '#F5F5F4',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    color: '#1C1917',
    fontWeight: '500',
  },
  inputDisabled: {
    color: '#A8A29E',
  },
  inputWrapperDisabled: {
    backgroundColor: '#FAFAFA',
    borderColor: '#F5F5F4',
  },
  hint: {
    fontSize: 12,
    color: palette.primary,
    fontWeight: '600',
  },
  themeGrid: {
    gap: 12,
  },
  themeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F4',
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 12,
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  themeName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#44403C',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.primary + '20',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: palette.primary,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E7E5E4',
    backgroundColor: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 16,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  footerInfo: {
    alignItems: 'center',
    marginTop: 20,
    gap: 4,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A8A29E',
  },
  devText: {
    fontSize: 10,
    color: '#D6D3D1',
  },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E5E4',
    marginBottom: 8,
  },
  lineConfigContent: {
    gap: 8,
    marginTop: 8,
  },
  eyeBtn: {
    padding: 8,
    marginLeft: 4,
  },
});
