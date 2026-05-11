import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Set notification handler to show alerts in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("attendance", {
      name: "เช็คชื่อหน้าเสาธง",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#F97316",
    });
  }
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId || "nkw-student-care-dev";
    
    // Attempt to get the push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    
    return tokenData.data;
  } catch (error) {
    console.error("Failed to get push token:", error);
    return null;
  }
}

export async function scheduleDailyAttendanceReminder(
  notifyTime: string // "HH:MM"
): Promise<string | null> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    // Cancel existing attendance reminders
    await cancelAttendanceReminders();

    const [hourStr, minuteStr] = notifyTime.split(":");
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if (isNaN(hour) || isNaN(minute)) return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ ถึงเวลาเช็คชื่อหน้าเสาธง",
        body: "อย่าลืมบันทึกการเข้าร่วมกิจกรรมของนักเรียน",
        data: { type: "attendance_reminder" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });

    return id;
  } catch (error) {
    console.error("Failed to schedule notification:", error);
    return null;
  }
}

export async function cancelAttendanceReminders(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.data?.type === "attendance_reminder") {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch (error) {
    console.error("Failed to cancel notifications:", error);
  }
}

export async function getScheduledReminders() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.filter((n) => n.content.data?.type === "attendance_reminder");
  } catch {
    return [];
  }
}
