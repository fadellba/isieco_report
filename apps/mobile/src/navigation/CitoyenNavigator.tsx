import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext.js';

import { NouveauSignalementScreen } from '../screens/citoyen/NouveauSignalementScreen.js';
import { MesSignalementsScreen } from '../screens/citoyen/MesSignalementsScreen.js';
import { PointsCitoyenScreen } from '../screens/citoyen/PointsCitoyenScreen.js';
import { NotificationsScreen } from '../screens/citoyen/NotificationsScreen.js';
import { ProfileScreen } from '../screens/common/ProfileScreen.js';

const Tab = createBottomTabNavigator();

export const CitoyenNavigator: React.FC = () => {
  const { colors, theme } = useTheme();

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
        name="NouveauSignalement"
        component={NouveauSignalementScreen}
        options={{
          title: 'Signaler un Dépôt',
          tabBarLabel: 'Signaler',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <Feather name="plus-circle" size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="MesSignalements"
        component={MesSignalementsScreen}
        options={{
          title: 'Mes Observations',
          tabBarLabel: 'Suivi',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <Feather name="list" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="PointsCitoyen"
        component={PointsCitoyenScreen}
        options={{
          title: 'Éco-Points & Rang',
          tabBarLabel: 'Points',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <Feather name="award" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Alertes Salubrité',
          tabBarLabel: 'Alertes',
          tabBarIcon: ({ color, size, focused }) => (
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
          title: 'Mon Espace Citoyen',
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color, size, focused }) => (
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
