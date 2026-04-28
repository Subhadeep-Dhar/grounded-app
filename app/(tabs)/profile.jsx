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

const BADGES = [
  { id: 'early_bird', emoji: '🌅', name: 'Early Bird', requirement: '3-day streak', earned: false },
  { id: 'consistent', emoji: '💪', name: 'Consistent', requirement: '7-day streak', earned: false },
  { id: 'first_step', emoji: '🎯', name: 'First Step', requirement: '5 completions', earned: false },
  { id: 'trusted', emoji: '⭐', name: 'Trusted', requirement: '80+ trust score', earned: false },
  { id: 'champion', emoji: '🏆', name: 'Champion', requirement: '30 completions', earned: false },
  { id: 'unstoppable', emoji: '🔥', name: 'Unstoppable', requirement: '14-day streak', earned: false },
];

export default function Profile() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        setUserData(snap.data());
      }
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
          }
        },
      ]
    );
  };

  const getEarnedBadges = () => {
    if (!userData) return [];
    
    return BADGES.map(badge => {
      let earned = false;
      
      switch (badge.id) {
        case 'early_bird':
          earned = (userData.streakCount || 0) >= 3;
          break;
        case 'consistent':
          earned = (userData.streakCount || 0) >= 7;
          break;
        case 'first_step':
          earned = (userData.totalCompletions || 0) >= 5;
          break;
        case 'trusted':
          earned = (userData.trustScore || 0) >= 80;
          break;
        case 'champion':
          earned = (userData.totalCompletions || 0) >= 30;
          break;
        case 'unstoppable':
          earned = (userData.streakCount || 0) >= 14;
          break;
      }
      
      return { ...badge, earned };
    });
  };

  const earnedBadges = getEarnedBadges();
  const earnedCount = earnedBadges.filter(b => b.earned).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
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
          Member since {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
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
          <Text style={styles.statLabel}>Trust Score</Text>
        </View>
      </View>

      {/* Progress Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Progress</Text>
        
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Badge Collection</Text>
            <Text style={styles.progressCount}>
              {earnedCount} / {BADGES.length}
            </Text>
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
              : `Earn ${BADGES.length - earnedCount} more badge${BADGES.length - earnedCount > 1 ? 's' : ''} to complete your collection`}
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
              style={[
                styles.badgeCard,
                !badge.earned && styles.badgeLocked
              ]}
            >
              <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
              <Text style={[
                styles.badgeName,
                !badge.earned && styles.badgeNameLocked
              ]}>
                {badge.name}
              </Text>
              <Text style={[
                styles.badgeRequirement,
                !badge.earned && styles.badgeRequirementLocked
              ]}>
                {badge.requirement}
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
            ⚠️ Some features are limited on web. Open in mobile app for full experience.
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
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
    backgroundColor: '#F9FAFB',
  },
  content: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  email: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsGrid: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  progressCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  badgeLocked: {
    borderColor: '#E5E7EB',
    opacity: 0.6,
  },
  badgeEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  badgeNameLocked: {
    color: '#9CA3AF',
  },
  badgeRequirement: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  badgeRequirementLocked: {
    color: '#9CA3AF',
  },
  earnedBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  earnedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  webWarning: {
    backgroundColor: '#FEF3C7',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  webWarningText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
  },
  actions: {
    padding: 16,
    paddingTop: 8,
  },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});