import React, { useState, useEffect, useRef } from 'react';
import { 
  Book, 
  Page, 
  Chapter, 
  Volume, 
  CodexEntry, 
  Snapshot, 
  ChapterStatus, 
  ApiKeyItem, 
  GoogleDriveConfig, 
  UserPreferences,
  ThemeMode,
  AppLanguage,
  FontChoice,
  FontSize
} from './types';
import { db } from './lib/db';
import { setKeyFailoverListener } from './lib/gemini';
import { calculateTextStats } from './lib/speech';
import { useI18n } from './lib/i18n';
import { BookOpen, Plus } from 'lucide-react';
import { initDriveAuth, uploadLibraryToDrive, getCachedToken } from './lib/googleDrive';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { CodexModal } from './components/CodexModal';
import { AIAssistantDrawer } from './components/AIAssistantDrawer';
import { SettingsModal } from './components/SettingsModal';
import { ExportModal } from './components/ExportModal';
import { SnapshotModal } from './components/SnapshotModal';
import { PrintView } from './components/PrintView';
import { CorkboardView } from './components/CorkboardView';
import { ManuscriptStatsModal } from './components/ManuscriptStatsModal';
import { AuthModal } from './components/AuthModal';
import { TalkAndWriteModal } from './components/TalkAndWriteModal';
import { isStudioLocked, lockStudio, unlockStudio } from './lib/auth';

