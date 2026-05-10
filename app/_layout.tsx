import { Tabs, router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TeacherAuthProvider, useTeacherAuth } from "@/lib/teacher-auth";
import { SchoolConfigProvider, useSchoolConfig } from "@/lib/school-config";
import { getThemePalette } from "@/constants/theme-palettes";
import { DatabaseConfigProvider } from "@/lib/database-config";
import { PeriodProvider, usePeriod, Period } from "@/lib/period-context";
import { PeriodSelectionModal } from "@/components/period-selection-modal";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient } from "@/lib/trpc";
import { AppAlertProvider } from "@/components/app-alert-provider";

// Root Layout with all providers
export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => createTRPCClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <TeacherAuthProvider>
          <SchoolConfigProvider>
            <DatabaseConfigProvider>
              <PeriodProvider>
                <AppAlertProvider>
                  <TabLayout />
                </AppAlertProvider>
              </PeriodProvider>
            </DatabaseConfigProvider>
          </SchoolConfigProvider>
        </TeacherAuthProvider>

      </QueryClientProvider>
    </trpc.Provider>
  );
}

function TabLayout() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const bottomPadding = isWeb ? 24 : Math.max(insets.bottom, 8);
  const tabBarHeight = (isWeb ? 70 : 64) + bottomPadding;
  const { teacher: actualTeacher, isLoading } = useTeacherAuth();
  const { config } = useSchoolConfig();
  const { selectedPeriod, setSelectedPeriod, isPageLoading } = usePeriod();
  const palette = getThemePalette(config.themeColor);

  const [showPeriodModal, setShowPeriodModal] = useState(false);


  const teacher = actualTeacher;

  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !teacher) {
      router.replace("/login");
    }
  }, [teacher, isLoading]);

  useEffect(() => {
    // List of tabs that require a period to be selected
    const attendanceTabs = ["/", "/dashboard", "/classroom", "/overall"];
    const isAttendanceTab = attendanceTabs.includes(pathname);

    // Only show modal if NOT loading and period is not set
    if (teacher && isAttendanceTab && !selectedPeriod && !showPeriodModal && !isPageLoading) {
      setShowPeriodModal(true);
    }
  }, [selectedPeriod, teacher, pathname, isPageLoading]);

  if (isLoading) return null;

  const isAdmin = teacher?.role === "admin";

  const onPeriodSelect = (period: Period) => {
    setSelectedPeriod(period);
    setShowPeriodModal(false);
  };

  const showTabBar = teacher && pathname !== "/login" && pathname !== "/onboarding";

  return (
    <>
      <PeriodSelectionModal 
        visible={showPeriodModal} 
        onSelect={onPeriodSelect} 
        onClose={() => setShowPeriodModal(false)} 
      />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: palette.primary,
          tabBarInactiveTintColor: "#78716C",
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            display: showTabBar ? "flex" : "none",
            paddingTop: 12,
            paddingBottom: bottomPadding,
            height: tabBarHeight,
            backgroundColor: "#FFFFFF",
            borderTopColor: "#E7E5E4",
            borderTopWidth: 0.5,
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            marginTop: 4,
          },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: "เช็คชื่อ",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="checkmark.circle.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="chart.bar.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="classroom"
        options={{
          title: "สรุปห้อง",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="person.3.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="overall"
        options={{
          title: "ภาพรวม",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="list.bullet" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: "ประวัติ",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="calendar" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="absent-alert"
        options={{
          title: "ขาดเรียน",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="bell.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "แอดมิน",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="shield.fill" color={color} />
          ),
          // Hide from non-admin users
          href: isAdmin ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "โปรไฟล์",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="person.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "ตั้งค่า",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="gear" color={color} />
          ),
        }}
      />
      <Tabs.Screen name="login" options={{ href: null }} />
      <Tabs.Screen name="onboarding" options={{ href: null }} />
    </Tabs>
    </>
  );
}
