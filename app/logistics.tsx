import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors, FontSize, Spacing, BorderRadius, formatDate } from '../utils/format';
import {
  getOperationHistory, OperationLog, getCardCount, resetDatabase,
} from '../database';
import {
  generateCsvTemplate, exportCardsToCsv, getExportCsvContent, shareCsvFile, importCsvContent, ImportResult,
} from '../utils/csv';
import { ErrorState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { ResultBanner, ResultBannerData } from '../components/ResultBanner';
import { ShareInventoryModal } from '../components/ShareInventoryModal';

export default function LogisticsScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cardCount, setCardCountState] = useState(0);
  const [importProgress, setImportProgress] = useState<string | null>(null);

  // Result banner state
  const [banner, setBanner] = useState<ResultBannerData | null>(null);

  // Import error detail modal
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalData, setErrorModalData] = useState<{ title: string; summary: string; errors: string[] } | null>(null);

  // Import preview
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [previewSyncMode, setPreviewSyncMode] = useState(false);
  const [previewData, setPreviewData] = useState<{ rows: number; replaceMode: boolean; fileName: string; content: string } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [ops, count] = await Promise.all([getOperationHistory(), getCardCount()]);
      setHistory(ops);
      setCardCountState(count);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Helper to show result banner ──

  const showBanner = (type: ResultBannerData['type'], title: string, message: string, details?: string[]) => {
    setBanner({ type, title, message, details });
  };

  // ── Import (with preview) ──

  const handleImport = async (replaceExisting: boolean = false) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];

      // Read file content — web uses native File API, native uses FileSystem
      let content: string;
      if (Platform.OS === 'web' && (file as any).file) {
        const webFile = (file as any).file as File;
        content = await webFile.text();
      } else {
        content = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      if (!content || content.trim().length === 0) {
        showBanner('error', 'Empty File', 'The selected file appears to be empty.');
        return;
      }

      // Show preview if not in replace mode (let user decide)
      if (!replaceExisting) {
        setPreviewData({
          rows: 0,
          replaceMode: replaceExisting,
          fileName: file.name,
          content,
        });
        setPreviewSyncMode(false);
        setShowImportPreview(true);
        return;
      }

      // Direct replace mode
      await performImport(content, file.name, replaceExisting);
    } catch (err: any) {
      showBanner('error', 'Import Error', err.message || 'Failed to read file');
    }
  };

  const performImport = async (content: string, fileName: string, replaceExisting: boolean) => {
    const syncMode = previewSyncMode;
    setImporting(true);
    setImportProgress(replaceExisting ? 'Replacing & importing...' : syncMode ? 'Syncing inventory...' : 'Parsing CSV...');
    setShowImportPreview(false);

    try {
      const importResult: ImportResult = await importCsvContent(content, fileName, replaceExisting, syncMode);

      setImporting(false);
      setImportProgress(null);

      // Build rich feedback
      const parts: string[] = [];
      if (importResult.added > 0) parts.push(`${importResult.added} added`);
      if (importResult.updated > 0) parts.push(`${importResult.updated} updated`);
      if (importResult.removed > 0) parts.push(`${importResult.removed} removed`);
      const successSummary = parts.join(', ') || '0 cards processed';

      const details: string[] = [];
      if (importResult.added > 0) details.push(`• ${importResult.added} new cards inserted`);
      if (importResult.updated > 0) details.push(`• ${importResult.updated} existing cards updated`);
      if (importResult.removed > 0) details.push(`• ${importResult.removed} cards not in CSV removed`);

      const hasFailures = importResult.failed > 0 || importResult.errors.length > 0;

      if (hasFailures) {
        // Store errors for the detail modal
        setErrorModalData({
          title: `Import Errors — ${fileName}`,
          summary: `${successSummary} · ${importResult.failed} failed`,
          errors: importResult.errors,
        });
        setShowErrorModal(true);
      }

      if (importResult.failed > 0 && importResult.added + importResult.updated === 0) {
        showBanner(
          'error',
          'Import Failed',
          `0 cards imported · ${importResult.failed} row(s) failed. Tap for details.`,
          details
        );
      } else if (hasFailures) {
        showBanner(
          'partial',
          'Import Complete (with issues)',
          `${successSummary} · ${importResult.failed} row(s) failed. Tap for details.`,
          details
        );
      } else {
        showBanner('success', 'Import Successful', `${successSummary} from ${fileName}`, details);
        setErrorModalData(null);
        setShowErrorModal(false);
      }

      loadData();
    } catch (err: any) {
      setImporting(false);
      setImportProgress(null);
      showBanner('error', 'Import Failed', err.message || 'An unexpected error occurred');
    }
  };

  const confirmReplaceImport = () => {
    Alert.alert(
      'Replace All Cards?',
      'This will DELETE all existing cards and replace them with the contents of your CSV file. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace All',
          style: 'destructive',
          onPress: () => handleImport(true),
        },
      ]
    );
  };

  // ── Export ──

  const handleExport = async () => {
    try {
      setExporting(true);
      let exportedCount = 0;

      if (Platform.OS === 'web') {
        const csv = await getExportCsvContent();
        // Count rows minus header
        exportedCount = csv.split('\n').filter(l => l.trim()).length - 1;
        const fileName = `tcg_export_${new Date().toISOString().slice(0, 10)}.csv`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const filePath = await exportCardsToCsv();
        // Get count from DB
        exportedCount = cardCount;
        await shareCsvFile(filePath);
      }

      setExporting(false);
      showBanner(
        'success',
        'Export Complete',
        `${exportedCount} card${exportedCount !== 1 ? 's' : ''} exported to CSV`,
        [`File includes IDs, data matrices, price targets, and tags for full inventory management.`]
      );
      loadData();
    } catch (err: any) {
      setExporting(false);
      showBanner('error', 'Export Error', err.message || 'Failed to export');
    }
  };

  // ── Template download ──

  const handleDownloadTemplate = async () => {
    try {
      const csv = generateCsvTemplate();
      const fileName = 'tcg_card_template.csv';

      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await shareCsvFile(filePath);
      }
      showBanner('success', 'Template Downloaded', 'CSV template with all available fields.');
    } catch (err: any) {
      showBanner('error', 'Error', err.message || 'Failed to download template');
    }
  };

  // ── Clear All ──

  const handleClearAll = () => {
    Alert.alert(
      '⚠️ Clear All Inventory',
      `This will permanently delete all ${cardCount} cards and operation history. This cannot be undone.\n\nConsider exporting a backup first.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export & Clear',
          onPress: async () => {
            try {
              if (Platform.OS === 'web') {
                const csv = await getExportCsvContent();
                const fileName = `tcg_backup_${new Date().toISOString().slice(0, 10)}.csv`;
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              } else {
                const filePath = await exportCardsToCsv();
                await shareCsvFile(filePath);
              }
              Alert.alert(
                'Backup Saved',
                'CSV backup exported. Delete all cards now?',
                [
                  { text: 'Keep Cards', style: 'cancel' },
                  {
                    text: 'Delete All',
                    style: 'destructive',
                    onPress: async () => {
                      await resetDatabase();
                      showBanner('success', 'Inventory Cleared', 'All cards and history have been deleted.');
                      loadData();
                    },
                  },
                ]
              );
            } catch {
              Alert.alert(
                'Export Failed',
                'Could not create backup. Delete anyway?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete Without Backup',
                    style: 'destructive',
                    onPress: async () => {
                      await resetDatabase();
                      showBanner('success', 'Inventory Cleared', 'All cards and history have been deleted.');
                      loadData();
                    },
                  },
                ]
              );
            }
          },
        },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await resetDatabase();
            showBanner('success', 'Inventory Cleared', 'All cards and history have been deleted.');
            loadData();
          },
        },
      ]
    );
  };

  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <View style={{ flex: 1 }}>
      {/* Result Banner (positioned absolute over the content) */}
      <ResultBanner
        data={banner}
        onDismiss={() => { setBanner(null); }}
        onTap={() => {
          if (errorModalData && errorModalData.errors.length > 0) {
            setBanner(null);
            setShowErrorModal(true);
          }
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.header}>Logistics</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => setShowShareModal(true)}
            >
              <Text style={styles.settingsBtnText}>📱</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => router.push('/settings')}
            >
              <Text style={styles.settingsBtnText}>⚙</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {cardCount} card{cardCount !== 1 ? 's' : ''} · Import, export & batch update
        </Text>

        {/* ── Primary Actions ── */}
        <View style={styles.heroSection}>
          {/* Import */}
          <TouchableOpacity
            style={[styles.heroBtn, styles.heroBtnPrimary]}
            onPress={() => handleImport(false)}
            disabled={importing}
            activeOpacity={0.7}
          >
            <View style={styles.heroBtnContent}>
              {importing ? (
                <View style={styles.importProgress}>
                  <ActivityIndicator color={Colors.bg} />
                  <Text style={styles.importProgressText}>{importProgress}</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.heroIcon}>📥</Text>
                  <View style={styles.heroTextGroup}>
                    <Text style={styles.heroBtnTitle}>Import CSV</Text>
                    <Text style={styles.heroBtnHint}>Upsert cards from file</Text>
                  </View>
                </>
              )}
            </View>
          </TouchableOpacity>

          {/* Export */}
          <TouchableOpacity
            style={[styles.heroBtn, styles.heroBtnSecondary]}
            onPress={handleExport}
            disabled={exporting || cardCount === 0}
            activeOpacity={0.7}
          >
            <View style={styles.heroBtnContent}>
              {exporting ? (
                <ActivityIndicator color={Colors.accentBlue} />
              ) : (
                <>
                  <Text style={styles.heroIcon}>📤</Text>
                  <View style={styles.heroTextGroup}>
                    <Text style={styles.heroBtnTitleSecondary}>Export CSV</Text>
                    <Text style={styles.heroBtnHint}>Full inventory with IDs</Text>
                  </View>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Quick Tools ── */}
        <View style={styles.toolsRow}>
          <TouchableOpacity style={styles.toolCard} onPress={handleDownloadTemplate}>
            <Text style={styles.toolIcon}>📋</Text>
            <Text style={styles.toolTitle}>Template</Text>
            <Text style={styles.toolHint}>All fields</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolCard} onPress={confirmReplaceImport}>
            <Text style={styles.toolIcon}>🔄</Text>
            <Text style={styles.toolTitle}>Replace All</Text>
            <Text style={styles.toolHint}>Import & clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolCard, cardCount === 0 && styles.toolCardDisabled]}
            onPress={handleClearAll}
            disabled={cardCount === 0}
          >
            <Text style={styles.toolIcon}>🗑</Text>
            <Text style={[styles.toolTitle, styles.dangerText]}>Clear All</Text>
            <Text style={styles.toolHint}>{cardCount} cards</Text>
          </TouchableOpacity>
        </View>

        {/* ── How Update Import Works ── */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>💡 Batch Update via CSV</Text>
          <Text style={styles.infoText}>
            Export your inventory → edit in a spreadsheet → re-import.{'\n'}
            Cards are matched by their <Text style={styles.bold}>id</Text>. If an id matches an existing card, that card is updated. 
            If no id is provided, a new card is created. You can also match by <Text style={styles.bold}>data_matrix</Text>.
          </Text>
        </View>

        {/* ── CSV Format Reference ── */}
        <View style={styles.formatSection}>
          <Text style={styles.formatTitle}>CSV Format Reference (14 columns)</Text>
          <View style={styles.columnGrid}>
            {[
              { col: 'id', req: false, hint: 'DB id — leave blank for new, set to update existing' },
              { col: 'name', req: true, hint: 'Card name' },
              { col: 'set_name', req: true, hint: 'Set name' },
              { col: 'card_number', req: false, hint: 'e.g. 4/102' },
              { col: 'rarity', req: false, hint: 'Holo Rare, Common...' },
              { col: 'condition', req: false, hint: 'Defaults: Near Mint' },
              { col: 'price_paid', req: false, hint: 'e.g. 350.00' },
              { col: 'price_target', req: false, hint: 'Desired sell price' },
              { col: 'price_sold', req: false, hint: 'Actual sold price' },
              { col: 'quantity', req: false, hint: 'Defaults: 1' },
              { col: 'purchase_date', req: false, hint: 'YYYY-MM-DD' },
              { col: 'data_matrix', req: false, hint: 'Barcode / DataMatrix' },
              { col: 'tags', req: false, hint: 'Comma-separated tags' },
              { col: 'notes', req: false, hint: 'Free text' },
            ].map((col) => (
              <View key={col.col} style={styles.columnItem}>
                <View style={styles.columnHeader}>
                  <Text style={styles.columnName}>{col.col}</Text>
                  {col.req && <Text style={styles.requiredBadge}>REQ</Text>}
                </View>
                <Text style={styles.columnHint}>{col.hint}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── History ── */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Operation History</Text>
          {loading ? (
            <View style={{ gap: 8 }}>
              <Skeleton height={44} />
              <Skeleton height={44} />
              <Skeleton height={44} />
            </View>
          ) : history.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>No operations yet</Text>
              <Text style={styles.emptyHint}>Import or export to see history here</Text>
            </View>
          ) : (
            history.map((op, i) => (
              <View key={op.id} style={styles.historyRow}>
                <View style={styles.historyLeft}>
                  <View style={[
                    styles.historyBadge,
                    op.type === 'import' ? styles.badgeImport : styles.badgeExport,
                    op.status === 'failure' && styles.badgeFailure,
                  ]}>
                    <Text style={[
                      styles.historyBadgeText,
                      op.status === 'failure' && styles.badgeFailureText,
                    ]}>
                      {op.type === 'import' ? '↓ Import' : '↑ Export'}
                    </Text>
                  </View>
                  {op.file_name && (
                    <Text style={styles.historyFile} numberOfLines={1}>{op.file_name}</Text>
                  )}
                  {op.error_message && (
                    <Text style={styles.historyError} numberOfLines={2}>{op.error_message}</Text>
                  )}
                </View>
                <View style={styles.historyRight}>
                  <Text style={[
                    styles.historyCount,
                    op.status === 'success' ? styles.countSuccess : styles.countFailure,
                  ]}>
                    {op.status === 'success' ? '✓' : '✗'} {op.record_count}
                  </Text>
                  <Text style={styles.historyDate}>{formatDate(op.created_at)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Error Detail Modal ── */}
        <Modal visible={showErrorModal} transparent animationType="slide">
          <View style={styles.previewOverlay}>
            <View style={styles.errorModal}>
              <Text style={styles.errorModalTitle}>
                {errorModalData?.title ?? 'Import Errors'}
              </Text>
              {errorModalData && (
                <Text style={styles.errorModalSummary}>{errorModalData.summary}</Text>
              )}

              <ScrollView style={styles.errorList} showsVerticalScrollIndicator={true}>
                {errorModalData?.errors.map((err, i) => (
                  <View key={i} style={styles.errorItem}>
                    <Text style={styles.errorItemNum}>{i + 1}.</Text>
                    <Text style={styles.errorItemText}>{err}</Text>
                  </View>
                ))}
                {(!errorModalData || errorModalData.errors.length === 0) && (
                  <Text style={styles.errorEmpty}>No error details available.</Text>
                )}
              </ScrollView>

              <View style={styles.errorActions}>
                <TouchableOpacity
                  style={styles.errorCopyBtn}
                  onPress={() => {
                    if (errorModalData) {
                      const text = errorModalData.errors.join('\n');
                      if (Platform.OS === 'web') {
                        navigator.clipboard.writeText(text).catch(() => {});
                      }
                      Alert.alert('Copied', 'Error details copied to clipboard.');
                    }
                  }}
                >
                  <Text style={styles.errorCopyText}>📋 Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.errorCloseBtn}
                  onPress={() => setShowErrorModal(false)}
                >
                  <Text style={styles.errorCloseText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Import Preview Modal ── */}
        <Modal visible={showImportPreview} transparent animationType="slide">
          <View style={styles.previewOverlay}>
            <View style={styles.previewModal}>
              <Text style={styles.previewTitle}>Import Preview</Text>
              <Text style={styles.previewFile} numberOfLines={1}>{previewData?.fileName}</Text>

              <View style={styles.previewInfo}>
                <Text style={styles.previewInfoText}>
                  CSV <Text style={styles.bold}>upsert</Text> mode — cards with a matching{' '}
                  <Text style={styles.bold}>id</Text> will be <Text style={styles.bold}>updated</Text>.
                  New cards (no id or no match) will be <Text style={styles.bold}>added</Text>.
                </Text>
                <Text style={styles.previewInfoText}>
                  Existing inventory ({cardCount} cards) will be preserved. Modified cards keep their original IDs.
                </Text>
              </View>

              {/* Sync Mode Toggle */}
              <TouchableOpacity
                style={[styles.syncToggle, previewSyncMode && styles.syncToggleActive]}
                onPress={() => setPreviewSyncMode(!previewSyncMode)}
                activeOpacity={0.7}
              >
                <View style={styles.syncToggleRow}>
                  <Text style={styles.syncToggleIcon}>{previewSyncMode ? '🔄' : '📋'}</Text>
                  <View style={styles.syncToggleText}>
                    <Text style={[styles.syncToggleTitle, previewSyncMode && styles.syncToggleTitleActive]}>
                      Sync mode
                    </Text>
                    <Text style={styles.syncToggleHint}>
                      Remove cards not in this CSV after import
                    </Text>
                  </View>
                  <View style={[styles.syncCheckbox, previewSyncMode && styles.syncCheckboxActive]}>
                    {previewSyncMode && <Text style={styles.syncCheckmark}>✓</Text>}
                  </View>
                </View>
              </TouchableOpacity>

              {previewSyncMode && (
                <View style={styles.syncWarning}>
                  <Text style={styles.syncWarningText}>
                    ⚠️ Cards not present in this CSV will be <Text style={styles.bold}>permanently deleted</Text>.
                  </Text>
                </View>
              )}

              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={styles.previewCancelBtn}
                  onPress={() => setShowImportPreview(false)}
                >
                  <Text style={styles.previewCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.previewConfirmBtn, previewSyncMode && styles.previewConfirmBtnSync]}
                  onPress={() => previewData && performImport(previewData.content, previewData.fileName, previewData.replaceMode)}
                >
                  <Text style={styles.previewConfirmText}>
                    {previewSyncMode ? 'Sync Inventory' : 'Import Cards'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.previewOption}>
                <TouchableOpacity
                  onPress={() => {
                    setShowImportPreview(false);
                    confirmReplaceImport();
                  }}
                >
                  <Text style={styles.previewOptionText}>
                    Or replace all existing cards instead
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>

      <ShareInventoryModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg, paddingBottom: Spacing.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  header: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '800', letterSpacing: -0.5, flex: 1 },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtnText: { fontSize: 20 },
  subtitle: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },

  // Hero action buttons
  heroSection: { gap: Spacing.sm, marginTop: Spacing.lg },
  heroBtn: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroBtnPrimary: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  heroBtnSecondary: {
    backgroundColor: Colors.bgCard,
    borderColor: Colors.borderGlow,
  },
  heroBtnContent: {
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  heroIcon: { fontSize: 32 },
  heroTextGroup: { flex: 1 },
  heroBtnTitle: {
    color: Colors.bg,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  heroBtnTitleSecondary: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  heroBtnHint: {
    color: Colors.bg + '99',
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  importProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 8,
  },
  importProgressText: {
    color: Colors.bg,
    fontSize: FontSize.md,
    fontWeight: '600',
  },

  // Tool cards row
  toolsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  toolCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    alignItems: 'center',
    gap: 2,
  },
  toolCardDisabled: { opacity: 0.4 },
  toolIcon: { fontSize: 22 },
  toolTitle: {
    color: Colors.text,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 4,
  },
  toolHint: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  dangerText: { color: Colors.danger },

  // Info box about batch update workflow
  infoSection: {
    backgroundColor: Colors.accentGlow,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent + '44',
  },
  infoTitle: {
    color: Colors.accent,
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },

  // CSV Format Reference
  formatSection: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  formatTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  columnGrid: {
    gap: 6,
  },
  columnItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 130,
  },
  columnName: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '500',
  },
  requiredBadge: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.accent,
    backgroundColor: Colors.accentGlow,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  columnHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    flex: 1,
    textAlign: 'right',
  },

  // History
  historySection: { marginTop: Spacing.lg },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: 4,
  },
  emptyIcon: { fontSize: 32, opacity: 0.5 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, fontStyle: 'italic' },
  emptyHint: { color: Colors.textMuted, fontSize: FontSize.xs },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  historyLeft: { flex: 1 },
  historyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginBottom: 4,
  },
  badgeImport: { backgroundColor: Colors.accentGlow },
  badgeExport: { backgroundColor: Colors.accentBlueGlow },
  badgeFailure: { backgroundColor: Colors.danger + '22' },
  historyBadgeText: { color: Colors.accent, fontSize: FontSize.xs, fontWeight: '600' },
  badgeFailureText: { color: Colors.danger },
  historyFile: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  historyError: {
    color: Colors.danger,
    fontSize: 10,
    marginTop: 2,
  },
  historyRight: { alignItems: 'flex-end' },
  historyCount: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  countSuccess: { color: Colors.success },
  countFailure: { color: Colors.danger },
  historyDate: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  bold: { fontWeight: '700', color: Colors.text },

  // ── Import Preview Modal ──
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  previewModal: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
    borderColor: Colors.borderGlow,
  },
  previewTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  previewFile: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  previewInfo: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewInfoText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  previewActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  previewCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  previewCancelText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  previewConfirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  previewConfirmText: {
    color: Colors.bg,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  previewOption: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  previewOptionText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textDecorationLine: 'underline',
  },

  // Sync mode toggle
  syncToggle: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  syncToggleActive: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warning + '11',
  },
  syncToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  syncToggleIcon: {
    fontSize: 22,
  },
  syncToggleText: {
    flex: 1,
  },
  syncToggleTitle: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  syncToggleTitleActive: {
    color: Colors.warning,
  },
  syncToggleHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  syncCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncCheckboxActive: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warning,
  },
  syncCheckmark: {
    color: Colors.bg,
    fontSize: 13,
    fontWeight: '800',
  },
  syncWarning: {
    backgroundColor: Colors.warning + '18',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.warning + '33',
  },
  syncWarningText: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  previewConfirmBtnSync: {
    backgroundColor: Colors.warning,
  },

  // Error Detail Modal
  errorModal: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
    borderColor: Colors.borderGlow,
    maxHeight: '90%',
  },
  errorModalTitle: {
    color: Colors.danger,
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorModalSummary: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: 4,
  },
  errorList: {
    maxHeight: 400,
    marginTop: Spacing.md,
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  errorItemNum: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    width: 24,
    fontVariant: ['tabular-nums'],
  },
  errorItemText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  errorEmpty: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  errorActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  errorCopyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  errorCopyText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  errorCloseBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  errorCloseText: {
    color: Colors.bg,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
