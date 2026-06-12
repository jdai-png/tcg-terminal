import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Platform,
} from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../utils/format';

export interface ResultBannerData {
  type: 'success' | 'partial' | 'error';
  title: string;
  message: string;
  details?: string[];
}

interface Props {
  data: ResultBannerData | null;
  onDismiss: () => void;
  onTap?: () => void;
  autoDismissMs?: number;
}

export function ResultBanner({ data, onDismiss, onTap, autoDismissMs = 8000 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-60)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data) {
      // Animate in
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();

      // Auto-dismiss
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        dismiss();
      }, autoDismissMs);
    } else {
      opacity.setValue(0);
      translateY.setValue(-60);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -60, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  if (!data) return null;

  const isSuccess = data.type === 'success';
  const isPartial = data.type === 'partial';
  const isError = data.type === 'error';

  const bgColor = isSuccess ? Colors.success + '22' : isPartial ? Colors.warning + '22' : Colors.danger + '22';
  const borderColor = isSuccess ? Colors.success : isPartial ? Colors.warning : Colors.danger;
  const icon = isSuccess ? '✅' : isPartial ? '⚠️' : '❌';

  return (
    <Animated.View style={[
      styles.banner,
      { backgroundColor: bgColor, borderColor, opacity, transform: [{ translateY }] },
    ]}>
      <TouchableOpacity style={styles.content} onPress={onTap || dismiss} activeOpacity={0.8}>
        <View style={styles.headerRow}>
          <Text style={styles.icon}>{icon}</Text>
          <View style={styles.textBlock}>
            <Text style={[styles.title, { color: borderColor }]}>{data.title}</Text>
            <Text style={styles.message}>{data.message}</Text>
            {data.details && data.details.length > 0 && (
              <View style={styles.detailsBlock}>
                {data.details.map((d, i) => (
                  <Text key={i} style={styles.detailText}>{d}</Text>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity onPress={dismiss} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : Spacing.lg,
    left: Spacing.md,
    right: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  content: {
    padding: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  icon: {
    fontSize: 20,
    marginTop: 2,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  message: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
    lineHeight: 18,
  },
  detailsBlock: {
    marginTop: Spacing.xs,
  },
  detailText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  closeBtn: {
    padding: 4,
    marginTop: -2,
  },
  closeText: {
    color: Colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
});
