import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { db } from '../src/lib/firebase';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../src/constants/theme';
import { useAuthStore } from '../src/store/authStore';
import { Redirect } from 'expo-router';

export default function Admin() {
  const { user, loading: authLoading } = useAuthStore();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const fetchSubmissions = useCallback(async () => {
    try {
      let q = query(collection(db, 'submissions'));
      if (filter === 'flagged') {
        q = query(collection(db, 'submissions'), where('status', '==', 'flagged'));
      } else if (filter === 'pending') {
        q = query(collection(db, 'submissions'), where('status', '==', 'pending'));
      }
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSubmissions(data);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      Alert.alert('Error', 'Failed to load submissions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleApprove = async (item) => {
    try {
      await updateDoc(doc(db, 'submissions', item.id), { status: 'approved', reviewedAt: Date.now() });
      Alert.alert('Success', 'Submission approved');
      fetchSubmissions();
    } catch (error) { Alert.alert('Error', 'Failed to approve'); }
  };

  const handleReject = async (item) => {
    try {
      await updateDoc(doc(db, 'submissions', item.id), { status: 'rejected', reviewedAt: Date.now() });
      Alert.alert('Success', 'Submission rejected');
      fetchSubmissions();
    } catch (error) { Alert.alert('Error', 'Failed to reject'); }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return COLORS.success;
      case 'flagged': return COLORS.warning;
      case 'rejected': return COLORS.error;
      default: return COLORS.textMuted;
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.userId}>
            {item.userId ? item.userId.substring(0, 12) + '...' : 'Unknown'}
          </Text>
          <Text style={styles.timestamp}>
            {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Unknown'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status || 'pending'}
          </Text>
        </View>
      </View>
      {item.mediaUrl && (
        <Image source={{ uri: item.mediaUrl }} style={styles.image} resizeMode="cover" />
      )}
      <View style={styles.scoreRow}>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreValue}>{item.score || 0}</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreLabel}>Time</Text>
          <Text style={styles.scoreValue}>{item.didInTime ? '✅' : '❌'}</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreLabel}>Location</Text>
          <Text style={styles.scoreValue}>{item.locationOk !== false ? '✅' : '❌'}</Text>
        </View>
      </View>
      {(item.status === 'flagged' || item.status === 'pending') && (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionButton, styles.approveBtn]} onPress={() => handleApprove(item)}>
            <Text style={styles.approveText}>✓ Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.rejectBtn]} onPress={() => handleReject(item)}>
            <Text style={styles.rejectText}>✗ Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (authLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <Text style={styles.headerSubtitle}>{submissions.length} submissions</Text>
      </View>
      <View style={styles.filterRow}>
        {['all', 'flagged', 'pending'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={submissions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>No submissions found</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  loadingText: { marginTop: SPACING.md, color: COLORS.textSecondary, fontSize: FONT.md },
  header: { padding: SPACING.xl, paddingTop: Platform.OS === 'ios' ? 60 : 48, backgroundColor: COLORS.bgCard, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: FONT.xxl, fontWeight: FONT.bold, color: COLORS.textPrimary },
  headerSubtitle: { fontSize: FONT.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  filterRow: { flexDirection: 'row', padding: SPACING.lg, gap: SPACING.md, backgroundColor: COLORS.bgCard, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filterButton: { flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgElevated, alignItems: 'center' },
  filterActive: { backgroundColor: COLORS.accent },
  filterText: { fontSize: FONT.sm, fontWeight: FONT.semibold, color: COLORS.textMuted },
  filterTextActive: { color: COLORS.textPrimary },
  listContent: { padding: SPACING.lg, paddingBottom: SPACING.section },
  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, marginBottom: SPACING.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, ...SHADOW.card },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg },
  userId: { fontSize: FONT.sm, fontWeight: FONT.semibold, color: COLORS.textPrimary },
  timestamp: { fontSize: FONT.xs, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: RADIUS.round },
  statusText: { fontSize: FONT.xs, fontWeight: FONT.semibold, textTransform: 'capitalize' },
  image: { width: '100%', height: 200, backgroundColor: COLORS.bgElevated },
  scoreRow: { flexDirection: 'row', padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border },
  scoreItem: { flex: 1, alignItems: 'center' },
  scoreLabel: { fontSize: FONT.xs, color: COLORS.textMuted, marginBottom: 2 },
  scoreValue: { fontSize: FONT.md, fontWeight: FONT.semibold, color: COLORS.textPrimary },
  actions: { flexDirection: 'row', padding: SPACING.lg, paddingTop: 0, gap: SPACING.md },
  actionButton: { flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.sm, alignItems: 'center' },
  approveBtn: { backgroundColor: COLORS.accentGlow, borderWidth: 1, borderColor: COLORS.accentBorder },
  rejectBtn: { backgroundColor: COLORS.errorBg, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  approveText: { fontSize: FONT.sm, fontWeight: FONT.semibold, color: COLORS.accent },
  rejectText: { fontSize: FONT.sm, fontWeight: FONT.semibold, color: COLORS.error },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.lg },
  emptyText: { fontSize: FONT.md, color: COLORS.textSecondary },
});