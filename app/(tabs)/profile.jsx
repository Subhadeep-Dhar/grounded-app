import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useAuthStore } from '../../src/store/authStore';
import { logout } from '../../src/services/auth';
import { BADGES } from '../../src/constants/config';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../src/constants/theme';

export default function Profile() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) setUserData(snap.data());
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const earnedBadges = BADGES.map(badge => ({
    ...badge,
    earned: badge.check(userData || {}),
  }));
  const earnedCount = earnedBadges.filter(b => b.earned).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.email?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        </View>
        <Text style={styles.email}>{user?.email || 'User'}</Text>
        <Text style={styles.memberSince}>
          Member since {new Date(userData?.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.statCardAccent]}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statValue}>{userData?.streakCount || 0}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>🏆</Text>
          <Text style={styles.statValue}>{userData?.totalCompletions || 0}</Text>
          <Text style={styles.statLabel}>Completions</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>⭐</Text>
          <Text style={styles.statValue}>{userData?.trustScore || 50}</Text>
          <Text style={styles.statLabel}>Trust</Text>
        </View>
      </View>

      {/* Progress Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Progress</Text>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Badge Collection</Text>
            <Text style={styles.progressCount}>{earnedCount} / {BADGES.length}</Text>
          </View>

          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(earnedCount / BADGES.length) * 100}%` }
              ]}
            />
          </View>

          <Text style={styles.progressText}>
            {earnedCount === BADGES.length
              ? '🎉 All badges earned!'
              : `Earn ${BADGES.length - earnedCount} more to complete your collection`}
          </Text>
        </View>
      </View>

      {/* Badges Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Badges</Text>

        <View style={styles.badgesGrid}>
          {earnedBadges.map((badge) => (
            <View
              key={badge.id}
              style={[styles.badgeCard, !badge.earned && styles.badgeLocked]}
            >
              <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
              <Text style={[styles.badgeName, !badge.earned && styles.badgeNameLocked]}>
                {badge.name}
              </Text>
              <Text style={[styles.badgeDesc, !badge.earned && styles.badgeDescLocked]}>
                {badge.desc}
              </Text>
              {badge.earned && (
                <View style={styles.earnedBadge}>
                  <Text style={styles.earnedText}>✓ Earned</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Web Warning */}
      {Platform.OS === 'web' && (
        <View style={styles.webWarning}>
          <Text style={styles.webWarningText}>
            ⚠️ Some features are limited on web. Open on mobile for full experience.
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Grounded v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
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
    alignItems: 'center',
    padding: SPACING.xxl,
    paddingTop: Platform.OS === 'ios' ? 70 : 56,
    backgroundColor: COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 2,
    borderColor: COLORS.accentBorder,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.glow,
  },
  avatarText: {
    fontSize: FONT.xxxl,
    fontWeight: FONT.bold,
    color: COLORS.accent,
  },
  email: {
    fontSize: FONT.xl,
    fontWeight: FONT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  memberSince: {
    fontSize: FONT.sm,
    color: COLORS.textMuted,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.subtle,
  },
  statCardAccent: {
    borderColor: COLORS.accentBorder,
  },
  statEmoji: {
    fontSize: 28,
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
    textAlign: 'center',
  },

  // Section
  section: {
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT.lg,
    fontWeight: FONT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },

  // Progress
  progressCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.subtle,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  progressTitle: {
    fontSize: FONT.md,
    fontWeight: FONT.semibold,
    color: COLORS.textPrimary,
  },
  progressCount: {
    fontSize: FONT.md,
    fontWeight: FONT.bold,
    color: COLORS.accent,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.sm,
  },
  progressText: {
    fontSize: FONT.sm,
    color: COLORS.textMuted,
  },

  // Badges
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  badgeCard: {
    width: '47%',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.accentBorder,
    ...SHADOW.subtle,
  },
  badgeLocked: {
    borderColor: COLORS.border,
    opacity: 0.5,
  },
  badgeEmoji: {
    fontSize: 32,
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
  earnedBadge: {
    backgroundColor: COLORS.accentGlow,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.round,
    marginTop: SPACING.sm,
  },
  earnedText: {
    fontSize: FONT.xs,
    fontWeight: FONT.semibold,
    color: COLORS.accent,
  },

  // Web Warning
  webWarning: {
    backgroundColor: COLORS.warningBg,
    margin: SPACING.lg,
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

  // Actions
  actions: {
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  logoutButton: {
    backgroundColor: COLORS.errorBg,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutButtonText: {
    color: COLORS.error,
    fontSize: FONT.md,
    fontWeight: FONT.semibold,
  },
  version: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});