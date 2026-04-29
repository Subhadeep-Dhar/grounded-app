// Grounded — App Configuration

// Challenge time windows (IST)
export const TIME_CONFIG = {
  actionStart: 5 * 60,       // 5:00 AM
  actionEnd: 7 * 60,         // 7:00 AM
  submitEnd: 23 * 60 + 59,   // 11:59 PM (relaxed for testing — tighten for prod)
};

// Notification schedule (hours in 24h format)
export const NOTIFICATION_SCHEDULE = {
  wakeUp: { hour: 4, minute: 45 },
  nudge: { hour: 6, minute: 0 },
  sleep: { hour: 22, minute: 0 },
};

// Scoring weights
export const SCORING = {
  timeWeight: 25,
  locationWeight: 35,
  mediaWeight: 40,
  streakBonus: 5,           // per streak day
  maxStreakBonus: 20,
};

// Trust score config
export const TRUST_CONFIG = {
  initial: 50,
  approvedDelta: 2,
  flaggedDelta: -1,
  rejectedDelta: -3,
  min: 0,
  max: 100,
};

// Badge definitions
export const BADGES = [
  { id: 'early_bird', emoji: '🌅', name: 'Early Bird', desc: '3-day streak', check: (u) => (u.streakCount || 0) >= 3 },
  { id: 'consistent', emoji: '💪', name: 'Consistent', desc: '7-day streak', check: (u) => (u.streakCount || 0) >= 7 },
  { id: 'first_step', emoji: '🎯', name: 'Dedicated', desc: '5 completions', check: (u) => (u.totalCompletions || 0) >= 5 },
  { id: 'trusted', emoji: '⭐', name: 'Trusted', desc: '80+ trust score', check: (u) => (u.trustScore || 0) >= 80 },
  { id: 'champion', emoji: '🏆', name: 'Champion', desc: '30 completions', check: (u) => (u.totalCompletions || 0) >= 30 },
  { id: 'unstoppable', emoji: '🔥', name: 'Unstoppable', desc: '14-day streak', check: (u) => (u.streakCount || 0) >= 14 },
];