import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  X, 
  Copy, 
  Check, 
  CornerDownLeft, 
  Lightbulb, 
  FileSearch, 
  MessageSquare, 
  Compass,
  Mic,
  MicOff,
  Flame,
  BookOpen
} from 'lucide-react';
import { Book, Chapter, Page, AppLanguage, ApiKeyItem } from '../types';
import { useI18n } from '../lib/i18n';
import { askLibraryAI } from '../lib/gemini';
import { createSpeechRecognizer, isSpeechRecognitionSupported } from '../lib/speech';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  activeChapter: Chapter | null;
  activePage: Page | null;
  onInsertToPage: (text: string) => void;
  language: AppLanguage;
  apiKeys: ApiKeyItem[];
  /** The author's chosen model id; empty lets the server pick. */
  aiModel?: string;

  onUpdateKeyStatus: (keyId: string, status: ApiKeyItem['status'], error?: string) => void;
  onOpenTalkAndWrite?: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  book,
  activeChapter,
  activePage,
  onInsertToPage,
  language,
  apiKeys,
  aiModel,
  onUpdateKeyStatus,
  onOpenTalkAndWrite,
}) => {
  const t = useI18n(language);
  const isAr = language === 'ar';

  const isPersonalOrNonFiction = !book.genre || 
    ['personal', 'memoir', 'philosophy', 'guide', 'essays', 'self-development', 'thoughts', 'reflections', 'biography', 'journal', 'شخصي', 'سيرة', 'فلسفة', 'تأملات', 'مقالات', 'تطوير ذات', 'خواطر', 'مذكرات'].some(k => 
      (book.genre?.toLowerCase().includes(k)) || 
      (book.description?.toLowerCase().includes(k)) ||
      (book.aiSettings?.bookType && book.aiSettings.bookType !== 'fiction')
    );

  const initialWelcome = isAr
    ? isPersonalOrNonFiction
      ? `أهلاً بك يا مؤلفنا العزيز. أنا كاتبك المشارك ومستشارك الأدبي لكتابك الشخصي "${book.title}". يمكنك التحدث إليّ بأفكارك وخواطرك، وسأقوم بتحويلها وصياغتها في صلب كتابك، أو مناقشة الأفكار الفلسفية والتجارب الحياتية وتطوير محاور الكتاب!`
      : `أهلاً بك يا مؤلفنا العزيز. أنا مساعدك في استوديو الكتابة، مطلّع على روايتك "${book.title}" وعلى شخصيات وأحداث المدونة (Codex). اسألني عن أي تفاصيل، تناقضات، أو أفكار لتطوير المشاهد!`
    : isPersonalOrNonFiction
      ? `Welcome, author. I am your co-author and scribe for your personal book "${book.title}". Speak or write your thoughts, philosophies, and memories, and I will help weave them into polished book prose!`
      : `Welcome, author. I am your Studio Assistant, fully versed in "${book.title}" and your worldbuilding Codex. Ask me about plot continuity, character depth, or brainstorming next scenes!`;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: initialWelcome,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isVoiceInput, setIsVoiceInput] = useState(false);
  const speechRecognizerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (speechRecognizerRef.current) {
        speechRecognizerRef.current.stop();
      }
    };
  }, []);

  if (!isOpen) return null;

  const toggleVoiceInput = () => {
    if (isVoiceInput) {
      if (speechRecognizerRef.current) {
        speechRecognizerRef.current.stop();
      }
      setIsVoiceInput(false);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      alert(isAr ? 'الإملاء الصوتي غير مدعوم في هذا المتصفح' : 'Speech recognition not supported in this browser');
      return;
    }

    const langCode = isAr ? 'ar-SA' : 'en-US';
    const recognizer = createSpeechRecognizer(langCode, {
      onResult: (text) => {
        setInput(prev => prev.trim() ? prev + ' ' + text : text);
      },
      onError: () => setIsVoiceInput(false),
      onEnd: () => setIsVoiceInput(false),
    });

    if (recognizer) {
      speechRecognizerRef.current = recognizer;
      try {
        recognizer.start();
        setIsVoiceInput(true);
      } catch {
        setIsVoiceInput(false);
      }
    }
  };

  const quickPrompts = isPersonalOrNonFiction
    ? [
        {
          label: isAr ? 'صياغة وتعميق فكرة شخصية' : 'Deepen Personal Thought',
          icon: Lightbulb,
          prompt: isAr
            ? 'خذ الفكرة أو الموقف المطروح في الصفحة الحالية، وعمّق أبعاده الفلسفية والنفسية وصُغ لي فقرة كتابية رصينة ومؤثرة.'
            : 'Take the core idea or lived experience in this page, deepen its philosophical and emotional depth, and write an articulate passage for my book.',
        },
        {
          label: isAr ? 'استخلاص مبادئ وقواعد حياة' : 'Extract Core Principles',
          icon: Flame,
          prompt: isAr
            ? 'استخلص المبادئ وقواعد الحياة الجوهرية من هذه التجربة أو الأفكار، واكتبها كنقاط مضيئة واضحة تلهم القارئ.'
            : 'Extract the foundational life principles and mental models from this reflection into concise, impactful takeaways.',
        },
        {
          label: isAr ? 'سؤال ملهم لاستثارة الذكريات' : 'Memory Prompt',
          icon: MessageSquare,
          prompt: isAr
            ? 'اطرح عليّ سؤالاً عميقاً ومحدداً يستخرج مني قصة شخصية أو ذكرى حقيقية تثري هذا المحور في كتابي.'
            : 'Ask me a poignant, specific question that helps me recall an authentic memory or turning point for this chapter.',
        },
        {
          label: isAr ? 'هيكلة وتسلسل الفصل' : 'Structure Chapter',
          icon: Compass,
          prompt: isAr
            ? 'اقترح تسلسلاً منطقياً وتدرجاً للأفكار وعناوين فرعية لتنظيم محاور هذا الفصل.'
            : 'Suggest a compelling structural flow and subheadings to organize the themes of this chapter smoothly.',
        },
      ]
    : [
        {
          label: t.aiPrompts.checkConsistency,
          icon: FileSearch,
          prompt: isAr
            ? 'تحقق من عدم وجود أي تناقضات بين الصفحة الحالية ومدونة الشخصيات والأحداث السابقة.'
            : 'Check for any inconsistencies between this page and our worldbuilding Codex.',
        },
        {
          label: t.aiPrompts.describeScene,
          icon: Lightbulb,
          prompt: isAr
            ? 'اقترح تفاصيل حسية عميقة (أصوات، روائح، إضاءة) لإثراء المشهد الحالي.'
            : 'Suggest rich sensory details (sounds, scents, atmospheric lighting) to enhance this scene.',
        },
        {
          label: t.aiPrompts.summarizeChapter,
          icon: MessageSquare,
          prompt: isAr
            ? 'لخص أحداث هذا الفصل وقدم تحليلاً للمنحنى العاطفي للشخصيات.'
            : 'Summarize the events of this chapter and analyze the character emotional arcs.',
        },
        {
          label: isAr ? 'صقل الحوار والعمق' : 'Polish Dialogue',
          icon: Sparkles,
          prompt: isAr
            ? 'قم بمراجعة حوارات هذا المشهد لتبدو أكثر طبيعية وغنية بالمعاني المبطنة والتوتر الدرامي.'
            : 'Review dialogue in this scene to increase subtext, natural rhythm, and dramatic tension.',
        },
      ];

  const handleSendMessage = async (userPrompt: string) => {
    if (!userPrompt.trim() || isLoading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: userPrompt.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await askLibraryAI(
        apiKeys,
        onUpdateKeyStatus,
        book,
        userPrompt,
        activeChapter || undefined,
        activePage || undefined,
        undefined,
        aiModel
      );

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: isAr
          ? `عذراً، حدث خطأ: ${err.message || 'تعذر الاتصال بالذكاء الاصطناعي'}. يرجى التحقق من صلاحية مفاتيح Gemini.`
          : `Error: ${err.message || 'Failed to connect to AI'}. Please check your Gemini API keys.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      className="fixed inset-y-0 right-0 rtl:right-auto rtl:left-0 z-40 w-full sm:w-96 bg-surface border-l rtl:border-l-0 rtl:border-r border-subtle shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="p-4 border-b border-subtle flex items-center justify-between bg-canvas/60">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-main">
            {isPersonalOrNonFiction ? (isAr ? 'مستشارك الأدبي وكاتبك المشارك' : 'Personal Book Co-Author') : t.aiAssistant}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {onOpenTalkAndWrite && (
            <button
              onClick={() => {
                onClose();
                onOpenTalkAndWrite();
              }}
              className="p-1.5 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 hover:bg-indigo-100"
              title={isAr ? 'فتح وضع التحدث والكتابة المباشرة' : 'Open Talk & Write Studio'}
            >
              <Mic className="w-3 h-3 text-indigo-600" />
              <span className="text-[10px] hidden xs:inline">{isAr ? 'تحدث واكتب' : 'Talk & Write'}</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-sub hover:text-main hover:bg-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Book Context Pills */}
      <div className="px-4 py-2 border-b border-subtle bg-canvas/30 flex items-center justify-between text-[11px] text-sub">
        <div className="truncate">
          <span>{isAr ? 'الكتاب:' : 'Book:'} </span>
          <strong className="text-main">{book.title}</strong>
        </div>
        {activeChapter && (
          <span className="truncate max-w-[120px] bg-elevated px-2 py-0.5 rounded-md text-[10px]">
            {activeChapter.title}
          </span>
        )}
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-3 py-2 border-b border-subtle bg-canvas/20 flex gap-1.5 overflow-x-auto no-scrollbar">
        {quickPrompts.map((qp, idx) => {
          const Icon = qp.icon;
          return (
            <button
              key={idx}
              onClick={() => handleSendMessage(qp.prompt)}
              disabled={isLoading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-surface border border-subtle hover:bg-elevated hover:border-indigo-600/30 text-sub hover:text-main whitespace-nowrap transition-all shrink-0 disabled:opacity-40"
            >
              <Icon className="w-3 h-3 text-indigo-600" />
              <span>{qp.label}</span>
            </button>
          );
        })}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl p-3 text-xs leading-relaxed select-text ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-br-xs font-medium'
                    : 'bg-canvas border border-subtle text-main rounded-bl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap font-amiri text-sm">{m.content}</div>

                {/* Assistant actions: Copy & Insert into page */}
                {!isUser && m.id !== 'welcome' && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-subtle/50 text-[10px] text-sub">
                    <button
                      onClick={() => handleCopy(m.content, m.id)}
                      className="flex items-center gap-1 hover:text-main"
                    >
                      {copiedId === m.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={() => onInsertToPage(m.content)}
                      className="flex items-center gap-1 hover:text-indigo-600"
                    >
                      <CornerDownLeft className="w-3 h-3" />
                      <span>{isAr ? 'إدراج بالصفحة' : 'Insert to page'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-sub italic">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
            <span>{isAr ? 'المساعد يفكر ويصوغ استشارته لك...' : 'Consulting your book & drafting...'}</span>
          </div>
        )}
      </div>

      {/* Input Field with Mic */}
      <div className="p-3 border-t border-subtle bg-surface">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(input);
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`p-2 rounded-xl border transition-all ${
              isVoiceInput
                ? 'bg-red-500 text-white border-red-500 animate-pulse'
                : 'bg-canvas text-sub hover:text-main border-subtle hover:bg-elevated'
            }`}
            title={isVoiceInput ? (isAr ? 'إيقاف الإملاء' : 'Stop voice') : (isAr ? 'تحدث بصوتك' : 'Voice input')}
          >
            {isVoiceInput ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-indigo-600" />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isAr
                ? 'تحدث أو اسأل عن فكرة، خاطرة، أو اطلب صياغة مقطع...'
                : 'Speak or ask about an idea, reflection, or request a passage...'
            }
            className="flex-1 bg-canvas border border-subtle rounded-xl px-3 py-2 text-xs text-main placeholder:text-dim focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-all shadow-xs"
          >
            <Send className="w-4 h-4 rtl:rotate-180" />
          </button>
        </form>
      </div>
    </div>
  );
};
