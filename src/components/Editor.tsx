import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  Languages, 
  AlignLeft, 
  AlignRight, 
  Play, 
  Pause, 
  VolumeX, 
  Wand2, 
  Search,
  Replace,
  X,
  StickyNote,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Quote,
  Check,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Volume2,
  Maximize2,
  Minimize2,
  Focus,
  Flame,
  Music,
  Eye
} from 'lucide-react';
import { Book, Chapter, Page, FontChoice, FontSize, AppLanguage, ApiKeyItem } from '../types';
import { useI18n } from '../lib/i18n';
import { ambientSound, AmbientSoundType } from '../lib/ambientSound';
import { 
  createSpeechRecognizer, 
  isSpeechRecognitionSupported, 
  speakText, 
  stopSpeaking, 
  pauseSpeaking, 
  resumeSpeaking, 
  calculateTextStats 
} from '../lib/speech';
import { 
  tellAiToType, 
  translateAndType, 
  cleanUpVoiceSpeech, 
  adjustTone,
  enhanceArabicPunctuationAndTashkeel,
  suggestSynonymsAndRhetoric
} from '../lib/gemini';

interface EditorProps {
  book: Book;
  chapter: Chapter | null;
  page: Page | null;
  onUpdateContent: (content: string) => void;
  onUpdateTitle: (title: string) => void;
  onUpdateNotes?: (notes: string) => void;
  fontChoice: FontChoice;
  onChangeFontChoice: (font: FontChoice) => void;
  fontSize: FontSize;
  onChangeFontSize: (size: FontSize) => void;
  editorMaxWidth?: 'prose' | 'wide' | 'full';
  onChangeEditorMaxWidth?: (width: 'prose' | 'wide' | 'full') => void;
  language: AppLanguage;
  apiKeys: ApiKeyItem[];
  /** The author's chosen model id; empty lets the server pick. */
  aiModel?: string;

  onUpdateKeyStatus: (keyId: string, status: ApiKeyItem['status'], error?: string) => void;
  isZenMode: boolean;
  onToggleZenMode: () => void;
  onOpenTalkAndWrite?: () => void;
}

