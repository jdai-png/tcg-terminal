import { useEffect, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors, FontSize, Spacing } from '../utils/format';
import { DexColors, DexText } from '../utils/pokedex-theme';
import { seedIfEmpty, getDatabase } from '../database';

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    async function init() {
      await getDatabase();
      await seedIfEmpty();
      setDbReady(true);
    }
    init();
  }, []);

  if (!dbReady) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Initializing TCG Terminal...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: DexColors.holoCyan,
          tabBarInactiveTintColor: DexColors.frameBevel,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'DASH',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>◈</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="inventory/index"
          options={{
            title: 'INV',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>▣</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="scanner"
          options={{
            title: 'SCAN',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: 22, fontWeight: '900' }}>◎</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="sales/index"
          options={{
            title: 'SALES',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>◆</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="logistics"
          options={{
            title: 'LOG',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>⬢</Text>
            ),
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  tabBar: {
    backgroundColor: DexColors.frame,
    borderTopColor: DexColors.frameBevel,
    borderTopWidth: 5,
    height: Platform.OS === 'ios' ? 92 : 68,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    paddingTop: 10,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: DexText.tabLabel,
});
