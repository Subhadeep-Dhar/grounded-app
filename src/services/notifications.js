import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const requestPermission = async () => {
    if (Platform.OS === 'web') return false; // 🔥 prevent crash

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
};

export const scheduleReminder = async () => {
    if (Platform.OS === 'web') return; // 🔥 prevent crash

    await Notifications.scheduleNotificationAsync({
        content: {
            title: "Wake up!",
            body: "Your challenge starts soon 🚀",
        },
        trigger: {
            hour: 4,
            minute: 45,
            repeats: true,
        },
    });
};