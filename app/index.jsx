import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

export default function Index() {
  const { user, loading } = useAuthStore();

  if (loading) return null;

  return user
    ? <Redirect href="/(tabs)/home" />
    : <Redirect href="/(auth)/login" />;
}