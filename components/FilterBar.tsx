import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../utils/format';

export type FilterValues = {
  search: string;
  set_name: string;
  rarity: string;
  condition: string;
  minPrice: string;
  maxPrice: string;
};

interface FilterBarProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  sets: string[];
  rarities: string[];
  conditions: string[];
}

export function FilterBar({ filters, onFiltersChange, sets, rarities, conditions }: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = filters.set_name || filters.rarity || filters.condition || filters.minPrice || filters.maxPrice;

  const updateFilter = (key: keyof FilterValues, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({ search: '', set_name: '', rarity: '', condition: '', minPrice: '', maxPrice: '' });
  };

  const FilterChip = ({ label, value, options, filterKey }: {
    label: string; value: string; options: string[]; filterKey: keyof FilterValues;
  }) => (
    <View style={cStyles.filterGroup}>
      <Text style={cStyles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={cStyles.chipScroll}>
        <TouchableOpacity
          style={[cStyles.chip, !value && cStyles.chipActive]}
          onPress={() => updateFilter(filterKey, '')}
        >
          <Text style={[cStyles.chipText, !value && cStyles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[cStyles.chip, value === opt && cStyles.chipActive]}
            onPress={() => updateFilter(filterKey, value === opt ? '' : opt)}
          >
            <Text style={[cStyles.chipText, value === opt && cStyles.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={cStyles.container}>
      {/* Search */}
      <View style={cStyles.searchRow}>
        <TextInput
          style={cStyles.searchInput}
          placeholder="Search cards, sets, numbers..."
          placeholderTextColor={Colors.textMuted}
          value={filters.search}
          onChangeText={v => updateFilter('search', v)}
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[cStyles.filterToggle, hasActiveFilters && cStyles.filterToggleActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={[cStyles.filterToggleText, hasActiveFilters && cStyles.filterToggleTextActive]}>
            {hasActiveFilters ? '⚡' : '☰'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Expanded filters */}
      {showFilters && (
        <View style={cStyles.filtersPanel}>
          <FilterChip label="Set" value={filters.set_name} options={sets} filterKey="set_name" />
          <FilterChip label="Rarity" value={filters.rarity} options={rarities} filterKey="rarity" />
          <FilterChip label="Condition" value={filters.condition} options={conditions} filterKey="condition" />

          <View style={cStyles.filterGroup}>
            <Text style={cStyles.filterLabel}>Price Range</Text>
            <View style={cStyles.priceRow}>
              <TextInput
                style={cStyles.priceInput}
                placeholder="Min $"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                value={filters.minPrice}
                onChangeText={v => updateFilter('minPrice', v)}
              />
              <Text style={cStyles.priceSep}>–</Text>
              <TextInput
                style={cStyles.priceInput}
                placeholder="Max $"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                value={filters.maxPrice}
                onChangeText={v => updateFilter('maxPrice', v)}
              />
            </View>
          </View>

          {hasActiveFilters && (
            <TouchableOpacity style={cStyles.clearBtn} onPress={clearFilters}>
              <Text style={cStyles.clearBtnText}>Clear All Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const cStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterToggle: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterToggleActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  filterToggleText: {
    fontSize: 18,
    color: Colors.textSecondary,
  },
  filterToggleTextActive: {
    color: Colors.accent,
  },
  filtersPanel: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  filterGroup: {
    marginTop: Spacing.sm,
  },
  filterLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: Colors.accentGlow,
    borderColor: Colors.accent,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  priceInput: {
    flex: 1,
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.text,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  priceSep: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  clearBtn: {
    marginTop: Spacing.md,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  clearBtnText: {
    color: Colors.danger,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
