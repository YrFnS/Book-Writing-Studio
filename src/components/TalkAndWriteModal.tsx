import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  CornerDownLeft, 
  Plus, 
  Copy, 
  Check, 
  RefreshCw, 
  X, 
  MessageSquare, 
  BookOpen, 
  HelpCircle, 
  Sliders, 
  FileText,
  Flame,
  ArrowRight,
  Send,
  Trash2
} from 'lucide-react';
import { Book, Chapter, Page, AppLanguage, ApiKeyItem } from '../types';
import { useI18n } from '../lib/i18n';
import { 
  talkAndWriteProse, 
  getNextInterviewQuestion, 
  compileInterviewToChapter,
  TalkAndWriteResult 
} from '../lib/gemini';
import { 
  createSpeechRecognizer, 
  isSpeechRecognitionSupported, 
  speakText, 
  stopSpeaking 
} from '../lib/speech';

interface TalkAndWriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  activeChapter: Chapter | null;
  activePage: Page | null;
  onInsertToPage: (text: string, mode: 'cursor' | 'append' | 'replace') => void;
  onCreateNewPageWithContent: (title: string, content: string) => void;
  language: AppLanguage;
  apiKeys: ApiKeyItem[];
  onUpdateKeyStatus: (keyId: string, status: ApiKeyItem['status'], error?: string) => void;
}

type ScribeMode = 'free_talk' | 'interviewer' | 'principles';

