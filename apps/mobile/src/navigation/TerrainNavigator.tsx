import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import { MissionsTerrainScreen } from '../screens/terrain/MissionsTerrainScreen.js';
import { CompteRenduScreen } from '../screens/terrain/CompteRenduScreen.js';
import { NotificationsScreen } from '../screens/citoyen/NotificationsScreen.js';
import { ProfileScreen } from '../screens/common/ProfileScreen.js';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MissionsStack: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '800', color: '#0f172a' },
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
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '800', color: '#0f172a' },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="MissionsTab"
        component={MissionsStack}
        options={{
          headerShown: false,
          tabBarLabel: 'Missions',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🚛</Text>,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Alertes Communales',
          tabBarLabel: 'Alertes',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🔔</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profil Agent',
          tabBarLabel: 'Profil',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
};
