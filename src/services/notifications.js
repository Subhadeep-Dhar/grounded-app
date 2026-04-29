import { Platform } from 'react-native';

let Notifications = null;

// 🔥 SAFE LOAD (prevents Expo Go crash)
if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    Notifications = null;
  }
}

const isDisabled = !Notifications;

// 🔥 Permission
export const requestPermission = async () => {
  if (isDisabled) return false;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

// 🔥 Morning reminder (DISABLED safely)
export const scheduleMorningReminder = async () => {
  if (isDisabled) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🌅 Wake up!",
      body: "Your challenge starts soon 🚀",
    },
    trigger: null, // 🔥 FIX (was crashing)
  });
};

// 🔥 Nudge (DISABLED safely)
export const scheduleNudgeReminder = async () => {
  if (isDisabled) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "⏳ Still time!",
      body: "Start now 💪",
    },
    trigger: null,
  });
};

// 🔥 Arrival
export const sendArrivalNotification = async () => {
  if (isDisabled) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🎉 You showed up!",
      body: "Nice work",
    },
    trigger: null,
  });
};

// 🔥 Completion
export const sendCompletionNotification = async () => {
  if (isDisabled) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "💪 Completed!",
      body: "Good job",
    },
    trigger: null,
  });
};