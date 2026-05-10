import { ScrollView, Text, View, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useDatabaseConfig } from '@/lib/database-config';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAppAlert } from '@/components/app-alert-provider';

export default function OnboardingScreen() {
  const router = useRouter();
  const { setConfig } = useDatabaseConfig();
  const appAlert = useAppAlert();
  const [selectedDb, setSelectedDb] = useState<'manus' | 'supabase'>('manus');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    try {
      setIsLoading(true);

      if (selectedDb === 'supabase') {
        if (!supabaseUrl.trim() || !supabaseKey.trim()) {
          appAlert.show({ title: 'ข้อผิดพลาด', message: 'กรุณากรอก Supabase URL และ Anon Key', type: 'error' });
          return;
        }

        // Validate Supabase credentials
        try {
          const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
            },
          });
          if (!response.ok && response.status !== 404) {
            appAlert.show({ title: 'ข้อผิดพลาด', message: 'ไม่สามารถเชื่อมต่อ Supabase ได้ กรุณาตรวจสอบ URL และ Key', type: 'error' });
            return;
          }
        } catch (error) {
          appAlert.show({ title: 'ข้อผิดพลาด', message: 'ไม่สามารถเชื่อมต่อ Supabase ได้', type: 'error' });
          return;
        }

        await setConfig({
          type: 'supabase',
          supabaseUrl: supabaseUrl.trim(),
          supabaseAnonKey: supabaseKey.trim(),
          isConfigured: true,
        });
      } else {
        await setConfig({
          type: 'manus',
          isConfigured: true,
        });
      }

      router.replace('/login');
    } catch (error) {
      appAlert.show({ title: 'ข้อผิดพลาด', message: 'ไม่สามารถบันทึกการตั้งค่าได้', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-gradient-to-b from-primary/10 to-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="p-6">
        <View className="flex-1 justify-center gap-8">
          {/* Header */}
          <View className="items-center gap-2">
            <Text className="text-3xl font-bold text-foreground">เช็คชื่อหน้าเสาธง</Text>
            <Text className="text-base text-muted text-center">
              ตั้งค่าฐานข้อมูลเพื่อเริ่มต้นใช้งาน
            </Text>
          </View>

          {/* Database Selection */}
          <View className="gap-4">
            <Text className="text-lg font-semibold text-foreground">เลือกฐานข้อมูล</Text>

            {/* Manus Option */}
            <Pressable
              onPress={() => setSelectedDb('manus')}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View
                className={cn(
                  'p-4 rounded-2xl border-2 gap-2',
                  selectedDb === 'manus'
                    ? 'bg-primary/10 border-primary'
                    : 'bg-surface border-border'
                )}
              >
                <Text className="text-lg font-semibold text-foreground">Manus Database</Text>
                <Text className="text-sm text-muted">
                  ใช้ฐานข้อมูล Manus ที่มีอยู่แล้ว (ค่าเริ่มต้น)
                </Text>
                <Text className="text-xs text-muted mt-2">
                  ✓ ตั้งค่าง่าย ✓ ไม่ต้องสมัครสมาชิก
                </Text>
              </View>
            </Pressable>

            {/* Supabase Option */}
            <Pressable
              onPress={() => setSelectedDb('supabase')}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View
                className={cn(
                  'p-4 rounded-2xl border-2 gap-2',
                  selectedDb === 'supabase'
                    ? 'bg-primary/10 border-primary'
                    : 'bg-surface border-border'
                )}
              >
                <Text className="text-lg font-semibold text-foreground">Supabase</Text>
                <Text className="text-sm text-muted">
                  ใช้ Supabase (PostgreSQL) ของคุณเอง
                </Text>
                <Text className="text-xs text-muted mt-2">
                  ✓ ควบคุมเต็มที่ ✓ ข้อมูลของคุณ
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Supabase Configuration */}
          {selectedDb === 'supabase' && (
            <View className="gap-4 bg-surface p-4 rounded-2xl">
              <Text className="text-base font-semibold text-foreground">ตั้งค่า Supabase</Text>

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Supabase URL</Text>
                <TextInput
                  placeholder="https://xxxxx.supabase.co"
                  value={supabaseUrl}
                  onChangeText={setSupabaseUrl}
                  editable={!isLoading}
                  className="bg-background border border-border rounded-lg p-3 text-foreground"
                  placeholderTextColor="#999"
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Anon Key</Text>
                <TextInput
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseKey}
                  onChangeText={setSupabaseKey}
                  editable={!isLoading}
                  secureTextEntry
                  className="bg-background border border-border rounded-lg p-3 text-foreground"
                  placeholderTextColor="#999"
                />
              </View>

              <Text className="text-xs text-muted">
                หาได้ที่ Supabase Dashboard → Settings → API Keys
              </Text>
            </View>
          )}

          {/* Info Box */}
          <View className="bg-warning/10 border border-warning rounded-lg p-4 gap-2">
            <Text className="font-semibold text-warning">ℹ️ ข้อมูล</Text>
            <Text className="text-sm text-foreground">
              {selectedDb === 'manus'
                ? 'ข้อมูลจะถูกเก็บบน Manus Cloud Server'
                : 'ข้อมูลจะถูกเก็บบน Supabase PostgreSQL ของคุณ'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View className="p-6 gap-3">
        <Pressable
          onPress={handleContinue}
          disabled={isLoading}
          style={({ pressed }) => [
            {
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View className="bg-primary rounded-full py-4 items-center">
            <Text className="text-lg font-semibold text-background">
              {isLoading ? 'กำลังตรวจสอบ...' : 'ดำเนินการต่อ'}
            </Text>
          </View>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}
