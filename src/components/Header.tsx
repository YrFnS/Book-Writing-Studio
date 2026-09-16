import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  Settings as SettingsIcon, 
  Download, 
  Sparkles, 
  Compass, 
  History, 
  Maximize2, 
  Sun, 
  Moon, 
  Coffee, 
  Languages, 
  Menu,
  CheckCircle2,
  AlertCircle,
  Plus,
  LayoutGrid,
  FileEdit,
  BarChart3,
  MoreVertical,
  X,
  Lock,
  Wrench,
  Cloud,
  RefreshCw,
  Mic
} from 'lucide-react';
import { Book, ThemeMode, AppLanguage, ApiKeyItem, GoogleDriveConfig } from '../types';
import { useI18n } from '../lib/i18n';

interface HeaderProps {
  books: Book[];
  activeBook: Book | null;
  onSelectBook: (bookId: string) => void;
  onNewBook: () => void;
  theme: ThemeMode;
  onToggleTheme: (theme: ThemeMode) => void;
  language: AppLanguage;
  onToggleLanguage: (lang: AppLanguage) => void;
  isZenMode: boolean;
  onToggleZenMode: () => void;
  onOpenSettings: () => void;
  onOpenExport: () => void;
  onOpenCodex: () => void;
  onOpenSnapshots: () => void;
  onOpenAIAssistant: () => void;
  onOpenTalkAndWrite?: () => void;
  onOpenStats?: () => void;
  onToggleMobileSidebar: () => void;
  apiKeys: ApiKeyItem[];
  hasDefaultKey: boolean;
  dailyGoal: { target: number; current: number; streak: number };
  saveStatus: 'saved' | 'saving';
  viewMode?: 'editor' | 'corkboard';
  onToggleViewMode?: () => void;
  onLockStudio?: () => void;
  driveConfig?: GoogleDriveConfig;
  driveSyncState?: 'idle' | 'syncing' | 'synced' | 'error';
}

