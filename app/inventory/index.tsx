import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius } from '../../utils/format';
import { getAllCards, getDistinctSets, getDistinctRarities, Card, CardFilters } from '../../database';
import { CardRow } from '../../components/CardRow';
import { FilterBar } from '../../components/FilterBar';
import { CardRowSkeleton } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/EmptyState';

const CONDITIONS = ['Mint', 'Near Mint', 'Excellent', 'Good', 'Light Played', 'Played', 'Poor'];

export default function InventoryScreen() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sets, setSets] = useState<string[]>([]);
  const [rarities, setRarities] = useState<string[]>([]);
  const [filters, setFilters] = useState<CardFilters & { includeArchived?: boolean }>({
    search: '',
    set_name: undefined,
    rarity: undefined,
    condition: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    includeArchived: false,
  });

  const loadCards = useCallback(async (filterVals: typeof filters) => {
    try {
      const { includeArchived, ...rest } = filterVals;
      const apiFilters: CardFilters = { search: rest.search || undefined };
      if (rest.set_name) apiFilters.set_name = rest.set_name;
      if (rest.rarity) apiFilters.rarity = rest.rarity;
      if (rest.condition) apiFilters.condition = rest.condition;
      if (rest.minPrice !== undefined) apiFilters.minPrice = Number(rest.minPrice);
      if (rest.maxPrice !== undefined) apiFilters.maxPrice = Number(rest.maxPrice);
      if (includeArchived) apiFilters.includeArchived = true;

      const [cardList, setList, rarityList] = await Promise.all([
        getAllCards(apiFilters),
        getDistinctSets(),
        getDistinctRarities(),
      ]);
      setCards(cardList);
      setSets(setList);
      setRarities(rarityList);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load cards');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => { loadCards(filters); }, [filters])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadCards(filters);
  };

  const handleCardPress = (card: Card) => {
    router.push(`/inventory/${card.id}`);
  };

  const renderItem = ({ item }: { item: Card }) => (
    <View style={item.archived === 1 ? styles.archivedItem : undefined}>
      <CardRow card={item} onPress={item.archived === 1 ? () => {} : handleCardPress} />
      {item.archived === 1 && (
        <Text style={styles.archivedBadge}>Archived</Text>
      )}
    </View>
  );

  function ListHeader() {
    return (
      <View>
        <View style={styles.headerRow}>
          <Text style={styles.inventoryTitle}>Inventory</Text>
          <TouchableOpacity
            style={styles.registerChip}
            onPress={() => router.push('/register')}
          >
            <Text style={styles.registerChipText}>+ Register</Text>
          </TouchableOpacity>
        </View>
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          sets={sets}
          rarities={rarities}
          conditions={CONDITIONS}
          includeArchived={filters.includeArchived}
          onIncludeArchivedChange={(v) => setFilters(prev => ({ ...prev, includeArchived: v }))}
        />
      </View>
    );
  }

  if (error && cards.length === 0) {
    return (
      <View style={styles.container}>
        <ListHeader />
        <ErrorState message={error} onRetry={() => loadCards(filters)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={cards}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          loading ? (
            <View>
              {Array.from({ length: 8 }).map((_, i) => (
                <CardRowSkeleton key={i} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="📦"
              title="No cards found"
              subtitle="Scan a card or import a CSV to start building your inventory."
            />
          )
        }
        stickyHeaderIndices={[0]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      {/* Card count indicator */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {cards.length} card{cards.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  inventoryTitle: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  registerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.accent,
  },
  registerChipText: {
    color: Colors.bg,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 60,
  },
  countBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.bgCard,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  countText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  archivedBadge: {
    position: 'absolute',
    top: 10,
    right: 16,
    color: Colors.warning,
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.warning + '18',
    overflow: 'hidden',
  },
  archivedItem: {
    opacity: 0.6,
  },
});
