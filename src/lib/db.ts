import { Book, UserPreferences, ApiKeyItem, GoogleDriveConfig } from '../types';

const DB_NAME = 'AuthorStudioDB';
const DB_VERSION = 1;

interface StudioDBData {
  books: Book[];
  activeBookId: string | null;
  activePageId: string | null;
  preferences: UserPreferences;
  apiKeys: ApiKeyItem[];
  driveConfig: GoogleDriveConfig;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'papyrus',
  appLanguage: 'ar',
  fontChoice: 'amiri',
  fontSize: 'lg',
  autoSaveInterval: 2,
  speechLanguage: 'ar-SA',
  defaultDirection: 'auto',
  writingGoal: {
    dailyTarget: 1000,
    todayCount: 0,
    lastDate: new Date().toISOString().slice(0, 10),
    streakDays: 0,
  },
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('store')) {
        db.createObjectStore('store');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getFromStore<T>(key: string): Promise<T | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('store', 'readonly');
      const store = transaction.objectStore('store');
      const request = store.get(key);

      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`IndexedDB read failed for key ${key}, using memory fallback`, err);
    const item = localStorage.getItem(`author_studio_${key}`);
    return item ? JSON.parse(item) : null;
  }
}

async function saveToStore<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('store', 'readwrite');
      const store = transaction.objectStore('store');
      const request = store.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`IndexedDB save failed for key ${key}, using localStorage fallback`, err);
    try {
      localStorage.setItem(`author_studio_${key}`, JSON.stringify(value));
    } catch (e) {
      console.error('LocalStorage save failed:', e);
    }
  }
}

export const db = {
  async init(): Promise<StudioDBData> {
    let books = await getFromStore<Book[]>('books');
    let activeBookId = await getFromStore<string>('activeBookId');
    let activePageId = await getFromStore<string>('activePageId');
    let preferences = await getFromStore<UserPreferences>('preferences');
    let apiKeys = await getFromStore<ApiKeyItem[]>('apiKeys');
    let driveConfig = await getFromStore<GoogleDriveConfig>('driveConfig');

    if (!books) {
      books = [];
      await saveToStore('books', books);
    }

    if (!activeBookId && books.length > 0) {
      activeBookId = books[0].id;
    }

    if (!activePageId && books.length > 0) {
      const firstPage = books[0].volumes?.[0]?.chapters?.[0]?.pages?.[0];
      activePageId = firstPage ? firstPage.id : null;
    }

    if (!preferences) {
      preferences = DEFAULT_PREFERENCES;
      await saveToStore('preferences', preferences);
    }

    if (!apiKeys) {
      apiKeys = [];
      await saveToStore('apiKeys', apiKeys);
    }

    if (!driveConfig) {
      driveConfig = {
        connected: false,
        autoBackupEnabled: false,
      };
      await saveToStore('driveConfig', driveConfig);
    }

    return {
      books,
      activeBookId,
      activePageId,
      preferences,
      apiKeys,
      driveConfig,
    };
  },

  async saveBooks(books: Book[]): Promise<void> {
    await saveToStore('books', books);
  },

  async saveActivePointers(bookId: string | null, pageId: string | null): Promise<void> {
    await saveToStore('activeBookId', bookId);
    await saveToStore('activePageId', pageId);
  },

  async savePreferences(preferences: UserPreferences): Promise<void> {
    await saveToStore('preferences', preferences);
  },

  async saveApiKeys(apiKeys: ApiKeyItem[]): Promise<void> {
    await saveToStore('apiKeys', apiKeys);
  },

  async saveDriveConfig(driveConfig: GoogleDriveConfig): Promise<void> {
    await saveToStore('driveConfig', driveConfig);
  },

  async clearAll(): Promise<void> {
    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('store', 'readwrite');
        const store = transaction.objectStore('store');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('Clear DB error:', e);
    }
    localStorage.clear();
  },

  async exportBackup(): Promise<string> {
    const books = await getFromStore<Book[]>('books') || [];
    const preferences = await getFromStore<UserPreferences>('preferences');
    const apiKeys = await getFromStore<ApiKeyItem[]>('apiKeys') || [];
    const data = { books, preferences, apiKeys, version: 1, exportedAt: new Date().toISOString() };
    return JSON.stringify(data, null, 2);
  },

  async importBackup(jsonString: string): Promise<StudioDBData | null> {
    try {
      const data = JSON.parse(jsonString);
      if (data && Array.isArray(data.books)) {
        await saveToStore('books', data.books);
        if (data.preferences) await saveToStore('preferences', data.preferences);
        if (Array.isArray(data.apiKeys)) await saveToStore('apiKeys', data.apiKeys);
        return await db.init();
      }
    } catch (e) {
      console.error('Import backup error:', e);
    }
    return null;
  },
};
