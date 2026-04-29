import { SCORING } from '../constants/config';

export const calculateScore = ({ timeOk, locationOk, hasMedia, streakCount = 0 }) => {
  let score = 0;

  if (timeOk) score += SCORING.timeWeight;
  if (locationOk) score += SCORING.locationWeight;
  if (hasMedia) score += SCORING.mediaWeight;

  // Streak bonus
  const streakBonus = Math.min(streakCount * SCORING.streakBonus, SCORING.maxStreakBonus);
  score += streakBonus;

  // Cap at 100
  return Math.min(100, score);
};