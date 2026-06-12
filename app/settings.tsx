import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Switch, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius } from '../utils/format';
import { getAppSettings, setAppSetting } from '../database';

interface SocialFields {
  instagram: string;
  twitter: string;
  ebay: string;
  website: string;
  custom1: string;
  custom2: string;
}

const FIELD_LABELS: Record<keyof SocialFields, { label: string; placeholder: string }> = {
  instagram:   { label: 'Instagram',    placeholder: '@username' },
  twitter:     { label: 'Twitter / X',  placeholder: '@username' },
  ebay:        { label: 'eBay Store',   placeholder: 'Store name or URL' },
  website:     { label: 'Website',      placeholder: 'https://yoursite.com' },
  custom1:     { label: 'Custom Link 1', placeholder: 'URL or handle' },
  custom2:     { label: 'Custom Link 2', placeholder: 'URL or handle' },
};

const KEY_MAP: Record<keyof SocialFields, string> = {
  instagram: 'social_instagram',
  twitter:   'social_twitter',
  ebay:      'social_ebay',
  website:   'social_website',
  custom1:   'social_custom1',
  custom2:   'social_custom2',
};

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<SocialFields>({
    instagram: '', twitter: '', ebay: '', website: '', custom1: '', custom2: '',
  });
  const [includeSocialsOnLabel, setIncludeSocialsOnLabel] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await getAppSettings();
      setFields({
        instagram: settings[KEY_MAP.instagram] || '',
        twitter:   settings[KEY_MAP.twitter] || '',
        ebay:      settings[KEY_MAP.ebay] || '',
        website:   settings[KEY_MAP.website] || '',
        custom1:   settings[KEY_MAP.custom1] || '',
        custom2:   settings[KEY_MAP.custom2] || '',
      });
      setIncludeSocialsOnLabel(settings['label_include_socials'] === '1');
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (key: keyof SocialFields, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [fieldKey, storageKey] of Object.entries(KEY_MAP)) {
        await setAppSetting(storageKey, fields[fieldKey as keyof SocialFields]);
      }
      await setAppSetting('label_include_socials', includeSocialsOnLabel ? '1' : '0');
      Alert.alert('✓ Saved', 'Settings updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = true; // We always allow save

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.header}>Settings</Text>
          <View style={styles.backBtn} />
        </View>

        {/* Social Handles Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌐 Social Handles</Text>
          <Text style={styles.sectionHint}>
            These appear on printed DataMatrix labels and optionally in shared inventory QR codes.
          </Text>

          {loading ? (
            <Text style={styles.loadingText}>Loading settings...</Text>
          ) : (
            (Object.keys(FIELD_LABELS) as (keyof SocialFields)[]).map(key => (
              <View key={key} style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>{FIELD_LABELS[key].label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={fields[key]}
                  onChangeText={(v) => handleFieldChange(key, v)}
                  placeholder={FIELD_LABELS[key].placeholder}
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ))
          )}
        </View>

        {/* Label Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🖨 Label Preferences</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>Include social handles on labels</Text>
              <Text style={styles.toggleHint}>Adds Instagram, Twitter, etc. to DataMatrix and print layout</Text>
            </View>
            <Switch
              value={includeSocialsOnLabel}
              onValueChange={setIncludeSocialsOnLabel}
              trackColor={{ false: Colors.border, true: Colors.accent + '66' }}
              thumbColor={includeSocialsOnLabel ? Colors.accent : Colors.textMuted}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.danger }]}>⚠️ Danger Zone</Text>
          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={() => {
              Alert.alert(
                'Reset All Settings',
                'This will clear all social handles and preferences. Continue?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                      for (const key of Object.values(KEY_MAP)) {
                        await setAppSetting(key, '');
                      }
                      await setAppSetting('label_include_socials', '0');
                      setFields({ instagram: '', twitter: '', ebay: '', website: '', custom1: '', custom2: '' });
                      setIncludeSocialsOnLabel(false);
                    },
                  },
                ]
              );
            }}
          >
            <Text style={styles.dangerBtnText}>Reset All Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Settings'}</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 60,
  },
  backText: {
    color: Colors.accentBlue,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  header: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  section: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    lineHeight: 16,
    marginBottom: Spacing.md,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  fieldWrapper: {
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  toggleText: {
    flex: 1,
  },
  toggleLabel: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  toggleHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: Colors.bg,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  dangerBtn: {
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.danger + '44',
    alignItems: 'center',
    backgroundColor: Colors.danger + '11',
  },
  dangerBtnText: {
    color: Colors.danger,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
