// Grounded — App Configuration (Discipline Integrity System v2)
// Single source of truth for all behavioral config.
// Adjust values here — do NOT hardcode elsewhere.

// ─── Session State Machine ────────────────────────────────────────────────────
export const SESSION_STATES = {
  NOT_STARTED: 'NOT_STARTED',
  TRAVELING: 'TRAVELING',
  ARRIVED_WAITING: 'ARRIVED_WAITING',
  VERIFICATION_UNLOCKED: 'VERIFICATION_UNLOCKED',
  SUBMITTED: 'SUBMITTED',
  EXPIRED: 'EXPIRED',
};

// ─── Time Windows (minutes from midnight, IST) ───────────────────────────────
// scoreMultiplier: multiplied against raw score
// trustMultiplier: multiplied against trust delta
// streakEligible: whether submission counts toward streak
export const TIME_WINDOWS = {
  primary: {
    start: 5 * 60,       // 05:00
    end: 7 * 60 + 30,    // 07:30
    label: 'Morning Window',
    scoreMultiplier: 1.0,
    trustMultiplier: 1.0,
    streakEligible: true,
  },
  late: {
    start: 18 * 60,      // 18:00
    end: 21 * 60,        // 21:00
    label: 'Evening Window',
    scoreMultiplier: 0.7,
    trustMultiplier: 0.5,
    streakEligible: true, // Counts toward streak, reduced trust gain
  },
};

// ─── Stay Duration ────────────────────────────────────────────────────────────
// IS_DEV: automatically true in Expo development builds
const IS_DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
export const STAY_DURATION = IS_DEV ? 15 : 120; // seconds (15s dev, 120s prod)
export const DEV_STAY_DURATION = 15;
export const PROD_STAY_DURATION = 120;

// ─── Scoring Weights ──────────────────────────────────────────────────────────
export const SCORING_CONFIG = {
  location: {
    perfect: 35,  // distance < 30m
    good: 25,     // distance < 100m
    ok: 10,       // distance < 200m
  },
  stay: {
    full: 30,     // >= STAY_DURATION
    partial: 15,  // >= STAY_DURATION / 2
  },
  proof: 15,      // photo uploaded
  integrity: 10,  // clean session (no mocked GPS flags)
  streak: {
    minForBonus: 3,    // minimum streak days to earn bonus
    perDay: 3,         // bonus points per streak day
    max: 15,           // cap on streak bonus
  },
};

// ─── Trust Score Config ───────────────────────────────────────────────────────
// Goal: ~10+ perfect primary-window days to reach rewardThreshold from 0
export const TRUST_CONFIG = {
  initial: 0,            // NEW users start at 0 (not 50)
  rewardThreshold: 60,   // threshold for "Trusted" status
  max: 100,
  min: 0,
  // Diminishing progression tiers (base gain for perfect primary-window submission)
  progressionTiers: [
    { threshold: 60, delta: 2 }, // 60-100: +2
    { threshold: 40, delta: 3 }, // 40-59: +3
    { threshold: 20, delta: 4 }, // 20-39: +4
    { threshold: 0, delta: 5 }   // 0-19: +5
  ],
  // Low-score penalty per submission
  lowScorePenalty: -3,
  // Missed-day penalty (only inside region)
  missedDayPenalty: -5,
  streakBreakPenalty: -2,
  missedDayPenaltyCap: -15, // max penalty per missed event
};

// ─── Streak Config ────────────────────────────────────────────────────────────
export const STREAK_CONFIG = {
  minForBonus: 3,  // minimum streak to earn trust bonus
  bonusPerDay: 1,  // additional trust per streak day (after multiplier)
};

// ─── Region Config (MIT Manipal campus geofence) ─────────────────────────────
export const REGION_CONFIG = {
  center: { latitude: 13.3475, longitude: 74.7925 },
  radiusMeters: 3000,         // 3km covers full MIT Manipal campus
  gracePeriodMs: 5 * 60 * 1000, // 5 min before freezing progression on exit
};

// ─── Notification Schedule (24h IST) ─────────────────────────────────────────
export const NOTIFICATION_SCHEDULE = {
  wakeUp: { hour: 4, minute: 45 },
  nudge: { hour: 6, minute: 0 },
  sleep: { hour: 22, minute: 0 },
};

// ─── Legacy compatibility exports ─────────────────────────────────────────────
// Keep these so no other existing file breaks without modification
export const TIME_CONFIG = {
  actionStart: TIME_WINDOWS.primary.start,
  actionEnd: TIME_WINDOWS.primary.end,
  submitEnd: TIME_WINDOWS.late.end,
};

// ─── Badge Definitions ────────────────────────────────────────────────────────
// Updated: 'trusted' badge now requires 60 (new threshold, not 80)
export const BADGES = [
  { id: 'first_step', name: 'First Step', desc: '1 completion', check: (u) => (u.totalCompletions || 0) >= 1 },
  { id: 'early_bird', name: 'Early Bird', desc: '3-day streak', check: (u) => (u.streakCount || 0) >= 3 },
  { id: 'consistent', name: 'Consistent', desc: '7-day streak', check: (u) => (u.streakCount || 0) >= 7 },
  { id: 'trusted', name: 'Trusted', desc: '60+ trust score', check: (u) => (u.trustScore || 0) >= 60 },
  { id: 'champion', name: 'Champion', desc: '30 completions', check: (u) => (u.totalCompletions || 0) >= 30 },
  { id: 'unstoppable', name: 'Unstoppable', desc: '14-day streak', check: (u) => (u.streakCount || 0) >= 14 },
];