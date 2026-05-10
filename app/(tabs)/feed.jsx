import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import {
  Clock,
  MapPin,
  CircleCheck,
  X,
  Maximize2,
  Calendar,
  Zap,
  User,
  ShieldCheck,
  TriangleAlert,
  CircleX,
  ImageOff
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getFeed } from '../../src/services/feed';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../src/constants/theme';

const { width, height } = Dimensions.get('window');

const DynamicImage = ({ uri, onPress }) => {
  const [aspectRatio, setAspectRatio] = useState(1);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (uri) {
      Image.getSize(uri, (w, h) => {
        setAspectRatio(w / h);
      }, (err) => {
        console.warn('Failed to get image size', err);
        setAspectRatio(1);
      });
    }
  }, [uri]);

  return (
    <TouchableOpacity 
      activeOpacity={0.9} 
      onPress={onPress}
      style={[styles.imageContainer, { aspectRatio: Math.min(Math.max(aspectRatio, 0.75), 1.75) }]}
    >
      {!hasError ? (
        <>
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setHasError(true)}
          />
          <View style={styles.expandBadge}>
            <Maximize2 size={16} color="white" />
          </View>
        </>
      ) : (
        <View style={styles.errorPlaceholder}>
          <ImageOff size={32} color={COLORS.textMuted} />
          <Text style={styles.errorText}>Image expired or missing</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default function Feed() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchFeed = useCallback(async () => {
    try {
      const data = await getFeed();
      setSubmissions(data);
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFeed();
  }, [fetchFeed]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return COLORS.success;
      case 'flagged': return COLORS.warning;
      case 'rejected': return COLORS.error;
      default: return COLORS.textMuted;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CircleCheck size={12} color={COLORS.success} />;
      case 'flagged': return <TriangleAlert size={12} color={COLORS.warning} />;
      case 'rejected': return <CircleX size={12} color={COLORS.error} />;
      default: return <Clock size={12} color={COLORS.textMuted} />;
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderItem = ({ item }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <TouchableOpacity 
            style={styles.userInfo}
            onPress={() => router.push(`/user/${item.userId}`)}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              {item.user?.profilePic ? (
                <Image source={{ uri: item.user.profilePic }} style={styles.avatarImage} />
              ) : (
                <User size={18} color={COLORS.accent} />
              )}
            </View>
            <View>
              <Text style={styles.username}>
                {item.user?.username || 'Grounded User'}
              </Text>
              <View style={styles.timestampRow}>
                <Clock size={10} color={COLORS.textMuted} style={{ marginRight: 4 }} />
                <Text style={styles.timestamp}>{formatDate(item.timestamp)}</Text>
              </View>
            </View>
          </TouchableOpacity>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) + '20' }
          ]}>
            {getStatusIcon(item.status)}
            <Text style={[styles.statusText, { color: getStatusColor(item.status), marginLeft: 4 }]}>
              {item.status || 'pending'}
            </Text>
          </View>
        </View>

        {item.mediaUrl && (
          <DynamicImage 
            uri={item.mediaUrl} 
            onPress={() => setSelectedImage(item.mediaUrl)} 
          />
        )}

        <View style={styles.cardFooter}>
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Score</Text>
            <View style={styles.scoreRow}>
              <Zap size={14} color={COLORS.accent} style={{ marginRight: 4 }} />
              <Text style={styles.scoreValue}>{item.score || 0}</Text>
            </View>
          </View>
          <View style={styles.detailContainer}>
            <Text style={styles.detailLabel}>Verification</Text>
            <View style={styles.detailValueRow}>
              {item.locationOk !== false ? (
                <CircleCheck size={12} color={COLORS.success} />
              ) : (
                <CircleX size={12} color={COLORS.error} />
              )}
              <Text style={[styles.detailValue, { marginLeft: 4 }]}>
                Location
              </Text>
            </View>
          </View>
          <View style={styles.detailContainer}>
            <Text style={styles.detailLabel}>Timing</Text>
            <View style={styles.detailValueRow}>
              <Clock size={12} color={item.didInTime ? COLORS.success : COLORS.warning} />
              <Text style={[styles.detailValue, { marginLeft: 4 }]}>
                {item.didInTime ? 'On Time' : 'Late'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>📭</Text>
      <Text style={styles.emptyTitle}>No Submissions Yet</Text>
      <Text style={styles.emptyText}>
        Be the first to complete a challenge today!
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity Feed</Text>
        <Text style={styles.headerSubtitle}>
          {submissions.length} recent submission{submissions.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={submissions}
        renderItem={renderItem}
        keyExtractor={(item, index) => item.timestamp?.toString() || index.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {/* Image Zoom Modal */}
      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => setSelectedImage(null)}
          >
            <X size={28} color="white" />
          </TouchableOpacity>
          
          <Image
            source={{ uri: selectedImage }}
            style={styles.expandedImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
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
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  username: {
    fontSize: FONT.md,
    fontWeight: FONT.bold,
    color: COLORS.textPrimary,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  timestamp: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.round,
  },
  statusEmoji: {
    fontSize: 11,
    marginRight: SPACING.xs,
  },
  statusText: {
    fontSize: FONT.xs,
    fontWeight: FONT.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  imageContainer: {
    width: '100%',
    backgroundColor: 'black',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  expandBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
    borderRadius: RADIUS.round,
  },
  scoreContainer: {
    flex: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: FONT.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreValue: {
    fontSize: FONT.xl,
    fontWeight: FONT.extrabold,
    color: COLORS.textPrimary,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: FONT.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailValue: {
    fontSize: FONT.xs,
    fontWeight: FONT.bold,
    color: COLORS.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONT.xl,
    fontWeight: FONT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  expandedImage: {
    width: width,
    height: height * 0.8,
  },
  errorPlaceholder: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: FONT.xs,
    marginTop: SPACING.sm,
    fontWeight: FONT.medium,
  },
});
