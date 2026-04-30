import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../src/services/db';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../src/constants/theme';

export default function Leaderboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'users'),
        orderBy('trustScore', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((doc, index) => ({
        id: doc.id,
        rank: index + 1,
        ...doc.data(),
      }));
      setUsers(data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.rankContainer}>
        <Text style={[
          styles.rankText,
          item.rank === 1 && styles.rankGold,
          item.rank === 2 && styles.rankSilver,
          item.rank === 3 && styles.rankBronze,
        ]}>
          {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : item.rank}
        </Text>
      </View>
      
      <View style={styles.userInfo}>
        <Text style={styles.username} numberOfLines={1}>
          {item.email?.split('@')[0] || 'Anonymous'}
        </Text>
        <Text style={styles.stats}>
          🔥 {item.streakCount || 0} day streak
        </Text>
      </View>

      <View style={styles.scoreContainer}>
        <Text style={styles.scoreValue}>{item.trustScore?.toFixed(0) || 0}</Text>
        <Text style={styles.scoreLabel}>Trust</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Fetching champions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <Text style={styles.headerSubtitle}>Top 20 Trusted Disciplinarians</Text>
      </View>

      <FlatList
        data={users}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: FONT.md,
  },
  header: {
    padding: SPACING.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    backgroundColor: COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT.xxl,
    fontWeight: FONT.bold,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.section,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.subtle,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: FONT.md,
    fontWeight: FONT.bold,
    color: COLORS.textSecondary,
  },
  rankGold: { color: '#FFD700', fontSize: 24 },
  rankSilver: { color: '#C0C0C0', fontSize: 24 },
  rankBronze: { color: '#CD7F32', fontSize: 24 },
  userInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  username: {
    fontSize: FONT.md,
    fontWeight: FONT.semibold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  stats: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
  },
  scoreContainer: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  scoreValue: {
    fontSize: FONT.lg,
    fontWeight: FONT.bold,
    color: COLORS.accent,
  },
  scoreLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
