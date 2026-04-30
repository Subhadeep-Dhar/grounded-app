import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { getUserDoc } from '../../src/services/db';
import { getTodayChallenge } from '../../src/services/challenge';
import { hasUserSubmittedToday } from '../../src/services/submission';
import { getRandomQuote } from '../../src/constants/messages';
import { BADGES } from '../../src/constants/config';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../src/constants/theme';

export default function Home() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quote, setQuote] = useState(getRandomQuote());

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [userDoc, todayChallenge, submittedToday] = await Promise.all([
        getUserDoc(user.uid),
        getTodayChallenge(user.uid),
        hasUserSubmittedToday(user.uid),
      ]);
      setUserData(userDoc);
      setChallenge(todayChallenge);
      setAlreadySubmitted(submittedToday);
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setQuote(getRandomQuote());
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const earnedBadges = BADGES.filter(b => b.check(userData || {}));
  const isWeb = Platform.OS === 'web';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.subGreeting}>{quote}</Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/(tabs)/profile')}
        >
          <Text style={styles.profileText}>
            {user?.email?.charAt(0).toUpperCase() || '?'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Today's Challenge Card */}
      <TouchableOpacity
        style={styles.challengeCard}
        onPress={() => !alreadySubmitted && router.push('/(tabs)/challenge')}
        activeOpacity={alreadySubmitted ? 1 : 0.85}
      >
        <View style={styles.challengeHeader}>
          <Text style={styles.challengeLabel}>TODAY'S CHALLENGE</Text>
          <View style={[
            styles.statusBadge,
            (challenge?.status === 'completed' || alreadySubmitted) && styles.statusCompleted
          ]}>
            <Text style={[
              styles.statusText,
              (challenge?.status === 'completed' || alreadySubmitted) && styles.statusTextCompleted
            ]}>
              {(challenge?.status === 'completed' || alreadySubmitted) ? '✓ Done' : '→ Start'}
            </Text>
          </View>
        </View>

        <Text style={styles.challengeTask}>
          {challenge?.task || 'Loading...'}
        </Text>

        <View style={styles.challengeLocation}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationText}>
            {challenge?.location || 'Loading...'}
          </Text>
        </View>

        {alreadySubmitted ? (
          <View style={[styles.startButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.accent, shadowOpacity: 0 }]}>
            <Text style={[styles.startButtonText, { color: COLORS.accent }]}>✅ You showed up today</Text>
          </View>
        ) : challenge?.status !== 'completed' && (
          <View style={styles.startButton}>
            <Text style={styles.startButtonText}>Start Session →</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.statCardStreak]}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statValue}>{userData?.streakCount || 0}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>⭐</Text>
          <Text style={styles.statValue}>{userData?.trustScore || 50}</Text>
          <Text style={styles.statLabel}>Trust Score</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>🏆</Text>
          <Text style={styles.statValue}>{userData?.totalCompletions || 0}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Trust Score Bar */}
      <View style={styles.trustCard}>
        <View style={styles.trustHeader}>
          <Text style={styles.trustTitle}>Trust Score</Text>
          <Text style={styles.trustValue}>{userData?.trustScore || 50}/100</Text>
        </View>
        <View style={styles.trustBarBg}>
          <View
            style={[
              styles.trustBarFill,
              { width: `${Math.min(userData?.trustScore || 50, 100)}%` }
            ]}
          />
        </View>
        <Text style={styles.trustHint}>
          {(userData?.trustScore || 50) >= 80 ? 'Excellent standing!' :
           (userData?.trustScore || 50) >= 60 ? 'Good progress — keep showing up.' :
           'Show up daily to build trust.'}
        </Text>

        {/* Breakdown */}
        <View style={styles.breakdown}>
          <Text style={styles.breakdownTitle}>How it works:</Text>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownEmoji}>🚀</Text>
              <View>
                <Text style={styles.breakdownLabel}>Score ≥ 70</Text>
                <Text style={styles.breakdownValue}>+score × 0.1</Text>
              </View>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownEmoji}>👍</Text>
              <View>
                <Text style={styles.breakdownLabel}>Score 40-69</Text>
                <Text style={styles.breakdownValue}>+score × 0.05</Text>
              </View>
            </View>
          </View>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownEmoji}>⚠️</Text>
              <View>
                <Text style={styles.breakdownLabel}>Score &lt; 40</Text>
                <Text style={styles.breakdownValue}>-5 Points</Text>
              </View>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownEmoji}>🔥</Text>
              <View>
                <Text style={styles.breakdownLabel}>Streak ≥ 3</Text>
                <Text style={styles.breakdownValue}>+2 Bonus</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Badges Section */}
      <View style={styles.badgesSection}>
        <Text style={styles.sectionTitle}>Badges</Text>
        <View style={styles.badgesGrid}>
          {BADGES.map(badge => {
            const earned = badge.check(userData || {});
            return (
              <View key={badge.id} style={[styles.badge, !earned && styles.badgeLocked]}>
                <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]}>
                  {badge.name}
                </Text>
                <Text style={[styles.badgeDesc, !earned && styles.badgeDescLocked]}>
                  {badge.desc}
                </Text>
                {earned && (
                  <View style={styles.earnedDot} />
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Web Warning */}
      {isWeb && (
        <View style={styles.webWarning}>
          <Text style={styles.webWarningText}>
            ⚠️ For full features (GPS, Camera, Maps), open on mobile
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: SPACING.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: SPACING.section,
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

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  greeting: {
    fontSize: FONT.xxl,
    fontWeight: FONT.bold,
    color: COLORS.textPrimary,
  },
  subGreeting: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    maxWidth: 260,
    fontStyle: 'italic',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1.5,
    borderColor: COLORS.accentBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    fontSize: FONT.lg,
    fontWeight: FONT.bold,
    color: COLORS.accent,
  },

  // Challenge Card
  challengeCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  challengeLabel: {
    fontSize: FONT.xs,
    fontWeight: FONT.bold,
    color: COLORS.accent,
    letterSpacing: 1,
  },
  statusBadge: {
    backgroundColor: COLORS.warningBg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.round,
  },
  statusCompleted: {
    backgroundColor: COLORS.accentGlow,
  },
  statusText: {
    fontSize: FONT.xs,
    fontWeight: FONT.semibold,
    color: COLORS.warning,
  },
  statusTextCompleted: {
    color: COLORS.accent,
  },
  challengeTask: {
    fontSize: FONT.xl,
    fontWeight: FONT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  challengeLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 14,
    marginRight: SPACING.sm,
  },
  locationText: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
  },
  startButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.lg,
    ...SHADOW.glow,
  },
  startButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONT.md,
    fontWeight: FONT.bold,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.subtle,
  },
  statCardStreak: {
    borderColor: COLORS.accentBorder,
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: FONT.xxl,
    fontWeight: FONT.extrabold,
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },

  // Trust Score
  trustCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  trustHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  trustTitle: {
    fontSize: FONT.md,
    fontWeight: FONT.semibold,
    color: COLORS.textPrimary,
  },
  trustValue: {
    fontSize: FONT.md,
    fontWeight: FONT.bold,
    color: COLORS.accent,
  },
  trustBarBg: {
    height: 8,
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  trustBarFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.sm,
  },
  trustHint: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
  breakdown: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  breakdownTitle: {
    fontSize: 10,
    fontWeight: FONT.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  breakdownEmoji: {
    fontSize: 16,
  },
  breakdownLabel: {
    fontSize: 11,
    fontWeight: FONT.semibold,
    color: COLORS.textPrimary,
  },
  breakdownValue: {
    fontSize: 10,
    color: COLORS.accent,
    fontWeight: FONT.bold,
  },

  // Badges
  badgesSection: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT.lg,
    fontWeight: FONT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  badge: {
    width: '47%',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.accentBorder,
    position: 'relative',
  },
  badgeLocked: {
    borderColor: COLORS.border,
    opacity: 0.45,
  },
  badgeEmoji: {
    fontSize: 28,
    marginBottom: SPACING.sm,
  },
  badgeName: {
    fontSize: FONT.sm,
    fontWeight: FONT.semibold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  badgeNameLocked: {
    color: COLORS.textMuted,
  },
  badgeDesc: {
    fontSize: FONT.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  badgeDescLocked: {
    color: COLORS.textMuted,
  },
  earnedDot: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    ...SHADOW.glow,
  },

  // Web Warning
  webWarning: {
    backgroundColor: COLORS.warningBg,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  webWarningText: {
    fontSize: FONT.sm,
    color: COLORS.warning,
    textAlign: 'center',
  },
});