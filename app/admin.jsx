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
} from 'react-native';
import { db } from '../src/lib/firebase';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';

export default function Admin() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, flagged, pending

  const fetchSubmissions = useCallback(async () => {
    try {
      let q = query(collection(db, 'submissions'));
      
      if (filter === 'flagged') {
        q = query(collection(db, 'submissions'), where('status', '==', 'flagged'));
      } else if (filter === 'pending') {
        q = query(collection(db, 'submissions'), where('status', '==', 'pending'));
      }
      
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSubmissions(data);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      Alert.alert('Error', 'Failed to load submissions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleApprove = async (item) => {
    try {
      await updateDoc(doc(db, 'submissions', item.id), {
        status: 'approved',
        reviewedAt: Date.now(),
      });
      Alert.alert('Success', 'Submission approved');
      fetchSubmissions();
    } catch (error) {
      Alert.alert('Error', 'Failed to approve submission');
    }
  };

  const handleReject = async (item) => {
    try {
      await updateDoc(doc(db, 'submissions', item.id), {
        status: 'rejected',
        reviewedAt: Date.now(),
      });
      Alert.alert('Success', 'Submission rejected');
      fetchSubmissions();
    } catch (error) {
      Alert.alert('Error', 'Failed to reject submission');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#10B981';
      case 'flagged': return '#F59E0B';
      case 'rejected': return '#EF4444';
      default: return '#6B7280';
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
        <Image
          source={{ uri: item.mediaUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      )}

      <View style={styles.scoreRow}>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreValue}>{item.score || 0}</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreLabel}>Time Bonus</Text>
          <Text style={styles.scoreValue}>{item.didInTime ? '✅ Yes' : '❌ No'}</Text>
        </View>
      </View>

      {item.status === 'flagged' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApprove(item)}
          >
            <Text style={styles.approveText}>✓ Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleReject(item)}
          >
            <Text style={styles.rejectText}>✗ Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>📭</Text>
      <Text style={styles.emptyText}>No submissions found</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <Text style={styles.headerSubtitle}>
          {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'flagged' && styles.filterActive]}
          onPress={() => setFilter('flagged')}
        >
          <Text style={[styles.filterText, filter === 'flagged' && styles.filterTextActive]}>
            Flagged
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'pending' && styles.filterActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            Pending
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={submissions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#10B981']}
          />
        }
        ListEmptyComponent={renderEmpty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  filterActive: {
    backgroundColor: '#10B981',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  userId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
  },
  scoreRow: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  scoreItem: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#D1FAE5',
  },
  rejectButton: {
    backgroundColor: '#FEE2E2',
  },
  approveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
  },
  rejectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
});