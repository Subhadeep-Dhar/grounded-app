// Grounded — Design System (Dark Theme)
// Single source of truth for all styling tokens

export const COLORS = {
  // Backgrounds
  bg: '#0A0A0F',
  bgCard: '#14141F',
  bgElevated: '#1C1C2E',
  bgInput: '#1A1A28',
  bgOverlay: 'rgba(0, 0, 0, 0.6)',

  // Accent (Emerald Green — brand)
  accent: '#10B981',
  accentLight: '#34D399',
  accentDark: '#059669',
  accentGlow: 'rgba(16, 185, 129, 0.15)',
  accentBorder: 'rgba(16, 185, 129, 0.3)',

  // Text
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#0A0A0F',

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.15)',
  error: '#EF4444',
  errorBg: 'rgba(239, 68, 68, 0.15)',
  info: '#3B82F6',
  infoBg: 'rgba(59, 130, 246, 0.15)',

  // Borders
  border: '#1E1E30',
  borderLight: '#2A2A3E',
  borderAccent: 'rgba(16, 185, 129, 0.4)',

  // Tab bar
  tabBar: '#0E0E16',
  tabInactive: '#64748B',
  tabActive: '#10B981',

  // Gradients (use as array for LinearGradient)
  gradientAccent: ['#10B981', '#059669'],
  gradientDark: ['#14141F', '#0A0A0F'],
  gradientCard: ['#1C1C2E', '#14141F'],
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  round: 999,
};

export const FONT = {
  // Sizes
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  hero: 40,

  // Weights
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

export const SHADOW = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  glow: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
};

// MIT Manipal boundary (bounding box for validation)
export const MIT_BOUNDARY = {
  center: { latitude: 13.3475, longitude: 74.7925 },
  latDelta: 0.015,
  lonDelta: 0.015,
  // Rough boundary corners
  north: 13.355,
  south: 13.340,
  east: 74.800,
  west: 74.785,
};

// Geofence radius in meters
export const GEOFENCE_RADIUS = 50;

// Stay duration in seconds
export const STAY_DURATION = 120;
