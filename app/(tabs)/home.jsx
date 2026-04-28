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

export default function Home() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    try {
      const [userDoc, todayChallenge] = await Promise.all([
        getUserDoc(user.uid),
        getTodayChallenge(user.uid),
      ]);
      setUserData(userDoc);
      setChallenge(todayChallenge);
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
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const isWeb = Platform.OS === 'web';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#10B981']}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {getGreeting()}
          </Text>
          <Text style={styles.subGreeting}>
            Ready for today's challenge?
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => router.push('/(tabs)/profile')}
        >
          <Text style={styles.profileEmoji}>👤</Text>
        </TouchableOpacity>
      </View>

      {/* Today's Challenge Card */}
      <TouchableOpacity
        style={styles.challengeCard}
        onPress={() => router.push('/(tabs)/challenge')}
        activeOpacity={0.8}
      >
        <View style={styles.challengeHeader}>
          <Text style={styles.challengeLabel}>Today's Challenge</Text>
          <View style={[
            styles.statusBadge,
            challenge?.status === 'completed' && styles.statusCompleted
          ]}>
            <Text style={styles.statusText}>
              {challenge?.status === 'completed' ? '✓ Done' : '→ Start'}
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

        {challenge?.status !== 'completed' && (
          <View style={styles.startButton}>
            <Text style={styles.startButtonText}>Start Session →</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
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
          <Text style={styles.statLabel}>Completions</Text>
        </View>
      </View>

      {/* Badges Section */}
      <View style={styles.badgesSection}>
        <Text style={styles.sectionTitle}>Your Badges</Text>
        <View style={styles.badgesGrid}>
          <Badge 
            emoji="🌅" 
            name="Early Bird" 
            earned={userData?.streakCount >= 3} 
          />
          <Badge 
            emoji="💪" 
            name="Consistent" 
            earned={userData?.streakCount >= 7} 
          />
          <Badge 
            emoji="🎯" 
            name="First Step" 
            earned={userData?.totalCompletions >= 5} 
          />
          <Badge 
            emoji="⭐" 
            name="Trusted" 
            earned={userData?.trustScore >= 80} 
          />
        </View>
      </View>

      {/* Web Warning */}
      {isWeb && (
        <View style={styles.webWarning}>
          <Text style={styles.webWarningText}>
            ⚠️ For full features, open on mobile (GPS, Camera, Maps)
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

function Badge({ emoji, name, earned }) {
  return (
    <View style={[styles.badge, !earned && styles.badgeLocked]}>
      <Text style={styles.badgeEmoji}>{emoji}</Text>
      <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 20,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subGreeting: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileEmoji: {
    fontSize: 24,
  },
  challengeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  challengeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    textTransform: 'uppercase',
  },
  statusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCompleted: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  challengeTask: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  challengeLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#6B7280',
  },
  startButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  badgesSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  badge: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  badgeLocked: {
    borderColor: '#E5E7EB',
    opacity: 0.5,
  },
  badgeEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  badgeNameLocked: {
    color: '#9CA3AF',
  },
  webWarning: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  webWarningText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
  },
});