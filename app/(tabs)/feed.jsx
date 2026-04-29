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
} from 'react-native';
import { getFeed } from '../../src/services/feed';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../src/constants/theme';

export default function Feed() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const getStatusEmoji = (status) => {
    switch (status) {
      case 'approved': return '✅';
      case 'flagged': return '⚠️';
      case 'rejected': return '❌';
      default: return '⏳';
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

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.userId ? item.userId.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <View>
            <Text style={styles.userId}>
              {item.userId ? item.userId.substring(0, 8) + '...' : 'Anonymous'}
            </Text>
            <Text style={styles.timestamp}>{formatDate(item.timestamp)}</Text>
          </View>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(item.status) + '20' }
        ]}>
          <Text style={styles.statusEmoji}>{getStatusEmoji(item.status)}</Text>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status || 'pending'}
          </Text>
        </View>
      </View>

      {item.mediaUrl && (
        <Image
          source={{ uri: item.mediaUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      )}

      <View style={styles.cardFooter}>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreValue}>{item.score || 0}</Text>
        </View>
        <View style={styles.detailContainer}>
          <Text style={styles.detailLabel}>Time</Text>
          <Text style={styles.detailValue}>
            {item.didInTime ? '✅ On time' : '⏰ Late'}
          </Text>
        </View>
        <View style={styles.detailContainer}>
          <Text style={styles.detailLabel}>Location</Text>
          <Text style={styles.detailValue}>
            {item.locationOk !== false ? '✅ Verified' : '❌ Failed'}
          </Text>
        </View>
      </View>
    </View>
  );

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
  avatarText: {
    fontSize: FONT.md,
    fontWeight: FONT.bold,
    color: COLORS.accent,
  },
  userId: {
    fontSize: FONT.sm,
    fontWeight: FONT.semibold,
    color: COLORS.textPrimary,
  },
  timestamp: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
    marginTop: 1,
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
    fontWeight: FONT.semibold,
    textTransform: 'capitalize',
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: COLORS.bgElevated,
  },
  cardFooter: {
    flexDirection: 'row',
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  scoreContainer: {
    flex: 1,
  },
  detailContainer: {
    flex: 1,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  scoreValue: {
    fontSize: FONT.xl,
    fontWeight: FONT.extrabold,
    color: COLORS.textPrimary,
  },
  detailLabel: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: FONT.sm,
    fontWeight: FONT.semibold,
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
});
