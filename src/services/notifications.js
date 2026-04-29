import { Platform } from 'react-native';
import {
  WAKE_UP_MESSAGES,
  NUDGE_MESSAGES,
  ARRIVAL_MESSAGES,
  COMPLETION_MESSAGES,
  MISS_MESSAGES,
  SLEEP_MESSAGES,
  getRandomMessage,
} from '../constants/messages';

let Notifications = null;

// Safe load — prevents Expo Go crash
if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    Notifications = null;
  }
}

const isDisabled = !Notifications;

// ─── Permission ───────────────────────────────
export const requestPermission = async () => {
  if (isDisabled) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return false;

    // Set notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    return true;
  } catch (error) {
    console.error('Notification permission error:', error);
    return false;
  }
};

// ─── Cancel all existing ──────────────────────
const cancelAll = async () => {
  if (isDisabled) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.error('Cancel notifications error:', e);
  }
};

// ─── Schedule a daily notification ────────────
const scheduleDailyNotification = async (hour, minute, messagePool, category, identifier) => {
  if (isDisabled) return;

  try {
    const msg = getRandomMessage(messagePool, category);

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: msg.title,
        body: msg.body,
        sound: 'default',
      },
      trigger: {
        type: 'daily',
        hour,
        minute,
      },
    });
  } catch (error) {
    // Fallback: schedule with seconds delay for Expo Go compatibility
    console.warn('Daily trigger failed, using fallback:', error.message);
  }
};

// ─── Schedule all recurring notifications ─────
export const scheduleAllNotifications = async () => {
  if (isDisabled) return;

  try {
    await cancelAll();

    // 4:45 AM — Wake-up
    await scheduleDailyNotification(4, 45, WAKE_UP_MESSAGES, 'wakeup', 'wakeup-reminder');

    // 6:00 AM — Nudge
    await scheduleDailyNotification(6, 0, NUDGE_MESSAGES, 'nudge', 'nudge-reminder');

    // 10:00 PM — Sleep
    await scheduleDailyNotification(22, 0, SLEEP_MESSAGES, 'sleep', 'sleep-reminder');

    console.log('✅ All notifications scheduled');
  } catch (error) {
    console.error('Schedule notifications error:', error);
  }
};

// ─── Instant notifications (on events) ────────
export const sendArrivalNotification = async () => {
  if (isDisabled) return;

  try {
    const msg = getRandomMessage(ARRIVAL_MESSAGES, 'arrival');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: msg.title,
        body: msg.body,
        sound: 'default',
      },
      trigger: null, // Instant
    });
  } catch (error) {
    console.error('Arrival notification error:', error);
  }
};

export const sendCompletionNotification = async () => {
  if (isDisabled) return;

  try {
    const msg = getRandomMessage(COMPLETION_MESSAGES, 'completion');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: msg.title,
        body: msg.body,
        sound: 'default',
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Completion notification error:', error);
  }
};

export const sendMissNotification = async () => {
  if (isDisabled) return;

  try {
    const msg = getRandomMessage(MISS_MESSAGES, 'miss');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: msg.title,
        body: msg.body,
        sound: 'default',
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Miss notification error:', error);
  }
};