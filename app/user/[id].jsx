import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
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
  Medal
} from 'lucide-react-native';
import { db } from '../../src/lib/firebase';
import { BADGES } from '../../src/constants/config';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../src/constants/theme';

export default function PublicProfile() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    if (!id) return;
    try {
      const snap = await getDoc(doc(db, 'users', id));
      if (snap.exists()) setUserData(snap.data());
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

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

  if (!userData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>User not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Info */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {userData?.profilePic ? (
                <Image source={{ uri: userData.profilePic }} style={styles.profileImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {userData?.username?.charAt(0).toUpperCase() || '?'}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.nameRow}>
            <Text style={styles.username}>{userData?.username || 'Grounded User'}</Text>
            {(userData?.trustScore || 0) >= 90 && (
              <ShieldCheck size={18} color={COLORS.accent} style={{ marginLeft: 6 }} />
            )}
          </View>

          <View style={styles.infoRow}>
            <Calendar size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
            <Text style={styles.memberSince}>
              Member since {new Date(userData?.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardAccent]}>
            <Flame size={24} color="#FF4500" style={{ marginBottom: 8 }} />
            <Text style={styles.statValue}>{userData?.streakCount || 0}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>

          <View style={styles.statCard}>
            <Trophy size={24} color="#FFA500" style={{ marginBottom: 8 }} />
            <Text style={styles.statValue}>{userData?.totalCompletions || 0}</Text>
            <Text style={styles.statLabel}>Completions</Text>
          </View>

          <View style={styles.statCard}>
            <Star size={24} color="#FFD700" style={{ marginBottom: 8 }} />
            <Text style={styles.statValue}>{userData?.trustScore || 50}</Text>
            <Text style={styles.statLabel}>Trust</Text>
          </View>
        </View>

        {/* Badges Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badges Collected ({earnedCount})</Text>

          <View style={styles.badgesGrid}>
            {earnedBadges.filter(b => b.earned).map((badge) => (
              <View key={badge.id} style={styles.badgeCard}>
                <Award size={32} color={COLORS.accent} style={{ marginBottom: 8 }} />
                <Text style={styles.badgeName}>{badge.name}</Text>
                <Text style={styles.badgeDesc}>{badge.desc}</Text>
                <View style={styles.earnedBadge}>
                  <CheckCircle2 size={12} color={COLORS.accent} style={{ marginRight: 4 }} />
                  <Text style={styles.earnedText}>Verified</Text>
                </View>
              </View>
            ))}
            {earnedCount === 0 && (
              <View style={styles.emptyBadges}>
                <Award size={48} color={COLORS.textMuted} style={{ marginBottom: 12, opacity: 0.3 }} />
                <Text style={styles.emptyText}>No badges earned yet.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
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
  customHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerIcon: {
    padding: 4,
  },
  headerTitle: {
    fontSize: FONT.lg,
    fontWeight: FONT.bold,
    color: COLORS.textPrimary,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: FONT.lg,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xl,
  },
  backButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
  },
  backButtonText: {
    color: COLORS.textPrimary,
    fontWeight: FONT.bold,
  },

  // Profile Header
  profileHeader: {
    alignItems: 'center',
    padding: SPACING.xxl,
    backgroundColor: COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 2,
    borderColor: COLORS.accentBorder,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.glow,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: FONT.bold,
    color: COLORS.accent,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  username: {
    fontSize: FONT.xxl,
    fontWeight: FONT.bold,
    color: COLORS.textPrimary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  badgeName: {
    fontSize: FONT.sm,
    fontWeight: FONT.semibold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  badgeDesc: {
    fontSize: FONT.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  earnedBadge: {
    backgroundColor: COLORS.accentGlow,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.round,
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  earnedText: {
    fontSize: FONT.xs,
    fontWeight: FONT.semibold,
    color: COLORS.accent,
  },
  emptyBadges: {
    width: '100%',
    padding: SPACING.xxl,
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT.sm,
  }
});
