import * as Notifications from 'expo-notifications';

export const requestPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
};

export const scheduleReminder = async () => {
    const windowStartHour = 5;
    const notifyHour = 4;
    const notifyMinute = 45;

    await Notifications.scheduleNotificationAsync({
        content: {
            title: "🔥 Challenge Starting Soon",
            body: "Your challenge starts in 15 minutes. Get ready!",
        },
        trigger: {
            hour: notifyHour,
            minute: notifyMinute,
            repeats: true,
        },
    });
};