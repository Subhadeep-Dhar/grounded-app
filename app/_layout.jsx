import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '../src/store/authStore';
import { requestPermission, scheduleReminder } from '../src/services/notifications';

export default function RootLayout() {
    const init = useAuthStore((s) => s.init);

    useEffect(() => {
        init();

        const setupNotifications = async () => {
            const granted = await requestPermission();
            if (granted) {
                await scheduleReminder();
            }
        };

        setupNotifications();
    }, []);

    return <Stack screenOptions={{ headerShown: false }} />;
}