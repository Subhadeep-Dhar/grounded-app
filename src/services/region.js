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
 * Handles Grace Period state machine to prevent GPS jitter from instantly freezing progression.
 * Returns { isInside, changed, newStatus }
 * 
 * @param {string} userId
 * @param {number} latitude
 * @param {number} longitude
 * @param {object} userData - the full user document data (for currentStatus and lastExitTime)
 */
export const evaluateRegion = async (userId, latitude, longitude, userData = {}) => {
  const isInside = isInsideRegion(latitude, longitude);
  const currentStatus = userData.regionStatus || 'inside';
  const lastExitTime = userData.lastExitTime || null;
  const { gracePeriodMs } = REGION_CONFIG;

  let newStatus = currentStatus;
  let newExitTime = lastExitTime;
  let changed = false;

  if (isInside) {
    if (currentStatus === 'outside' || lastExitTime !== null) {
      newStatus = 'inside';
      newExitTime = null;
      changed = true;
      console.log('[Region] Returned inside region. Restoring state.');
    }
  } else {
    // We are currently measured as Outside
    if (currentStatus === 'inside') {
      if (!lastExitTime) {
        // First exit measurement: start the grace period
        newExitTime = Date.now();
        changed = true;
        console.log('[Region] First exit detected. Starting grace period.');
      } else if (Date.now() - lastExitTime > gracePeriodMs) {
        // Grace period expired: transition fully to outside
        newStatus = 'outside';
        changed = true;
        console.log('[Region] Grace period expired. Transitioning to OUTSIDE.');
      }
    }
  }

  // Handle stale-region-state protection (always update timestamp if check succeeds)
  // We avoid high frequency writes by only writing if state changed OR if the last update was very old (e.g. > 1 day)
  const lastUpdate = userData.regionStatusUpdatedAt || 0;
  const isStale = Date.now() - lastUpdate > 24 * 60 * 60 * 1000;

  if ((changed || isStale) && userId) {
    try {
      await updateDoc(doc(db, 'users', userId), {
        regionStatus: newStatus,
        lastExitTime: newExitTime,
        regionStatusUpdatedAt: Date.now(),
      });
    } catch (e) {
      console.warn('[Region] Error persisting state:', e);
    }
  }

  return { isInside, changed: newStatus !== currentStatus, newStatus };
};
