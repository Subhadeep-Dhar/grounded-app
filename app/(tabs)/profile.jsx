import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useAuthStore } from '../../src/store/authStore';

export default function Profile() {
  const { user } = useAuthStore();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (user) {
      getDoc(doc(db, 'users', user.uid)).then(snap =>
        setData(snap.data())
      );
    }
  }, [user]);

  if (!data) return <Text>Loading...</Text>;

  return (
    <View>
      <Text>Email: {data.email}</Text>
      <Text>Streak: {data.streakCount}</Text>
      <Text>Total: {data.totalCompletions}</Text>
    </View>
  );
}