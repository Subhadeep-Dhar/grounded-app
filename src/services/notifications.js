import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// 🔒 Web guard helper
const isWeb = Platform.OS === 'web';

// 🔥 Request permission
export const requestPermission = async () => {
  if (isWeb) return false;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

// 🔥 4:45 AM wake-up reminder
export const scheduleMorningReminder = async () => {
  if (isWeb) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🌅 Wake up!",
      body: "Your challenge starts in 15 minutes 🚀",
    },
    trigger: {
      hour: 4,
      minute: 45,
      repeats: true,
    },
  });
};

// 🔥 6:00 AM nudge (conditional)
export const scheduleNudgeReminder = async () => {
  if (isWeb) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "⏳ Still time!",
      body: "Start now — just show up 💪",
    },
    trigger: {
      hour: 6,
      minute: 0,
      repeats: true,
    },
  });
};

// 🔥 Instant notification helpers
export const sendArrivalNotification = async () => {
  if (isWeb) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🎉 You showed up!",
      body: "That’s what matters most.",
    },
    trigger: null,
  });
};

export const sendCompletionNotification = async () => {
  if (isWeb) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "💪 Great job!",
      body: "Challenge completed successfully!",
    },
    trigger: null,
  });
};