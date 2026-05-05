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
import {
  Flame,
  Trophy,
  Star,
  MapPin,
  Clock,
  Camera,
  CircleCheck,
  ArrowLeft,
  ShieldCheck,
  Zap,
  TriangleAlert,
  Share2,
  Navigation,
  Target,
  Timer,
  Maximize2,
  CircleX,
  History,
  User,
  Calendar,
  Award,
  CheckCircle2,
  ArrowRight,
  ThumbsUp,
  Crown,
  Medal,
  ChevronRight
} from 'lucide-react-native';
import ArrowUp from 'lucide-react-native/dist/cjs/icons/arrow-up';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../src/services/db';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../src/constants/theme';
import { Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function Leaderboard() {
  const router = useRouter();
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
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push(`/user/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.rankContainer}>
        {item.rank === 1 ? (
          <Crown size={24} color="#FFD700" />
        ) : item.rank === 2 ? (
          <Medal size={22} color="#C0C0C0" />
        ) : item.rank === 3 ? (
          <Medal size={22} color="#CD7F32" />
        ) : (
          <Text style={styles.rankText}>{item.rank}</Text>
        )}
      </View>
      
      <View style={styles.avatar}>
        {item.profilePic ? (
          <Image source={{ uri: item.profilePic }} style={styles.avatarImage} />
        ) : (
          <User size={18} color={COLORS.accent} />
        )}
      </View>

      <View style={styles.userInfo}>
        <Text style={styles.username} numberOfLines={1}>
          {item.username || 'Grounded User'}
        </Text>
        <View style={styles.statsRow}>
          <Flame size={12} color={COLORS.accent} style={{ marginRight: 4 }} />
          <Text style={styles.stats}>
            {item.streakCount || 0} day streak
          </Text>
        </View>
      </View>

      <View style={styles.scoreContainer}>
        <View style={styles.scoreRow}>
          <Star size={14} color={COLORS.accent} style={{ marginRight: 4 }} />
          <Text style={styles.scoreValue}>{item.trustScore?.toFixed(0) || 0}</Text>
        </View>
        <Text style={styles.scoreLabel}>Trust</Text>
      </View>
      <ChevronRight size={16} color={COLORS.textMuted} style={{ marginLeft: 8 }} />
    </TouchableOpacity>
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
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  userInfo: {
    flex: 1,
    marginLeft: SPACING.lg,
  },
  username: {
    fontSize: FONT.md,
    fontWeight: FONT.bold,
    color: COLORS.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  stats: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
  },
  scoreContainer: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
