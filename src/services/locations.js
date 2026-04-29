import { db } from '../lib/firebase';
import { collection, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
import { GEOFENCE_RADIUS } from '../constants/theme';

// MIT Manipal workout locations
const MIT_LOCATIONS = [
  { id: 'football_ground', name: 'Football Ground', latitude: 13.34656, longitude: 74.79372, radius: GEOFENCE_RADIUS, active: true, capacity: 20 },
  { id: 'basketball_court', name: 'Basketball Court', latitude: 13.3470, longitude: 74.7930, radius: GEOFENCE_RADIUS, active: true, capacity: 15 },
  { id: 'library_area', name: 'Library Area', latitude: 13.3475, longitude: 74.7925, radius: GEOFENCE_RADIUS, active: true, capacity: 15 },
  { id: 'kmc_greens', name: 'KMC Greens', latitude: 13.3490, longitude: 74.7880, radius: GEOFENCE_RADIUS, active: true, capacity: 20 },
  { id: 'innovation_centre', name: 'Innovation Centre', latitude: 13.3465, longitude: 74.7915, radius: GEOFENCE_RADIUS, active: true, capacity: 15 },
  { id: 'student_plaza', name: 'Student Plaza', latitude: 13.3478, longitude: 74.7940, radius: GEOFENCE_RADIUS, active: true, capacity: 20 },
  { id: 'end_point', name: 'End Point', latitude: 13.3452, longitude: 74.7920, radius: GEOFENCE_RADIUS, active: true, capacity: 15 },
  { id: 'mit_gate', name: 'MIT Main Gate', latitude: 13.3500, longitude: 74.7935, radius: GEOFENCE_RADIUS, active: true, capacity: 15 },
  { id: 'swimming_pool', name: 'Swimming Pool Area', latitude: 13.3480, longitude: 74.7910, radius: GEOFENCE_RADIUS, active: true, capacity: 10 },
  { id: 'hostel_ground', name: 'Hostel Block Ground', latitude: 13.3460, longitude: 74.7945, radius: GEOFENCE_RADIUS, active: true, capacity: 20 },
];

/**
 * Fetch all active locations from Firestore.
 * Falls back to hardcoded MIT locations if Firestore collection is empty.
 */
export const getLocations = async () => {
  try {
    const q = query(collection(db, 'locations'), where('active', '==', true));
    const snap = await getDocs(q);

    if (snap.empty) {
      // Seed if empty and return fallback
      await seedLocations();
      return MIT_LOCATIONS;
    }

    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching locations:', error);
    return MIT_LOCATIONS; // Fallback
  }
};

/**
 * Load-balanced location assignment.
 * Picks the location with fewest current users today.
 */
export const assignLocation = async (userId) => {
  try {
    const locations = await getLocations();
    const today = new Date().toDateString();

    // Count how many users are assigned to each location today
    const challengesSnap = await getDocs(
      query(collection(db, 'challenges'), where('date', '==', today))
    );

    const locationCounts = {};
    locations.forEach(loc => { locationCounts[loc.id] = 0; });

    challengesSnap.forEach(doc => {
      const data = doc.data();
      if (data.locationId && locationCounts[data.locationId] !== undefined) {
        locationCounts[data.locationId]++;
      }
    });

    // Sort by usage (ascending) and pick the least-used one
    const sorted = locations
      .filter(loc => (locationCounts[loc.id] || 0) < loc.capacity)
      .sort((a, b) => (locationCounts[a.id] || 0) - (locationCounts[b.id] || 0));

    if (sorted.length === 0) {
      // All at capacity — pick random
      return locations[Math.floor(Math.random() * locations.length)];
    }

    // Pick from the least-used locations (top 3 to add variety)
    const topCandidates = sorted.slice(0, Math.min(3, sorted.length));
    return topCandidates[Math.floor(Math.random() * topCandidates.length)];
  } catch (error) {
    console.error('Error assigning location:', error);
    // Fallback to random
    const locations = MIT_LOCATIONS;
    return locations[Math.floor(Math.random() * locations.length)];
  }
};

/**
 * Seed MIT Manipal locations into Firestore.
 */
export const seedLocations = async () => {
  try {
    for (const loc of MIT_LOCATIONS) {
      await setDoc(doc(db, 'locations', loc.id), loc);
    }
    console.log('Seeded', MIT_LOCATIONS.length, 'locations');
  } catch (error) {
    console.error('Error seeding locations:', error);
  }
};
