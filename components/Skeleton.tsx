import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Colors, BorderRadius } from '../utils/format';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = BorderRadius.sm, style }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as any, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function CardRowSkeleton() {
  return (
    <View style={styles.cardRow}>
      <Skeleton width={120} height={16} />
      <View style={styles.cardRowMeta}>
        <Skeleton width={70} height={12} />
        <Skeleton width={60} height={12} />
      </View>
      <Skeleton width={50} height={16} />
    </View>
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.dashboard}>
      <Skeleton width={180} height={36} borderRadius={BorderRadius.md} />
      <Skeleton width={140} height={18} style={{ marginTop: 8 }} />
      <View style={styles.statRow}>
        <Skeleton width="45%" height={80} borderRadius={BorderRadius.lg} />
        <Skeleton width="45%" height={80} borderRadius={BorderRadius.lg} />
      </View>
      <Skeleton width="100%" height={160} borderRadius={BorderRadius.lg} style={{ marginTop: 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.bgInput,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  cardRowMeta: {
    flex: 1,
    gap: 4,
  },
  dashboard: {
    padding: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
});
