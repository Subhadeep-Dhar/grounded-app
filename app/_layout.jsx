import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import {
  requestPermission,
  scheduleAllNotifications,
} from '../src/services/notifications';

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();

    if (Platform.OS !== 'web') {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('#0A0A0F');
        StatusBar.setTranslucent(true);
      }
    }

    const setup = async () => {
      const granted = await requestPermission();
      if (granted) {
        await scheduleAllNotifications();
      }
    };

    setup();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0A0F' },
        animation: 'fade',
      }}
    />
  );
}