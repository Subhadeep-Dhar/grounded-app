import { Tabs, Redirect } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS, FONT } from '../../src/constants/theme';
import { useEffect } from 'react';
import * as Location from 'expo-location';
import { db } from '../../src/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { evaluateRegion } from '../../src/services/region';
import { pauseNotifications, resumeNotifications } from '../../src/services/notifications';

function TabIcon({ emoji, label, focused }) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiActive]}>{emoji}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
      {focused && <View style={styles.activeIndicator} />}
    </View>
  );
}

export default function TabLayout() {
  const { user, loading } = useAuthStore();

  // Lightweight single-shot region check on launch
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const checkRegionOnLaunch = async () => {
      try {
        // Handle location permission failures gracefully
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return; // fail gracefully, avoid false freeze

        // Balanced accuracy: fast enough without GPS jitter
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, maximumAge: 60000 });
        if (!isMounted) return;

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const { newStatus, changed } = await evaluateRegion(user.uid, loc.coords.latitude, loc.coords.longitude, userDoc.data());
          // Only trigger notification system if status changed to avoid redundant scheduling
          if (changed) {
            if (newStatus === 'inside') {
              resumeNotifications().catch(() => {});
            } else {
              pauseNotifications().catch(() => {});
            }
          }
        }
      } catch (e) {
        console.warn('[Layout] Silent region check failed:', e);
      }
    };

    checkRegionOnLaunch();

    return () => { isMounted = false; };
  }, [user]);

  if (!loading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.tabInactive,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="challenge"
        options={{
          title: 'Challenge',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🎯" label="Challenge" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📋" label="Feed" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏆" label="Leaders" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👤" label="Profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.tabBar,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  tabEmoji: {
    fontSize: 22,
    opacity: 0.5,
  },
  tabEmojiActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: FONT.xs,
    fontWeight: FONT.medium,
    color: COLORS.tabInactive,
    marginTop: 2,
  },
  tabLabelActive: {
    color: COLORS.tabActive,
    fontWeight: FONT.semibold,
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
    marginTop: 4,
  },
});
