export type ThemeMode = 'papyrus' | 'slate' | 'sand';
export type AppLanguage = 'en' | 'ar';
export type FontChoice = 'amiri' | 'noto' | 'lora' | 'sans';
export type FontSize = 'sm' | 'base' | 'lg' | 'xl';
export type ChapterStatus = 'draft' | 'in_progress' | 'revised' | 'completed';

export interface Page {
  id: string;
  chapterId: string;
  bookId: string;
  title: string;
  order: number;
  content: string;
  notes?: string;
  wordCount: number;
  updatedAt: number;
}

export interface Chapter {
  id: string;
  volumeId: string;
  bookId: string;
  title: string;
  order: number;
  synopsis?: string;
  status: ChapterStatus;
  pages: Page[];
}

export interface Volume {
  id: string;
  bookId: string;
  title: string;
  order: number;
  chapters: Chapter[];
}

export interface CodexEntry {
  id: string;
  bookId: string;
  name: string;
  category: 'concept' | 'insight' | 'person' | 'quote' | 'topic' | 'character' | 'location' | 'plot' | 'lore' | 'item';
  description: string;
  aliases?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Snapshot {
  id: string;
  bookId: string;
  title: string;
  description?: string;
  timestamp: number;
  pageId?: string;
  chapterId?: string;
  contentSnapshot: string;
}

export interface BookAiSettings {
  bookType?: 'personal' | 'memoir' | 'philosophy' | 'guide' | 'essays' | 'fiction';
  authorVoice?: string; // e.g. "Personal, honest, reflective, insightful, candid"
  narrativeTone?: string; // e.g. "Philosophical & Reflective", "Intimate Memoir", "Instructive & Clear", "Poetic Arabic Adabi"
  pov?: 'first_person' | 'third_limited' | 'third_omniscient' | 'second_person';
  targetAudience?: string; // e.g. "Self / Personal Record", "Readers of Philosophy & Reflections", "General Public"
  customInstructions?: string; // e.g. "Write from my personal lived experience, use deep introspection, structure with takeaways"
  rulesToAvoid?: string; // e.g. "No generic motivational cliches, avoid dry academic jargon"
}

export interface BookCustomization {
  coverColor?: 'amber' | 'emerald' | 'indigo' | 'rose' | 'slate';
  editorWidth?: 'normal' | 'wide' | 'full';
  lineHeight?: 'relaxed' | 'loose' | 'normal';
  paragraphIndent?: boolean;
}

export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  genre?: string;
  primaryLanguage: 'ar' | 'en' | 'mixed';
  description: string;
  synopsis?: string;
  targetWordCount: number;
  volumes: Volume[];
  codex: CodexEntry[];
  snapshots: Snapshot[];
  aiSettings?: BookAiSettings;
  customization?: BookCustomization;
  createdAt: number;
  updatedAt: number;
}

export type KeyStatus = 'active' | 'rate_limited' | 'invalid' | 'unknown' | 'testing';

export interface ApiKeyItem {
  id: string;
  label: string;
  key: string;
  status: KeyStatus;
  lastTested?: number;
  errorMessage?: string;
  quotaMessage?: string;
}

export interface GoogleDriveConfig {
  connected: boolean;
  autoBackupEnabled?: boolean;
  userEmail?: string;
  lastSyncTime?: number;
  backupFileName?: string;
  clientId?: string;
  accessToken?: string;
  folderId?: string;
}

export interface WritingGoal {
  dailyTarget: number;
  todayCount: number;
  lastDate: string; // YYYY-MM-DD
  streakDays: number;
}

export interface UserPreferences {
  theme: ThemeMode;
  appLanguage: AppLanguage;
  fontChoice: FontChoice;
  fontSize: FontSize;
  autoSaveInterval: number; // in seconds
  activeKeyId?: string;
  speechLanguage: 'ar-SA' | 'ar-EG' | 'en-US' | 'en-GB';
  defaultDirection: 'auto' | 'rtl' | 'ltr';
  writingGoal: WritingGoal;
  // Extended customization
  aiModel?: 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-2.0-flash';
  aiTemperature?: number; // 0.2 to 1.0 (default 0.7)
  aiLanguagePreference?: 'auto' | 'ar' | 'en';
  globalAiPersona?: string; // Global default system instructions
  editorMaxWidth?: 'prose' | 'wide' | 'full';
  paragraphIndent?: boolean;
  lineHeight?: 'normal' | 'relaxed' | 'loose';
  spellCheck?: boolean;
  typewriterDefault?: boolean;
}
