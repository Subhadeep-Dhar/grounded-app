/**
 * region.js — Manipal region validation service.
 * Pure geofence checks + Firestore status persistence.
 * No background polling — called on-demand from GPS updates.
 */
import { REGION_CONFIG } from '../constants/config';
import { getDistance } from '../utils/location';
import { db } from '../lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

/**
 * Check if given coordinates are inside the Manipal region.
 * Pure function — no side effects, safe to call frequently.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {boolean}
 */
export const isInsideRegion = (latitude, longitude) => {
  if (latitude == null || longitude == null) return false;
  const { center, radiusMeters } = REGION_CONFIG;
  const dist = getDistance(latitude, longitude, center.latitude, center.longitude);
  return dist <= radiusMeters;
};

/**
 * Get user's stored region status from Firestore.
 * @returns {'inside'|'outside'|'unknown'}
 */
export const getRegionStatus = async (userId) => {
  if (!userId) return 'unknown';
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.exists() ? (snap.data().regionStatus || 'unknown') : 'unknown';
  } catch (e) {
    console.warn('[Region] getRegionStatus error:', e);
    return 'unknown';
  }
};

/**
 * Persist region status update to Firestore.
 * Non-blocking — fires and forgets gracefully.
 * @param {string} userId
 * @param {'inside'|'outside'} status
 */
export const updateRegionStatus = async (userId, status) => {
  if (!userId) return;
  try {
    await updateDoc(doc(db, 'users', userId), {
      regionStatus: status,
      regionStatusUpdatedAt: Date.now(),
    });
  } catch (e) {
    console.warn('[Region] updateRegionStatus error:', e);
  }
};

/**
 * Evaluate region status from coordinates and update Firestore if changed.
 * Returns true if inside region, false if outside.
 * Call this from GPS update handler — NOT on a timer (battery efficient).
 * @param {string} userId
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} currentStatus - current cached status ('inside'|'outside'|'unknown')
 * @returns {{ isInside: boolean, changed: boolean, newStatus: string }}
 */
export const evaluateRegion = async (userId, latitude, longitude, currentStatus) => {
  const isInside = isInsideRegion(latitude, longitude);
  const newStatus = isInside ? 'inside' : 'outside';
  const changed = newStatus !== currentStatus;

  if (changed && userId) {
    // Fire-and-forget — don't block GPS callback
    updateRegionStatus(userId, newStatus).catch(() => {});
  }

  return { isInside, changed, newStatus };
};
