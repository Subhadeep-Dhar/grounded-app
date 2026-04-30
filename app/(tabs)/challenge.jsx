import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Dimensions,
  Share,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { getTodayChallenge } from '../../src/services/challenge';
import { getCurrentLocation, watchUserLocation } from '../../src/services/gps';
import { captureImage } from '../../src/services/camera';
import { submitChallenge, hasUserSubmittedToday } from '../../src/services/submission';
import { sendArrivalNotification, sendCompletionNotification } from '../../src/services/notifications';
import { getDistance } from '../../src/utils/location';
import { COLORS, FONT, SPACING, RADIUS, SHADOW, STAY_DURATION } from '../../src/constants/theme';
import { getUserDoc } from '../../src/services/db';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { runTransaction } from 'firebase/firestore';

const { width } = Dimensions.get('window');
const isNative = Platform.OS !== 'web';

// Conditionally import MapView for mobile only
let MapView, Marker, Polyline, Circle;
if (isNative) {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Polyline = Maps.Polyline;
    Circle = Maps.Circle;
  } catch (e) {
    MapView = null;
  }
}

export default function Challenge() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionState, setSessionState] = useState('idle'); // idle, tracking, arrived, staying, completed
  const [userLocation, setUserLocation] = useState(null);
  const [stayTimer, setStayTimer] = useState(0);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [distance, setDistance] = useState(null);

  const watchSub = useRef(null);
  const stayInterval = useRef(null);
  const mapRef = useRef(null);
  const sessionStateRef = useRef(sessionState);

  // Keep ref in sync
  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  const fetchChallenge = useCallback(async () => {
    if (!user) return;

    try {
      // GET USER DATA
      const userDoc = await getUserDoc(user.uid);

      // BLOCK IF ALREADY COMPLETED
      const submittedToday = await hasUserSubmittedToday(user.uid);
      if (submittedToday) {
        setSessionState('completed'); // reuse completed UI
        setLoading(false);
        return;
      }

      const todayChallenge = await getTodayChallenge(user.uid);

      setChallenge(todayChallenge);

      if (todayChallenge.status === 'completed') {
        setSessionState('completed');
      }

    } catch (error) {
      console.error('Error fetching challenge:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  // Stay timer
  useEffect(() => {
    if (sessionState === 'staying') {
      stayInterval.current = setInterval(() => {
        setStayTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (stayInterval.current) clearInterval(stayInterval.current);
    }
    return () => {
      if (stayInterval.current) clearInterval(stayInterval.current);
    };
  }, [sessionState]);

  // Cleanup watch
  useEffect(() => {
    return () => {
      if (watchSub.current) watchSub.current.remove();
    };
  }, []);

  const getDistanceText = (dist) => {
    if (dist === null) return '';
    if (dist < 30) return "You're here! 🎯";
    if (dist < 100) return "Almost there! 🏃";
    if (dist < 300) return `${Math.round(dist)}m away — keep going`;
    if (dist < 1000) return `${Math.round(dist)}m away`;
    return `${(dist / 1000).toFixed(1)}km away`;
  };

  const startSession = async () => {
    setLocationError(null);
    setLoading(true);

    try {
      const location = await getCurrentLocation();
      const newLoc = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(newLoc);
      setSessionState('tracking');

      // Calculate initial distance
      if (challenge) {
        const dist = getDistance(
          newLoc.latitude, newLoc.longitude,
          challenge.latitude, challenge.longitude
        );
        setDistance(dist);
      }

      // Start watching
      watchSub.current = await watchUserLocation((loc) => {
        const updatedLoc = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setUserLocation(updatedLoc);

        if (challenge) {
          const dist = getDistance(
            updatedLoc.latitude, updatedLoc.longitude,
            challenge.latitude, challenge.longitude
          );
          setDistance(dist);

          // Auto-arrive
          if (dist <= challenge.radius && sessionStateRef.current === 'tracking') {
            handleArrival();
          }
        }

        // Animate map camera
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            ...updatedLoc,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }, 500);
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

    // Stop watching (save battery)
    if (watchSub.current) {
      watchSub.current.remove();
      watchSub.current = null;
    }

    setTimeout(() => {
      setSessionState('staying');
    }, 1500);
  };

  const handleCapture = async () => {
    try {
      const uri = await captureImage();
      if (uri) setMediaUrl(uri);
    } catch (error) {
      Alert.alert('Camera Error', 'Unable to access camera.');
    }
  };

  const handleShare = async () => {
    if (!mediaUrl) return;
    
    try {
      await Share.share({
        message: `🎯 I just completed today's Grounded challenge!\n\n📍 ${challenge?.location}\n\n💪 Showing up matters. Join me at Grounded!`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return; // prevent double click

    setSubmitting(true);

    try {
      // validations
      if (!mediaUrl) {
        Alert.alert('Required', 'Please capture a photo before submitting.');
        setSubmitting(false);
        return;
      }

      if (stayTimer < STAY_DURATION) {
        Alert.alert(
          'Wait',
          `Stay for ${Math.ceil((STAY_DURATION - stayTimer) / 60)} more minute(s).`
        );
        setSubmitting(false);
        return;
      }

      // submit challenge
      const result = await submitChallenge(
        user.uid,
        { ...challenge, stayTime: stayTimer },
        mediaUrl,
        userLocation
      );

      setSubmissionResult(result);

      sendCompletionNotification();
      setSessionState('completed');

      Alert.alert(
        '🎉 Challenge Complete!',
        `Score: ${result.score} • Status: ${result.status}\nGreat job showing up today.`
      );

    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Submission Error', error.message || 'Failed to submit.');
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
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading challenge...</Text>
      </View>
    );
  }

  const isWeb = Platform.OS === 'web';

  // ─── COMPLETED STATE ────────────────────────
  if (sessionState === 'completed') {
    const res = submissionResult || {};
    const statusLabel = res.score >= 80 ? '🔥 Excellent' : res.score >= 60 ? '👍 Good' : '⚠️ Needs improvement';
    const statusColor = res.score >= 80 ? COLORS.success : res.score >= 60 ? COLORS.warning : COLORS.error;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.completedContainer}>
          <Text style={styles.completedEmoji}>🎉</Text>
          <Text style={styles.completedTitle}>Challenge Complete!</Text>
          
          <View style={[styles.statusBadgeLarge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
            <Text style={[styles.statusBadgeTextLarge, { color: statusColor }]}>{statusLabel}</Text>
          </View>

          <View style={styles.scoreBreakdownCard}>
            <View style={styles.mainScoreRow}>
              <Text style={styles.mainScoreLabel}>Total Score</Text>
              <Text style={styles.mainScoreValue}>{res.score || 0}</Text>
            </View>
            
            <View style={styles.breakdownDivider} />
            
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Location Accuracy</Text>
              <Text style={styles.breakdownValue}>+{res.locationScore || 0}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Time Completion</Text>
              <Text style={styles.breakdownValue}>+{res.timeScore || 0}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Photo Proof</Text>
              <Text style={styles.breakdownValue}>+{res.proofScore || 0}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Session Integrity</Text>
              <Text style={styles.breakdownValue}>+{res.integrityScore || 0}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Streak Bonus</Text>
              <Text style={styles.breakdownValue}>+{res.streakBonus || 0}</Text>
            </View>
          </View>

          <Text style={styles.completedText}>
            Great job showing up today.{'\n'}Your trust score has been boosted.
          </Text>

          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => router.push('/(tabs)/home')}
            activeOpacity={0.8}
          >
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ─── IDLE STATE ─────────────────────────────
  if (sessionState === 'idle') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.screenHeader}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Challenge</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Challenge Info */}
        <View style={styles.challengeInfo}>
          <Text style={styles.challengeLabel}>TODAY'S TASK</Text>
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
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>🚀 Start Session</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ─── TRACKING / ARRIVED / STAYING STATE ─────
  return (
    <View style={styles.container}>
      {/* Status Banner */}
      <View style={[
        styles.statusBanner,
        sessionState === 'tracking' && styles.statusTracking,
        sessionState === 'arrived' && styles.statusArrived,
        sessionState === 'staying' && styles.statusStaying,
      ]}>
        <View style={styles.statusContent}>
          <Text style={styles.statusEmoji}>
            {sessionState === 'tracking' ? '🧭' : sessionState === 'arrived' ? '🎯' : '⏱️'}
          </Text>
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>
              {sessionState === 'tracking' ? 'Navigating...' :
                sessionState === 'arrived' ? 'You Arrived!' :
                  'Stay Put!'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {sessionState === 'tracking' ? getDistanceText(distance) :
                sessionState === 'arrived' ? 'Hold your position' :
                  `${formatTime(stayTimer)} / ${formatTime(STAY_DURATION)}`}
            </Text>
          </View>
        </View>
      </View>

      {/* Progress Bar for Staying */}
      {sessionState === 'staying' && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min((stayTimer / STAY_DURATION) * 100, 100)}%` }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {stayTimer >= STAY_DURATION ? '✅ Stay complete!' : 'Stay for 2 minutes to verify'}
          </Text>
        </View>
      )}

      {/* Map */}
      <View style={styles.mapContainer}>
        {isNative && MapView && challenge ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: userLocation?.latitude || challenge.latitude,
              longitude: userLocation?.longitude || challenge.longitude,
              latitudeDelta: 0.008,
              longitudeDelta: 0.008,
            }}
            showsUserLocation={false}
            showsMyLocationButton={false}
            customMapStyle={darkMapStyle}
          >
            {/* User Marker */}
            {userLocation && (
              <Marker
                coordinate={userLocation}
                title="You"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.userMarker}>
                  <View style={styles.userMarkerInner} />
                </View>
              </Marker>
            )}

            {/* Destination Marker */}
            <Marker
              coordinate={{
                latitude: challenge.latitude,
                longitude: challenge.longitude,
              }}
              title={challenge.location}
            >
              <View style={styles.destMarker}>
                <Text style={styles.destMarkerText}>📍</Text>
              </View>
            </Marker>

            {/* Geofence Circle */}
            <Circle
              center={{
                latitude: challenge.latitude,
                longitude: challenge.longitude,
              }}
              radius={challenge.radius}
              strokeColor="rgba(16, 185, 129, 0.6)"
              fillColor="rgba(16, 185, 129, 0.1)"
              strokeWidth={2}
            />
          </MapView>
        ) : (
          <View style={styles.mapFallback}>
            <Text style={styles.mapEmoji}>🗺️</Text>
            <Text style={styles.mapText}>
              {sessionState === 'tracking' ? 'Tracking your location...' :
                'Session in progress'}
            </Text>
            {userLocation && (
              <Text style={styles.coordText}>
                📍 {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
              </Text>
            )}
            {distance !== null && (
              <Text style={styles.distanceText}>{getDistanceText(distance)}</Text>
            )}
          </View>
        )}
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {/* Camera Section */}
        <View style={styles.cameraSection}>
          {mediaUrl ? (
            <TouchableOpacity
              style={styles.photoPreview}
              onPress={handleCapture}
              activeOpacity={0.8}
            >
              <View style={styles.photoPreviewContent}>
                <Image source={{ uri: mediaUrl }} style={styles.photoThumbnail} />
                <View style={styles.photoInfo}>
                  <Text style={styles.photoEmoji}>✅</Text>
                  <Text style={styles.photoText}>Photo captured</Text>
                  <Text style={styles.photoHint}>Tap to retake</Text>
                </View>
              </View>
              <Text style={styles.photoDeleteNote}>
                ⏰ This photo will be visible in the feed for 1 day, then automatically deleted.
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCapture}
              disabled={isWeb}
              activeOpacity={0.8}
            >
              <Text style={styles.captureEmoji}>📷</Text>
              <Text style={styles.captureText}>
                {isWeb ? 'Camera unavailable on web' : 'Take Photo'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!mediaUrl || stayTimer < STAY_DURATION || submitting) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!mediaUrl || stayTimer < STAY_DURATION || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.textPrimary} />
          ) : (
            <Text style={styles.submitButtonText}>
              {stayTimer < STAY_DURATION
                ? `Wait ${STAY_DURATION - stayTimer}s`
                : mediaUrl
                  ? '✅ Submit Challenge'
                  : 'Take photo first'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Share Button */}
        {mediaUrl && stayTimer >= STAY_DURATION && (
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Text style={styles.shareButtonText}>📤 Share to Social Media</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Dark map style for Google Maps
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a9e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1e1e30' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e1a' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e1e30' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2e1a' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e1e30' }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    padding: SPACING.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
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
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  backButton: {
    fontSize: FONT.md,
    color: COLORS.accent,
    fontWeight: FONT.semibold,
  },
  headerTitle: {
    fontSize: FONT.lg,
    fontWeight: FONT.semibold,
    color: COLORS.textPrimary,
  },

  // Idle - Challenge Info
  challengeInfo: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.xxl,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },
  challengeLabel: {
    fontSize: FONT.xs,
    fontWeight: FONT.bold,
    color: COLORS.accent,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  challengeTask: {
    fontSize: FONT.xxl,
    fontWeight: FONT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 14,
    marginRight: SPACING.sm,
  },
  locationText: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
  },
  errorBox: {
    backgroundColor: COLORS.errorBg,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT.sm,
  },
  webNote: {
    backgroundColor: COLORS.warningBg,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  webNoteText: {
    color: COLORS.warning,
    fontSize: FONT.sm,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOW.glow,
  },
  startButtonDisabled: {
    backgroundColor: COLORS.textMuted,
    shadowOpacity: 0,
  },
  startButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONT.lg,
    fontWeight: FONT.bold,
  },

  // Status Banner
  statusBanner: {
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  statusTracking: {
    backgroundColor: COLORS.infoBg,
  },
  statusArrived: {
    backgroundColor: COLORS.accentGlow,
  },
  statusStaying: {
    backgroundColor: COLORS.warningBg,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusEmoji: {
    fontSize: 36,
    marginRight: SPACING.lg,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: FONT.xl,
    fontWeight: FONT.bold,
    color: COLORS.textPrimary,
  },
  statusSubtitle: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Progress
  progressContainer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.bg,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.sm,
  },
  progressText: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  // Map
  mapContainer: {
    flex: 1,
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  map: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    padding: SPACING.xl,
  },
  mapEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  mapText: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  coordText: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  distanceText: {
    fontSize: FONT.md,
    color: COLORS.accent,
    fontWeight: FONT.semibold,
  },

  // User Marker
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  userMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },

  // Destination Marker
  destMarker: {
    alignItems: 'center',
  },
  destMarkerText: {
    fontSize: 28,
  },

  // Bottom Actions
  bottomActions: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  cameraSection: {},
  photoPreview: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  photoPreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
    marginRight: SPACING.md,
  },
  photoInfo: {
    flex: 1,
  },
  photoEmoji: {
    fontSize: 20,
  },
  photoText: {
    fontSize: FONT.md,
    color: COLORS.accent,
    fontWeight: FONT.semibold,
  },
  photoHint: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  photoDeleteNote: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    textAlign: 'center',
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  captureEmoji: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  captureText: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
  },
  submitButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    padding: SPACING.lg + 2,
    alignItems: 'center',
    ...SHADOW.glow,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.textMuted,
    shadowOpacity: 0,
  },
  submitButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONT.md,
    fontWeight: FONT.bold,
  },

  // Share
  shareButton: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shareButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT.md,
    fontWeight: FONT.medium,
  },

  // Completed
  completedContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
    paddingTop: 60,
  },
  completedEmoji: {
    fontSize: 72,
    marginBottom: SPACING.lg,
  },
  completedTitle: {
    fontSize: FONT.xxxl,
    fontWeight: FONT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  statusBadgeLarge: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },
  statusBadgeTextLarge: {
    fontSize: FONT.md,
    fontWeight: FONT.bold,
  },
  scoreBreakdownCard: {
    width: '100%',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xl,
    ...SHADOW.card,
  },
  mainScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  mainScoreLabel: {
    fontSize: FONT.lg,
    fontWeight: FONT.semibold,
    color: COLORS.textSecondary,
  },
  mainScoreValue: {
    fontSize: 42,
    fontWeight: FONT.extrabold,
    color: COLORS.accent,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  breakdownLabel: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
  },
  breakdownValue: {
    fontSize: FONT.sm,
    fontWeight: FONT.bold,
    color: COLORS.textPrimary,
  },
  completedText: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.xxxl,
  },
  homeButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
    ...SHADOW.glow,
  },
  homeButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONT.md,
    fontWeight: FONT.bold,
  },
});
