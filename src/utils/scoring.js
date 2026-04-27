export const calculateScore = ({ timeOk, locationOk, hasMedia }) => {
  let score = 0;

  if (timeOk) score += 25;
  if (locationOk) score += 35;
  if (hasMedia) score += 40;

  return score; // out of 100
};