export const TalkAndWriteModal: React.FC<TalkAndWriteModalProps> = ({
  isOpen,
  onClose,
  book,
  activeChapter,
  activePage,
  onInsertToPage,
  onCreateNewPageWithContent,
  language,
  apiKeys,
  onUpdateKeyStatus,
}) => {
  const t = useI18n(language);
  const isAr = language === 'ar';

  // Mode: free_talk (Talk & Scribe) | interviewer (Ask & Answer) | principles (Thoughts to Principles)
  const [activeMode, setActiveMode] = useState<ScribeMode>('free_talk');

  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState<'ar-SA' | 'ar-EG' | 'en-US' | 'en-GB'>('ar-SA');
  const [spokenText, setSpokenText] = useState('');
  const recognitionRef = useRef<any>(null);

  // Selected Style
  const [writingStyle, setWritingStyle] = useState<'personal_memoir' | 'philosophical' | 'clear_guide' | 'deep_reflections' | 'principles' | 'candid'>('personal_memoir');

  // AI Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<TalkAndWriteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Interviewer conversation state
  const [interviewHistory, setInterviewHistory] = useState<{ role: 'author' | 'interviewer'; text: string }[]>([]);
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);

  // Focus textarea when modal opens
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      stopSpeaking();
      setIsListening(false);
      setIsPlayingAudio(false);
      return;
    }

    // Set speech language based on app language or book language
    if (book.primaryLanguage === 'ar' || language === 'ar') {
      setSpeechLang('ar-SA');
    } else {
      setSpeechLang('en-US');
    }
  }, [isOpen, book.primaryLanguage, language]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      stopSpeaking();
    };
  }, []);

  if (!isOpen) return null;

  // Toggle Voice Recognition
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      alert(isAr 
        ? 'الإملاء الصوتي غير مدعوم في هذا المتصفح. يُفضل استخدام متصفح Chrome أو Edge أو Safari.'
        : 'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    const recognizer = createSpeechRecognizer(speechLang, {
      onResult: (transcriptText) => {
        setSpokenText((prev) => {
          // If we already have text, append with space
          if (prev.trim()) {
            return prev + ' ' + transcriptText;
          }
          return transcriptText;
        });
      },
      onError: (err) => {
        console.error('Speech recognition error:', err);
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
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        setIsListening(false);
      }
    }
  };

  // Convert Spoken Thoughts to Book Prose
  const handleGenerateProse = async () => {
    if (!spokenText.trim() || isGenerating) return;

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const generated = await talkAndWriteProse(
        apiKeys,
        onUpdateKeyStatus,
        book,
        spokenText.trim(),
        {
          targetLang: language,
          writingStyle: activeMode === 'principles' ? 'principles' : writingStyle,
          activeChapter: activeChapter || undefined,
          activePage: activePage || undefined,
        }
      );
      setResult(generated);
    } catch (err: any) {
      setErrorMessage(err.message || (isAr ? 'فشلت عملية الصياغة. يرجى التحقق من مفاتيح Gemini.' : 'Writing failed. Please verify your Gemini keys.'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Interviewer: Ask the author the next question
  const handleAskNextQuestion = async () => {
    setIsAskingQuestion(true);
    setErrorMessage(null);
    try {
      const question = await getNextInterviewQuestion(
        apiKeys,
        onUpdateKeyStatus,
        book,
        interviewHistory,
        activeChapter || undefined,
        isAr ? 'ar' : 'en'
      );

      setInterviewHistory((prev) => [
        ...prev,
        { role: 'interviewer', text: question }
      ]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to get interview question');
    } finally {
      setIsAskingQuestion(false);
    }
  };

  // Interviewer: Author submits spoken or typed answer
  const handleSubmitInterviewAnswer = () => {
    if (!spokenText.trim()) return;
    setInterviewHistory((prev) => [
      ...prev,
      { role: 'author', text: spokenText.trim() }
    ]);
    setSpokenText('');
  };

  // Interviewer: Compile entire interview into a chapter
  const handleCompileInterview = async () => {
    if (interviewHistory.length === 0 || isGenerating) return;
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const prose = await compileInterviewToChapter(
        apiKeys,
        onUpdateKeyStatus,
        book,
        interviewHistory,
        activeChapter || undefined,
        isAr ? 'ar' : 'en'
      );
      setResult({
        title: isAr ? 'خلاصة وتأملات الحوار' : 'Interview Synthesis & Reflections',
        prose,
        keyTakeaway: isAr ? 'مستخلصة من حوارك وأفكارك الشفهية' : 'Compiled directly from your spoken dialogue',
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to compile interview');
    } finally {
      setIsGenerating(false);
    }
  };

  // Play result audio
  const handleTogglePlayAudio = () => {
    if (isPlayingAudio) {
      stopSpeaking();
      setIsPlayingAudio(false);
      return;
    }

    if (!result?.prose) return;
    setIsPlayingAudio(true);
    speakText(result.prose, {
      rate: 1.0,
      onEnd: () => setIsPlayingAudio(false),
      onError: () => setIsPlayingAudio(false),
    });
  };

  // Copy result
  const handleCopyResult = () => {
    if (!result?.prose) return;
    navigator.clipboard.writeText(result.prose);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs select-none">
      <div 
        className="w-full max-w-3xl bg-surface border border-subtle rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-subtle flex items-center justify-between gap-3 bg-canvas/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 border border-indigo-600/20 flex items-center justify-center shrink-0 shadow-xs">
              <Mic className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-main truncate flex items-center gap-2">
                <span>{isAr ? 'تحدّث واكتب مع الذكاء الاصطناعي' : 'Talk & Write with AI'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 border border-indigo-600/20">
                  {isAr ? 'كاتب شخصي لك' : 'Personal Scribe'}
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-sub truncate">
                {isAr
                  ? `تحدث بأفكارك وخواطرك بحرية، وسيقوم الذكاء بصياغتها ونظمها في كتابك "${book.title}"`
                  : `Speak your raw thoughts freely, and AI will turn them into book prose for "${book.title}"`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-sub hover:text-main hover:bg-elevated transition-colors"
            title={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-subtle bg-canvas/30 flex items-center gap-2 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveMode('free_talk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 ${
              activeMode === 'free_talk'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-sub hover:text-main hover:bg-elevated'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAr ? 'سرد حر وصياغة فورية' : 'Talk & Scribe'}</span>
          </button>

          <button
            onClick={() => {
              setActiveMode('interviewer');
              if (interviewHistory.length === 0) {
                handleAskNextQuestion();
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 ${
              activeMode === 'interviewer'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-sub hover:text-main hover:bg-elevated'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{isAr ? 'المحاور الشخصي (سيرة وتأملات)' : 'Biographer Interview'}</span>
          </button>

          <button
            onClick={() => setActiveMode('principles')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 ${
              activeMode === 'principles'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-sub hover:text-main hover:bg-elevated'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{isAr ? 'أفكار إلى مبادئ وخلاصات' : 'Thoughts to Principles'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Active Mode Description & Settings */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Style Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sub font-medium">{isAr ? 'نمط الصياغة:' : 'Writing Style:'}</span>
              <select
                value={writingStyle}
                onChange={(e: any) => setWritingStyle(e.target.value)}
                className="bg-canvas border border-subtle rounded-lg px-2.5 py-1 text-xs font-medium text-main focus:outline-none cursor-pointer"
              >
                <option value="personal_memoir">{isAr ? 'سيرة ذاتية وتجارب شخصية' : 'Personal Memoir & Stories'}</option>
                <option value="philosophical">{isAr ? 'تأمل فلسفي وحكمة هادئة' : 'Philosophical & Reflective'}</option>
                <option value="clear_guide">{isAr ? 'دليل عملي وأفكار منظمة' : 'Structured Non-Fiction Guide'}</option>
                <option value="deep_reflections">{isAr ? 'خواطر ومقالات عميقة' : 'Deep Introspective Essays'}</option>
                <option value="principles">{isAr ? 'مبادئ وقواعد حياة واضحة' : 'Core Life Principles'}</option>
                <option value="candid">{isAr ? 'حديث مباشر بلا تصنع' : 'Direct Candid Voice'}</option>
              </select>
            </div>

            {/* Speech Language Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-sub font-medium">{isAr ? 'لغة الحديث:' : 'Spoken Voice:'}</span>
              <select
                value={speechLang}
                onChange={(e: any) => setSpeechLang(e.target.value)}
                className="bg-canvas border border-subtle rounded-lg px-2 py-1 text-xs font-medium text-main focus:outline-none cursor-pointer"
              >
                <option value="ar-SA">العربية (السعودية / الفصحى)</option>
                <option value="ar-EG">العربية (المصرية)</option>
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
              </select>
            </div>
          </div>

          {/* Interviewer Mode Dialogue Log */}
          {activeMode === 'interviewer' && (
            <div className="space-y-3 bg-canvas/50 border border-subtle rounded-2xl p-4 max-h-56 overflow-y-auto">
              <div className="text-[11px] font-bold text-sub uppercase flex items-center justify-between">
                <span>{isAr ? 'جلسة الحوار مع الكاتب' : 'Interview Dialogue History'}</span>
                {interviewHistory.length > 0 && (
                  <button
                    onClick={() => setInterviewHistory([])}
                    className="text-[11px] text-red-500 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{isAr ? 'مسح الجلسة' : 'Clear'}</span>
                  </button>
                )}
              </div>

              {interviewHistory.length === 0 ? (
                <div className="text-center py-4 text-xs text-sub">
                  <p>{isAr ? 'انقر أدناه لبدء طرح السؤال الأول من المحاور الشخصي...' : 'Click below to start with the first question...'}</p>
                </div>
              ) : (
                interviewHistory.map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`flex flex-col gap-1 p-2.5 rounded-xl text-xs ${
                      item.role === 'interviewer'
                        ? 'bg-indigo-600/10 border border-indigo-600/20 text-main'
                        : 'bg-surface border border-subtle text-main'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold text-sub">
                      <span>{item.role === 'interviewer' ? (isAr ? '🎙️ المحاور الذكي' : '🎙️ Biographer AI') : (isAr ? '✍️ المؤلف (أنت)' : '✍️ Author (You)')}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{item.text}</p>
                  </div>
                ))
              )}

              {isAskingQuestion && (
                <div className="text-xs text-indigo-600 dark:text-indigo-400 animate-pulse flex items-center gap-1.5 p-2">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>{isAr ? 'المحاور يفكر في سؤاله القادم بناءً على كتابك...' : 'Formulating the next insightful question...'}</span>
                </div>
              )}
            </div>
          )}

          {/* Voice Recording / Input Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-main flex items-center gap-2">
                <span>{isAr ? 'تحدث بأفكارك وخواطرك هنا:' : 'Speak or Type Your Thoughts:'}</span>
                {isListening && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 font-bold animate-pulse flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                    {isAr ? 'جارٍ الاستماع لصوتك...' : 'Listening to your voice...'}
                  </span>
                )}
              </label>

              {spokenText && (
                <button
                  onClick={() => setSpokenText('')}
                  className="text-[11px] text-sub hover:text-red-500 transition-colors"
                >
                  {isAr ? 'مسح النص' : 'Clear Text'}
                </button>
              )}
            </div>

            <div className="relative">
              <textarea
                ref={inputRef}
                rows={4}
                value={spokenText}
                onChange={(e) => setSpokenText(e.target.value)}
                placeholder={
                  isAr
                    ? 'مثال: تحدث بحرية عن فكرة، تجربة شخصية، فلسفة تؤمن بها، أو درس تعلمته من الحياة... اضغط زر الميكروفون وتكلم، وسيتولى الذكاء صياغتها فصيحة.'
                    : 'Example: Speak freely about a personal experience, a life principle, or a reflection... Press the mic and talk, and AI will weave it into your book.'
                }
                className="w-full bg-canvas border border-subtle rounded-2xl p-4 text-xs sm:text-sm text-main focus:outline-none focus:ring-2 focus:ring-indigo-600/40 leading-relaxed resize-none"
              />

              {/* Big Floating Microphone Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`absolute bottom-3 end-3 p-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition-all ${
                  isListening
                    ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105'
                }`}
                title={isListening ? (isAr ? 'إيقاف التسجيل' : 'Stop Listening') : (isAr ? 'اضغط وتحدث بصوتك' : 'Press to Speak')}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                <span className="text-xs font-bold hidden sm:inline">
                  {isListening ? (isAr ? 'إيقاف' : 'Stop') : (isAr ? 'تحدّث الآن' : 'Press to Talk')}
                </span>
              </button>
            </div>
          </div>

          {/* Action Row for Generation */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {activeMode === 'interviewer' ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleSubmitInterviewAnswer}
                  disabled={!spokenText.trim()}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-semibold bg-surface border border-subtle hover:bg-elevated text-main disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isAr ? 'إرسال الإجابة للمحاور' : 'Submit Spoken Answer'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleAskNextQuestion}
                  disabled={isAskingQuestion}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-surface border border-subtle hover:bg-elevated text-sub disabled:opacity-40 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAskingQuestion ? 'animate-spin' : ''}`} />
                  <span>{isAr ? 'سؤال جديد' : 'Next Question'}</span>
                </button>
              </div>
            ) : (
              <div className="text-xs text-sub">
                {activeChapter && (
                  <span>
                    {isAr ? 'الفصل النشط:' : 'Current Chapter:'} <strong className="text-main">{activeChapter.title}</strong>
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 ms-auto">
              {activeMode === 'interviewer' ? (
                <button
                  type="button"
                  onClick={handleCompileInterview}
                  disabled={interviewHistory.length === 0 || isGenerating}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 flex items-center gap-2 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isGenerating ? (isAr ? 'جارٍ نظم الفصل...' : 'Compiling Chapter...') : (isAr ? 'نظم الحوار في فصل كامل' : 'Compile Interview into Chapter')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateProse}
                  disabled={!spokenText.trim() || isGenerating}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 flex items-center gap-2 transition-all hover:scale-102"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {isGenerating 
                      ? (isAr ? 'جارٍ صياغة أفكارك في كتابك...' : 'Weaving into Book Prose...') 
                      : (isAr ? 'صياغة أفكاري في الكتاب ✍️' : 'Write to Manuscript ✍️')}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Generated Result Preview Box */}
          {result && (
            <div className="space-y-3 pt-3 border-t border-subtle animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-main flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>{result.title || (isAr ? 'النص المصاغ لكتابك' : 'Crafted Book Prose')}</span>
                  </span>
                  {result.keyTakeaway && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 border border-indigo-600/15 max-w-xs truncate" title={result.keyTakeaway}>
                      💡 {result.keyTakeaway}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {/* Audio Listen */}
                  <button
                    type="button"
                    onClick={handleTogglePlayAudio}
                    className={`p-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${
                      isPlayingAudio 
                        ? 'bg-indigo-600 text-white border-indigo-600' 
                        : 'bg-surface text-main hover:bg-elevated border-subtle'
                    }`}
                    title={isPlayingAudio ? (isAr ? 'إيقاف الاستماع' : 'Stop Audio') : (isAr ? 'استمع للنص بصوت طبيعي' : 'Listen')}
                  >
                    {isPlayingAudio ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{isPlayingAudio ? (isAr ? 'إيقاف' : 'Stop') : (isAr ? 'استماع' : 'Listen')}</span>
                  </button>

                  {/* Copy */}
                  <button
                    type="button"
                    onClick={handleCopyResult}
                    className="p-1.5 rounded-lg text-xs font-medium bg-surface text-main hover:bg-elevated border border-subtle flex items-center gap-1"
                    title={isAr ? 'نسخ النص' : 'Copy'}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{copied ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ' : 'Copy')}</span>
                  </button>
                </div>
              </div>

              {/* Prose Content */}
              <div className="p-4 sm:p-5 rounded-2xl bg-canvas border border-subtle/80 text-xs sm:text-sm text-main leading-relaxed whitespace-pre-wrap font-serif">
                {result.prose}
              </div>

              {/* Insertion Actions */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onInsertToPage(result.prose, 'append');
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface border border-subtle hover:bg-elevated text-main flex items-center gap-1.5 shadow-xs"
                >
                  <CornerDownLeft className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isAr ? 'إضافة لنهاية الصفحة الحالية' : 'Append to Active Page'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onInsertToPage(result.prose, 'cursor');
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface border border-subtle hover:bg-elevated text-main flex items-center gap-1.5 shadow-xs"
                >
                  <CornerDownLeft className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isAr ? 'إدراج عند موضع المؤشر' : 'Insert at Cursor'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const pageTitle = result.title || (isAr ? 'فصل جديد' : 'New Section');
                    onCreateNewPageWithContent(pageTitle, result.prose);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إنشاء صفحة جديدة بهذا النص' : 'Create as New Page'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
