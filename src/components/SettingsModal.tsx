import React, { useState } from 'react';
import { 
  Key, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Cloud, 
  Download, 
  Upload, 
  Sliders, 
  X, 
  Check,
  HardDrive,
  BookOpen,
  Sparkles,
  Bot,
  Layers,
  Palette,
  Compass,
  Wand2,
  FileText,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';
import { 
  ApiKeyItem, 
  GoogleDriveConfig, 
  UserPreferences, 
  AppLanguage, 
  Book,
  BookAiSettings,
  BookCustomization
} from '../types';
import { useI18n } from '../lib/i18n';
import { testKeyApi } from '../lib/gemini';
import { db } from '../lib/db';
import {
  signInWithGoogleDrive,
  signOutGoogleDrive,
  uploadLibraryToDrive,
  downloadLibraryFromDrive,
  getCachedToken,
} from '../lib/googleDrive';
import { DriveSetupGuide } from './DriveSetupGuide';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: ApiKeyItem[];
  onUpdateApiKeys: (keys: ApiKeyItem[]) => void;
  driveConfig: GoogleDriveConfig;
  onUpdateDriveConfig: (cfg: GoogleDriveConfig) => void;
  preferences: UserPreferences;
  onUpdatePreferences: (pref: UserPreferences) => void;
  onRestoreBackup: (json: string) => void;
  language: AppLanguage;
  books?: Book[];
  activeBook?: Book | null;
  onUpdateBook?: (book: Book) => void;
  onSelectBook?: (bookId: string) => void;
  onNewBook?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKeys,
  onUpdateApiKeys,
  driveConfig,
  onUpdateDriveConfig,
  preferences,
  onUpdatePreferences,
  onRestoreBackup,
  language,
  books = [],
  activeBook = null,
  onUpdateBook,
  onSelectBook,
  onNewBook,
}) => {
  const t = useI18n(language);
  const [activeTab, setActiveTab] = useState<'book' | 'ai' | 'editor' | 'keys' | 'storage'>('book');

  // New Key input form
  const [newKeyInput, setNewKeyInput] = useState('');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);

  // Live model fetching state
  const [fetchedModels, setFetchedModels] = useState<Array<{ name: string; displayName: string }>>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleFetchLiveModels = async () => {
    const activeKey = apiKeys.find(k => k.status === 'active')?.key || apiKeys[0]?.key;
    if (!activeKey) {
      setFetchError(language === 'ar' ? 'أضف مفتاح API في علامة التبويب "مفاتيح API" أولاً.' : 'Please add an API key in the "API Keys" tab first.');
      return;
    }
    setIsFetchingModels(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/gemini/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: activeKey }),
      });
      const data = await res.json();
      if (data.success && data.models) {
        const list = data.models.map((modelName: string) => ({
          name: modelName,
          displayName: modelName,
        }));
        setFetchedModels(list);
      } else {
        throw new Error(data.error || 'Failed to fetch models');
      }
    } catch (err: any) {
      setFetchError(err.message || 'Failed to fetch');
    } finally {
      setIsFetchingModels(false);
    }
  };

  // Restore input ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Active book AI Settings updater
  const handleUpdateActiveBookAiSettings = (updates: Partial<BookAiSettings>) => {
    if (!activeBook || !onUpdateBook) return;
    const newAiSettings: BookAiSettings = {
      ...(activeBook.aiSettings || {}),
      ...updates,
    };
    onUpdateBook({
      ...activeBook,
      aiSettings: newAiSettings,
      updatedAt: Date.now(),
    });
  };

  // Active book Customization updater
  const handleUpdateActiveBookCustomization = (updates: Partial<BookCustomization>) => {
    if (!activeBook || !onUpdateBook) return;
    const newCustomization: BookCustomization = {
      ...(activeBook.customization || {}),
      ...updates,
    };
    onUpdateBook({
      ...activeBook,
      customization: newCustomization,
      updatedAt: Date.now(),
    });
  };

  // Active book Metadata updater
  const handleUpdateActiveBookMeta = (field: 'title' | 'subtitle' | 'genre' | 'description' | 'targetWordCount', value: any) => {
    if (!activeBook || !onUpdateBook) return;
    onUpdateBook({
      ...activeBook,
      [field]: value,
      updatedAt: Date.now(),
    });
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyInput.trim()) return;

    const newKey: ApiKeyItem = {
      id: `key-${Date.now()}`,
      label: newKeyLabel.trim() || `Key ${apiKeys.length + 1}`,
      key: newKeyInput.trim(),
      status: 'testing',
      lastTested: Date.now(),
    };

    const updated = [...apiKeys, newKey];
    onUpdateApiKeys(updated);
    setNewKeyInput('');
    setNewKeyLabel('');

    // Automatically test the newly added key
    setTestingKeyId(newKey.id);
    const testResult = await testKeyApi(newKey.key);
    onUpdateApiKeys(
      updated.map((k) =>
        k.id === newKey.id
          ? {
              ...k,
              status: testResult.success ? 'active' : testResult.isRateLimited ? 'rate_limited' : 'invalid',
              errorMessage: testResult.error,
              quotaMessage: testResult.message,
            }
          : k
      )
    );
    setTestingKeyId(null);
  };

  const handleTestKey = async (keyItem: ApiKeyItem) => {
    setTestingKeyId(keyItem.id);
    const result = await testKeyApi(keyItem.key);
    onUpdateApiKeys(
      apiKeys.map((k) =>
        k.id === keyItem.id
          ? {
              ...k,
              status: result.success ? 'active' : result.isRateLimited ? 'rate_limited' : 'invalid',
              errorMessage: result.error,
              quotaMessage: result.message,
              lastTested: Date.now(),
            }
          : k
      )
    );
    setTestingKeyId(null);
  };

  const handleDeleteKey = (keyId: string) => {
    onUpdateApiKeys(apiKeys.filter((k) => k.id !== keyId));
  };

  const handleDownloadBackup = async () => {
    try {
      const fullBackupJson = await db.exportBackup();
      const blob = new Blob([fullBackupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `riwaya-studio-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export backup:', err);
    }
  };

  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onRestoreBackup(content);
        onClose();
      }
    };
    reader.readAsText(file);
  };

  // Google Drive Two-Way Sync State
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);
  const [isDrivePushing, setIsDrivePushing] = useState(false);
  const [isDrivePulling, setIsDrivePulling] = useState(false);
  const [driveStatusMsg, setDriveStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleConnectDrive = async (silent = false) => {
    setIsDriveConnecting(true);
    setDriveStatusMsg(null);
    try {
      const { user, accessToken } = await signInWithGoogleDrive(driveConfig.clientId || '', silent);
      const updatedConfig: GoogleDriveConfig = {
        ...driveConfig,
        connected: true,
        autoBackupEnabled: true,
        userEmail: user.email || driveConfig.userEmail || '',
        accessToken,
        lastSyncTime: Date.now(),
      };
      onUpdateDriveConfig(updatedConfig);

      // Immediately push an initial sync to create folder and backup file
      try {
        await uploadLibraryToDrive(accessToken, {
          version: 1,
          appName: 'InkWeaver Studio',
          exportedAt: Date.now(),
          books,
          preferences,
          activeBookId: activeBook?.id || null,
        });
        setDriveStatusMsg({
          type: 'success',
          text: language === 'ar'
            ? 'تم ربط Google Drive بنجاح ومزامنة مكتبتك في مجلد InkWeaver Studio!'
            : 'Google Drive connected and initial library sync completed in "InkWeaver Studio"!'
        });
      } catch (uploadErr) {
        setDriveStatusMsg({
          type: 'info',
          text: language === 'ar'
            ? 'تم ربط حساب Google بنجاح. انقر على "مزامنة إلى Drive" لحفظ مكتبتك.'
            : 'Connected successfully. Click "Sync to Drive" to upload your library.'
        });
      }
    } catch (err: any) {
      console.error('Google Drive sign-in error:', err);
      setDriveStatusMsg({
        type: 'error',
        text: err.message || (language === 'ar' ? 'فشل تسجيل الدخول إلى Google Drive' : 'Failed to connect Google Drive'),
      });
    } finally {
      setIsDriveConnecting(false);
    }
  };

  /**
   * Drive access tokens last about an hour and the browser flow has no refresh
   * token, so renew silently first and only fall back to the popup.
   */
  const resolveDriveToken = async (): Promise<string | null> => {
    const token = getCachedToken() || driveConfig.accessToken;
    if (token) return token;

    if (driveConfig.connected && driveConfig.clientId) {
      try {
        const { accessToken } = await signInWithGoogleDrive(driveConfig.clientId, true);
        onUpdateDriveConfig({ ...driveConfig, accessToken });
        return accessToken;
      } catch {
        // Silent renewal fails when consent lapsed; fall through to the popup.
      }
    }

    await handleConnectDrive();
    return null;
  };

  const handlePushToDrive = async () => {
    const token = await resolveDriveToken();
    if (!token) return;

    setIsDrivePushing(true);
    setDriveStatusMsg(null);
    try {
      await uploadLibraryToDrive(token, {
        version: 1,
        appName: 'InkWeaver Studio',
        exportedAt: Date.now(),
        books,
        preferences,
        activeBookId: activeBook?.id || null,
      });
      const updatedConfig = { ...driveConfig, lastSyncTime: Date.now() };
      onUpdateDriveConfig(updatedConfig);
      setDriveStatusMsg({
        type: 'success',
        text: language === 'ar'
          ? `تم رفع ومزامنة ${books.length} كتاب وجميع الفصول بنجاح إلى Google Drive!`
          : `Successfully synced ${books.length} book(s) and all chapters to Google Drive!`
      });
    } catch (err: any) {
      console.error('Push to Drive error:', err);
      if (err.message?.includes('401') || err.message?.includes('403')) {
        setDriveStatusMsg({
          type: 'error',
          text: language === 'ar'
            ? 'انتهت صلاحية الجلسة، يرجى إعادة الاتصال بحساب Google.'
            : 'Session expired, please reconnect your Google account.'
        });
      } else {
        setDriveStatusMsg({
          type: 'error',
          text: err.message || (language === 'ar' ? 'فشل الرفع إلى Google Drive' : 'Failed to sync to Google Drive')
        });
      }
    } finally {
      setIsDrivePushing(false);
    }
  };

  const handlePullFromDrive = async () => {
    const token = await resolveDriveToken();
    if (!token) return;

    setIsDrivePulling(true);
    setDriveStatusMsg(null);
    try {
      const { payload, modifiedTime } = await downloadLibraryFromDrive(token);
      if (!payload || !payload.books || payload.books.length === 0) {
        setDriveStatusMsg({
          type: 'info',
          text: language === 'ar'
            ? 'لم يتم العثور على نسخة احتياطية سابقة في Google Drive. يمكنك الضغط على "مزامنة إلى Drive" لحفظ نسختك الأولى.'
            : 'No existing library backup found on Google Drive. Click "Sync to Drive" to save your first backup.'
        });
        return;
      }

      const formattedDate = modifiedTime ? new Date(modifiedTime).toLocaleString() : '';
      const confirmMsg = language === 'ar'
        ? `تم العثور على نسخة في Google Drive (${formattedDate}) تحتوي على ${payload.books.length} كتاب.\n\nهل أنت متأكد أنك تريد استرجاع وتحديث مكتبتك في الاستوديو بهذه النسخة السحابية؟`
        : `Found backup on Google Drive (${formattedDate}) with ${payload.books.length} book(s).\n\nAre you sure you want to restore and overwrite your local studio library with this version from Google Drive?`;

      if (window.confirm(confirmMsg)) {
        onRestoreBackup(JSON.stringify(payload));
        const updatedConfig = { ...driveConfig, lastSyncTime: Date.now() };
        onUpdateDriveConfig(updatedConfig);
        setDriveStatusMsg({
          type: 'success',
          text: language === 'ar'
            ? `تم استرجاع ومزامنة المكتبة بنجاح (${payload.books.length} كتاب)!`
            : `Successfully restored ${payload.books.length} book(s) from Google Drive!`
        });
      }
    } catch (err: any) {
      console.error('Pull from Drive error:', err);
      if (err.message?.includes('401') || err.message?.includes('403')) {
        setDriveStatusMsg({
          type: 'error',
          text: language === 'ar'
            ? 'انتهت صلاحية الجلسة، يرجى إعادة الاتصال بحساب Google.'
            : 'Session expired, please reconnect your Google account.'
        });
      } else {
        setDriveStatusMsg({
          type: 'error',
          text: err.message || (language === 'ar' ? 'فشل القراءة من Google Drive' : 'Failed to pull from Google Drive')
        });
      }
    } finally {
      setIsDrivePulling(false);
    }
  };

  const handleDisconnectDrive = async () => {
    try {
      await signOutGoogleDrive();
    } catch (e) {
      console.warn('Sign out error:', e);
    }
    onUpdateDriveConfig({
      ...driveConfig,
      connected: false,
      autoBackupEnabled: false,
      accessToken: undefined,
      userEmail: undefined,
    });
    setDriveStatusMsg({
      type: 'info',
      text: language === 'ar' ? 'تم إلغاء ربط Google Drive بنجاح.' : 'Google Drive disconnected.'
    });
  };

  const spineColors = [
    { id: 'amber', label: language === 'ar' ? 'عنبري ملكي' : 'Royal Amber', bg: 'bg-amber-600', ring: 'ring-amber-500' },
    { id: 'emerald', label: language === 'ar' ? 'زمردي عتيق' : 'Antique Emerald', bg: 'bg-emerald-600', ring: 'ring-emerald-500' },
    { id: 'indigo', label: language === 'ar' ? 'نيلي ليلي' : 'Midnight Indigo', bg: 'bg-indigo-600', ring: 'ring-indigo-500' },
    { id: 'rose', label: language === 'ar' ? 'قرمزي مخملي' : 'Velvet Rose', bg: 'bg-rose-600', ring: 'ring-rose-500' },
    { id: 'slate', label: language === 'ar' ? 'فحمي رخامي' : 'Marble Slate', bg: 'bg-slate-700', ring: 'ring-slate-400' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-4xl max-h-[92vh] bg-surface border border-subtle rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-subtle flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/15 border border-indigo-600/30 flex items-center justify-center text-indigo-700 dark:text-indigo-300">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-main">
                {language === 'ar' ? 'مركز التخصيص والإعدادات' : 'Studio Settings & Customization'}
              </h2>
              <p className="text-xs text-sub">
                {language === 'ar' 
                  ? 'تخصيص ذكاء كل كتاب على حدة، إعدادات Gemini الشاملة، وخيارات المحرر' 
                  : 'Configure per-book AI directives, Gemini models, editor aesthetics, and free storage'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-sub hover:text-main hover:bg-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 border-b border-subtle bg-canvas overflow-x-auto no-scrollbar">
          {/* Active Book Customization Tab */}
          <button
            onClick={() => setActiveTab('book')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 shrink-0 ${
              activeTab === 'book'
                ? 'border-indigo-600 dark:border-indigo-400 text-indigo-900 dark:text-indigo-200 bg-surface'
                : 'border-transparent text-sub hover:text-main'
            }`}
          >
            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{language === 'ar' ? 'تخصيص هذا الكتاب والذكاء الخاص به' : 'Current Book & Book AI'}</span>
          </button>

          {/* AI Configuration Tab */}
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 shrink-0 ${
              activeTab === 'ai'
                ? 'border-indigo-600 dark:border-indigo-400 text-indigo-900 dark:text-indigo-200 bg-surface'
                : 'border-transparent text-sub hover:text-main'
            }`}
          >
            <Bot className="w-4 h-4 text-purple-600" />
            <span>{language === 'ar' ? 'استوديو الذكاء الاصطناعي العام' : 'Global AI Persona'}</span>
          </button>

          {/* Editor & App Customization Tab */}
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 shrink-0 ${
              activeTab === 'editor'
                ? 'border-indigo-600 dark:border-indigo-400 text-indigo-900 dark:text-indigo-200 bg-surface'
                : 'border-transparent text-sub hover:text-main'
            }`}
          >
            <Palette className="w-4 h-4 text-emerald-600" />
            <span>{language === 'ar' ? 'المحرر وتجربة القراءة' : 'Editor & Experience'}</span>
          </button>

          {/* API Keys Tab */}
          <button
            onClick={() => setActiveTab('keys')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 shrink-0 ${
              activeTab === 'keys'
                ? 'border-indigo-600 dark:border-indigo-400 text-indigo-900 dark:text-indigo-200 bg-surface'
                : 'border-transparent text-sub hover:text-main'
            }`}
          >
            <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{language === 'ar' ? 'مفاتيح AI' : 'API Keys'}</span>
            {apiKeys.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-indigo-600/15 dark:bg-indigo-500/20 text-indigo-900 dark:text-indigo-200 font-bold">
                {apiKeys.length}
              </span>
            )}
          </button>

          {/* Storage & Backup Tab */}
          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 shrink-0 ${
              activeTab === 'storage'
                ? 'border-indigo-600 dark:border-indigo-400 text-indigo-900 dark:text-indigo-200 bg-surface'
                : 'border-transparent text-sub hover:text-main'
            }`}
          >
            <HardDrive className="w-4 h-4 text-blue-600" />
            <span>{language === 'ar' ? 'النسخ الاحتياطي والتخزين' : 'Storage & Backup'}</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* TAB 1: PER-BOOK & BOOK AI CUSTOMIZATION */}
          {activeTab === 'book' && (
            <div className="space-y-6">
              {activeBook ? (
                <>
                  {/* Active Book Selector & Switcher */}
                  <div className="p-4 rounded-xl bg-canvas border border-subtle space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <h4 className="text-xs font-bold text-main uppercase font-mono">
                          {language === 'ar' ? 'الكتاب النشط حالياً للتعديل' : 'Active Manuscript'}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        {books.length > 1 && onSelectBook && (
                          <select
                            value={activeBook.id}
                            onChange={(e) => onSelectBook(e.target.value)}
                            className="bg-surface border border-subtle rounded-lg px-2.5 py-1 text-xs text-main font-medium focus:outline-none cursor-pointer"
                          >
                            {books.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.title}
                              </option>
                            ))}
                          </select>
                        )}
                        {onNewBook && (
                          <button
                            type="button"
                            onClick={onNewBook}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/10 dark:bg-indigo-500/15 text-indigo-900 dark:text-indigo-200 hover:bg-indigo-600/20 border border-indigo-600/30 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{language === 'ar' ? 'إنشاء كتاب جديد' : 'New Book'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Book Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div>
                        <label className="text-[11px] font-medium text-sub block mb-1">
                          {language === 'ar' ? 'عنوان الكتاب' : 'Book Title'}
                        </label>
                        <input
                          type="text"
                          value={activeBook.title}
                          onChange={(e) => handleUpdateActiveBookMeta('title', e.target.value)}
                          className="w-full bg-surface border border-subtle rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-sub block mb-1">
                          {language === 'ar' ? 'العنوان الفرعي' : 'Subtitle'}
                        </label>
                        <input
                          type="text"
                          value={activeBook.subtitle || ''}
                          onChange={(e) => handleUpdateActiveBookMeta('subtitle', e.target.value)}
                          placeholder="e.g. الجزء الأول"
                          className="w-full bg-surface border border-subtle rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-sub block mb-1">
                          {language === 'ar' ? 'التصنيف الأدبي' : 'Genre'}
                        </label>
                        <input
                          type="text"
                          value={activeBook.genre || ''}
                          onChange={(e) => handleUpdateActiveBookMeta('genre', e.target.value)}
                          placeholder="e.g. خيال تاريخي / Historical Fiction"
                          className="w-full bg-surface border border-subtle rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Book Spine Color & Visual Customization */}
                  <div className="p-4 rounded-xl bg-canvas border border-subtle space-y-3">
                    <h4 className="text-xs font-bold text-main uppercase font-mono flex items-center gap-1.5">
                      <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>{language === 'ar' ? 'لون غلاف الكتاب والمظهر المخصص' : 'Book Spine Accent & Cover Theme'}</span>
                    </h4>
                    <p className="text-xs text-sub">
                      {language === 'ar'
                        ? 'اختر الطابع اللوني لغلاف الرواية في الشريط الجانبي لتسهيل التمييز بين أعمالك الأدبية.'
                        : 'Choose the visual spine accent for this manuscript in your library sidebar.'}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      {spineColors.map((sc) => {
                        const isSelected = (activeBook.customization?.coverColor || 'indigo') === sc.id;
                        return (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() => handleUpdateActiveBookCustomization({ coverColor: sc.id as any })}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                              isSelected
                                ? 'border-indigo-600 dark:border-indigo-400 bg-surface font-bold text-main shadow-xs ring-1 ring-indigo-500'
                                : 'border-subtle bg-surface/50 text-sub hover:bg-surface'
                            }`}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full ${sc.bg}`} />
                            <span>{sc.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* PER-BOOK AI CO-AUTHOR CONFIGURATION (CRITICAL REQUEST) */}
                  <div className="p-4 rounded-xl bg-indigo-950/5 dark:bg-indigo-500/5 border border-indigo-600/25 dark:border-indigo-500/25 space-y-4">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h4 className="text-xs font-bold text-main uppercase font-mono">
                        {language === 'ar' ? 'الذكاء الاصطناعي الخاص بهذا الكتاب حصراً' : 'Per-Book AI Co-Author Directives'}
                      </h4>
                    </div>
                    <p className="text-xs text-sub leading-relaxed">
                      {language === 'ar'
                        ? 'هذه التوجيهات تُحقن خصيصاً عندما يعمل الذكاء الاصطناعي على هذا الكتاب، لضمان التزام الذكاء بنبرة هذه الرواية المحددة، وزاوية السرد، والقواعد المحظورة.'
                        : 'These instructions are injected specifically when AI operates on this book, guaranteeing adherence to its distinct voice, perspective, and rules.'}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Narrative Tone */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-main block">
                          {language === 'ar' ? 'النبرة الأدبية للرواية' : 'Narrative Tone & Voice'}
                        </label>
                        <select
                          value={activeBook.aiSettings?.narrativeTone || ''}
                          onChange={(e) => handleUpdateActiveBookAiSettings({ narrativeTone: e.target.value })}
                          className="w-full bg-surface border border-subtle rounded-lg px-3 py-2 text-xs text-main focus:outline-none cursor-pointer"
                        >
                          <option value="">{language === 'ar' ? 'افتراضي (أدبي فصيح سلس)' : 'Default (Literary & Fluid)'}</option>
                          <option value="Dramatic & Atmospheric">{language === 'ar' ? 'درامي مشوق وغامر' : 'Dramatic & Atmospheric'}</option>
                          <option value="Philosophical & Reflective">{language === 'ar' ? 'فلسفي تأملي هادئ' : 'Philosophical & Reflective'}</option>
                          <option value="Historical Classical Arabic">{language === 'ar' ? 'فصحى تراثية رصينة (كلاسيكي)' : 'Historical Classical Arabic'}</option>
                          <option value="Fast-Paced Suspense">{language === 'ar' ? 'إثارة وتشويق سريع الإيقاع' : 'Fast-Paced Suspense'}</option>
                          <option value="Poetic & Lyrical">{language === 'ar' ? 'شاعري وجداني غني بالصور' : 'Poetic & Lyrical'}</option>
                          <option value="Dark Noir">{language === 'ar' ? 'نوار غامض سوداوي' : 'Dark & Gritty Noir'}</option>
                        </select>
                      </div>

                      {/* Point of View (POV) */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-main block">
                          {language === 'ar' ? 'زاوية السرد والضمير (POV)' : 'Point of View (POV)'}
                        </label>
                        <select
                          value={activeBook.aiSettings?.pov || 'third_limited'}
                          onChange={(e) => handleUpdateActiveBookAiSettings({ pov: e.target.value as any })}
                          className="w-full bg-surface border border-subtle rounded-lg px-3 py-2 text-xs text-main focus:outline-none cursor-pointer"
                        >
                          <option value="third_limited">
                            {language === 'ar' ? 'ضمير الغائب المحدود (Third Person Limited)' : 'Third Person Limited'}
                          </option>
                          <option value="first_person">
                            {language === 'ar' ? 'ضمير المتكلم ("أنا" / First Person)' : 'First Person ("I")'}
                          </option>
                          <option value="third_omniscient">
                            {language === 'ar' ? 'الراوي العليم المحيط (Third Omniscient)' : 'Third Person Omniscient'}
                          </option>
                          <option value="second_person">
                            {language === 'ar' ? 'ضمير المخاطب ("أنت" / Second Person)' : 'Second Person ("You")'}
                          </option>
                        </select>
                      </div>
                    </div>

                    {/* Target Audience */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-main block">
                        {language === 'ar' ? 'الجمهور المستهدف' : 'Target Audience'}
                      </label>
                      <input
                        type="text"
                        value={activeBook.aiSettings?.targetAudience || ''}
                        onChange={(e) => handleUpdateActiveBookAiSettings({ targetAudience: e.target.value })}
                        placeholder="e.g. Adult Literary Fiction, Young Adult Fantasy, القراء المهتمون بالروايات التاريخية"
                        className="w-full bg-surface border border-subtle rounded-lg px-3 py-2 text-xs text-main focus:outline-none"
                      />
                    </div>

                    {/* Book Specific System Directives */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-main block">
                        {language === 'ar' ? 'توجيهات وأسلوب خاص بهذا الكتاب' : 'Book-Specific Directives & Style'}
                      </label>
                      <textarea
                        rows={3}
                        value={activeBook.aiSettings?.customInstructions || ''}
                        onChange={(e) => handleUpdateActiveBookAiSettings({ customInstructions: e.target.value })}
                        placeholder={
                          language === 'ar'
                            ? 'مثال: تدور الأحداث في الإسكندرية عام 1940. ركّز على روائح البحر والأزقة القديمة، واجعل الحوارات ناضجة ومقتضبة، وحافظ على حس الغموض في تصرفات البطل.'
                            : 'e.g. Set in 1940s Alexandria. Focus heavily on sensory sea details and guarded dialogue. Never resolve the central mystery early.'
                        }
                        className="w-full bg-surface border border-subtle rounded-lg p-2.5 text-xs text-main focus:outline-none"
                      />
                    </div>

                    {/* Forbidden Tropes & Rules to Avoid */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-red-700 dark:text-red-400 block">
                        {language === 'ar' ? 'محظورات وقواعد يمتنع الذكاء عن استخدامها في هذا الكتاب' : 'Forbidden Tropes & Rules to Avoid'}
                      </label>
                      <textarea
                        rows={2}
                        value={activeBook.aiSettings?.rulesToAvoid || ''}
                        onChange={(e) => handleUpdateActiveBookAiSettings({ rulesToAvoid: e.target.value })}
                        placeholder={
                          language === 'ar'
                            ? 'مثال: ممنوع استخدام ألفاظ حديثة أو تراكيب مترجمة، تجنب الكليشيهات مثل "كان الصمت مطبقاً"، لا تجعل النهاية سعيدة مسبقاً.'
                            : 'e.g. Do not use modern slang, avoid cheap cliffhangers, do not resolve conflict with sudden miracles.'
                        }
                        className="w-full bg-surface border border-subtle rounded-lg p-2.5 text-xs text-main focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-sub space-y-2">
                  <BookOpen className="w-8 h-8 mx-auto text-indigo-600/40" />
                  <p className="text-xs">{language === 'ar' ? 'لا يوجد كتاب نشط حالياً.' : 'No book currently active.'}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GLOBAL AI STUDIO CONFIGURATION */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              {/* Model Selection */}
              <div className="p-4 rounded-xl bg-canvas border border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-purple-600" />
                    <h4 className="text-xs font-bold text-main uppercase font-mono">
                      {language === 'ar' ? 'نموذج الذكاء الاصطناعي (Gemini Engine)' : 'Gemini AI Model'}
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold">
                    v2.5 Flash / Pro
                  </span>
                </div>

                {/* Custom Model ID input */}
                <div className="pt-2 space-y-1">
                  <label className="text-[11px] font-semibold text-main block">
                    {language === 'ar' ? 'أو أدخل اسم/معرف نموذج مخصص (Custom Gemini Model ID):' : 'Or enter custom Gemini model ID directly:'}
                  </label>
                  <input
                    type="text"
                    value={preferences.aiModel || 'gemini-2.5-flash'}
                    onChange={(e) => onUpdatePreferences({ ...preferences, aiModel: e.target.value as any })}
                    placeholder="e.g. gemini-2.5-flash"
                    className="w-full bg-surface border border-subtle rounded-lg px-3 py-2 text-xs text-main font-mono focus:outline-none"
                  />
                  <p className="text-[10px] text-dim">
                    {language === 'ar'
                      ? 'يمكنك كتابة أي معرف نموذج مدعوم في Google AI Studio وسيتم استخدامه في جميع التوليدات.'
                      : 'Type any model name supported by Google AI Studio API to use it immediately.'}
                  </p>
                </div>

                {/* Live Model Fetcher */}
                <div className="pt-2 space-y-2 border-t border-subtle">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleFetchLiveModels}
                      disabled={isFetchingModels}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isFetchingModels ? 'animate-spin' : ''}`} />
                      <span>{language === 'ar' ? 'جلب النماذج الحية من AI Studio' : 'Fetch Live Models from AI Studio'}</span>
                    </button>
                    {fetchError && <span className="text-[11px] text-red-500">{fetchError}</span>}
                  </div>

                  {fetchedModels.length > 0 && (
                    <div className="p-3 rounded-lg bg-surface border border-subtle space-y-2">
                      <p className="text-[11px] font-bold text-main">
                        {language === 'ar' ? 'النماذج المتاحة حالياً في حسابك:' : 'Available Models in your AI Studio account:'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {fetchedModels.map((fm) => (
                          <button
                            key={fm.name}
                            type="button"
                            onClick={() => onUpdatePreferences({ ...preferences, aiModel: fm.name as any })}
                            className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${
                              preferences.aiModel === fm.name
                                ? 'bg-purple-600 text-white border-purple-600 font-bold'
                                : 'bg-canvas text-main hover:bg-elevated border-subtle'
                            }`}
                          >
                            {fm.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Creativity / Temperature Slider */}
              <div className="p-4 rounded-xl bg-canvas border border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-main uppercase font-mono flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{language === 'ar' ? 'مستوى خيال وابتكار الذكاء (Temperature)' : 'Creativity & Imagination'}</span>
                  </h4>
                  <span className="text-xs font-mono font-bold text-indigo-900 dark:text-indigo-300">
                    {preferences.aiTemperature ?? 0.7}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={preferences.aiTemperature ?? 0.7}
                  onChange={(e) =>
                    onUpdatePreferences({
                      ...preferences,
                      aiTemperature: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-indigo-600 dark:accent-indigo-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-dim font-mono">
                  <span>0.2 ({language === 'ar' ? 'دقيق وواقعي' : 'Precise & Factual'})</span>
                  <span>0.7 ({language === 'ar' ? 'سرد أدبي متوازن' : 'Balanced Prose'})</span>
                  <span>1.0 ({language === 'ar' ? 'شاعري وخيال حر' : 'Boldly Poetic'})</span>
                </div>
              </div>

              {/* Global Author Persona */}
              <div className="p-4 rounded-xl bg-canvas border border-subtle space-y-2">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-xs font-bold text-main uppercase font-mono">
                    {language === 'ar' ? 'شخصية الكاتب وتوجيهاتك العامة الثابتة' : 'Global Author Persona & Master Rules'}
                  </h4>
                </div>
                <p className="text-xs text-sub leading-relaxed">
                  {language === 'ar'
                    ? 'توجيهات يتم إرفاقها دائماً في كل طلب ذكاء اصطناعي عبر كافة كتبك (مثال: أسلوبك المفضل، الكلمات التي ترفضها، منهجيتك في السرد).'
                    : 'System directives applied globally across all books and writing prompts.'}
                </p>
                <textarea
                  rows={3}
                  value={preferences.globalAiPersona || ''}
                  onChange={(e) => onUpdatePreferences({ ...preferences, globalAiPersona: e.target.value })}
                  placeholder={
                    language === 'ar'
                      ? 'مثال: اكتب دائماً بلغة عربية فصحى راقية خالية من التكلف، واعتمد على مبدأ "أظهِر ولا تخبر" (Show, Don\'t Tell)، واجعل الأوصاف الحسية ملموسة.'
                      : 'e.g. Always prioritize vivid imagery, show don\'t tell, psychological depth, and concise impactful sentences.'
                  }
                  className="w-full bg-surface border border-subtle rounded-lg p-2.5 text-xs text-main focus:outline-none"
                />
              </div>

              {/* AI Language Preference */}
              <div className="p-4 rounded-xl bg-canvas border border-subtle space-y-3">
                <h4 className="text-xs font-bold text-main uppercase font-mono">
                  {language === 'ar' ? 'لغة استجابة الذكاء الاصطناعي المفضلة' : 'AI Output Language Match'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'auto', label: language === 'ar' ? 'تلقائي (مطابقة النص الحالي)' : 'Auto (Match Current Text)' },
                    { id: 'ar', label: language === 'ar' ? 'دائماً بالعربية الفصحى' : 'Always Literary Arabic' },
                    { id: 'en', label: language === 'ar' ? 'دائماً بالإنجليزية' : 'Always Literary English' },
                  ].map((lp) => {
                    const isSelected = (preferences.aiLanguagePreference || 'auto') === lp.id;
                    return (
                      <button
                        key={lp.id}
                        type="button"
                        onClick={() => onUpdatePreferences({ ...preferences, aiLanguagePreference: lp.id as any })}
                        className={`p-2.5 rounded-lg border text-xs font-medium text-start transition-all ${
                          isSelected
                            ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-600/10 dark:bg-indigo-500/15 text-indigo-900 dark:text-indigo-200 font-semibold'
                            : 'border-subtle bg-surface text-sub hover:bg-elevated'
                        }`}
                      >
                        {lp.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: APP & EDITOR PREFERENCES */}
          {activeTab === 'editor' && (
            <div className="space-y-6">
              {/* Daily Word Target */}
              <div className="p-4 rounded-xl bg-canvas border border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-main uppercase font-mono">{t.dailyGoal}</h4>
                  <span className="text-xs font-mono font-bold text-indigo-900 dark:text-indigo-300">
                    {preferences.writingGoal.dailyTarget} {t.words}
                  </span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="6000"
                  step="100"
                  value={preferences.writingGoal.dailyTarget}
                  onChange={(e) =>
                    onUpdatePreferences({
                      ...preferences,
                      writingGoal: {
                        ...preferences.writingGoal,
                        dailyTarget: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  className="w-full accent-indigo-600 dark:accent-indigo-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-dim font-mono">
                  <span>200 {t.words}</span>
                  <span>1,500 {t.words}</span>
                  <span>3,500 {t.words}</span>
                  <span>6,000 {t.words}</span>
                </div>
              </div>

              {/* Editor Line Height & Spacing */}
              <div className="p-4 rounded-xl bg-canvas border border-subtle space-y-3">
                <h4 className="text-xs font-bold text-main uppercase font-mono">
                  {language === 'ar' ? 'المسافة بين الأسطر (Line Spacing)' : 'Line Height & Vertical Rhythm'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'normal', label: language === 'ar' ? 'عادي (1.6x)' : 'Standard (1.6x)' },
                    { id: 'relaxed', label: language === 'ar' ? 'مريح (1.8x) - موصى به' : 'Relaxed (1.8x) - Recommended' },
                    { id: 'loose', label: language === 'ar' ? 'متباعد (2.1x)' : 'Spacious (2.1x)' },
                  ].map((lh) => {
                    const isSelected = (preferences.lineHeight || 'relaxed') === lh.id;
                    return (
                      <button
                        key={lh.id}
                        type="button"
                        onClick={() => onUpdatePreferences({ ...preferences, lineHeight: lh.id as any })}
                        className={`p-2.5 rounded-lg border text-xs text-start transition-all ${
                          isSelected
                            ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-600/10 dark:bg-indigo-500/15 text-indigo-900 dark:text-indigo-200 font-semibold'
                            : 'border-subtle bg-surface text-sub hover:bg-elevated'
                        }`}
                      >
                        {lh.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto Save Interval */}
              <div className="p-4 rounded-xl bg-canvas border border-subtle space-y-3">
                <h4 className="text-xs font-bold text-main uppercase font-mono">
                  {language === 'ar' ? 'فترة الحفظ التلقائي المحلي' : 'Auto-Save Interval'}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { sec: 1, label: language === 'ar' ? 'ثانية واحدة (فوري)' : '1 Second (Instant)' },
                    { sec: 3, label: language === 'ar' ? '3 ثوانٍ (موصى به)' : '3 Seconds' },
                    { sec: 5, label: language === 'ar' ? '5 ثوانٍ' : '5 Seconds' },
                    { sec: 10, label: language === 'ar' ? '10 ثوانٍ' : '10 Seconds' },
                  ].map((as) => {
                    const isSelected = (preferences.autoSaveInterval || 3) === as.sec;
                    return (
                      <button
                        key={as.sec}
                        type="button"
                        onClick={() => onUpdatePreferences({ ...preferences, autoSaveInterval: as.sec })}
                        className={`p-2 rounded-lg border text-xs text-center transition-all ${
                          isSelected
                            ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-600/10 dark:bg-indigo-500/15 text-indigo-900 dark:text-indigo-200 font-bold'
                            : 'border-subtle bg-surface text-sub hover:bg-elevated'
                        }`}
                      >
                        {as.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Speech Recognition Language */}
              <div className="p-4 rounded-xl bg-canvas border border-subtle space-y-3">
                <h4 className="text-xs font-bold text-main uppercase font-mono">
                  {language === 'ar' ? 'لغة الإملاء الصوتي الافتراضية' : 'Default Speech Dictation Language'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: 'ar-SA', label: 'العربية (المملكة العربية السعودية)' },
                    { id: 'ar-EG', label: 'العربية (جمهورية مصر العربية)' },
                    { id: 'en-US', label: 'English (United States)' },
                    { id: 'en-GB', label: 'English (United Kingdom)' },
                  ].map((sl) => (
                    <button
                      key={sl.id}
                      type="button"
                      onClick={() => onUpdatePreferences({ ...preferences, speechLanguage: sl.id as any })}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        preferences.speechLanguage === sl.id
                          ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-600/10 dark:bg-indigo-500/15 text-indigo-900 dark:text-indigo-200 font-semibold'
                          : 'border-subtle bg-surface text-sub hover:bg-elevated'
                      }`}
                    >
                      <span>{sl.label}</span>
                      {preferences.speechLanguage === sl.id && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: API KEYS */}
          {activeTab === 'keys' && (
            <div className="space-y-5">
              {/* Educational info badge */}
              <div className="p-3.5 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/10 border border-indigo-600/25 dark:border-indigo-500/25 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-sub space-y-1">
                  <p className="font-semibold text-main">{language === 'ar' ? 'نظام تدوير المفاتيح التلقائي المجاني (Key Failover)' : 'Automated Key Pool & Failover'}</p>
                  <p className="leading-relaxed">{t.keyFailoverHelp}</p>
                </div>
              </div>

              {/* Add Key Form */}
              <form onSubmit={handleAddKey} className="p-4 rounded-xl bg-canvas border border-subtle space-y-3">
                <h4 className="text-xs font-bold text-main uppercase font-mono">{t.addKey}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder={language === 'ar' ? 'اسم المفتاح (اختياري)' : 'Key Label (optional)'}
                    className="bg-surface border border-subtle rounded-lg px-3 py-2 text-xs text-main focus:outline-none"
                  />
                  <input
                    type="password"
                    required
                    value={newKeyInput}
                    onChange={(e) => setNewKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="sm:col-span-2 bg-surface border border-subtle rounded-lg px-3 py-2 text-xs text-main font-mono focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-900 dark:text-indigo-300 hover:underline"
                  >
                    {language === 'ar' ? 'احصل على مفتاح مجاني من Google AI Studio ↗' : 'Get free API key at Google AI Studio ↗'}
                  </a>
                  <button
                    type="submit"
                    className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.addKey}</span>
                  </button>
                </div>
              </form>

              {/* Keys List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-main uppercase font-mono">{language === 'ar' ? 'المفاتيح المضافة' : 'Configured Keys'} ({apiKeys.length})</h4>
                {apiKeys.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-canvas border border-dashed border-subtle text-sub text-xs space-y-1">
                    <Key className="w-6 h-6 mx-auto text-dim" />
                    <p>{language === 'ar' ? 'لا توجد مفاتيح مضافة حتى الآن' : 'No API keys configured yet'}</p>
                    <p className="text-[11px] text-dim">{language === 'ar' ? 'أضف مفتاح Gemini للبدء بالاستمتاع بميزات الذكاء الاصطناعي' : 'Add a Gemini API key to unlock writing features'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {apiKeys.map((keyItem) => {
                      const isTesting = testingKeyId === keyItem.id;
                      return (
                        <div
                          key={keyItem.id}
                          className="p-3 rounded-xl bg-canvas border border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="shrink-0">
                              {keyItem.status === 'active' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                              {keyItem.status === 'rate_limited' && <AlertCircle className="w-4 h-4 text-amber-600" />}
                              {keyItem.status === 'invalid' && <AlertCircle className="w-4 h-4 text-red-600" />}
                              {keyItem.status === 'unknown' && <Key className="w-4 h-4 text-dim" />}
                              {keyItem.status === 'testing' && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-main truncate">{keyItem.label}</p>
                                <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full font-bold ${
                                  keyItem.status === 'active' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' :
                                  keyItem.status === 'rate_limited' ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300' :
                                  keyItem.status === 'invalid' ? 'bg-red-500/10 text-red-700 dark:text-red-300' :
                                  'bg-subtle text-sub'
                                }`}>
                                  {keyItem.status}
                                </span>
                              </div>
                              <p className="text-[11px] font-mono text-dim truncate">
                                ••••••••••••{keyItem.key.slice(-6)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                            <button
                              onClick={() => handleTestKey(keyItem)}
                              disabled={isTesting}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-sub hover:text-main hover:bg-elevated border border-subtle flex items-center gap-1 transition-colors"
                            >
                              <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                              <span>{t.testKey}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteKey(keyItem.id)}
                              className="p-1 rounded-lg text-sub hover:text-red-500 hover:bg-elevated transition-colors"
                              title={t.delete}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: STORAGE & BACKUP */}
          {activeTab === 'storage' && (
            <div className="space-y-5">
              {/* Google Drive Two-Way Sync Integration */}
              <div className="p-5 rounded-2xl bg-canvas border border-subtle shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-subtle">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-main flex items-center gap-2">
                        <span>Google Drive</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold">
                          {language === 'ar' ? 'مزامنة ثنائية (قراءة وكتابة)' : '2-Way Auto Sync (Read & Write)'}
                        </span>
                      </h4>
                      <p className="text-xs text-sub">
                        {language === 'ar'
                          ? 'ربط مباشر بحساب Google لحفظ الروايات واسترجاعها تلقائياً وبأمان تام.'
                          : 'Connect your Google account for automatic two-way read/write synchronization.'}
                      </p>
                    </div>
                  </div>

                  {driveConfig.connected && (
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 font-mono">
                        {driveConfig.userEmail || (language === 'ar' ? 'متصل' : 'Connected')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status Message / Alerts */}
                {driveStatusMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                      driveStatusMsg.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                        : driveStatusMsg.type === 'error'
                        ? 'bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300'
                        : 'bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300'
                    }`}
                  >
                    {driveStatusMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : driveStatusMsg.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                    ) : (
                      <Cloud className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                    )}
                    <div className="flex-1 leading-relaxed">{driveStatusMsg.text}</div>
                    <button
                      onClick={() => setDriveStatusMsg(null)}
                      className="text-sub hover:text-main p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {!driveConfig.connected ? (
                  /* Not connected: the user brings their own Google Client ID. */
                  <DriveSetupGuide
                    language={language}
                    clientId={driveConfig.clientId || ''}
                    onChangeClientId={(clientId) => onUpdateDriveConfig({ ...driveConfig, clientId })}
                    onConnect={() => handleConnectDrive()}
                    isConnecting={isDriveConnecting}
                  />
                ) : (
                  /* Connected State: Two-Way Sync Controls */
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-surface border border-subtle">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-main flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{language === 'ar' ? 'المزامنة التلقائية الخلفية (Auto-Sync)' : 'Automatic Background Sync'}</span>
                        </span>
                        <p className="text-[11px] text-sub">
                          {language === 'ar'
                            ? 'حفظ أي تعديلات وفصول جديدة تلقائياً في Google Drive بمجرد الكتابة.'
                            : 'Automatically sync and upload library changes to Drive as you write.'}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          onUpdateDriveConfig({
                            ...driveConfig,
                            autoBackupEnabled: !driveConfig.autoBackupEnabled,
                          })
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          driveConfig.autoBackupEnabled ? 'bg-emerald-600' : 'bg-subtle'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            driveConfig.autoBackupEnabled
                              ? (language === 'ar' ? '-translate-x-5' : 'translate-x-5')
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Action Buttons for Two-Way Push & Pull */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Push to Drive (Write) */}
                      <button
                        onClick={handlePushToDrive}
                        disabled={isDrivePushing}
                        className="p-3.5 rounded-xl bg-surface hover:bg-elevated border border-subtle flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-700 dark:text-indigo-400 flex items-center justify-center">
                            {isDrivePushing ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <ArrowUpCircle className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-main block">
                              {language === 'ar' ? 'مزامنة إلى Drive (كتابة / رفع)' : 'Sync to Drive (Push / Write)'}
                            </span>
                            <span className="text-[11px] text-sub block">
                              {language === 'ar' ? 'رفع جميع الكتب والفصول الآن' : 'Save current studio library to Drive'}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-semibold px-2 py-1 rounded-md bg-canvas border border-subtle text-sub">
                          {isDrivePushing ? '...' : 'Upload'}
                        </span>
                      </button>

                      {/* Pull from Drive (Read) */}
                      <button
                        onClick={handlePullFromDrive}
                        disabled={isDrivePulling}
                        className="p-3.5 rounded-xl bg-surface hover:bg-elevated border border-subtle flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            {isDrivePulling ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <ArrowDownCircle className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-main block">
                              {language === 'ar' ? 'سحب من Drive (قراءة / استرجاع)' : 'Pull from Drive (Read / Fetch)'}
                            </span>
                            <span className="text-[11px] text-sub block">
                              {language === 'ar' ? 'استرجاع النسخة المحفوظة على Drive' : 'Restore library from Drive version'}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-semibold px-2 py-1 rounded-md bg-canvas border border-subtle text-sub">
                          {isDrivePulling ? '...' : 'Restore'}
                        </span>
                      </button>
                    </div>

                    {/* Drive Details & Disconnect */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-[11px] text-sub border-t border-subtle">
                      <div className="flex items-center gap-3">
                        <span>
                          {language === 'ar' ? 'المجلد:' : 'Folder:'}{' '}
                          <code className="font-mono px-1 py-0.5 bg-surface rounded text-main">
                            InkWeaver Studio / inkweaver_library.json
                          </code>
                        </span>
                        {driveConfig.lastSyncTime && (
                          <span>
                            {language === 'ar' ? 'آخر مزامنة:' : 'Last sync:'}{' '}
                            {new Date(driveConfig.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={handleDisconnectDrive}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 text-xs font-medium underline underline-offset-2 self-start sm:self-auto cursor-pointer"
                      >
                        {language === 'ar' ? 'إلغاء ربط Google Drive' : 'Disconnect Drive'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Free Local Storage & File Export Notice */}
              <div className="p-4 rounded-xl bg-canvas border border-subtle space-y-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-main uppercase font-mono">
                    {language === 'ar' ? 'النسخ الاحتياطي المحلي والملفات (.json)' : 'Local File Backup & Export (.json)'}
                  </h4>
                </div>
                <p className="text-xs text-sub leading-relaxed">{t.freeStorageNotice}</p>
              </div>

              {/* Backup & Restore Controls via JSON File */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-canvas border border-subtle flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-main flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>{t.backupNow}</span>
                    </h5>
                    <p className="text-[11px] text-sub leading-relaxed">
                      {language === 'ar'
                        ? 'تنزيل ملف JSON كامل يحتوي على جميع كتبك، فصولك، ومدونة الشخصيات لحفظها على حاسوبك الشخصي.'
                        : 'Download a complete JSON file with all your books, chapters, and worldbuilding codex.'}
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadBackup}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.backupNow}</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-canvas border border-subtle flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-main flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span>{t.restoreBackup}</span>
                    </h5>
                    <p className="text-[11px] text-sub leading-relaxed">
                      {language === 'ar'
                        ? 'استرجاع مكتبتك بالكامل من ملف احتياطي محفوظ سابقاً على جهازك.'
                        : 'Restore your entire library anytime from a previously saved backup file.'}
                    </p>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    onChange={handleRestoreFileSelected}
                    className="hidden"
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-canvas hover:bg-elevated text-main border border-subtle flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{t.restoreBackup}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
