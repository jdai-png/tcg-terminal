import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius, formatCurrency, truncateText } from '../utils/format';
import { Card } from '../database';

interface CardRowProps {
  card: Card;
  onPress: (card: Card) => void;
}

export function CardRow({ card, onPress }: CardRowProps) {
  const conditionColor = Colors.condition[card.condition as keyof typeof Colors.condition] || Colors.textSecondary;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(card)}
      activeOpacity={0.6}
    >
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={1}>
          {truncateText(card.name, 30)}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.setName} numberOfLines={1}>
            {card.set_name}
          </Text>
          {card.card_number && (
            <Text style={styles.cardNumber}>#{card.card_number}</Text>
          )}
        </View>
      </View>
      <View style={styles.right}>
        <View style={[styles.conditionBadge, { borderColor: conditionColor }]}>
          <View style={[styles.conditionDot, { backgroundColor: conditionColor }]} />
          <Text style={[styles.conditionText, { color: conditionColor }]}>
            {card.condition}
          </Text>
        </View>
        <Text style={styles.price}>{formatCurrency(card.price_paid)}</Text>
        {card.quantity > 1 && (
          <Text style={styles.quantity}>×{card.quantity}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  left: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  setName: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  cardNumber: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  conditionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  conditionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  conditionText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  price: {
    color: Colors.accent,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  quantity: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
});
