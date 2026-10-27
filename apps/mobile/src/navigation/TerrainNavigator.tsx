import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext.js';

import { MissionsTerrainScreen } from '../screens/terrain/MissionsTerrainScreen.js';
import { CompteRenduScreen } from '../screens/terrain/CompteRenduScreen.js';
import { NotificationsScreen } from '../screens/citoyen/NotificationsScreen.js';
import { ProfileScreen } from '../screens/common/ProfileScreen.js';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MissionsStack: React.FC = () => {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 16,
          color: colors.textPrimary,
        },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="MissionsList"
        component={MissionsTerrainScreen}
        options={{ title: 'Missions Terrain Dakar' }}
      />
      <Stack.Screen
        name="CompteRendu"
        component={CompteRenduScreen}
        options={{ title: 'Clôture & Preuve' }}
      />
    </Stack.Navigator>
  );
};

export const TerrainNavigator: React.FC = () => {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 16,
          color: colors.textPrimary,
        },
        headerTintColor: colors.primary,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 84 : 68,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 8,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="MissionsTab"
        component={MissionsStack}
        options={{
          headerShown: false,
          tabBarLabel: 'Missions',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <Feather name="truck" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Alertes Communales',
          tabBarLabel: 'Alertes',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <Feather name="bell" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profil Agent',
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <Feather name="user" size={20} color={color} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  activeIconContainer: {
    transform: [{ scale: 1.05 }],
  },
});
