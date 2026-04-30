export const calculateScore = ({ 
  distance, 
  stayTime, 
  targetStayTime, 
  hasMedia, 
  streakCount = 0,
  isCleanSession = true 
}) => {
  let locationScore = 0;
  if (distance < 50) locationScore = 30;
  else if (distance < 100) locationScore = 20;

  let timeScore = 0;
  if (stayTime >= targetStayTime) timeScore = 25;
  else if (stayTime >= targetStayTime / 2) timeScore = 10;

  const proofScore = hasMedia ? 15 : 0;
  const integrityScore = isCleanSession ? 10 : 0;
  const streakBonus = streakCount >= 3 ? 5 : 0;

  const totalScore = locationScore + timeScore + proofScore + integrityScore + streakBonus;

  return {
    score: Math.min(100, totalScore),
    locationScore,
    timeScore,
    proofScore,
    integrityScore,
    streakBonus,
    distance,
  };
};

/**
 * Calculate the change in trust score based on session performance.
 */
export const calculateTrustDelta = (score, streakCount, isSuspicious = false) => {
  let delta = 0;
  
  if (score >= 70) {
    delta = score * 0.1; // score 80 -> +8
  } else if (score >= 40) {
    delta = score * 0.05; // score 50 -> +2.5
  } else {
    delta = -5; // Penalty for low score
  }

  // Bonus for consistency
  if (streakCount >= 3) delta += 2;
  
  // Penalty for suspicious activity
  if (isSuspicious) delta -= 3;

  return delta;
};