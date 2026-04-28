// Email validation
export const validateEmail = (email) => {
  if (!email || email.trim() === '') {
    return 'Email is required';
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  
  return null;
};

// Password validation
export const validatePassword = (password) => {
  if (!password || password === '') {
    return 'Password is required';
  }
  
  if (password.length < 6) {
    return 'Password must be at least 6 characters';
  }
  
  return null;
};

// Confirm password validation
export const validateConfirmPassword = (password, confirmPassword) => {
  if (!confirmPassword || confirmPassword === '') {
    return 'Please confirm your password';
  }
  
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  
  return null;
};

// Location validation
export const validateLocation = (location, target, radius) => {
  if (!location) {
    return 'Location not available';
  }
  
  const lat = location.latitude || location.coords?.latitude;
  const lon = location.longitude || location.coords?.longitude;
  
  if (lat === undefined || lon === undefined) {
    return 'Invalid location coordinates';
  }
  
  return null;
};

// Challenge completion validation
export const validateChallengeCompletion = (challenge, sessionState, stayTimer, mediaUrl) => {
  const errors = [];
  
  if (!challenge) {
    errors.push('No challenge loaded');
  }
  
  if (sessionState !== 'staying') {
    errors.push('You must arrive at the destination first');
  }
  
  if (stayTimer < 120) {
    errors.push(`You need to stay for ${Math.ceil((120 - stayTimer) / 60)} more minute(s)`);
  }
  
  if (!mediaUrl) {
    errors.push('Please capture a photo as proof');
  }
  
  return errors.length > 0 ? errors : null;
};