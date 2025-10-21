import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';

function CustomTopTabs() {
  const router = useRouter();
  const pathname = usePathname();
  
  const tabs = [
    { name: 'index', label: 'Home', icon: 'home' },
    { name: 'search', label: 'Search', icon: 'search' },
    { name: 'library', label: 'Library', icon: 'library' },
    { name: 'favorites', label: 'Favorites', icon: 'heart' },
    { name: 'profile', label: 'Profile', icon: 'person' },
    { name: 'admin', label: 'Admin', icon: 'settings' },
  ];
  
  const getIsActive = (tabName: string) => {
    if (tabName === 'index') return pathname === '/' || pathname === '/index';
    return pathname.includes(tabName);
  };
  
  return (
    <View style={styles.topTabBar}>
      {tabs.map((tab) => {
        const isActive = getIsActive(tab.name);
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.topTab}
            onPress={() => router.push(`/${tab.name === 'index' ? '' : tab.name}`)}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={20} 
              color={isActive ? '#10B981' : '#64748B'} 
            />
            <Text style={[styles.topTabLabel, isActive && styles.topTabLabelActive]}>
              {tab.label}
            </Text>
            {isActive && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A' }} edges={['top']}>
      <CustomTopTabs />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