export function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLocked, setIsLocked] = useState(isStudioLocked());
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'editor' | 'corkboard'>('editor');
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [driveConfig, setDriveConfig] = useState<GoogleDriveConfig>({
    connected: false,
    autoBackupEnabled: false,
  });
  const [driveSyncState, setDriveSyncState] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // Monitor Google Drive session
  useEffect(() => {
    const unsub = initDriveAuth(
      (user, token) => {
        setDriveConfig((prev) => ({
          ...prev,
          connected: true,
          userEmail: user.email || prev.userEmail,
          accessToken: token,
        }));
      },
      () => {
        // Auth cleared
      }
    );
    return () => unsub();
  }, []);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'papyrus',
    appLanguage: 'ar',
    fontChoice: 'amiri',
    fontSize: 'lg',
    autoSaveInterval: 2,
    speechLanguage: 'ar-SA',
    defaultDirection: 'auto',
    writingGoal: {
      dailyTarget: 1000,
      todayCount: 380,
      lastDate: new Date().toISOString().slice(0, 10),
      streakDays: 4,
    },
  });

  // UI State
  const [isZenMode, setIsZenMode] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCodexOpen, setIsCodexOpen] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isTalkAndWriteOpen, setIsTalkAndWriteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSnapshotsOpen, setIsSnapshotsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  // New Book Dialog Modal
  const [isNewBookModalOpen, setIsNewBookModalOpen] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookSubtitle, setNewBookSubtitle] = useState('');
  const [newBookGenre, setNewBookGenre] = useState('');
  const [newBookDesc, setNewBookDesc] = useState('');

  // Daily word tracking starting point for the session
  const initialWordsRef = useRef<number | null>(null);

  // Initialize DB
  useEffect(() => {
    async function loadData() {
      try {
        const data = await db.init();
        setBooks(data.books);
        setActiveBookId(data.activeBookId);
        setActivePageId(data.activePageId);
        setPreferences(data.preferences);
        setApiKeys(data.apiKeys);
        setDriveConfig(data.driveConfig);

        // Apply theme to body & dark class
        document.body.setAttribute('data-theme', data.preferences.theme);
        document.documentElement.classList.toggle('dark', data.preferences.theme === 'slate');
        // Apply document language and direction
        document.documentElement.lang = data.preferences.appLanguage;
        document.documentElement.dir = data.preferences.appLanguage === 'ar' ? 'rtl' : 'ltr';

        setIsLoaded(true);
      } catch (e) {
        console.error('Failed to load database:', e);
        setIsLoaded(true);
      }
    }
    loadData();
  }, []);

  // Update theme & direction when preferences change
  useEffect(() => {
    if (!isLoaded) return;
    document.body.setAttribute('data-theme', preferences.theme);
    document.documentElement.classList.toggle('dark', preferences.theme === 'slate');
    document.documentElement.lang = preferences.appLanguage;
    document.documentElement.dir = preferences.appLanguage === 'ar' ? 'rtl' : 'ltr';
  }, [preferences.theme, preferences.appLanguage, isLoaded]);

  // Setup key failover notification
  useEffect(() => {
    setKeyFailoverListener((failedKey, nextKey) => {
      console.warn(`Gemini Key failover triggered: ${failedKey.label} -> ${nextKey ? nextKey.label : 'None'}`);
    });
  }, []);

  // Active items lookup
  const activeBook = books.find((b) => b.id === activeBookId) || books[0] || null;

  let activeChapter: Chapter | null = null;
  let activePage: Page | null = null;

  if (activeBook) {
    for (const vol of activeBook.volumes) {
      for (const ch of vol.chapters) {
        for (const pg of ch.pages) {
          if (pg.id === activePageId) {
            activePage = pg;
            activeChapter = ch;
            break;
          }
        }
        if (activePage) break;
      }
      if (activePage) break;
    }
  }

  // Fallback to first page if activePageId invalid
  useEffect(() => {
    if (activeBook && !activePage) {
      const firstPage = activeBook.volumes?.[0]?.chapters?.[0]?.pages?.[0];
      if (firstPage) {
        setActivePageId(firstPage.id);
      }
    }
  }, [activeBook, activePage]);

  // Auto-save debounced
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queueSave = (updatedBooks: Book[]) => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      await db.saveBooks(updatedBooks);
      await db.saveActivePointers(activeBookId, activePageId);
      setSaveStatus('saved');

      // Auto-sync to Google Drive in background
      const token = getCachedToken() || driveConfig.accessToken;
      if (driveConfig.connected && driveConfig.autoBackupEnabled && token) {
        setDriveSyncState('syncing');
        try {
          await uploadLibraryToDrive(token, {
            version: 1,
            appName: 'InkWeaver Studio',
            exportedAt: Date.now(),
            books: updatedBooks,
            preferences,
            activeBookId,
          });
          const updatedCfg = { ...driveConfig, lastSyncTime: Date.now() };
          setDriveConfig(updatedCfg);
          await db.saveDriveConfig(updatedCfg);
          setDriveSyncState('synced');
        } catch (syncErr) {
          console.warn('Google Drive background sync failed:', syncErr);
          setDriveSyncState('error');
        }
      }
    }, 1200);
  };

  // Content update handler
  const handleUpdatePageContent = (newContent: string) => {
    if (!activeBook || !activePage) return;

    const stats = calculateTextStats(newContent);
    const prevWords = activePage.wordCount || 0;
    const diff = Math.max(0, stats.words - prevWords);

    // Update daily count
    if (diff > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const isNewDay = preferences.writingGoal.lastDate !== today;
      const updatedGoal = {
        ...preferences.writingGoal,
        todayCount: isNewDay ? diff : preferences.writingGoal.todayCount + diff,
        lastDate: today,
        streakDays: isNewDay ? preferences.writingGoal.streakDays + 1 : preferences.writingGoal.streakDays,
      };
      const updatedPref = { ...preferences, writingGoal: updatedGoal };
      setPreferences(updatedPref);
      db.savePreferences(updatedPref);
    }

    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        updatedAt: Date.now(),
        volumes: b.volumes.map((v) => ({
          ...v,
          chapters: v.chapters.map((c) => ({
            ...c,
            pages: c.pages.map((p) => {
              if (p.id !== activePage.id) return p;
              return {
                ...p,
                content: newContent,
                wordCount: stats.words,
                updatedAt: Date.now(),
              };
            }),
          })),
        })),
      };
    });

    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  // Page title update
  const handleUpdatePageTitle = (newTitle: string) => {
    if (!activeBook || !activePage) return;
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        volumes: b.volumes.map((v) => ({
          ...v,
          chapters: v.chapters.map((c) => ({
            ...c,
            pages: c.pages.map((p) => {
              if (p.id !== activePage.id) return p;
              return { ...p, title: newTitle, updatedAt: Date.now() };
            }),
          })),
        })),
      };
    });
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  // Handle New Chapter created from speech synthesis
  const handleNewChapterFromSpeech = (title: string, prose: string) => {
    if (!activeBook) return;
    const vol = activeBook.volumes[0];
    if (!vol) return;
    const newPageId = `page-${Date.now()}`;
    const newChap: Chapter = {
      id: `chap-${Date.now()}`,
      volumeId: vol.id,
      bookId: activeBook.id,
      title: title || (preferences.appLanguage === 'ar' ? 'فصل جديد' : 'New Chapter'),
      order: vol.chapters.length + 1,
      status: 'draft',
      pages: [
        {
          id: newPageId,
          chapterId: `chap-${Date.now()}`,
          bookId: activeBook.id,
          title: title || (preferences.appLanguage === 'ar' ? 'نص مفرّغ' : 'Draft'),
          order: 1,
          content: prose,
          wordCount: prose.trim() ? prose.trim().split(/\s+/).length : 0,
          updatedAt: Date.now(),
        },
      ],
    };

    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        volumes: b.volumes.map((v) => {
          if (v.id !== vol.id) return v;
          return { ...v, chapters: [...v.chapters, newChap] };
        }),
      };
    });

    setBooks(updatedBooks);
    queueSave(updatedBooks);
    setActivePageId(newPageId);
  };

  // Add Volume
  const handleAddVolume = (title: string) => {
    if (!activeBook) return;
    const newVol: Volume = {
      id: `vol-${Date.now()}`,
      bookId: activeBook.id,
      title,
      order: activeBook.volumes.length + 1,
      chapters: [
        {
          id: `chap-${Date.now()}`,
          volumeId: `vol-${Date.now()}`,
          bookId: activeBook.id,
          title: preferences.appLanguage === 'ar' ? 'الفصل 1' : 'Chapter 1',
          order: 1,
          status: 'draft',
          pages: [
            {
              id: `page-${Date.now()}`,
              chapterId: `chap-${Date.now()}`,
              bookId: activeBook.id,
              title: preferences.appLanguage === 'ar' ? 'الصفحة 1' : 'Page 1',
              order: 1,
              content: '',
              wordCount: 0,
              updatedAt: Date.now(),
            },
          ],
        },
      ],
    };

    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return { ...b, volumes: [...b.volumes, newVol], updatedAt: Date.now() };
    });

    setBooks(updatedBooks);
    queueSave(updatedBooks);
    setActivePageId(newVol.chapters[0].pages[0].id);
  };

  // Add Chapter
  const handleAddChapter = (volumeId: string, title: string) => {
    if (!activeBook) return;
    const newPageId = `page-${Date.now()}`;
    const newChap: Chapter = {
      id: `chap-${Date.now()}`,
      volumeId,
      bookId: activeBook.id,
      title,
      order: 99,
      status: 'draft',
      pages: [
        {
          id: newPageId,
          chapterId: `chap-${Date.now()}`,
          bookId: activeBook.id,
          title: preferences.appLanguage === 'ar' ? 'المشهد الأول' : 'Scene 1',
          order: 1,
          content: '',
          wordCount: 0,
          updatedAt: Date.now(),
        },
      ],
    };

    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        volumes: b.volumes.map((v) => {
          if (v.id !== volumeId) return v;
          return { ...v, chapters: [...v.chapters, newChap] };
        }),
      };
    });

    setBooks(updatedBooks);
    queueSave(updatedBooks);
    setActivePageId(newPageId);
  };

  // Add Page
  const handleAddPage = (chapterId: string, title: string) => {
    if (!activeBook) return;
    const newPage: Page = {
      id: `page-${Date.now()}`,
      chapterId,
      bookId: activeBook.id,
      title,
      order: 99,
      content: '',
      wordCount: 0,
      updatedAt: Date.now(),
    };

    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        volumes: b.volumes.map((v) => ({
          ...v,
          chapters: v.chapters.map((c) => {
            if (c.id !== chapterId) return c;
            return { ...c, pages: [...c.pages, newPage] };
          }),
        })),
      };
    });

    setBooks(updatedBooks);
    queueSave(updatedBooks);
    setActivePageId(newPage.id);
  };

  // Delete Page
  const handleDeletePage = (pageId: string) => {
    if (!activeBook) return;
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        volumes: b.volumes.map((v) => ({
          ...v,
          chapters: v.chapters.map((c) => ({
            ...c,
            pages: c.pages.filter((p) => p.id !== pageId),
          })),
        })),
      };
    });

    setBooks(updatedBooks);
    queueSave(updatedBooks);
    if (activePageId === pageId) {
      const remainingPage = updatedBooks.find(b => b.id === activeBook.id)?.volumes[0]?.chapters[0]?.pages[0];
      setActivePageId(remainingPage ? remainingPage.id : null);
    }
  };

  // Delete Chapter
  const handleDeleteChapter = (chapterId: string) => {
    if (!activeBook) return;
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        volumes: b.volumes.map((v) => ({
          ...v,
          chapters: v.chapters.filter((c) => c.id !== chapterId),
        })),
      };
    });
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  // Update Chapter Status
  const handleUpdateChapterStatus = (chapterId: string, status: ChapterStatus) => {
    if (!activeBook) return;
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        volumes: b.volumes.map((v) => ({
          ...v,
          chapters: v.chapters.map((c) => (c.id === chapterId ? { ...c, status } : c)),
        })),
      };
    });
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  // Update Page Notes
  const handleUpdatePageNotes = (notes: string) => {
    if (!activeBook || !activePage) return;
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        volumes: b.volumes.map((v) => ({
          ...v,
          chapters: v.chapters.map((c) => ({
            ...c,
            pages: c.pages.map((p) => {
              if (p.id !== activePage.id) return p;
              return { ...p, notes, updatedAt: Date.now() };
            }),
          })),
        })),
      };
    });
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  // Rename Volume
  const handleRenameVolume = (volumeId: string, newTitle: string) => {
    if (!activeBook) return;
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        volumes: b.volumes.map((v) => (v.id === volumeId ? { ...v, title: newTitle } : v)),
      };
    });
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  // Rename Chapter
  const handleRenameChapter = (chapterId: string, newTitle: string) => {
    if (!activeBook) return;
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        volumes: b.volumes.map((v) => ({
          ...v,
          chapters: v.chapters.map((c) => (c.id === chapterId ? { ...c, title: newTitle } : c)),
        })),
      };
    });
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  // Rename Page
  const handleRenamePage = (pageId: string, newTitle: string) => {
    if (!activeBook) return;
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        volumes: b.volumes.map((v) => ({
          ...v,
          chapters: v.chapters.map((c) => ({
            ...c,
            pages: c.pages.map((p) => (p.id === pageId ? { ...p, title: newTitle } : p)),
          })),
        })),
      };
    });
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  // Move Chapter Up/Down
  const handleMoveChapter = (chapterId: string, direction: 'up' | 'down') => {
    if (!activeBook) return;
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        volumes: b.volumes.map((v) => {
          const idx = v.chapters.findIndex((c) => c.id === chapterId);
          if (idx === -1) return v;
          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= v.chapters.length) return v;
          const chaps = [...v.chapters];
          const [moved] = chaps.splice(idx, 1);
          chaps.splice(targetIdx, 0, moved);
          return { ...v, chapters: chaps };
        }),
      };
    });
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  // Move Page Up/Down
  const handleMovePage = (pageId: string, direction: 'up' | 'down') => {
    if (!activeBook) return;
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        volumes: b.volumes.map((v) => ({
          ...v,
          chapters: v.chapters.map((c) => {
            const idx = c.pages.findIndex((p) => p.id === pageId);
            if (idx === -1) return c;
            const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (targetIdx < 0 || targetIdx >= c.pages.length) return c;
            const pgs = [...c.pages];
            const [moved] = pgs.splice(idx, 1);
            pgs.splice(targetIdx, 0, moved);
            return { ...c, pages: pgs };
          }),
        })),
      };
    });
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  // Update Chapter Synopsis
  const handleUpdateChapterSynopsis = (chapterId: string, synopsis: string) => {
    if (!activeBook) return;
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        volumes: b.volumes.map((v) => ({
          ...v,
          chapters: v.chapters.map((c) => (c.id === chapterId ? { ...c, synopsis } : c)),
        })),
      };
    });
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  // Direct Book Updater (used by Settings for per-book AI & visual customization)
  const handleUpdateActiveBook = (updatedBook: Book) => {
    const updatedBooks = books.map((b) => (b.id === updatedBook.id ? { ...updatedBook, updatedAt: Date.now() } : b));
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  // Switch Active Book
  const handleSelectBook = (bookId: string) => {
    const targetBook = books.find((b) => b.id === bookId);
    if (!targetBook) return;
    setActiveBookId(targetBook.id);
    const firstPage = targetBook.volumes[0]?.chapters[0]?.pages[0];
    if (firstPage) {
      setActivePageId(firstPage.id);
    }
  };

  // Create Book
  const handleCreateNewBookSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookTitle.trim()) return;

    const newBook: Book = {
      id: `book-${Date.now()}`,
      title: newBookTitle.trim(),
      subtitle: newBookSubtitle.trim() || undefined,
      genre: newBookGenre.trim() || undefined,
      description: newBookDesc.trim() || 'A new manuscript in progress.',
      primaryLanguage: 'mixed',
      targetWordCount: 50000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      volumes: [
        {
          id: `vol-${Date.now()}`,
          bookId: `book-${Date.now()}`,
          title: preferences.appLanguage === 'ar' ? 'الجزء الأول' : 'Part I',
          order: 1,
          chapters: [
            {
              id: `chap-${Date.now()}`,
              volumeId: `vol-${Date.now()}`,
              bookId: `book-${Date.now()}`,
              title: preferences.appLanguage === 'ar' ? 'الفصل 1' : 'Chapter 1',
              order: 1,
              status: 'draft',
              pages: [
                {
                  id: `page-${Date.now()}`,
                  chapterId: `chap-${Date.now()}`,
                  bookId: `book-${Date.now()}`,
                  title: preferences.appLanguage === 'ar' ? 'المقدمة' : 'Introduction',
                  order: 1,
                  content: '',
                  wordCount: 0,
                  updatedAt: Date.now(),
                },
              ],
            },
          ],
        },
      ],
      codex: [],
      snapshots: [],
    };

    const updated = [...books, newBook];
    setBooks(updated);
    setActiveBookId(newBook.id);
    setActivePageId(newBook.volumes[0].chapters[0].pages[0].id);
    queueSave(updated);

    setIsNewBookModalOpen(false);
    setNewBookTitle('');
    setNewBookSubtitle('');
    setNewBookGenre('');
    setNewBookDesc('');
  };

  // Codex Handlers
  const handleAddCodexEntry = (entryData: Omit<CodexEntry, 'id' | 'bookId' | 'createdAt' | 'updatedAt'>) => {
    if (!activeBook) return;
    const newEntry: CodexEntry = {
      ...entryData,
      id: `codex-${Date.now()}`,
      bookId: activeBook.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return { ...b, codex: [...b.codex, newEntry] };
    });
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  const handleUpdateCodexEntry = (entryId: string, updates: Partial<CodexEntry>) => {
    if (!activeBook) return;
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return {
        ...b,
        codex: b.codex.map((e) => (e.id === entryId ? { ...e, ...updates, updatedAt: Date.now() } : e)),
      };
    });
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  const handleDeleteCodexEntry = (entryId: string) => {
    if (!activeBook) return;
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return { ...b, codex: b.codex.filter((e) => e.id !== entryId) };
    });
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  // Snapshot Handlers
  const handleCreateSnapshot = (title: string, description?: string) => {
    if (!activeBook || !activePage) return;
    const newSnap: Snapshot = {
      id: `snap-${Date.now()}`,
      bookId: activeBook.id,
      title,
      description,
      timestamp: Date.now(),
      pageId: activePage.id,
      chapterId: activeChapter?.id,
      contentSnapshot: activePage.content,
    };
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return { ...b, snapshots: [newSnap, ...b.snapshots] };
    });
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  const handleRestoreSnapshot = (snap: Snapshot) => {
    if (!activePage) return;
    handleUpdatePageContent(snap.contentSnapshot);
  };

  const handleDeleteSnapshot = (snapId: string) => {
    if (!activeBook) return;
    const updatedBooks = books.map((b) => {
      if (b.id !== activeBook.id) return b;
      return { ...b, snapshots: b.snapshots.filter((s) => s.id !== snapId) };
    });
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  // Key Status updater
  const handleUpdateKeyStatus = (keyId: string, status: ApiKeyItem['status'], error?: string) => {
    const updated = apiKeys.map((k) =>
      k.id === keyId ? { ...k, status, errorMessage: error, lastTested: Date.now() } : k
    );
    setApiKeys(updated);
    db.saveApiKeys(updated);
  };

  // Preferences updater
  const handleUpdatePreferences = (newPref: UserPreferences) => {
    setPreferences(newPref);
    db.savePreferences(newPref);
  };

  // API Keys updater
  const handleUpdateApiKeys = (keys: ApiKeyItem[]) => {
    setApiKeys(keys);
    db.saveApiKeys(keys);
  };

  // Drive Config updater
  const handleUpdateDriveConfig = (cfg: GoogleDriveConfig) => {
    setDriveConfig(cfg);
    db.saveDriveConfig(cfg);
  };

  // Restore backup
  const handleRestoreBackup = async (json: string) => {
    const data = await db.importBackup(json);
    if (data) {
      setBooks(data.books);
      setActiveBookId(data.activeBookId);
      setActivePageId(data.activePageId);
      setPreferences(data.preferences);
    }
  };

  const handleUpdateTargetWordCount = (newTarget: number) => {
    if (!activeBook) return;
    const updatedBooks = books.map((b) => (b.id === activeBook.id ? { ...b, targetWordCount: newTarget } : b));
    setBooks(updatedBooks);
    queueSave(updatedBooks);
  };

  const handleUpdateDailyGoal = (newDailyTarget: number) => {
    const updated = {
      ...preferences,
      writingGoal: {
        ...preferences.writingGoal,
        dailyTarget: newDailyTarget,
      },
    };
    handleUpdatePreferences(updated);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas text-sub">
        <div className="flex flex-col items-center gap-3">
          <span className="w-4 h-4 rounded-full bg-indigo-600 animate-ping" />
          <p className="text-xs font-mono">Opening Studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-canvas text-main flex flex-col font-sans-ui transition-colors duration-200 overflow-hidden">
      {/* Secure Auth Lock Screen */}
      {isLocked && (
        <AuthModal
          language={preferences.appLanguage}
          onSuccess={() => {
            unlockStudio();
            setIsLocked(false);
          }}
        />
      )}

      {/* Top Studio Header */}
      <Header
        books={books}
        activeBook={activeBook}
        onSelectBook={(id) => {
          setActiveBookId(id);
          const book = books.find((b) => b.id === id);
          const firstPage = book?.volumes?.[0]?.chapters?.[0]?.pages?.[0];
          setActivePageId(firstPage ? firstPage.id : null);
          db.saveActivePointers(id, firstPage ? firstPage.id : null);
        }}
        onNewBook={() => setIsNewBookModalOpen(true)}
        theme={preferences.theme}
        onToggleTheme={(thm) => handleUpdatePreferences({ ...preferences, theme: thm })}
        language={preferences.appLanguage}
        onToggleLanguage={(lang) => handleUpdatePreferences({ ...preferences, appLanguage: lang })}
        isZenMode={isZenMode}
        onToggleZenMode={() => setIsZenMode((prev) => !prev)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenCodex={() => setIsCodexOpen(true)}
        onOpenSnapshots={() => setIsSnapshotsOpen(true)}
        onOpenAIAssistant={() => setIsAiDrawerOpen(true)}
        onOpenTalkAndWrite={() => setIsTalkAndWriteOpen(true)}
        onOpenStats={() => setIsStatsOpen(true)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        apiKeys={apiKeys}
        hasDefaultKey={true}
        dailyGoal={{
          target: preferences.writingGoal.dailyTarget,
          current: preferences.writingGoal.todayCount,
          streak: preferences.writingGoal.streakDays,
        }}
        saveStatus={saveStatus}
        driveConfig={driveConfig}
        driveSyncState={driveSyncState}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode(prev => prev === 'editor' ? 'corkboard' : 'editor')}
        onLockStudio={() => {
          lockStudio();
          setIsLocked(true);
        }}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Book Structure Explorer (Hidden in Zen Mode) */}
        {!isZenMode && activeBook && (
          <Sidebar
            book={activeBook}
            activePageId={activePageId}
            onSelectPage={(id) => {
              setActivePageId(id);
              db.saveActivePointers(activeBookId, id);
            }}
            onAddVolume={handleAddVolume}
            onAddChapter={handleAddChapter}
            onAddPage={handleAddPage}
            onDeletePage={handleDeletePage}
            onDeleteChapter={handleDeleteChapter}
            onUpdateChapterStatus={handleUpdateChapterStatus}
            isOpenMobile={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
            language={preferences.appLanguage}
            viewMode={viewMode}
            onToggleViewMode={() => setViewMode(prev => prev === 'editor' ? 'corkboard' : 'editor')}
            onRenameVolume={handleRenameVolume}
            onRenameChapter={handleRenameChapter}
            onRenamePage={handleRenamePage}
            onMoveChapter={handleMoveChapter}
            onMovePage={handleMovePage}
          />
        )}

        {/* Central Writing Canvas or Corkboard Overview */}
        {activeBook ? (
          viewMode === 'corkboard' ? (
            <CorkboardView
              book={activeBook}
              activePageId={activePageId}
              onSelectPage={(id) => {
                setActivePageId(id);
                db.saveActivePointers(activeBookId, id);
                setViewMode('editor');
              }}
              onUpdatePageTitle={handleRenamePage}
              onUpdateChapterSynopsis={handleUpdateChapterSynopsis}
              onUpdateChapterStatus={handleUpdateChapterStatus}
              onAddPage={handleAddPage}
              onAddChapter={handleAddChapter}
              language={preferences.appLanguage}
              onSwitchToEditor={() => setViewMode('editor')}
            />
          ) : (
            <Editor
              book={activeBook}
              chapter={activeChapter}
              page={activePage}
              onUpdateContent={handleUpdatePageContent}
              onUpdateTitle={handleUpdatePageTitle}
              onUpdateNotes={handleUpdatePageNotes}
              fontChoice={preferences.fontChoice}
              onChangeFontChoice={(font) => handleUpdatePreferences({ ...preferences, fontChoice: font })}
              fontSize={preferences.fontSize}
              onChangeFontSize={(size) => handleUpdatePreferences({ ...preferences, fontSize: size })}
              editorMaxWidth={preferences.editorMaxWidth || 'full'}
              onChangeEditorMaxWidth={(width) => handleUpdatePreferences({ ...preferences, editorMaxWidth: width })}
              language={preferences.appLanguage}
              apiKeys={apiKeys}
              onUpdateKeyStatus={handleUpdateKeyStatus}
              isZenMode={isZenMode}
              onToggleZenMode={() => setIsZenMode((prev) => !prev)}
              onOpenTalkAndWrite={() => setIsTalkAndWriteOpen(true)}
            />
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-canvas text-center">
            <div className="w-16 h-16 rounded-3xl bg-indigo-600/10 border border-indigo-600/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 mb-4 shadow-sm">
              <BookOpen className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-main font-serif mb-2">
              {preferences.appLanguage === 'ar' ? 'لا توجد كتب مضافة بعد' : 'No books in your library'}
            </h2>
            <p className="text-xs text-sub max-w-sm mb-6 leading-relaxed">
              {preferences.appLanguage === 'ar'
                ? 'ابدأ بكتابة روايتك أو كتابك الأول الآن عبر إنشاء مشروع جديد بكل لغات الإبداع.'
                : 'Start writing your first novel or manuscript by creating a new book project.'}
            </p>
            <button
              onClick={() => setIsNewBookModalOpen(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{preferences.appLanguage === 'ar' ? 'إنشاء كتاب جديد' : 'Create New Book'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Codex / Worldbuilding Bible Modal */}
      {activeBook && (
        <CodexModal
          book={activeBook}
          isOpen={isCodexOpen}
          onClose={() => setIsCodexOpen(false)}
          onAddEntry={handleAddCodexEntry}
          onUpdateEntry={handleUpdateCodexEntry}
          onDeleteEntry={handleDeleteCodexEntry}
          language={preferences.appLanguage}
          apiKeys={apiKeys}
          onUpdateKeyStatus={handleUpdateKeyStatus}
        />
      )}

      {/* AI Studio Assistant Drawer (Chat with Book & Continuity RAG) */}
      {activeBook && (
        <AIAssistantDrawer
          isOpen={isAiDrawerOpen}
          onClose={() => setIsAiDrawerOpen(false)}
          book={activeBook}
          activeChapter={activeChapter}
          activePage={activePage}
          onInsertToPage={(text) => {
            if (activePage) {
              const newContent = activePage.content + (activePage.content ? '\n\n' : '') + text;
              handleUpdatePageContent(newContent);
            }
          }}
          language={preferences.appLanguage}
          apiKeys={apiKeys}
          onUpdateKeyStatus={handleUpdateKeyStatus}
          onOpenTalkAndWrite={() => setIsTalkAndWriteOpen(true)}
        />
      )}

      {/* Talk & Write Studio Modal (Talk to AI -> Writes Book Chapters & Non-Fiction Prose) */}
      {activeBook && (
        <TalkAndWriteModal
          isOpen={isTalkAndWriteOpen}
          onClose={() => setIsTalkAndWriteOpen(false)}
          book={activeBook}
          activeChapter={activeChapter}
          activePage={activePage}
          onInsertToPage={(text) => {
            if (activePage) {
              const newContent = activePage.content + (activePage.content ? '\n\n' : '') + text;
              handleUpdatePageContent(newContent);
            }
          }}
          onNewChapterFromSpeech={handleNewChapterFromSpeech}
          language={preferences.appLanguage}
          apiKeys={apiKeys}
          onUpdateKeyStatus={handleUpdateKeyStatus}
        />
      )}

      {/* Settings Modal (Gemini Key Pool Manager, Google Drive Backup, Preferences, Per-Book Customization) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKeys={apiKeys}
        onUpdateApiKeys={handleUpdateApiKeys}
        driveConfig={driveConfig}
        onUpdateDriveConfig={handleUpdateDriveConfig}
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
        onRestoreBackup={handleRestoreBackup}
        language={preferences.appLanguage}
        books={books}
        activeBook={activeBook}
        onUpdateBook={handleUpdateActiveBook}
        onSelectBook={handleSelectBook}
        onNewBook={() => {
          setIsSettingsOpen(false);
          setIsNewBookModalOpen(true);
        }}
      />

      {/* Export Modal (DOCX, PDF, Markdown, Text) */}
      {activeBook && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          book={activeBook}
          activeChapter={activeChapter}
          activePage={activePage}
          language={preferences.appLanguage}
        />
      )}

      {/* Snapshots / Version History Modal */}
      {activeBook && (
        <SnapshotModal
          isOpen={isSnapshotsOpen}
          onClose={() => setIsSnapshotsOpen(false)}
          book={activeBook}
          activePage={activePage}
          onCreateSnapshot={handleCreateSnapshot}
          onRestoreSnapshot={handleRestoreSnapshot}
          onDeleteSnapshot={handleDeleteSnapshot}
          language={preferences.appLanguage}
        />
      )}

      {/* Manuscript Analytics & Goals Modal */}
      {activeBook && (
        <ManuscriptStatsModal
          isOpen={isStatsOpen}
          onClose={() => setIsStatsOpen(false)}
          book={activeBook}
          writingGoal={preferences.writingGoal}
          onUpdateTargetWordCount={handleUpdateTargetWordCount}
          onUpdateDailyGoal={handleUpdateDailyGoal}
          language={preferences.appLanguage}
        />
      )}

      {/* Modal: Create New Book */}
      {isNewBookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
          <div className="w-full max-w-md bg-surface border border-subtle rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <h3 className="text-sm font-bold text-main">
                {preferences.appLanguage === 'ar' ? 'إنشاء كتاب أو رواية جديدة' : 'Create New Book'}
              </h3>
              <button
                onClick={() => setIsNewBookModalOpen(false)}
                className="text-sub hover:text-main text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewBookSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-sub block mb-1">
                  {preferences.appLanguage === 'ar' ? 'عنوان الكتاب *' : 'Book Title *'}
                </label>
                <input
                  type="text"
                  required
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                  placeholder="e.g. سراج في الضباب / The Whispering Lantern"
                  className="w-full bg-canvas border border-subtle rounded-lg px-3 py-2 text-xs text-main focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-sub block mb-1">
                  {preferences.appLanguage === 'ar' ? 'العنوان الفرعي' : 'Subtitle'}
                </label>
                <input
                  type="text"
                  value={newBookSubtitle}
                  onChange={(e) => setNewBookSubtitle(e.target.value)}
                  placeholder="e.g. Volume I"
                  className="w-full bg-canvas border border-subtle rounded-lg px-3 py-2 text-xs text-main focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-sub block mb-1">
                  {preferences.appLanguage === 'ar' ? 'التصنيف الأدبي' : 'Genre'}
                </label>
                <input
                  type="text"
                  value={newBookGenre}
                  onChange={(e) => setNewBookGenre(e.target.value)}
                  placeholder="e.g. خيال تاريخي / Historical Fiction"
                  className="w-full bg-canvas border border-subtle rounded-lg px-3 py-2 text-xs text-main focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-sub block mb-1">
                  {preferences.appLanguage === 'ar' ? 'نبذة ومقدمة العمل' : 'Premise / Description'}
                </label>
                <textarea
                  rows={3}
                  value={newBookDesc}
                  onChange={(e) => setNewBookDesc(e.target.value)}
                  placeholder="e.g. The core conflict, setting, and emotional stakes..."
                  className="w-full bg-canvas border border-subtle rounded-lg p-2.5 text-xs text-main focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle">
                <button
                  type="button"
                  onClick={() => setIsNewBookModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-sub hover:text-main"
                >
                  {preferences.appLanguage === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  {preferences.appLanguage === 'ar' ? 'إنشاء الكتاب' : 'Create Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden print element typeset for printing PDF directly */}
      {activeBook && <PrintView book={activeBook} />}
    </div>
  );
}
export default App;