export const Editor: React.FC<EditorProps> = ({
  book,
  chapter,
  page,
  onUpdateContent,
  onUpdateTitle,
  onUpdateNotes,
  fontChoice,
  onChangeFontChoice,
  fontSize,
  onChangeFontSize,
  editorMaxWidth,
  onChangeEditorMaxWidth,
  language,
  apiKeys,
  aiModel,
  onUpdateKeyStatus,
  isZenMode,
  onToggleZenMode,
  onOpenTalkAndWrite,
}) => {
  const t = useI18n(language);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Editor Max Width Layout (Page vs Wide vs Full Google Docs style)
  const [maxWidth, setMaxWidth] = useState<'prose' | 'wide' | 'full'>(editorMaxWidth || 'full');

  useEffect(() => {
    if (editorMaxWidth) {
      setMaxWidth(editorMaxWidth);
    }
  }, [editorMaxWidth]);

  const handleMaxWidthChange = (w: 'prose' | 'wide' | 'full') => {
    setMaxWidth(w);
    if (onChangeEditorMaxWidth) {
      onChangeEditorMaxWidth(w);
    }
  };

  // Zen Mode specialized focus states
  const [isTypewriterMode, setIsTypewriterMode] = useState(false);
  const [isParagraphFocus, setIsParagraphFocus] = useState(false);
  const [ambientType, setAmbientType] = useState<AmbientSoundType>('none');
  const [ambientVol, setAmbientVol] = useState(0.5);
  const [showAmbientMenu, setShowAmbientMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const sessionStartWordsRef = useRef<number | null>(null);

  // Text Direction
  const [direction, setDirection] = useState<'auto' | 'rtl' | 'ltr'>('auto');

  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState<'ar-SA' | 'ar-EG' | 'en-US' | 'en-GB'>('ar-SA');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  // Audio Proofreading (TTS) state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState(1.0);

  // AI Dialogs & Actions
  const [showAiPromptModal, setShowAiPromptModal] = useState(false);
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [aiTargetLang, setAiTargetLang] = useState<'ar' | 'en' | 'auto'>('auto');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);

  // Tone rewrite modal
  const [showToneModal, setShowToneModal] = useState(false);
  const [selectedTone, setSelectedTone] = useState<'poetic' | 'dramatic' | 'descriptive' | 'classicalArabic' | 'concise'>('poetic');

  // Synonyms & Rhetoric modal
  const [showSynonymsModal, setShowSynonymsModal] = useState(false);
  const [synonymsResult, setSynonymsResult] = useState<string>('');

  // Find & Replace state
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findTerm, setFindTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [matchCount, setMatchCount] = useState(0);

  // Scene Notes Panel
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [notesInput, setNotesInput] = useState(page?.notes || '');

  // Detailed Stats Analytics Modal
  const [showStatsModal, setShowStatsModal] = useState(false);

  // In-app Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Text Stats
  const content = page?.content || '';
  const stats = calculateTextStats(content);

  // Sync title and notes inputs
  const [titleInput, setTitleInput] = useState(page?.title || '');
  useEffect(() => {
    setTitleInput(page?.title || '');
    setNotesInput(page?.notes || '');
  }, [page?.id]);

  // Recalculate Find match counts
  useEffect(() => {
    if (!findTerm.trim()) {
      setMatchCount(0);
      return;
    }
    try {
      const flags = isCaseSensitive ? 'g' : 'gi';
      const escaped = findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = content.match(new RegExp(escaped, flags));
      setMatchCount(matches ? matches.length : 0);
    } catch {
      setMatchCount(0);
    }
  }, [findTerm, isCaseSensitive, content]);

  // Track session words written
  useEffect(() => {
    if (sessionStartWordsRef.current === null && stats.words > 0) {
      sessionStartWordsRef.current = stats.words;
    }
  }, [stats.words]);

  // Auto-resize textarea to eliminate redundant interior page scrollbars
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, isZenMode ? 600 : 450)}px`;
    }
  }, [content, fontChoice, fontSize, isZenMode]);

  const sessionWordsCount = Math.max(0, stats.words - (sessionStartWordsRef.current || stats.words));

  // Ambient sound handlers
  const handleSelectAmbient = (type: AmbientSoundType) => {
    setAmbientType(type);
    ambientSound.play(type);
  };

  const handleVolumeChange = (vol: number) => {
    setAmbientVol(vol);
    ambientSound.setVolume(vol);
  };

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Cleanup ambient sound on component unmount
  useEffect(() => {
    return () => {
      ambientSound.stop();
    };
  }, []);

  // Keyboard shortcut listener for Find & Replace (Ctrl+F) and Zen Exit (Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFindOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isZenMode) {
        onToggleZenMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMode, onToggleZenMode]);

  // Typewriter mode auto-scroll alignment
  const handleTypewriterScroll = () => {
    if (!isTypewriterMode || !textareaRef.current) return;
    const el = textareaRef.current;
    const cursor = el.selectionStart || 0;
    const textBefore = el.value.substring(0, cursor);
    const lineNum = textBefore.split('\n').length;
    const approxLineHeight = 32;
    const targetY = lineNum * approxLineHeight - el.clientHeight / 2;
    el.scrollTop = Math.max(0, targetY);
  };

  // Text Selection helper
  const getSelectedText = () => {
    const textarea = textareaRef.current;
    if (!textarea) return '';
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    return content.substring(start, end);
  };

  // Insert or Wrap text at cursor
  const wrapOrInsertText = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const selected = content.substring(start, end);
    const newText = content.substring(0, start) + prefix + selected + suffix + content.substring(end);
    onUpdateContent(newText);

    setTimeout(() => {
      textarea.focus();
      const cursorTarget = start + prefix.length + selected.length + (selected ? suffix.length : 0);
      textarea.setSelectionRange(cursorTarget, cursorTarget);
    }, 40);
  };

  // Find & Replace handlers
  const handleReplaceNext = () => {
    if (!findTerm) return;
    const flags = isCaseSensitive ? '' : 'i';
    const escaped = findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);
    const newContent = content.replace(regex, replaceTerm);
    onUpdateContent(newContent);
  };

  const handleReplaceAll = () => {
    if (!findTerm) return;
    const flags = isCaseSensitive ? 'g' : 'gi';
    const escaped = findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);
    const newContent = content.replace(regex, replaceTerm);
    onUpdateContent(newContent);
    showToast(language === 'ar' ? `تم استبدال ${matchCount} موضعاً` : `Replaced ${matchCount} occurrences`);
  };

  // Handle Speech Recognition
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      showToast('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    setTranscript('');
    const recognizer = createSpeechRecognizer(speechLang, {
      onResult: (text) => {
        setTranscript(text);
      },
      onError: (err) => {
        console.error('Speech error:', err);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });

    if (recognizer) {
      recognitionRef.current = recognizer;
      try {
        recognizer.start();
        setIsListening(true);
      } catch (e) {
        console.error('Failed to start speech recognition:', e);
        setIsListening(false);
      }
    }
  };

  // Insert transcript into text at cursor
  const handleInsertTranscript = (textToInsert: string) => {
    if (!textToInsert) return;
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const before = content.substring(0, start);
      const after = content.substring(end);
      const spacer = before.length > 0 && !before.endsWith('\n') && !before.endsWith(' ') ? ' ' : '';
      const newText = before + spacer + textToInsert + after;
      onUpdateContent(newText);
      setTranscript('');
      setTimeout(() => {
        textarea.focus();
        const cursorPosition = start + spacer.length + textToInsert.length;
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      }, 50);
    } else {
      onUpdateContent(content + (content ? '\n\n' : '') + textToInsert);
      setTranscript('');
    }
  };

  // Clean transcript with AI & insert
  const handleCleanAndInsertTranscript = async () => {
    if (!transcript.trim()) return;
    setIsAiLoading(true);
    setAiErrorMessage(null);
    try {
      const cleaned = await cleanUpVoiceSpeech(
        apiKeys,
        onUpdateKeyStatus,
        transcript,
        speechLang,
        aiModel
      );
      handleInsertTranscript(cleaned);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'AI cleanup failed');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Translate transcript with AI & insert
  const handleTranslateAndInsertTranscript = async () => {
    if (!transcript.trim()) return;
    setIsAiLoading(true);
    setAiErrorMessage(null);
    try {
      const targetLang = speechLang.startsWith('ar') ? 'en' : 'ar';
      const translated = await translateAndType(
        apiKeys,
        onUpdateKeyStatus,
        transcript,
        targetLang,
        aiModel
      );
      handleInsertTranscript(translated);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'AI translation failed');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Audio proofreading
  const handlePlayAudio = () => {
    if (isPlayingAudio && !isAudioPaused) {
      pauseSpeaking();
      setIsAudioPaused(true);
      return;
    }

    if (isPlayingAudio && isAudioPaused) {
      resumeSpeaking();
      setIsAudioPaused(false);
      return;
    }

    if (!content.trim()) return;

    setIsPlayingAudio(true);
    setIsAudioPaused(false);
    speakText(content, {
      rate: audioSpeed,
      onEnd: () => {
        setIsPlayingAudio(false);
        setIsAudioPaused(false);
      },
      onError: () => {
        setIsPlayingAudio(false);
        setIsAudioPaused(false);
      },
    });
  };

  const handleStopAudio = () => {
    stopSpeaking();
    setIsPlayingAudio(false);
    setIsAudioPaused(false);
  };

  // AI Prompt Command handler
  const handleTellAiToTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPromptInput.trim()) return;

    setIsAiLoading(true);
    setAiErrorMessage(null);

    try {
      const generatedText = await tellAiToType(
        apiKeys,
        onUpdateKeyStatus,
        book,
        aiPromptInput.trim(),
        aiTargetLang,
        chapter || undefined,
        page || undefined,
        undefined,
        aiModel
      );

      handleInsertTranscript(generatedText);
      setShowAiPromptModal(false);
      setAiPromptInput('');
    } catch (err: any) {
      setAiErrorMessage(err.message || 'AI writing generation failed');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Tone Rewrite handler
  const handleToneRewrite = async () => {
    const selected = getSelectedText() || content;
    if (!selected.trim()) return;

    setIsAiLoading(true);
    setAiErrorMessage(null);

    try {
      const rewritten = await adjustTone(
        apiKeys,
        onUpdateKeyStatus,
        selected,
        selectedTone,
        aiModel
      );

      const textarea = textareaRef.current;
      if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText = content.substring(0, start) + rewritten + content.substring(end);
        onUpdateContent(newText);
      } else {
        onUpdateContent(rewritten);
      }

      setShowToneModal(false);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Tone adjustment failed');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Tashkeel & Literary Punctuation handler
  const handleTashkeelPunctuation = async () => {
    const selected = getSelectedText() || content;
    if (!selected.trim()) {
      showToast(language === 'ar' ? 'حدد نصاً أولاً لتطبيق التشكيل والترقيم' : 'Highlight text to apply formatting');
      return;
    }

    setIsAiLoading(true);
    setAiErrorMessage(null);
    try {
      const refined = await enhanceArabicPunctuationAndTashkeel(
        apiKeys,
        onUpdateKeyStatus,
        selected,
        aiModel
      );

      const textarea = textareaRef.current;
      if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText = content.substring(0, start) + refined + content.substring(end);
        onUpdateContent(newText);
      } else {
        onUpdateContent(refined);
      }
      showToast(language === 'ar' ? 'تم ضبط الترقيم والتشكيل بنجاح' : 'Punctuation and formatting updated');
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Punctuation formatting failed');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Synonyms & Rhetoric suggestions
  const handleSynonymsAndRhetoric = async () => {
    const selected = getSelectedText();
    if (!selected.trim()) {
      showToast(language === 'ar' ? 'حدد كلمة أو جملة لاقتراح بدائل بلاغية' : 'Highlight a word or phrase first');
      return;
    }

    setIsAiLoading(true);
    setAiErrorMessage(null);
    try {
      const suggestions = await suggestSynonymsAndRhetoric(
        apiKeys,
        onUpdateKeyStatus,
        selected,
        language,
        aiModel
      );
      setSynonymsResult(suggestions);
      setShowSynonymsModal(true);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to suggest synonyms');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Font family class
  const getFontFamilyClass = () => {
    switch (fontChoice) {
      case 'amiri':
        return 'font-amiri';
      case 'noto':
        return 'font-noto';
      case 'lora':
        return 'font-lora';
      default:
        return 'font-sans-ui';
    }
  };

  // Font size class
  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'sm':
        return 'text-base sm:text-lg leading-relaxed';
      case 'base':
        return 'text-lg sm:text-xl leading-relaxed';
      case 'lg':
        return 'text-xl sm:text-2xl leading-loose';
      case 'xl':
        return 'text-2xl sm:text-3xl leading-loose';
      default:
        return 'text-lg sm:text-xl leading-relaxed';
    }
  };

  if (!page) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-canvas text-sub select-none">
        <div className="text-center max-w-sm space-y-3">
          <Wand2 className="w-8 h-8 mx-auto text-indigo-600/60" />
          <p className="text-sm font-medium">{t.newPage}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col min-h-0 bg-canvas overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-4 rtl:left-4 rtl:right-auto z-50 bg-indigo-600 text-white text-xs px-4 py-2 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
          {toastMessage}
        </div>
      )}

      {/* Editor Primary Toolbar */}
      {!isZenMode && (
        <div className="no-print border-b border-subtle bg-surface/85 backdrop-blur-xs px-2 sm:px-6 py-1.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar z-10 select-none">
          {/* Left tools: Direction, Font family, Font size */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Direction Toggle */}
            <div className="flex items-center bg-canvas border border-subtle rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => setDirection('auto')}
                className={`px-2 py-1 text-xs rounded font-mono ${direction === 'auto' ? 'bg-indigo-600/20 text-indigo-950 dark:text-indigo-200 font-bold' : 'text-sub'}`}
                title="Auto text direction"
              >
                Auto
              </button>
              <button
                onClick={() => setDirection('rtl')}
                className={`p-1 text-xs rounded ${direction === 'rtl' ? 'bg-indigo-600/20 text-indigo-950 dark:text-indigo-200 font-bold' : 'text-sub'}`}
                title="Right-to-Left (العربية)"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDirection('ltr')}
                className={`p-1 text-xs rounded ${direction === 'ltr' ? 'bg-indigo-600/20 text-indigo-950 dark:text-indigo-200 font-bold' : 'text-sub'}`}
                title="Left-to-Right (English)"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Font Picker */}
            <select
              value={fontChoice}
              onChange={(e) => onChangeFontChoice(e.target.value as FontChoice)}
              className="bg-canvas border border-subtle rounded-lg px-2 py-1 text-xs font-medium text-main focus:outline-none cursor-pointer shrink-0"
              title={t.font}
            >
              <option value="amiri">خط أميري (Amiri)</option>
              <option value="noto">نسخ عربي (Noto Naskh)</option>
              <option value="lora">Lora (Literary English)</option>
              <option value="sans">Sans (Modern Clean)</option>
            </select>

            {/* Font Size */}
            <div className="flex items-center bg-canvas border border-subtle rounded-lg p-0.5 shrink-0">
              {(['sm', 'base', 'lg', 'xl'] as FontSize[]).map((sz) => (
                <button
                  key={sz}
                  onClick={() => onChangeFontSize(sz)}
                  className={`px-1.5 sm:px-2 py-0.5 text-xs font-mono uppercase rounded ${fontSize === sz ? 'bg-indigo-600/20 text-indigo-950 dark:text-indigo-200 font-bold' : 'text-dim hover:text-sub'}`}
                >
                  {sz}
                </button>
              ))}
            </div>

            {/* Layout Width Selector (Page vs Wide vs Full Google Docs) */}
            <div className="hidden sm:flex items-center bg-canvas border border-subtle rounded-lg p-0.5 shrink-0">
              {[
                { id: 'prose', label: language === 'ar' ? 'صفحة' : 'Page' },
                { id: 'wide', label: language === 'ar' ? 'عريض' : 'Wide' },
                { id: 'full', label: language === 'ar' ? 'كامل (Docs)' : 'Full (Docs)' },
              ].map((w) => (
                <button
                  key={w.id}
                  onClick={() => handleMaxWidthChange(w.id as any)}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all ${maxWidth === w.id ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'text-dim hover:text-sub'}`}
                  title={language === 'ar' ? 'تغيير عرض صفحة الكتابة' : 'Change editor layout width'}
                >
                  {w.label}
                </button>
              ))}
            </div>

            {/* Find & Replace Trigger Button */}
            <button
              onClick={() => setIsFindOpen(prev => !prev)}
              className={`p-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 shrink-0 ${
                isFindOpen 
                  ? 'bg-indigo-600 text-white border-indigo-600' 
                  : 'bg-canvas text-sub hover:text-main border-subtle hover:bg-elevated'
              }`}
              title={`${t.findAndReplace} (Ctrl+F)`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Scene Notes Toggle */}
            <button
              onClick={() => setIsNotesOpen(prev => !prev)}
              className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 shrink-0 ${
                isNotesOpen 
                  ? 'bg-indigo-600 text-white border-indigo-600' 
                  : 'bg-canvas text-sub hover:text-main border-subtle hover:bg-elevated'
              }`}
              title={t.sceneNotes}
            >
              <StickyNote className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.sceneNotes}</span>
            </button>
          </div>

          {/* Right tools: AI Actions, Speech Dictation, Audio Proofreader */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Talk & Write with AI Scribe */}
            {onOpenTalkAndWrite && (
              <button
                onClick={onOpenTalkAndWrite}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-all shrink-0 hover:scale-102"
                title={language === 'ar' ? 'تحدث واكتب مع الذكاء الاصطناعي (كاتب شخصي)' : 'Talk & Write with AI Scribe'}
              >
                <Mic className="w-3.5 h-3.5 text-white" />
                <span>{language === 'ar' ? 'تحدّث واكتب' : 'Talk & Write'}</span>
              </button>
            )}

            {/* Tell AI to Type */}
            <button
              onClick={() => setShowAiPromptModal(true)}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-600/25 transition-all shrink-0"
              title={t.tellAiToType}
            >
              <Wand2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{t.tellAiToType}</span>
            </button>

            {/* Tone Rewrite */}
            <button
              onClick={() => setShowToneModal(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-sub hover:text-main hover:bg-elevated border border-subtle transition-all shrink-0"
              title={t.toneAdjust}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden md:inline">{t.toneAdjust}</span>
            </button>

            {/* Tashkeel & Literary Punctuation */}
            <button
              onClick={handleTashkeelPunctuation}
              disabled={isAiLoading}
              className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-sub hover:text-main hover:bg-elevated border border-subtle transition-all shrink-0"
              title={t.tashkeel}
            >
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">ـَـ</span>
              <span>{t.tashkeel}</span>
            </button>

            {/* Rhetorical Synonyms */}
            <button
              onClick={handleSynonymsAndRhetoric}
              disabled={isAiLoading}
              className="hidden xl:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-sub hover:text-main hover:bg-elevated border border-subtle transition-all shrink-0"
              title={t.synonyms}
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>{t.synonyms}</span>
            </button>

            {/* Voice Dictation Button */}
            <div className="flex items-center bg-canvas border border-subtle rounded-lg p-0.5 shrink-0">
              <button
                onClick={toggleListening}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'text-sub hover:text-main hover:bg-elevated'
                }`}
                title={isListening ? t.stopListening : t.startListening}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                <span className="hidden sm:inline">{isListening ? t.listening : t.speechInput}</span>
              </button>

              <select
                value={speechLang}
                onChange={(e) => setSpeechLang(e.target.value as any)}
                className="bg-transparent text-[11px] text-sub focus:outline-none cursor-pointer px-1 py-0.5 hidden xs:inline-block"
                title="Voice dictation language"
              >
                <option value="ar-SA">العربية (السعودية)</option>
                <option value="ar-EG">العربية (مصر)</option>
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
              </select>
            </div>

            {/* Audio Proofreading Player (TTS) */}
            <div className="flex items-center bg-canvas border border-subtle rounded-lg p-0.5 shrink-0">
              <button
                onClick={handlePlayAudio}
                className={`p-1 rounded-md text-sub hover:text-main transition-colors ${isPlayingAudio ? 'text-indigo-600 dark:text-indigo-400' : ''}`}
                title={isPlayingAudio && !isAudioPaused ? 'Pause Proofreading' : 'Listen to Page'}
              >
                {isPlayingAudio && !isAudioPaused ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              {isPlayingAudio && (
                <button
                  onClick={handleStopAudio}
                  className="p-1 rounded-md text-sub hover:text-red-500"
                  title="Stop Proofreading"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                </button>
              )}
              <select
                value={audioSpeed}
                onChange={(e) => setAudioSpeed(parseFloat(e.target.value))}
                className="bg-transparent text-[10px] font-mono text-dim focus:outline-none cursor-pointer px-1 hidden sm:inline-block"
                title="Playback speed"
              >
                <option value="0.8">0.8x</option>
                <option value="1.0">1.0x</option>
                <option value="1.2">1.2x</option>
                <option value="1.5">1.5x</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Secondary Quick Formatting & Dialogue Toolbar */}
      {!isZenMode && (
        <div className="no-print border-b border-subtle bg-canvas/60 px-4 sm:px-6 py-1.5 flex items-center gap-1.5 overflow-x-auto text-xs text-sub select-none">
          {/* Dialogue quotes */}
          <button
            onClick={() => wrapOrInsertText('« ', ' »')}
            className="px-2 py-0.5 rounded hover:bg-elevated hover:text-main font-amiri font-bold"
            title={t.quoteArabic}
          >
            « »
          </button>
          <button
            onClick={() => wrapOrInsertText('“', '”')}
            className="px-2 py-0.5 rounded hover:bg-elevated hover:text-main font-serif font-bold"
            title={t.quoteEnglish}
          >
            “ ”
          </button>
          <button
            onClick={() => wrapOrInsertText('— ')}
            className="px-2 py-0.5 rounded hover:bg-elevated hover:text-main font-mono"
            title={t.dialogueDash}
          >
            —
          </button>
          <button
            onClick={() => wrapOrInsertText('…')}
            className="px-2 py-0.5 rounded hover:bg-elevated hover:text-main font-mono"
            title="Ellipsis"
          >
            …
          </button>

          <span className="w-px h-3.5 bg-subtle mx-1" />

          {/* Markdown quick format */}
          <button
            onClick={() => wrapOrInsertText('**', '**')}
            className="p-1 rounded hover:bg-elevated hover:text-main"
            title="Bold (**)"
          >
            <Bold className="w-3 h-3" />
          </button>
          <button
            onClick={() => wrapOrInsertText('*', '*')}
            className="p-1 rounded hover:bg-elevated hover:text-main"
            title="Italic (*)"
          >
            <Italic className="w-3 h-3" />
          </button>
          <button
            onClick={() => wrapOrInsertText('# ')}
            className="p-1 rounded hover:bg-elevated hover:text-main"
            title="Heading 1"
          >
            <Heading1 className="w-3 h-3" />
          </button>
          <button
            onClick={() => wrapOrInsertText('## ')}
            className="p-1 rounded hover:bg-elevated hover:text-main"
            title="Heading 2"
          >
            <Heading2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => wrapOrInsertText('> ')}
            className="p-1 rounded hover:bg-elevated hover:text-main"
            title="Blockquote (> )"
          >
            <Quote className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Find & Replace Bar */}
      {isFindOpen && (
        <div className="no-print bg-surface border-b border-subtle px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs animate-in slide-in-from-top-1 duration-150 z-20">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <div className="relative">
              <input
                type="text"
                value={findTerm}
                onChange={(e) => setFindTerm(e.target.value)}
                placeholder={t.find}
                className="bg-canvas border border-subtle rounded-lg px-2.5 py-1 text-xs text-main placeholder:text-dim focus:outline-none w-36 sm:w-48"
                autoFocus
              />
              {findTerm && (
                <span className="absolute top-1.5 right-2 rtl:left-2 rtl:right-auto text-[10px] text-dim font-mono">
                  {matchCount} {t.matchesFound}
                </span>
              )}
            </div>

            <input
              type="text"
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              placeholder={t.replace}
              className="bg-canvas border border-subtle rounded-lg px-2.5 py-1 text-xs text-main placeholder:text-dim focus:outline-none w-36 sm:w-48"
            />

            <label className="flex items-center gap-1 text-[11px] text-sub cursor-pointer">
              <input
                type="checkbox"
                checked={isCaseSensitive}
                onChange={(e) => setIsCaseSensitive(e.target.checked)}
                className="rounded border-subtle text-indigo-600 focus:ring-0"
              />
              <span>{t.matchCase}</span>
            </label>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleReplaceNext}
              disabled={matchCount === 0}
              className="px-2.5 py-1 text-xs font-medium bg-canvas border border-subtle rounded-lg hover:bg-elevated disabled:opacity-40"
            >
              {t.replace}
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={matchCount === 0}
              className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
            >
              {t.replaceAll}
            </button>
            <button
              onClick={() => setIsFindOpen(false)}
              className="p-1 text-sub hover:text-main rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Live Speech Dictation Bar */}
      {(isListening || transcript) && (
        <div className="no-print bg-surface border-b border-indigo-600/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md z-20 animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <p className="text-xs text-main truncate italic font-amiri text-sm">
              {transcript || (language === 'ar' ? 'تحدث الآن... سيظهر صوتك هنا' : 'Speak now... your voice will appear here')}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => handleInsertTranscript(transcript)}
              disabled={!transcript.trim()}
              className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-all flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              <span>{t.insertText}</span>
            </button>

            <button
              onClick={handleCleanAndInsertTranscript}
              disabled={!transcript.trim() || isAiLoading}
              className="px-2.5 py-1 text-xs font-semibold bg-canvas text-main border border-subtle rounded-lg hover:bg-elevated disabled:opacity-40 transition-all flex items-center gap-1"
              title={t.cleanUpVoice}
            >
              <Sparkles className="w-3 h-3 text-indigo-600" />
              <span>{t.cleanUpVoice}</span>
            </button>

            {onOpenTalkAndWrite && (
              <button
                onClick={onOpenTalkAndWrite}
                className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-1 shadow-xs"
                title={language === 'ar' ? 'صياغة أفكارك صوتياً مباشرة في كتابك' : 'Craft speech into polished book prose'}
              >
                <Mic className="w-3 h-3 text-white" />
                <span>{language === 'ar' ? 'صياغة في كتابي' : 'Craft into Book'}</span>
              </button>
            )}

            <button
              onClick={handleTranslateAndInsertTranscript}
              disabled={!transcript.trim() || isAiLoading}
              className="px-2.5 py-1 text-xs font-semibold bg-canvas text-main border border-subtle rounded-lg hover:bg-elevated disabled:opacity-40 transition-all flex items-center gap-1"
              title={t.translateAndInsert}
            >
              <Languages className="w-3 h-3 text-blue-500" />
              <span>{t.translateAndInsert}</span>
            </button>
          </div>
        </div>
      )}

      {/* Chapter Context Breadcrumb */}
      {!isZenMode && chapter && (
        <div className="no-print px-4 sm:px-12 pt-3 pb-1 flex items-center gap-2 text-xs text-dim">
          <span>{chapter.title}</span>
          <span>/</span>
          <span className="text-sub font-medium">{page.title}</span>
        </div>
      )}

      {/* Main Canvas & Split Notes Pane */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Main Writing Canvas */}
        <div className="flex-1 overflow-y-auto min-h-0 w-full px-2 sm:px-6 lg:px-12 py-4 sm:py-6 flex flex-col items-center">
          <div className={`w-full flex-1 flex flex-col min-h-0 transition-all ${
            maxWidth === 'prose' 
              ? 'max-w-3xl mx-auto' 
              : maxWidth === 'wide' 
              ? 'max-w-5xl mx-auto' 
              : 'max-w-full px-2 sm:px-8 lg:px-16'
          }`}>
            {/* Page Title input */}
            <input
              type="text"
              value={titleInput}
              onChange={(e) => {
                setTitleInput(e.target.value);
                onUpdateTitle(e.target.value);
              }}
              placeholder={t.newPage}
              dir={direction}
              className={`w-full bg-transparent font-bold text-main border-none focus:outline-none mb-4 pb-2 border-b border-subtle/30 placeholder:text-dim/50 ${
                fontChoice === 'amiri' || fontChoice === 'noto' ? 'font-amiri text-2xl sm:text-3xl' : 'font-lora text-2xl sm:text-3xl'
              }`}
            />

            {/* Prose Textarea with smooth scrolling */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                onUpdateContent(e.target.value);
                handleTypewriterScroll();
              }}
              onKeyUp={handleTypewriterScroll}
              onClick={handleTypewriterScroll}
              placeholder={
                language === 'ar'
                  ? 'ابدأ بكتابة نصك هنا... يمكنك التحدث صوتياً أو كتابة فقراتك بالعربية والإنجليزية بسلاسة تامة.'
                  : 'Begin writing your story here... Feel free to dictate with voice or type in both Arabic and English.'
              }
              dir={direction}
              className={`w-full flex-1 min-h-[450px] bg-transparent border-none resize-none focus:outline-none text-main placeholder:text-dim/40 transition-all overflow-y-auto ${getFontFamilyClass()} ${getFontSizeClass()} ${
                isParagraphFocus ? 'leading-loose tracking-wide' : 'leading-relaxed'
              }`}
              style={{
                paddingBottom: isZenMode && isTypewriterMode ? '45vh' : '6rem',
              }}
            />
          </div>
        </div>

        {/* Scene Notes Side Drawer */}
        {isNotesOpen && (
          <aside className="no-print w-72 sm:w-80 border-s border-subtle bg-surface flex flex-col h-full animate-in slide-in-from-right duration-200 shadow-md">
            <div className="p-3 border-b border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-main">{t.sceneNotes}</h4>
              </div>
              <button
                onClick={() => setIsNotesOpen(false)}
                className="p-1 rounded text-sub hover:text-main"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 flex-1 flex flex-col">
              <textarea
                value={notesInput}
                onChange={(e) => {
                  setNotesInput(e.target.value);
                  if (onUpdateNotes) onUpdateNotes(e.target.value);
                }}
                placeholder={t.sceneNotesPlaceholder}
                className="flex-1 w-full bg-canvas border border-subtle rounded-xl p-3 text-xs text-main placeholder:text-dim focus:outline-none resize-none leading-relaxed"
              />
            </div>
          </aside>
        )}
      </div>

      {/* Standard Bottom Status & Metrics Bar (when NOT in Zen Mode) */}
      {!isZenMode && (
        <footer className="no-print border-t border-subtle bg-surface/80 backdrop-blur-xs px-4 sm:px-8 py-2 flex items-center justify-between text-xs text-sub select-none">
          <div className="flex items-center gap-3 sm:gap-5 font-mono">
            <button
              onClick={() => setShowStatsModal(true)}
              className="hover:text-indigo-600 transition-colors flex items-center gap-1 cursor-pointer"
              title={language === 'ar' ? 'انقر لعرض إحصائيات النص المفصلة' : 'Click for detailed text statistics'}
            >
              <strong className="text-main">{stats.words.toLocaleString()}</strong> {t.words}
            </button>
            <span className="hidden sm:inline">
              <strong className="text-main">{stats.characters.toLocaleString()}</strong> {t.chars}
            </span>
            <span className="hidden md:inline">
              ~<strong className="text-main">{stats.readingTimeMinutes}</strong> {t.readingTime}
            </span>
            {stats.words > 0 && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-canvas border border-subtle">
                <span>{t.arabicText} {stats.arabicPercentage}%</span>
                <span>/</span>
                <span>{t.englishText} {100 - stats.arabicPercentage}%</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAiLoading && (
              <div className="flex items-center gap-1.5 text-indigo-600 text-xs">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                <span>Gemini...</span>
              </div>
            )}
            {aiErrorMessage && (
              <span className="text-red-500 text-[11px] max-w-xs truncate" title={aiErrorMessage}>
                {aiErrorMessage}
              </span>
            )}
          </div>
        </footer>
      )}

      {/* Modal: Detailed Manuscript Statistics & Analytics */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface border border-subtle rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <h3 className="text-sm font-bold text-main">
                  {language === 'ar' ? 'إحصائيات وتحليلات النص' : 'Manuscript Analytics & Statistics'}
                </h3>
              </div>
              <button
                onClick={() => setShowStatsModal(false)}
                className="text-sub hover:text-main text-xs"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="bg-canvas border border-subtle rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-main">{stats.words.toLocaleString()}</div>
                <div className="text-[11px] text-dim uppercase mt-1">{t.words}</div>
              </div>
              <div className="bg-canvas border border-subtle rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-main">{stats.characters.toLocaleString()}</div>
                <div className="text-[11px] text-dim uppercase mt-1">{t.chars}</div>
              </div>
              <div className="bg-canvas border border-subtle rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-main">{stats.readingTimeMinutes} min</div>
                <div className="text-[11px] text-dim uppercase mt-1">{t.readingTime}</div>
              </div>
              <div className="bg-canvas border border-subtle rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-main">
                  {content.split(/\n\n+/).filter(Boolean).length}
                </div>
                <div className="text-[11px] text-dim uppercase mt-1">
                  {language === 'ar' ? 'فقرات' : 'Paragraphs'}
                </div>
              </div>
            </div>

            {stats.words > 0 && (
              <div className="space-y-2 bg-canvas border border-subtle rounded-xl p-3">
                <div className="flex items-center justify-between text-xs text-sub">
                  <span>{language === 'ar' ? 'توازن اللغات (عربي / إنجليزي)' : 'Language Balance (Arabic / English)'}</span>
                  <span className="font-mono font-bold text-main">{stats.arabicPercentage}% Ar</span>
                </div>
                <div className="w-full h-2 bg-elevated rounded-full overflow-hidden flex">
                  <div className="bg-indigo-600 h-full transition-all" style={{ width: `${stats.arabicPercentage}%` }} />
                  <div className="bg-emerald-500 h-full transition-all" style={{ width: `${100 - stats.arabicPercentage}%` }} />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end pt-2 border-t border-subtle">
              <button
                onClick={() => setShowStatsModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Zen Focus HUD (when in Zen Mode) */}
      {isZenMode && (
        <div className="no-print fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[95vw] flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-surface/90 backdrop-blur-md border border-subtle shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 select-none">
          {/* Exit Zen Button */}
          <button
            onClick={onToggleZenMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
            title={t.exitZen}
          >
            <span>{t.exitZen}</span>
            <kbd className="hidden sm:inline px-1 py-0.5 rounded bg-indigo-700/60 text-[10px] font-mono">Esc</kbd>
          </button>

          <div className="w-px h-4 bg-subtle mx-1" />

          {/* Word counts & Session Progress */}
          <div className="flex items-center gap-2 text-xs font-mono text-sub px-1">
            <span className="flex items-center gap-1 text-main font-bold" title={t.words}>
              <span>{stats.words.toLocaleString()}</span>
              <span className="text-dim font-normal">{t.words}</span>
            </span>

            {sessionWordsCount > 0 && (
              <span className="flex items-center gap-0.5 text-orange-500 font-bold" title={t.sessionWords}>
                <Flame className="w-3.5 h-3.5" />
                <span>+{sessionWordsCount}</span>
              </span>
            )}
          </div>

          <div className="w-px h-4 bg-subtle mx-1" />

          {/* Typewriter Mode Toggle */}
          <button
            onClick={() => setIsTypewriterMode((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 ${
              isTypewriterMode
                ? 'bg-indigo-600/15 text-indigo-600 border border-indigo-600/30'
                : 'text-sub hover:text-main hover:bg-elevated'
            }`}
            title={t.typewriterMode}
          >
            <Focus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t.typewriterMode}</span>
          </button>

          {/* Paragraph Focus Mode Toggle */}
          <button
            onClick={() => setIsParagraphFocus((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 ${
              isParagraphFocus
                ? 'bg-indigo-600/15 text-indigo-600 border border-indigo-600/30'
                : 'text-sub hover:text-main hover:bg-elevated'
            }`}
            title={t.paragraphFocus}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t.paragraphFocus}</span>
          </button>

          {/* Ambient Soundscape Menu */}
          <div className="relative">
            <button
              onClick={() => setShowAmbientMenu((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 ${
                ambientType !== 'none'
                  ? 'bg-indigo-600/15 text-indigo-600 border border-indigo-600/30'
                  : 'text-sub hover:text-main hover:bg-elevated'
              }`}
              title={t.ambientSound}
            >
              {ambientType !== 'none' ? <Volume2 className="w-3.5 h-3.5 text-indigo-600 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {ambientType === 'rain'
                  ? t.soundRain
                  : ambientType === 'fireplace'
                  ? t.soundFireplace
                  : ambientType === 'breeze'
                  ? t.soundBreeze
                  : ambientType === 'alphaWaves'
                  ? t.soundAlpha
                  : t.ambientSound}
              </span>
            </button>

            {/* Ambient Audio Dropdown Menu */}
            {showAmbientMenu && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-52 p-2 bg-surface border border-subtle rounded-xl shadow-xl space-y-1.5 animate-in zoom-in-95 duration-100 z-50">
                <div className="text-[10px] font-bold text-dim uppercase font-mono px-2 py-1">
                  {t.ambientSound}
                </div>
                {[
                  { id: 'none', label: t.soundMute },
                  { id: 'rain', label: `🌧️ ${t.soundRain}` },
                  { id: 'fireplace', label: `🔥 ${t.soundFireplace}` },
                  { id: 'breeze', label: `🍃 ${t.soundBreeze}` },
                  { id: 'alphaWaves', label: `🧘 ${t.soundAlpha}` },
                ].map((snd) => (
                  <button
                    key={snd.id}
                    onClick={() => {
                      handleSelectAmbient(snd.id as AmbientSoundType);
                      if (snd.id === 'none') setShowAmbientMenu(false);
                    }}
                    className={`w-full text-start px-2.5 py-1 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      ambientType === snd.id
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-sub hover:text-main hover:bg-elevated'
                    }`}
                  >
                    <span>{snd.label}</span>
                    {ambientType === snd.id && <Check className="w-3 h-3" />}
                  </button>
                ))}

                {ambientType !== 'none' && (
                  <div className="pt-2 px-2 border-t border-subtle flex items-center gap-2">
                    <Volume2 className="w-3 h-3 text-sub" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={ambientVol}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-full h-1 bg-elevated accent-indigo-600 rounded-lg cursor-pointer"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-xl text-sub hover:text-main hover:bg-elevated transition-colors"
            title={t.fullscreen}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {/* Modal: "Tell AI to Type" Prompt Command Bar */}
      {showAiPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-surface border border-subtle rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-main">{t.tellAiToType}</h3>
              </div>
              <button
                onClick={() => setShowAiPromptModal(false)}
                className="text-sub hover:text-main text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTellAiToTypeSubmit} className="space-y-3">
              <p className="text-xs text-sub">
                {language === 'ar'
                  ? 'أخبر الذكاء الاصطناعي بما ترغب في كتابته، وسيقوم بصياغة سرد أدبي وإدراجه فوراً في صفحتك:'
                  : 'Tell Gemini what you want written, and it will compose literary prose and insert it directly into your page:'}
              </p>

              <textarea
                value={aiPromptInput}
                onChange={(e) => setAiPromptInput(e.target.value)}
                placeholder={
                  language === 'ar'
                    ? 'مثال: صف مشهد عاصفة رملية تقترب من أبراج المدينة عند الغروب بتفاصيل حسية وبلاغة...'
                    : 'Example: Describe a dust storm approaching the towers at sunset with deep atmospheric prose...'
                }
                rows={3}
                autoFocus
                className="w-full bg-canvas border border-subtle rounded-xl p-3 text-xs sm:text-sm text-main placeholder:text-dim focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-sub">{language === 'ar' ? 'اللغة المستهدفة:' : 'Target Language:'}</span>
                  <select
                    value={aiTargetLang}
                    onChange={(e) => setAiTargetLang(e.target.value as any)}
                    className="bg-canvas border border-subtle rounded-lg px-2 py-1 text-xs text-main focus:outline-none"
                  >
                    <option value="auto">تلقائي / Auto</option>
                    <option value="ar">العربية (فصحى راقية)</option>
                    <option value="en">English (Literary)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAiPromptModal(false)}
                    className="px-3 py-1.5 text-xs text-sub hover:text-main"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={!aiPromptInput.trim() || isAiLoading}
                    className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-40 transition-all flex items-center gap-1.5"
                  >
                    {isAiLoading ? <span className="animate-spin">⏳</span> : <Wand2 className="w-3.5 h-3.5" />}
                    <span>{language === 'ar' ? 'كتابة وإدراج' : 'Generate & Insert'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tone & Style Rewriter */}
      {showToneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface border border-subtle rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-main">{t.toneAdjust}</h3>
              </div>
              <button
                onClick={() => setShowToneModal(false)}
                className="text-sub hover:text-main text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-sub">
              {language === 'ar'
                ? 'اختر النبرة الأدبية لإعادة صياغة النص المحدد أو الصفحة الحالية:'
                : 'Choose the literary tone to refine your highlighted text or current page:'}
            </p>

            <div className="space-y-2">
              {[
                { id: 'poetic', label: t.tones.poetic },
                { id: 'dramatic', label: t.tones.dramatic },
                { id: 'descriptive', label: t.tones.descriptive },
                { id: 'classicalArabic', label: t.tones.classicalArabic },
                { id: 'concise', label: t.tones.concise },
              ].map((item) => (
                <label
                  key={item.id}
                  onClick={() => setSelectedTone(item.id as any)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    selectedTone === item.id 
                      ? 'border-indigo-600 bg-indigo-600/10 text-main font-semibold' 
                      : 'border-subtle bg-canvas text-sub hover:bg-elevated'
                  }`}
                >
                  <span className="text-xs">{item.label}</span>
                  <input
                    type="radio"
                    name="tone"
                    value={item.id}
                    checked={selectedTone === item.id}
                    onChange={() => setSelectedTone(item.id as any)}
                    className="sr-only"
                  />
                  {selectedTone === item.id && <Check className="w-4 h-4 text-indigo-600" />}
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle">
              <button
                onClick={() => setShowToneModal(false)}
                className="px-3 py-1.5 text-xs text-sub hover:text-main"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleToneRewrite}
                disabled={isAiLoading}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                {isAiLoading ? <span className="animate-spin">⏳</span> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{language === 'ar' ? 'تطبيق النبرة' : 'Apply Tone'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Synonyms & Rhetoric Suggestions */}
      {showSynonymsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface border border-subtle rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                <h3 className="text-sm font-bold text-main">{t.synonyms}</h3>
              </div>
              <button
                onClick={() => setShowSynonymsModal(false)}
                className="text-sub hover:text-main text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-canvas border border-subtle rounded-xl text-xs sm:text-sm text-main leading-relaxed whitespace-pre-line font-amiri">
              {synonymsResult}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowSynonymsModal(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
