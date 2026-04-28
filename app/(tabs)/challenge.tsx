import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { getTodayChallenge } from '../../src/services/challenge';
import { getCurrentLocation, watchUserLocation } from '../../src/services/gps';
import { captureImage } from '../../src/services/camera';
import { submitChallenge } from '../../src/services/submission';
import { sendArrivalNotification, sendCompletionNotification } from '../../src/services/notifications';

const { width } = Dimensions.get('window');

export default function Challenge() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionState, setSessionState] = useState('idle'); // idle, tracking, arrived, staying, completed
  const [userLocation, setUserLocation] = useState(null);
  const [path, setPath] = useState([]);
  const [stayTimer, setStayTimer] = useState(0);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [locationError, setLocationError] = useState(null);
  
  const watchSub = useRef(null);
  const stayInterval = useRef(null);

  // Calculate distance between two coordinates
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const fetchChallenge = useCallback(async () => {
    if (!user) return;
    
    try {
      const todayChallenge = await getTodayChallenge(user.uid);
      setChallenge(todayChallenge);
      
      if (todayChallenge.status === 'completed') {
        setSessionState('completed');
      }
    } catch (error) {
      console.error('Error fetching challenge:', error);
      Alert.alert('Error', 'Failed to load challenge');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  // Stay timer effect
  useEffect(() => {
    if (sessionState === 'staying') {
      stayInterval.current = setInterval(() => {
        setStayTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (stayInterval.current) {
        clearInterval(stayInterval.current);
      }
    }

    return () => {
      if (stayInterval.current) {
        clearInterval(stayInterval.current);
      }
    };
  }, [sessionState]);

  // Cleanup watch subscription
  useEffect(() => {
    return () => {
      if (watchSub.current) {
        watchSub.current.remove();
      }
    };
  }, []);

  const startSession = async () => {
    setLocationError(null);
    setLoading(true);
    
    try {
      const location = await getCurrentLocation();
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setPath([{ latitude: location.coords.latitude, longitude: location.coords.longitude }]);
      setSessionState('tracking');
      
      // Start watching location
      watchSub.current = await watchUserLocation((loc) => {
        const newLoc = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setUserLocation(newLoc);
        setPath((prev) => [...prev, newLoc]);
        
        // Check if arrived at destination
        if (challenge) {
          const dist = getDistance(
            newLoc.latitude,
            newLoc.longitude,
            challenge.latitude,
            challenge.longitude
          );
          
          if (dist <= challenge.radius && sessionState === 'tracking') {
            handleArrival();
          }
        }
      });
    } catch (error) {
      console.error('Location error:', error);
      setLocationError('Unable to get location. Please enable GPS.');
      Alert.alert('Location Error', 'Please enable location services and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleArrival = () => {
    setSessionState('arrived');
    sendArrivalNotification();
    
    // Auto-transition to staying after 1 second
    setTimeout(() => {
      setSessionState('staying');
    }, 1000);
  };

  const handleCapture = async () => {
    try {
      const uri = await captureImage();
      if (uri) {
        setMediaUrl(uri);
      }
    } catch (error) {
      Alert.alert('Camera Error', 'Unable to access camera. Please check permissions.');
    }
  };

  const handleSubmit = async () => {
    if (!mediaUrl) {
      Alert.alert('Required', 'Please capture a photo before submitting.');
      return;
    }

    if (stayTimer < 120) {
      Alert.alert('Wait', `You need to stay for 2 minutes. ${Math.ceil((120 - stayTimer) / 60)} minute(s) remaining.`);
      return;
    }

    setSubmitting(true);
    
    try {
      const locationOk = sessionState === 'staying';
      await submitChallenge(user.uid, challenge, mediaUrl, locationOk);
      
      sendCompletionNotification();
      setSessionState('completed');
      
      Alert.alert('🎉 Success!', 'Challenge completed! Great job showing up today.');
      router.push('/(tabs)/home');
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Submission Error', error.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading && !challenge) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading challenge...</Text>
      </View>
    );
  }

  const isWeb = Platform.OS === 'web';

  // Render different states
  const renderContent = () => {
    if (sessionState === 'completed') {
      return (
        <View style={styles.completedContainer}>
          <Text style={styles.completedEmoji}>🎉</Text>
          <Text style={styles.completedTitle}>Challenge Complete!</Text>
          <Text style={styles.completedText}>
            Great job showing up today. Come back tomorrow for another challenge.
          </Text>
          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => router.push('/(tabs)/home')}
          >
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (sessionState === 'idle') {
      return (
        <View style={styles.idleContainer}>
          <View style={styles.challengeInfo}>
            <Text style={styles.challengeLabel}>Today's Task</Text>
            <Text style={styles.challengeTask}>{challenge?.task}</Text>
            
            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationText}>{challenge?.location}</Text>
            </View>
          </View>

          {locationError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{locationError}</Text>
            </View>
          )}

          {isWeb && (
            <View style={styles.webNote}>
              <Text style={styles.webNoteText}>
                ⚠️ GPS and camera features require the mobile app.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.startButton, isWeb && styles.startButtonDisabled]}
            onPress={startSession}
            disabled={isWeb}
          >
            <Text style={styles.startButtonText}>🚀 Start Session</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Tracking, Arrived, or Staying states
    return (
      <View style={styles.sessionContainer}>
        {/* Status Banner */}
        <View style={[
          styles.statusBanner,
          sessionState === 'tracking' && styles.statusTracking,
          sessionState === 'arrived' && styles.statusArrived,
          sessionState === 'staying' && styles.statusStaying,
        ]}>
          <Text style={styles.statusEmoji}>
            {sessionState === 'tracking' ? '🧭' : sessionState === 'arrived' ? '🎯' : '⏱️'}
          </Text>
          <Text style={styles.statusTitle}>
            {sessionState === 'tracking' ? 'Navigating...' : 
             sessionState === 'arrived' ? 'You Arrived!' : 
             'Stay Put!'}
          </Text>
          <Text style={styles.statusSubtitle}>
            {sessionState === 'tracking' ? 'Head to the destination' :
             sessionState === 'arrived' ? 'Hold your position' :
             `${formatTime(stayTimer)} / 2:00`}
          </Text>
        </View>

        {/* Progress Bar for Staying */}
        {sessionState === 'staying' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${Math.min((stayTimer / 120) * 100, 100)}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {stayTimer >= 120 ? '✅ Stay complete!' : 'Stay for 2 minutes to verify'}
            </Text>
          </View>
        )}

        {/* Map Placeholder */}
        <View style={styles.mapContainer}>
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapEmoji}>🗺️</Text>
            <Text style={styles.mapText}>
              {sessionState === 'tracking' ? 'Tracking your location...' :
               sessionState === 'arrived' ? 'You are at the destination!' :
               'Session in progress'}
            </Text>
            {userLocation && (
              <Text style={styles.coordText}>
                📍 {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
              </Text>
            )}
          </View>
        </View>

        {/* Camera Section */}
        <View style={styles.cameraSection}>
          <Text style={styles.sectionTitle}>📸 Proof of Completion</Text>
          
          {mediaUrl ? (
            <View style={styles.photoPreview}>
              <Text style={styles.photoEmoji}>✅</Text>
              <Text style={styles.photoText}>Photo captured!</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCapture}
              disabled={isWeb}
            >
              <Text style={styles.captureButtonEmoji}>📷</Text>
              <Text style={styles.captureButtonText}>
                {isWeb ? 'Camera not available on web' : 'Take Photo'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!mediaUrl || stayTimer < 120 || submitting) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!mediaUrl || stayTimer < 120 || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>
              {stayTimer < 120 
                ? `Wait ${120 - stayTimer}s more` 
                : mediaUrl 
                  ? '✅ Submit Challenge' 
                  : 'Take photo first'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Challenge</Text>
        <View style={styles.headerSpacer} />
      </View>

      {renderContent()}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSpacer: {
    width: 60,
  },
  
  // Idle State
  idleContainer: {
    flex: 1,
    padding: 20,
  },
  challengeInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  challengeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  challengeTask: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  locationText: {
    fontSize: 16,
    color: '#6B7280',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  webNote: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  webNoteText: {
    color: '#92400E',
    fontSize: 14,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  
  // Session State
  sessionContainer: {
    flex: 1,
    padding: 20,
  },
  statusBanner: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  statusTracking: {
    backgroundColor: '#DBEAFE',
  },
  statusArrived: {
    backgroundColor: '#D1FAE5',
  },
  statusStaying: {
    backgroundColor: '#FEF3C7',
  },
  statusEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  mapContainer: {
    height: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  mapEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  mapText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  coordText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  cameraSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  captureButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  captureButtonEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  captureButtonText: {
    fontSize: 16,
    color: '#6B7280',
  },
  photoPreview: {
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  photoEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  photoText: {
    fontSize: 16,
    color: '#065F46',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  
  // Completed State
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  completedEmoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  completedTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  completedText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  homeButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});