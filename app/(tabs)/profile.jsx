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
  Image,
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
  Pencil,
  LogOut,
  CircleAlert,
  Info,
  Eye, EyeOff
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { db } from '../../src/lib/firebase';
import { useAuthStore } from '../../src/store/authStore';
import { logout } from '../../src/services/auth';
import { uploadImage } from '../../src/services/storage';
import { BADGES } from '../../src/constants/config';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../src/constants/theme';
import { Modal, TextInput } from 'react-native';

export default function Profile() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        setNewUsername(data.username || '');
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
          },
        },
      ]
    );
  };

  const pickProfilePic = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].uri) {
      try {
        setUpdating(true);
        const url = await uploadImage(result.assets[0].uri, user.uid);
        await updateDoc(doc(db, 'users', user.uid), { profilePic: url });
        setUserData(prev => ({ ...prev, profilePic: url }));
        Alert.alert('Success', 'Profile picture updated!');
      } catch (error) {
        Alert.alert('Error', 'Failed to upload profile picture');
      } finally {
        setUpdating(false);
      }
    }
  };

  const handleUpdateUsername = async () => {
    if (newUsername.trim().length < 3 || newUsername.trim().length > 15) {
      Alert.alert('Invalid Username', 'Username must be between 3 and 15 characters.');
      return;
    }

    // Check month limit
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastChangeDate = userData?.lastUsernameChangeDate ? new Date(userData.lastUsernameChangeDate) : null;
    
    let changeCount = userData?.usernameChangeCount || 0;
    
    if (lastChangeDate) {
      if (lastChangeDate.getMonth() !== currentMonth || lastChangeDate.getFullYear() !== currentYear) {
        changeCount = 0; // Reset for new month
      }
    }

    if (changeCount >= 2) {
      Alert.alert('Limit Reached', 'You can only change your username twice a month.');
      return;
    }

    try {
      setUpdating(true);
      await updateDoc(doc(db, 'users', user.uid), {
        username: newUsername.trim(),
        usernameChangeCount: changeCount + 1,
        lastUsernameChangeDate: Date.now(),
      });
      setUserData(prev => ({ 
        ...prev, 
        username: newUsername.trim(),
        usernameChangeCount: changeCount + 1,
        lastUsernameChangeDate: Date.now()
      }));
      setEditModalVisible(false);
      Alert.alert('Success', 'Username updated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update username');
    } finally {
      setUpdating(false);
    }
  };

  const earnedBadges = BADGES.map(badge => ({
    ...badge,
    earned: badge.check(userData || {}),
  }));
  const earnedCount = earnedBadges.filter(b => b.earned).length;

  const [profilePicRatio, setProfilePicRatio] = useState(1);

  useEffect(() => {
    if (userData?.profilePic) {
      Image.getSize(userData.profilePic, (width, height) => {
        setProfilePicRatio(width / height);
      }, (error) => {
        console.warn('Failed to get profile pic size', error);
        setProfilePicRatio(1);
      });
    }
  }, [userData?.profilePic]);

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
          <TouchableOpacity onPress={pickProfilePic} activeOpacity={0.8} disabled={updating}>
            <View style={styles.avatar}>
              {userData?.profilePic ? (
                <Image 
                  source={{ uri: userData.profilePic }} 
                  style={[styles.profileImage, { aspectRatio: profilePicRatio }]} 
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.avatarText}>
                  {userData?.username?.charAt(0).toUpperCase() || '?'}
                </Text>
              )}
              <View style={styles.cameraBadge}>
                <Camera size={14} color="white" />
              </View>
            </View>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.usernameRow} 
          onPress={() => setEditModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.username}>{userData?.username || 'Grounded User'}</Text>
          <Pencil size={16} color={COLORS.accent} style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        <View style={styles.infoRow}>
          <Calendar size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.memberSince}>
            Member since {new Date(userData?.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
        </View>
      </View>

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
          <Text style={styles.statValue}>{userData?.trustScore ?? 0}</Text>
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
              <Award size={32} color={badge.earned ? COLORS.accent : COLORS.textMuted} style={{ marginBottom: 8 }} />
              <Text style={[styles.badgeName, !badge.earned && styles.badgeNameLocked]}>
                {badge.name}
              </Text>
              <Text style={[styles.badgeDesc, !badge.earned && styles.badgeDescLocked]}>
                {badge.desc}
              </Text>
              {badge.earned && (
                <View style={styles.earnedBadge}>
                  <CircleCheck size={12} color={COLORS.accent} style={{ marginRight: 4 }} />
                  <Text style={styles.earnedText}>Earned</Text>
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
          <LogOut size={20} color={COLORS.error} style={{ marginRight: 8 }} />
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>

      </View>

      {/* Edit Username Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <CircleAlert size={20} color={COLORS.warning} />
              <Text style={styles.modalTitle}>Update Username</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              You can only change your username twice a month.
            </Text>
            
            <TextInput
              style={styles.textInput}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="Username"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={15}
            />
            <Text style={styles.inputHint}>{newUsername.length}/15 characters</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, updating && styles.saveButtonDisabled]} 
                onPress={handleUpdateUsername}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.limitInfo}>
              <Info size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
              <Text style={styles.limitText}>
                Changes remaining this month: {2 - (userData?.usernameChangeCount || 0)}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
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
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  username: {
    fontSize: FONT.xxl,
    fontWeight: FONT.bold,
    color: COLORS.textPrimary,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.accent,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.bgCard,
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
  statEmoji: {
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
    flexDirection: 'row',
    alignItems: 'center',
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
  logoutButton: {
    backgroundColor: COLORS.errorBg,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  version: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },
  modalTitle: {
    fontSize: FONT.xl,
    fontWeight: FONT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  modalSubtitle: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
  },
  textInput: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    color: COLORS.textPrimary,
    fontSize: FONT.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputHint: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: 'right',
    marginBottom: SPACING.xl,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  cancelButton: {
    flex: 1,
    padding: SPACING.lg,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT.md,
    fontWeight: FONT.semibold,
  },
  saveButton: {
    flex: 2,
    backgroundColor: COLORS.accent,
    padding: SPACING.lg,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    ...SHADOW.glow,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONT.md,
    fontWeight: FONT.bold,
  },
  limitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgElevated,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  limitText: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
    fontWeight: FONT.medium,
  },
});