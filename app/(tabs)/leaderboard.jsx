import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { getLeaderboard } from '../../src/services/leaderboard';

export default function Leaderboard() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    getLeaderboard().then(setUsers);
  }, []);

  return (
    <View>
      <Text>Leaderboard</Text>

      {users.map((u, i) => (
        <Text key={i}>
          {i + 1}. {u.email} - {u.totalCompletions}
        </Text>
      ))}
    </View>
  );
}