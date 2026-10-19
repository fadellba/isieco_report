import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { NouveauSignalementScreen } from '../screens/citoyen/NouveauSignalementScreen.js';
import { MesSignalementsScreen } from '../screens/citoyen/MesSignalementsScreen.js';
import { PointsCitoyenScreen } from '../screens/citoyen/PointsCitoyenScreen.js';
import { NotificationsScreen } from '../screens/citoyen/NotificationsScreen.js';
import { ProfileScreen } from '../screens/common/ProfileScreen.js';

const Tab = createBottomTabNavigator();

export const CitoyenNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '800', color: '#0f172a' },
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="NouveauSignalement"
        component={NouveauSignalementScreen}
        options={{
          title: 'Signaler',
          tabBarLabel: 'Signaler',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📢</Text>,
        }}
      />
      <Tab.Screen
        name="MesSignalements"
        component={MesSignalementsScreen}
        options={{
          title: 'Mes Signalements',
          tabBarLabel: 'Suivi',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📋</Text>,
        }}
      />
      <Tab.Screen
        name="PointsCitoyen"
        component={PointsCitoyenScreen}
        options={{
          title: 'Mes Points',
          tabBarLabel: 'Points',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🏆</Text>,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          tabBarLabel: 'Alertes',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🔔</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Mon Profil',
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
};