export const Header: React.FC<HeaderProps> = ({
  books,
  activeBook,
  onSelectBook,
  onNewBook,
  theme,
  onToggleTheme,
  language,
  onToggleLanguage,
  isZenMode,
  onToggleZenMode,
  onOpenSettings,
  onOpenExport,
  onOpenCodex,
  onOpenSnapshots,
  onOpenAIAssistant,
  onOpenTalkAndWrite,
  onOpenStats,
  onToggleMobileSidebar,
  apiKeys,
  hasDefaultKey,
  dailyGoal,
  saveStatus,
  viewMode = 'editor',
  onToggleViewMode,
  onLockStudio,
  driveConfig,
  driveSyncState,
}) => {
  const t = useI18n(language);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [showDesktopMenu, setShowDesktopMenu] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement>(null);

  const activeKeysCount = apiKeys.filter(k => k.status === 'active').length;
  const isHealthy = activeKeysCount > 0 || hasDefaultKey;
  const goalProgress = Math.min(100, Math.round((dailyGoal.current / (dailyGoal.target || 1)) * 100));

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
      }
      if (desktopMenuRef.current && !desktopMenuRef.current.contains(e.target as Node)) {
        setShowDesktopMenu(false);
      }
    };
    if (showMobileMenu || showDesktopMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMobileMenu, showDesktopMenu]);

  if (isZenMode) {
    return (
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <button
          onClick={onToggleZenMode}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface text-main border border-subtle shadow-sm hover:opacity-90 flex items-center gap-1.5 transition-all"
          title={t.exitZen}
        >
          <Maximize2 className="w-3.5 h-3.5 rotate-45" />
          <span>{t.exitZen}</span>
        </button>
      </div>
    );
  }

  return (
    <header className="no-print h-14 border-b border-subtle bg-surface/95 backdrop-blur-md px-2 sm:px-5 flex items-center justify-between gap-2 z-30 select-none relative">
      {/* Left side: Hamburger (mobile), Logo, Book Selector */}
      <div className="flex items-center gap-1.5 sm:gap-4 min-w-0 flex-1">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-1.5 rounded-lg text-sub hover:text-main hover:bg-elevated transition-colors shrink-0"
          aria-label="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/15 border border-indigo-600/25 flex items-center justify-center text-indigo-700 dark:text-indigo-300 shrink-0">
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>

          {/* Book Dropdown & Quick Create */}
          <div className="flex items-center gap-1 min-w-0">
            <select
              value={activeBook?.id || ''}
              onChange={(e) => {
                if (e.target.value === 'NEW') {
                  onNewBook();
                } else {
                  onSelectBook(e.target.value);
                }
              }}
              className="bg-canvas border border-subtle rounded-lg px-2 py-1 text-xs sm:text-sm font-semibold text-main focus:outline-none focus:ring-1 focus:ring-indigo-600/50 cursor-pointer max-w-[110px] xs:max-w-[140px] sm:max-w-[210px] truncate"
              title={activeBook?.title}
            >
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
              <option value="NEW">➕ {t.newBook}</option>
            </select>

            <button
              onClick={onNewBook}
              title={t.newBook}
              className="p-1 sm:px-2 sm:py-1 rounded-lg text-indigo-700 dark:text-indigo-300 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-600/25 flex items-center gap-1 shrink-0 text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t.newBook}</span>
            </button>
          </div>
        </div>

        {/* Save indicator & daily goal pill (desktop) */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-sub border-s border-subtle ps-3">
          <div className="flex items-center gap-1" title={t.saved}>
            <CheckCircle2 className={`w-3.5 h-3.5 ${saveStatus === 'saving' ? 'text-indigo-600 animate-pulse' : 'text-emerald-700 dark:text-emerald-400'}`} />
            <span className="text-[11px] font-mono">{saveStatus === 'saving' ? t.saving : t.saved}</span>
          </div>

          {driveConfig?.connected && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 transition-colors cursor-pointer"
              title={
                language === 'ar'
                  ? `Google Drive: ${driveSyncState === 'syncing' ? 'جارٍ المزامنة السحابية...' : 'متصل ومزامن تلقائياً'}`
                  : `Google Drive: ${driveSyncState === 'syncing' ? 'Syncing to Drive...' : 'Connected & Auto-Synced'}`
              }
            >
              {driveSyncState === 'syncing' ? (
                <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
              ) : (
                <Cloud className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              )}
              <span className="text-[10px] font-mono font-semibold">
                {driveSyncState === 'syncing' ? (language === 'ar' ? 'مزامنة...' : 'Syncing...') : 'Drive'}
              </span>
            </button>
          )}

          <button
            onClick={onOpenStats}
            className="flex items-center gap-1.5 bg-canvas px-2.5 py-1 rounded-full border border-subtle hover:border-indigo-600/50 hover:bg-elevated cursor-pointer transition-all" 
            title={`${dailyGoal.current} / ${dailyGoal.target} ${t.words} - ${t.statsTitle}`}
          >
            <span className="text-[11px] font-mono font-medium">{dailyGoal.current}/{dailyGoal.target} {t.words}</span>
            <div className="w-10 h-1.5 bg-elevated rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300 rounded-full"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
            {dailyGoal.streak > 0 && (
              <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold">🔥{dailyGoal.streak}d</span>
            )}
          </button>
        </div>
      </div>

      {/* Right side: Desktop Studio Actions */}
      <div className="hidden md:flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Talk & Write with AI (Personal Scribe) */}
        {onOpenTalkAndWrite && (
          <button
            onClick={onOpenTalkAndWrite}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 border border-indigo-200 dark:border-indigo-800 shadow-xs transition-all hover:scale-102"
            title={language === 'ar' ? 'تحدث واكتب مع الذكاء الاصطناعي (كاتب شخصي)' : 'Talk & Write with AI Scribe'}
          >
            <Mic className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden lg:inline">{language === 'ar' ? 'تحدّث واكتب' : 'Talk & Write'}</span>
          </button>
        )}

        {/* AI Assistant (Chat with Book) */}
        <button
          onClick={onOpenAIAssistant}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
          title={t.aiAssistant}
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
          <span className="hidden sm:inline">{t.aiAssistant}</span>
        </button>

        <div className="h-4 w-px bg-subtle mx-0.5" />

        {/* Eye Comfort Theme Switcher: Papyrus / Slate / Sand */}
        <div className="flex items-center bg-canvas rounded-lg p-0.5 border border-subtle shadow-xs">
          <button
            onClick={() => onToggleTheme('papyrus')}
            className={`p-1.5 rounded-md transition-colors ${theme === 'papyrus' ? 'bg-surface text-main font-bold shadow-xs' : 'text-dim hover:text-main'}`}
            title={t.themePapyrus}
          >
            <Coffee className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onToggleTheme('sand')}
            className={`p-1.5 rounded-md transition-colors ${theme === 'sand' ? 'bg-surface text-main font-bold shadow-xs' : 'text-dim hover:text-main'}`}
            title={t.themeSand}
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onToggleTheme('slate')}
            className={`p-1.5 rounded-md transition-colors ${theme === 'slate' ? 'bg-surface text-main font-bold shadow-xs' : 'text-dim hover:text-main'}`}
            title={t.themeSlate}
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Language Switcher (EN / AR) */}
        <button
          onClick={() => onToggleLanguage(language === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-main bg-surface hover:bg-elevated border border-subtle transition-colors shadow-xs"
          title="Toggle Language / تبديل اللغة"
        >
          <Languages className="w-3.5 h-3.5 text-main" />
          <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
        </button>

        {/* Desktop Overflow Menu Trigger for Tools & Secondary Actions */}
        <div className="relative" ref={desktopMenuRef}>
          <button
            onClick={() => setShowDesktopMenu(prev => !prev)}
            className={`px-3 py-1.5 rounded-lg transition-colors border shadow-xs flex items-center gap-1.5 text-xs font-semibold ${
              showDesktopMenu
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-surface text-main hover:bg-elevated border-subtle'
            }`}
            title={language === 'ar' ? 'أدوات الكتابة' : 'Writing Tools'}
          >
            <Wrench className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{language === 'ar' ? 'الأدوات' : 'Tools'}</span>
          </button>

          {/* Desktop Dropdown Menu */}
          {showDesktopMenu && (
            <div className="absolute right-0 rtl:left-0 rtl:right-auto top-full mt-2 w-60 p-2 rounded-2xl bg-surface border border-subtle shadow-2xl space-y-1 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-2 py-1 border-b border-subtle/50 text-[11px] font-bold text-dim uppercase font-mono">
                <span>{language === 'ar' ? 'أدوات الاستوديو والسرد' : 'Studio & Writing Tools'}</span>
                <button onClick={() => setShowDesktopMenu(false)} className="text-dim hover:text-main">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Manuscript Analytics / Progress Stats */}
              {onOpenStats && (
                <button
                  onClick={() => {
                    onOpenStats();
                    setShowDesktopMenu(false);
                  }}
                  className="w-full text-start px-2.5 py-1.5 rounded-lg text-xs text-main hover:bg-elevated flex items-center gap-2"
                >
                  <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{t.statsTitle}</span>
                </button>
              )}

              {/* Corkboard / Editor View Switcher */}
              {onToggleViewMode && (
                <button
                  onClick={() => {
                    onToggleViewMode();
                    setShowDesktopMenu(false);
                  }}
                  className="w-full text-start px-2.5 py-1.5 rounded-lg text-xs text-main hover:bg-elevated flex items-center gap-2"
                >
                  {viewMode === 'corkboard' ? <FileEdit className="w-4 h-4 text-main" /> : <LayoutGrid className="w-4 h-4 text-main" />}
                  <span>{viewMode === 'corkboard' ? t.editorView : t.corkboard}</span>
                </button>
              )}

              {/* Codex / Story Bible */}
              <button
                onClick={() => {
                  onOpenCodex();
                  setShowDesktopMenu(false);
                }}
                className="w-full text-start px-2.5 py-1.5 rounded-lg text-xs text-main hover:bg-elevated flex items-center gap-2"
              >
                <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{t.codex}</span>
              </button>

              <div className="h-px bg-subtle/60 my-1" />

              {/* Export */}
              <button
                onClick={() => {
                  onOpenExport();
                  setShowDesktopMenu(false);
                }}
                className="w-full text-start px-2.5 py-1.5 rounded-lg text-xs text-main hover:bg-elevated flex items-center gap-2"
              >
                <Download className="w-4 h-4 text-main" />
                <span>{t.export}</span>
              </button>

              {/* Version History / Snapshots */}
              <button
                onClick={() => {
                  onOpenSnapshots();
                  setShowDesktopMenu(false);
                }}
                className="w-full text-start px-2.5 py-1.5 rounded-lg text-xs text-main hover:bg-elevated flex items-center gap-2"
              >
                <History className="w-4 h-4 text-main" />
                <span>{t.snapshots}</span>
              </button>

              {/* Zen Mode */}
              <button
                onClick={() => {
                  onToggleZenMode();
                  setShowDesktopMenu(false);
                }}
                className="w-full text-start px-2.5 py-1.5 rounded-lg text-xs text-main hover:bg-elevated flex items-center gap-2"
              >
                <Maximize2 className="w-4 h-4 text-main" />
                <span>{t.zenMode}</span>
              </button>

              {/* Lock Studio */}
              {onLockStudio && (
                <button
                  onClick={() => {
                    onLockStudio();
                    setShowDesktopMenu(false);
                  }}
                  className="w-full text-start px-2.5 py-1.5 rounded-lg text-xs text-main hover:bg-elevated flex items-center gap-2"
                >
                  <Lock className="w-4 h-4 text-main" />
                  <span>{language === 'ar' ? 'قفل الاستوديو' : 'Lock Studio'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Settings button with key health status dot */}
        <button
          onClick={onOpenSettings}
          className="relative p-2 rounded-lg text-main bg-surface hover:bg-elevated border border-subtle transition-colors shadow-xs"
          title={t.settings}
        >
          <SettingsIcon className="w-4 h-4 text-main" />
          <span 
            className={`absolute top-1 right-1 w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-amber-600 animate-pulse'}`}
            title={isHealthy ? t.keyStatusActive : t.keyStatusRateLimited}
          />
        </button>
      </div>

      {/* Right side: Mobile Action Bar (Strict single-row, no overlapping!) */}
      <div className="flex md:hidden items-center gap-1 shrink-0">
        {/* AI Quick Button */}
        <button
          onClick={onOpenAIAssistant}
          className="p-1.5 rounded-lg bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 border border-indigo-600/25"
          title={t.aiAssistant}
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* View mode toggle */}
        {onToggleViewMode && (
          <button
            onClick={onToggleViewMode}
            className="p-1.5 rounded-lg bg-canvas text-sub border border-subtle"
            title={viewMode === 'corkboard' ? t.editorView : t.corkboard}
          >
            {viewMode === 'corkboard' ? <FileEdit className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
          </button>
        )}

        {/* Quick Language Toggle */}
        <button
          onClick={() => onToggleLanguage(language === 'ar' ? 'en' : 'ar')}
          className="px-1.5 py-1 rounded-lg text-[11px] font-bold bg-canvas border border-subtle text-main"
          title="Toggle Language"
        >
          {language === 'ar' ? 'EN' : 'عربي'}
        </button>

        {/* More Actions Dropdown Trigger */}
        <div className="relative" ref={mobileMenuRef}>
          <button
            onClick={() => setShowMobileMenu(prev => !prev)}
            className={`p-1.5 rounded-lg transition-colors border ${
              showMobileMenu 
                ? 'bg-indigo-600 text-white border-indigo-600' 
                : 'bg-canvas text-sub hover:text-main border-subtle'
            }`}
            aria-label="Studio Actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Mobile Actions Drawer Menu */}
          {showMobileMenu && (
            <div className="absolute right-0 rtl:left-0 rtl:right-auto top-full mt-2 w-56 p-2 rounded-2xl bg-surface border border-subtle shadow-2xl space-y-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-2 py-1 border-b border-subtle/50 text-[11px] font-bold text-dim uppercase font-mono">
                <span>{language === 'ar' ? 'أدوات الاستوديو' : 'Studio Actions'}</span>
                <button onClick={() => setShowMobileMenu(false)} className="text-dim hover:text-main">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Talk & Write with AI */}
              {onOpenTalkAndWrite && (
                <button
                  onClick={() => {
                    onOpenTalkAndWrite();
                    setShowMobileMenu(false);
                  }}
                  className="w-full text-start px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 flex items-center gap-2"
                >
                  <Mic className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{language === 'ar' ? 'تحدّث واكتب (AI Scribe)' : 'Talk & Write with AI'}</span>
                </button>
              )}

              {/* Codex / Story Bible */}
              <button
                onClick={() => {
                  onOpenCodex();
                  setShowMobileMenu(false);
                }}
                className="w-full text-start px-2.5 py-1.5 rounded-lg text-xs text-main hover:bg-elevated flex items-center gap-2"
              >
                <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{t.codex}</span>
              </button>

              {/* Stats */}
              {onOpenStats && (
                <button
                  onClick={() => {
                    onOpenStats();
                    setShowMobileMenu(false);
                  }}
                  className="w-full text-start px-2.5 py-1.5 rounded-lg text-xs text-main hover:bg-elevated flex items-center gap-2"
                >
                  <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{t.statsTitle}</span>
                </button>
              )}

              {/* Snapshots */}
              <button
                onClick={() => {
                  onOpenSnapshots();
                  setShowMobileMenu(false);
                }}
                className="w-full text-start px-2.5 py-1.5 rounded-lg text-xs text-main hover:bg-elevated flex items-center gap-2"
              >
                <History className="w-4 h-4" />
                <span>{t.snapshots}</span>
              </button>

              {/* Export */}
              <button
                onClick={() => {
                  onOpenExport();
                  setShowMobileMenu(false);
                }}
                className="w-full text-start px-2.5 py-1.5 rounded-lg text-xs text-main hover:bg-elevated flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>{t.export}</span>
              </button>

              {/* Zen Mode */}
              <button
                onClick={() => {
                  onToggleZenMode();
                  setShowMobileMenu(false);
                }}
                className="w-full text-start px-2.5 py-1.5 rounded-lg text-xs text-main hover:bg-elevated flex items-center gap-2"
              >
                <Maximize2 className="w-4 h-4" />
                <span>{t.zenMode}</span>
              </button>

              {/* Theme Switcher inside Mobile Menu */}
              <div className="pt-1 border-t border-subtle/50 px-2.5 py-1 flex items-center justify-between">
                <span className="text-[11px] text-dim">{language === 'ar' ? 'المظهر' : 'Theme'}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onToggleTheme('papyrus')}
                    className={`p-1 rounded ${theme === 'papyrus' ? 'bg-indigo-600/20 text-indigo-950 dark:text-indigo-200 font-bold' : 'text-dim'}`}
                    title={t.themePapyrus}
                  >
                    <Coffee className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onToggleTheme('sand')}
                    className={`p-1 rounded ${theme === 'sand' ? 'bg-indigo-600/20 text-indigo-950 dark:text-indigo-200 font-bold' : 'text-dim'}`}
                    title={t.themeSand}
                  >
                    <Sun className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onToggleTheme('slate')}
                    className={`p-1 rounded ${theme === 'slate' ? 'bg-indigo-600/20 text-indigo-950 dark:text-indigo-200 font-bold' : 'text-dim'}`}
                    title={t.themeSlate}
                  >
                    <Moon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Settings */}
              <button
                onClick={() => {
                  onOpenSettings();
                  setShowMobileMenu(false);
                }}
                className="w-full text-start px-2.5 py-1.5 rounded-lg text-xs text-main hover:bg-elevated flex items-center justify-between pt-1.5 border-t border-subtle/50"
              >
                <div className="flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4" />
                  <span>{t.settings}</span>
                </div>
                <span 
                  className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-600' : 'bg-amber-600'}`}
                />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
