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
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { getTodayChallenge } from '../../src/services/challenge';
import { getCurrentLocation, watchUserLocation } from '../../src/services/gps';
import { captureImage } from '../../src/services/camera';
import { submitChallenge, hasUserSubmittedToday, getTodaySubmission } from '../../src/services/submission';
import { sendArrivalNotification, sendCompletionNotification, pauseNotifications, resumeNotifications } from '../../src/services/notifications';
import { getDistance } from '../../src/utils/location';
import { getSession, startSession as dbStartSession, markArrived, resetArrival, unlockVerification, logSuspicion } from '../../src/services/session';
import { isInsideRegion, evaluateRegion } from '../../src/services/region';
import { getTimeWindow, isSubmissionAllowed, getCurrentMinutes } from '../../src/utils/scoring';
import { SESSION_STATES, TIME_WINDOWS, STAY_DURATION } from '../../src/constants/config';
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
  ChevronRight,
  Eye, EyeOff,
  Lock,
  MapPinOff,
} from 'lucide-react-native';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../src/constants/theme';
import { getUserDoc } from '../../src/services/db';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';

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
  const [sessionState, setSessionState] = useState(SESSION_STATES.NOT_STARTED);
  const [userLocation, setUserLocation] = useState(null);
  const [stayTimer, setStayTimer] = useState(0);
  const [countdownEndsAt, setCountdownEndsAt] = useState(null); // persisted across restarts
  const [mediaUrl, setMediaUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [distance, setDistance] = useState(null);
  const [photoRatio, setPhotoRatio] = useState(1);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isRegionLocked, setIsRegionLocked] = useState(false);
  const [regionStatus, setRegionStatus] = useState('unknown'); // 'inside'|'outside'|'unknown'
  const [timeWindow, setTimeWindow] = useState(null); // 'primary'|'late'|null
  const [isExpired, setIsExpired] = useState(false);
  const [isWatermarkImageLoaded, setIsWatermarkImageLoaded] = useState(false);

  const watchSub = useRef(null);
  const stayInterval = useRef(null);
  const mapRef = useRef(null);
  const watermarkRef = useRef(null);
  const sessionStateRef = useRef(sessionState);

  // Keep ref in sync
  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  const fetchChallenge = useCallback(async () => {
    if (!user) return;
    try {
      const submittedToday = await hasUserSubmittedToday(user.uid);
      if (submittedToday) {
        const subData = await getTodaySubmission(user.uid);
        setSubmissionResult(subData);
        setMediaUrl(subData?.mediaUrl);
        setSessionState(SESSION_STATES.SUBMITTED);
        setLoading(false);
        return;
      }

      // Check time window on mount (device clock for UI; backend validates server time)
      const mins = getCurrentMinutes();
      const window = getTimeWindow(mins);
      setTimeWindow(window);
      if (!window) setIsExpired(true);

      // Restore persisted session from Firestore (prevent restart bypass)
      const today = new Date().toDateString();
      const existingSession = await getSession(user.uid, today);
      if (existingSession) {
        const { state, countdownEndsAt: cEnd } = existingSession;
        if (state === SESSION_STATES.SUBMITTED) {
          const subData = await getTodaySubmission(user.uid);
          setSubmissionResult(subData);
          setSessionState(SESSION_STATES.SUBMITTED);
          setLoading(false);
          return;
        }
        if (state === SESSION_STATES.VERIFICATION_UNLOCKED) {
          setSessionState(SESSION_STATES.VERIFICATION_UNLOCKED);
          setCountdownEndsAt(cEnd || null);
          setStayTimer(STAY_DURATION);
        } else if (state === SESSION_STATES.ARRIVED_WAITING) {
          const now = Date.now();
          if (cEnd && now >= cEnd) {
            // Countdown already elapsed while app was closed → auto-unlock
            try { await unlockVerification(user.uid, today); } catch (_) {}
            setSessionState(SESSION_STATES.VERIFICATION_UNLOCKED);
            setStayTimer(STAY_DURATION);
          } else {
            // Restore countdown in progress
            setSessionState(SESSION_STATES.ARRIVED_WAITING);
            setCountdownEndsAt(cEnd || null);
            const elapsed = cEnd ? Math.max(0, Math.floor((STAY_DURATION * 1000 - (cEnd - now)) / 1000)) : 0;
            setStayTimer(elapsed);
          }
        } else if (state === SESSION_STATES.TRAVELING) {
          setSessionState(SESSION_STATES.TRAVELING);
        }
      }

      const todayChallenge = await getTodayChallenge(user.uid);
      setChallenge(todayChallenge);

      if (todayChallenge.regionLocked) {
        setIsRegionLocked(true);
        setRegionStatus('outside');
        pauseNotifications().catch(() => {});
      }

    } catch (error) {
      console.error('[Challenge] fetchChallenge error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  // Stay countdown — increments every second during ARRIVED_WAITING
  // Auto-unlocks verification when countdownEndsAt is reached
  useEffect(() => {
    if (sessionState === SESSION_STATES.ARRIVED_WAITING) {
      stayInterval.current = setInterval(async () => {
        setStayTimer((prev) => {
          const next = prev + 1;
          return next;
        });
        // Check if countdown elapsed
        if (countdownEndsAt && Date.now() >= countdownEndsAt) {
          clearInterval(stayInterval.current);
          setStayTimer(STAY_DURATION);
          try {
            const today = new Date().toDateString();
            await unlockVerification(user.uid, today);
            setSessionState(SESSION_STATES.VERIFICATION_UNLOCKED);
          } catch (e) {
            console.warn('[Challenge] unlockVerification error:', e);
          }
        }
      }, 1000);
    } else {
      if (stayInterval.current) clearInterval(stayInterval.current);
    }
    return () => {
      if (stayInterval.current) clearInterval(stayInterval.current);
    };
  }, [sessionState, countdownEndsAt, user]);

  // Cleanup watch
  useEffect(() => {
    return () => {
      if (watchSub.current) {
        watchSub.current.remove();
        watchSub.current = null;
      }
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
      // Guard: time window must be open
      const mins = getCurrentMinutes();
      const window = getTimeWindow(mins);
      if (!window) {
        setIsExpired(true);
        Alert.alert(
          'Window Closed',
          'Challenges are only available 5:00–7:30 AM or 6:00–9:00 PM.'
        );
        return;
      }
      setTimeWindow(window);

      // Get location
      const location = await getCurrentLocation();
      if (!location || !location.coords) {
        setLocationError('Unable to fetch location. Please try again.');
        Alert.alert('Location Error', 'Could not get your location.');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 800));

      const newLoc = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(newLoc);

      // Region check
      const inside = isInsideRegion(newLoc.latitude, newLoc.longitude);
      setIsRegionLocked(!inside);
      setRegionStatus(inside ? 'inside' : 'outside');
      if (!inside) {
        pauseNotifications().catch(() => {});
        Alert.alert(
          'Outside Manipal',
          'Progression is paused until you return to Manipal. You can still browse the app.'
        );
        return;
      }

      // Resume notifications if previously paused
      resumeNotifications().catch(() => {});

      // Persist session start in Firestore
      const today = new Date().toDateString();
      await dbStartSession(user.uid, today);
      setSessionState(SESSION_STATES.TRAVELING);

      // Initial distance
      if (challenge) {
        const dist = getDistance(
          newLoc.latitude, newLoc.longitude,
          challenge.latitude, challenge.longitude
        );
        setDistance(dist);
      }

      // Start location watcher
      const startWatcher = async () => {
        try {
          if (watchSub.current) { watchSub.current.remove(); watchSub.current = null; }

          watchSub.current = await watchUserLocation((loc) => {
            if (!loc || !loc.coords) return;

            const updatedLoc = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            setUserLocation(updatedLoc);

            // Mocked GPS detection (Expo exposes loc.mocked on Android)
            if (loc.mocked === true) {
              logSuspicion(user.uid, new Date().toDateString(), 'MOCKED_GPS').catch(() => {});
            }

            // Region re-evaluation on each GPS update (battery-efficient — no polling)
            const inside = isInsideRegion(updatedLoc.latitude, updatedLoc.longitude);
            setIsRegionLocked(!inside);
            setRegionStatus(inside ? 'inside' : 'outside');

            if (challenge) {
              const dist = getDistance(
                updatedLoc.latitude, updatedLoc.longitude,
                challenge.latitude, challenge.longitude
              );
              setDistance(dist);

              const currentState = sessionStateRef.current;

              // Arrival detection: only trigger if time window open + inside region
              if (dist <= challenge.radius && currentState === SESSION_STATES.TRAVELING && inside) {
                const nowMins = getCurrentMinutes();
                if (isSubmissionAllowed(nowMins)) {
                  handleArrival();
                }
              }

              // Anti-passive-wait: exit radius resets timer
              if (dist > challenge.radius && currentState === SESSION_STATES.ARRIVED_WAITING) {
                const today = new Date().toDateString();
                resetArrival(user.uid, today).catch(() => {});
                setSessionState(SESSION_STATES.TRAVELING);
                setStayTimer(0);
                setCountdownEndsAt(null);
                Alert.alert('Left the area', 'Timer reset. Return to the location to continue.');
              }
            }

            // Safe map animation
            if (mapRef.current) {
              try {
                mapRef.current.animateToRegion(
                  { ...updatedLoc, latitudeDelta: 0.005, longitudeDelta: 0.005 },
                  500
                );
              } catch (e) {}
            }
          });
        } catch (e) {
          console.log('[Challenge] Watcher error:', e);
        }
      };

      setTimeout(startWatcher, 1200);
    } catch (error) {
      console.log('[Challenge] startSession error:', error);
      setLocationError('Unable to get location. Please enable GPS.');
      Alert.alert('Error', 'Please enable location services and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleArrival = async () => {
    // Validate time window hasn't closed since session start
    const nowMins = getCurrentMinutes();
    if (!isSubmissionAllowed(nowMins)) {
      setIsExpired(true);
      setSessionState(SESSION_STATES.EXPIRED);
      return;
    }

    try {
      const today = new Date().toDateString();
      const session = await markArrived(user.uid, today);
      setCountdownEndsAt(session.countdownEndsAt);
      setSessionState(SESSION_STATES.ARRIVED_WAITING);
      setStayTimer(0);
      sendArrivalNotification();
    } catch (e) {
      console.warn('[Challenge] handleArrival error:', e);
      // Fallback: still transition UI
      setSessionState(SESSION_STATES.ARRIVED_WAITING);
      setCountdownEndsAt(Date.now() + STAY_DURATION * 1000);
      setStayTimer(0);
    }
  };

  const handleCapture = async () => {
    try {
      const uri = await captureImage();
      if (uri) {
        setMediaUrl(uri);
        Image.getSize(uri, (w, h) => {
          setPhotoRatio(w / h);
          setImageSize({ width: w, height: h });
          setIsWatermarkImageLoaded(false); // Reset for new capture
        }, (err) => {
          console.warn('Failed to get capture image size', err);
          setPhotoRatio(1);
          setImageSize({ width: 0, height: 0 });
        });
      }
    } catch (error) {
      console.error('handleCapture error:', error);
      Alert.alert('Camera Error', 'Unable to access camera or capture image.');
    }
  };

  const handleShare = async () => {
    if (!mediaUrl || !watermarkRef.current) return;

    try {
      setLoading(true);
      const uri = await captureRef(watermarkRef, {
        format: 'png',
        quality: 1,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: 'Share your achievement',
          UTI: 'public.png',
        });
      } else {
        await Share.share({
          message: `🎯 I successfully completed today's Grounded challenge!\n\n📍 ${challenge?.location}\n\n#grounded #mitmanipal #discipline`,
        });
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Share Error', 'Could not generate shareable image.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (!mediaUrl) {
        Alert.alert('Required', 'Please capture a photo before submitting.');
        return;
      }
      if (sessionState !== SESSION_STATES.VERIFICATION_UNLOCKED) {
        Alert.alert('Not yet', 'Complete the stay timer first.');
        return;
      }
      if (isRegionLocked) {
        Alert.alert('Outside Manipal', 'Progression is paused until you return to Manipal.');
        return;
      }

      // Watermark capture with safeguards
      let finalMediaUri = mediaUrl;
      try {
        // 1. Wait for Image component inside watermarkRef to load
        // 2. Add safety delay for native view hierarchy to sync
        const maxWait = 3000;
        const start = Date.now();
        while (!isWatermarkImageLoaded && (Date.now() - start < maxWait)) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Final safety delay (especially for Android rendering)
        await new Promise(resolve => setTimeout(resolve, 500));

        const capturedUri = await captureRef(watermarkRef, { 
          format: 'jpg', 
          quality: 0.8, // Slightly higher quality
          result: 'tmpfile'
        });

        // 3. Validate generated file
        if (capturedUri) {
          const response = await fetch(capturedUri);
          const blob = await response.blob();
          
          if (blob.size > 1000) { // Valid if > 1KB
            finalMediaUri = capturedUri;
          } else {
            console.warn('[Challenge] Generated watermark is too small/empty, falling back');
          }
        }
      } catch (e) {
        console.log('[Challenge] Watermark capture failed or invalid, using raw image:', e);
      }

      const result = await submitChallenge(
        user.uid,
        { ...challenge, stayTime: stayTimer },
        finalMediaUri,
        userLocation,
        sessionState,       // pass session state for server-side guard
        !isRegionLocked     // isInsideRegion
      );

      setSubmissionResult(result);
      sendCompletionNotification();
      setSessionState(SESSION_STATES.SUBMITTED);

      const windowLabel = result.timeWindow === 'late' ? ' (Evening window — reduced trust gain)' : '';
      Alert.alert(
        '🎉 Challenge Complete!',
        `Score: ${result.score} • Trust: ${result.newTrustScore?.toFixed(0) ?? '?'}${windowLabel}\nGreat job showing up today.`
      );
    } catch (error) {
      console.error('[Challenge] Submit error:', error);
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

  // ─── SUBMITTED STATE ─────────────────────────
  if (sessionState === SESSION_STATES.SUBMITTED) {
    const res = submissionResult || {};
    const statusLabel = res.score >= 80 ? 'Excellent' : res.score >= 60 ? 'Good' : 'Needs improvement';
    const statusColor = res.score >= 80 ? COLORS.success : res.score >= 60 ? COLORS.warning : COLORS.error;
    const StatusIcon = res.score >= 80 ? ShieldCheck : res.score >= 60 ? CircleCheck : TriangleAlert;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.completedContainer}>
          <StatusIcon size={64} color={statusColor} style={{ marginBottom: SPACING.xl }} />
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

  // ─── EXPIRED STATE ────────────────────────────
  if (sessionState === SESSION_STATES.EXPIRED || isExpired) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.completedContainer}>
          <CircleX size={64} color={COLORS.error} style={{ marginBottom: SPACING.xl }} />
          <Text style={styles.completedTitle}>Window Closed</Text>
          <View style={[styles.statusBadgeLarge, { backgroundColor: COLORS.errorBg, borderColor: COLORS.error }]}>
            <Text style={[styles.statusBadgeTextLarge, { color: COLORS.error }]}>Expired</Text>
          </View>
          <Text style={styles.completedText}>
            Today's submission window has closed.{'\n'}Come back tomorrow between 5:00–7:30 AM.
          </Text>
          <TouchableOpacity style={styles.homeButton} onPress={() => router.push('/(tabs)/home')} activeOpacity={0.8}>
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ─── REGION LOCKED STATE ─────────────────────
  if (isRegionLocked && sessionState === SESSION_STATES.NOT_STARTED) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.completedContainer}>
          <MapPinOff size={64} color={COLORS.warning} style={{ marginBottom: SPACING.xl }} />
          <Text style={styles.completedTitle}>Outside Manipal</Text>
          <View style={[styles.statusBadgeLarge, { backgroundColor: COLORS.warningBg, borderColor: COLORS.warning }]}>
            <Text style={[styles.statusBadgeTextLarge, { color: COLORS.warning }]}>Progression Paused</Text>
          </View>
          <Text style={styles.completedText}>
            Progression is paused until you return to Manipal.{'\n'}{'\n'}You can still browse the feed, profile, and leaderboard.
          </Text>
          <TouchableOpacity style={styles.homeButton} onPress={() => router.push('/(tabs)/home')} activeOpacity={0.8}>
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ─── NOT_STARTED STATE ────────────────────────
  if (sessionState === SESSION_STATES.NOT_STARTED) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.screenHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButtonRow}>
            <ArrowLeft size={20} color={COLORS.accent} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Challenge</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Challenge Info */}
        <View style={styles.challengeInfo}>
          <Text style={styles.challengeLabel}>TODAY'S TASK</Text>
          <Text style={styles.challengeTask}>{challenge?.task}</Text>
          <View style={styles.locationRow}>
            <MapPin size={16} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
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
          <Navigation size={20} color={COLORS.textPrimary} style={{ marginRight: 8 }} />
          <Text style={styles.startButtonText}>Start Session</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ─── TRAVELING / ARRIVED_WAITING / VERIFICATION_UNLOCKED STATE ─────
  const isVerificationUnlocked = sessionState === SESSION_STATES.VERIFICATION_UNLOCKED;
  const isArrived = sessionState === SESSION_STATES.ARRIVED_WAITING || isVerificationUnlocked;
  const isInCountdown = sessionState === SESSION_STATES.ARRIVED_WAITING;
  const remainingSeconds = Math.max(0, STAY_DURATION - stayTimer);

  return (
    <View style={styles.container}>
      {/* Region-paused banner (when inside a session but temporarily outside geofence) */}
      {isRegionLocked && (
        <View style={[styles.statusBanner, { backgroundColor: COLORS.warningBg, paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingBottom: SPACING.md }]}>
          <View style={styles.statusContent}>
            <MapPinOff size={20} color={COLORS.warning} />
            <Text style={[styles.statusTitle, { color: COLORS.warning, marginLeft: SPACING.md, fontSize: FONT.sm }]}>
              Progression paused until you return to Manipal.
            </Text>
          </View>
        </View>
      )}

      {/* Status Banner */}
      {!isRegionLocked && (
      <View style={[
        styles.statusBanner,
        sessionState === SESSION_STATES.TRAVELING && styles.statusTracking,
        isArrived && !isVerificationUnlocked && styles.statusArrived,
        isVerificationUnlocked && styles.statusStaying,
      ]}>
        <View style={styles.statusContent}>
          <View style={styles.statusIconContainer}>
            {sessionState === SESSION_STATES.TRAVELING ? (
              <Navigation size={24} color="white" />
            ) : isVerificationUnlocked ? (
              <CircleCheck size={24} color="white" />
            ) : (
              <Timer size={24} color="white" />
            )}
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>
              {sessionState === SESSION_STATES.TRAVELING ? 'Navigating...' :
                isVerificationUnlocked ? 'Verification Unlocked!' :
                  'Stay Put!'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {sessionState === SESSION_STATES.TRAVELING ? getDistanceText(distance) :
                isVerificationUnlocked ? 'Take your photo and submit.' :
                  `${formatTime(stayTimer)} / ${formatTime(STAY_DURATION)}`}
            </Text>
          </View>
        </View>
      </View>
      )}

      {/* Progress Bar */}
      {(isArrived) && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min((stayTimer / STAY_DURATION) * 100, 100)}%` },
                isVerificationUnlocked && { backgroundColor: COLORS.success },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {isVerificationUnlocked
              ? '✅ Stay complete! Take your photo.'
              : isInCountdown
                ? `Hold position — ${remainingSeconds}s remaining`
                : 'Stay for the required duration'}
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
                <MapPin size={24} color={COLORS.error} />
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
            <History size={48} color={COLORS.textMuted} style={{ marginBottom: 12, opacity: 0.3 }} />
            <Text style={styles.mapText}>
              {sessionState === 'tracking' ? 'Tracking your location...' :
                'Session in progress'}
            </Text>
            {userLocation && (
              <View style={styles.coordRow}>
                <MapPin size={12} color={COLORS.textMuted} style={{ marginRight: 4 }} />
                <Text style={styles.coordText}>
                  {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
                </Text>
              </View>
            )}
            {distance !== null && (
              <View style={styles.distRow}>
                <Navigation size={12} color={COLORS.accent} style={{ marginRight: 4 }} />
                <Text style={styles.distanceText}>{getDistanceText(distance)}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {/* Camera Section */}
        <View style={styles.cameraSection}>
          {mediaUrl && isVerificationUnlocked ? (
            <TouchableOpacity style={styles.photoPreview} onPress={handleCapture} activeOpacity={0.8}>
              <View style={styles.photoPreviewContent}>
                <Image
                  source={{ uri: mediaUrl }}
                  style={[styles.photoThumbnail, { aspectRatio: photoRatio || 1 }]}
                  resizeMode="cover"
                />
                <View style={styles.photoInfo}>
                  <CircleCheck size={16} color={COLORS.success} />
                  <Text style={styles.photoText}>Photo captured</Text>
                  <Text style={styles.photoHint}>Tap to retake</Text>
                </View>
              </View>
              <View style={styles.deleteNoteRow}>
                <Clock size={12} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                <Text style={styles.photoDeleteNote}>Auto-deletes after 24 hours</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.captureButton,
                (!isVerificationUnlocked || isWeb) && styles.captureButtonLocked,
              ]}
              onPress={isVerificationUnlocked ? handleCapture : undefined}
              disabled={!isVerificationUnlocked || isWeb}
              activeOpacity={isVerificationUnlocked ? 0.8 : 1}
            >
              {isVerificationUnlocked ? (
                <Camera size={24} color={COLORS.accent} />
              ) : (
                <Lock size={24} color={COLORS.textMuted} />
              )}
              <Text style={[styles.captureText, !isVerificationUnlocked && { color: COLORS.textMuted }]}>
                {isWeb ? 'Camera unavailable on web' :
                  !isVerificationUnlocked ? `Locked — ${remainingSeconds}s remaining` :
                    'Take Photo Proof'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!mediaUrl || !isVerificationUnlocked || submitting || isRegionLocked) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!mediaUrl || !isVerificationUnlocked || submitting || isRegionLocked}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.textPrimary} />
          ) : (
            <View style={styles.submitRow}>
              {isVerificationUnlocked && mediaUrl ? (
                <CircleCheck size={18} color={COLORS.textPrimary} style={{ marginRight: 8 }} />
              ) : (
                <Lock size={18} color={COLORS.textPrimary} style={{ marginRight: 8 }} />
              )}
              <Text style={styles.submitButtonText}>
                {!isVerificationUnlocked
                  ? `Locked — ${remainingSeconds}s`
                  : !mediaUrl
                    ? 'Take photo first'
                    : isRegionLocked
                      ? 'Outside Manipal'
                      : 'Submit Challenge'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Share Button */}
        {mediaUrl && isVerificationUnlocked && (
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Share2 size={18} color={COLORS.accent} style={{ marginRight: 8 }} />
            <Text style={styles.shareButtonText}>Share Achievement</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Hidden Watermark Capture View */}
      {mediaUrl && (
        <View style={styles.hiddenWatermarkContainer} pointerEvents="none">
          <View 
            ref={watermarkRef} 
            style={[
              styles.watermarkCapture,
              { aspectRatio: (imageSize && imageSize.width > 0) ? imageSize.width / imageSize.height : 1 }
            ]}
          >
            <Image 
              source={{ uri: mediaUrl }} 
              style={styles.watermarkImage} 
              onLoad={() => setIsWatermarkImageLoaded(true)}
            />
            <Image 
              source={require('../../assets/Grounded_logo_removed_background.png')} 
              style={styles.watermarkLogo} 
              resizeMode="contain"
            />
            <View style={styles.watermarkTextOverlay}>
              <Text style={styles.watermarkTag}>#GROUNDED</Text>
              <Text style={styles.watermarkChallenge}>{challenge?.location}</Text>
            </View>
          </View>
        </View>
      )}
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
  backButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: FONT.md,
    color: COLORS.accent,
    fontWeight: FONT.semibold,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: FONT.lg,
    fontWeight: FONT.bold,
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
    gap: SPACING.lg,
  },
  statusIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: COLORS.bgElevated,
    padding: SPACING.xxl,
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  coordText: {
    fontSize: FONT.sm,
    color: COLORS.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  distanceText: {
    fontSize: FONT.md,
    fontWeight: FONT.bold,
    color: COLORS.accent,
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
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoText: {
    fontSize: FONT.md,
    fontWeight: FONT.bold,
    color: COLORS.textPrimary,
  },
  photoHint: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
    marginLeft: 'auto',
  },
  deleteNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  photoDeleteNote: {
    fontSize: FONT.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  captureButton: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.subtle,
  },
  captureText: {
    fontSize: FONT.md,
    fontWeight: FONT.bold,
    color: COLORS.accent,
  },
  captureButtonLocked: {
    borderColor: COLORS.border,
    opacity: 0.6,
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

  // Watermark hidden view styles
  hiddenWatermarkContainer: {
    position: 'absolute',
    left: -width * 2, // Off-screen but not 'hidden' from renderer
    top: 0,
    width: width,
    zIndex: 1, // Positive zIndex to ensure it's in the rendering stack
    opacity: 0.01, // Near invisible
  },
  watermarkCapture: {
    width: width,
    height: width * 1.33,
    backgroundColor: 'transparent', // Avoid black flash if capture starts early
    position: 'relative',
  },
  watermarkImage: {
    width: '100%',
    height: '100%',
  },
  watermarkLogo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 100,
    height: 40,
    opacity: 0.9,
  },
  watermarkTextOverlay: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'flex-end',
  },
  watermarkTag: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  watermarkChallenge: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
    marginTop: 2,
  },
});
