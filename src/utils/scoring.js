import { SCORING_CONFIG, TRUST_CONFIG, STREAK_CONFIG, TIME_WINDOWS } from '../constants/config';

/**
 * Determine which time window the given minutes-from-midnight falls into.
 * Returns 'primary' | 'late' | null
 */
export const getTimeWindow = (minutesFromMidnight) => {
  const { primary, late } = TIME_WINDOWS;
  if (minutesFromMidnight >= primary.start && minutesFromMidnight <= primary.end) return 'primary';
  if (minutesFromMidnight >= late.start && minutesFromMidnight <= late.end) return 'late';
  return null;
};

/**
 * Returns true if submission is allowed at the given time.
 */
export const isSubmissionAllowed = (minutesFromMidnight) => {
  return getTimeWindow(minutesFromMidnight) !== null;
};

/**
 * Returns current minutes from midnight (local device clock).
 * Used for UI only — backend uses server timestamp.
 */
export const getCurrentMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

/**
 * Calculate raw session score.
 * @param {object} params
 * @param {number} params.distance - distance in meters from target
 * @param {number} params.stayTime - seconds stayed
 * @param {number} params.targetStayTime - required seconds
 * @param {boolean} params.hasMedia - photo uploaded
 * @param {number} params.streakCount - current streak
 * @param {boolean} params.isCleanSession - no mocked GPS flags
 * @param {'primary'|'late'} params.timeWindow - which time window
 * @returns {object} score breakdown
 */
export const calculateScore = ({
  distance,
  stayTime,
  targetStayTime,
  hasMedia,
  streakCount = 0,
  isCleanSession = true,
  timeWindow = 'primary',
}) => {
  const { location, stay, proof, integrity, streak } = SCORING_CONFIG;

  let locationScore = 0;
  if (distance < 30) locationScore = location.perfect;
  else if (distance < 100) locationScore = location.good;
  else if (distance < 200) locationScore = location.ok;

  let timeScore = 0;
  if (stayTime >= targetStayTime) timeScore = stay.full;
  else if (stayTime >= targetStayTime / 2) timeScore = stay.partial;

  const proofScore = hasMedia ? proof : 0;
  const integrityScore = isCleanSession ? integrity : 0;

  const rawStreakBonus =
    streakCount >= streak.minForBonus
      ? Math.min(streakCount * streak.perDay, streak.max)
      : 0;

  const rawTotal = locationScore + timeScore + proofScore + integrityScore + rawStreakBonus;

  // Apply window multiplier (late window = 0.7)
  const windowCfg = TIME_WINDOWS[timeWindow];
  const multiplier = windowCfg ? windowCfg.scoreMultiplier : 1.0;
  const totalScore = Math.min(100, Math.round(rawTotal * multiplier));

  return {
    score: totalScore,
    locationScore,
    timeScore,
    proofScore,
    integrityScore,
    streakBonus: rawStreakBonus,
    distance,
    timeWindow,
    isCleanSession,
  };
};

/**
 * Calculate trust score delta for a completed session.
 * Late window submissions get trustMultiplier applied.
 * @param {number} score - session score (0–100)
 * @param {number} currentTrust - current trust score
 * @param {number} streakCount - current streak
 * @param {'primary'|'late'} timeWindow
 * @param {boolean} isSuspicious - mocked GPS or other flag
 * @returns {number} delta to apply to trust score
 */
export const calculateTrustDelta = (score, currentTrust, streakCount, timeWindow = 'primary', isSuspicious = false) => {
  const { progressionTiers, lowScorePenalty } = TRUST_CONFIG;
  const windowCfg = TIME_WINDOWS[timeWindow];
  const trustMult = windowCfg ? windowCfg.trustMultiplier : 1.0;

  // Find tier delta
  const tier = progressionTiers.find(t => currentTrust >= t.threshold) || progressionTiers[progressionTiers.length - 1];
  const onTimeDelta = tier.delta;

  let delta = 0;

  if (score >= 70) {
    delta = onTimeDelta * trustMult;
  } else if (score >= 40) {
    delta = (onTimeDelta / 2) * trustMult;
  } else {
    delta = lowScorePenalty;                // no multiplier
  }

  // Streak consistency bonus (also reduced in late window)
  if (streakCount >= STREAK_CONFIG.minForBonus) {
    delta += STREAK_CONFIG.bonusPerDay * trustMult;
  }

  if (isSuspicious) delta -= 3;

  return parseFloat(delta.toFixed(2));
};

/**
 * Calculate penalty for missed days.
 * Only call this if user is INSIDE region.
 * @param {number} daysMissed - number of consecutive days missed
 * @returns {number} negative delta
 */
export const calculateMissedDayPenalty = (daysMissed) => {
  const { missedDayPenalty, streakBreakPenalty, missedDayPenaltyCap } = TRUST_CONFIG;
  const rawPenalty = daysMissed * missedDayPenalty + streakBreakPenalty;
  return Math.max(rawPenalty, missedDayPenaltyCap); // cap so one gap can't destroy score
};