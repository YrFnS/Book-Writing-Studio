import React, { useState } from 'react';
import { 
  BarChart3, 
  Target, 
  BookOpen, 
  Clock, 
  Flame, 
  X, 
  Layers, 
  TrendingUp, 
  CheckCircle2, 
  FileText,
  Check
} from 'lucide-react';
import { Book, AppLanguage, WritingGoal } from '../types';
import { useI18n } from '../lib/i18n';

interface ManuscriptStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  writingGoal: WritingGoal;
  onUpdateTargetWordCount: (newTarget: number) => void;
  onUpdateDailyGoal: (newDailyTarget: number) => void;
  language: AppLanguage;
}

export const ManuscriptStatsModal: React.FC<ManuscriptStatsModalProps> = ({
  isOpen,
  onClose,
  book,
  writingGoal,
  onUpdateTargetWordCount,
  onUpdateDailyGoal,
  language,
}) => {
  const t = useI18n(language);
  const [customTarget, setCustomTarget] = useState(book.targetWordCount || 75000);
  const [customDaily, setCustomDaily] = useState(writingGoal.dailyTarget || 1000);

  if (!isOpen) return null;

  // Calculate detailed manuscript metrics
  let totalWords = 0;
  let totalChapters = 0;
  let totalScenes = 0;
  let arabicCharCount = 0;
  let latinCharCount = 0;

  const chapterStats: {
    volTitle: string;
    chapterTitle: string;
    wordCount: number;
    sceneCount: number;
    status: string;
  }[] = [];

  for (const vol of book.volumes) {
    for (const ch of vol.chapters) {
      totalChapters++;
      let chWords = 0;
      for (const pg of ch.pages) {
        totalScenes++;
        const words = pg.wordCount || 0;
        chWords += words;
        totalWords += words;

        // Character language distribution
        const text = pg.content || '';
        for (let i = 0; i < text.length; i++) {
          const code = text.charCodeAt(i);
          if (code >= 0x0600 && code <= 0x06ff) {
            arabicCharCount++;
          } else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
            latinCharCount++;
          }
        }
      }
      chapterStats.push({
        volTitle: vol.title,
        chapterTitle: ch.title,
        wordCount: chWords,
        sceneCount: ch.pages.length,
        status: ch.status,
      });
    }
  }

  const targetWords = book.targetWordCount || 75000;
  const progressPercent = Math.min(100, Math.round((totalWords / targetWords) * 100));
  const estimatedPages = Math.max(1, Math.round(totalWords / 250));
  const readingTimeMinutes = Math.max(1, Math.round(totalWords / 200));

  // Pacing calculations
  const remainingWords = Math.max(0, targetWords - totalWords);
  const dailyTarget = writingGoal.dailyTarget || 1000;
  const daysToFinish = Math.ceil(remainingWords / Math.max(1, dailyTarget));
  const projectedFinishDate = new Date(Date.now() + daysToFinish * 86400000).toLocaleDateString(
    language === 'ar' ? 'ar-EG' : 'en-US',
    { year: 'numeric', month: 'short', day: 'numeric' }
  );

  // Language percentage
  const totalLetters = arabicCharCount + latinCharCount;
  const arabicPercent = totalLetters > 0 ? Math.round((arabicCharCount / totalLetters) * 100) : 100;
  const englishPercent = 100 - arabicPercent;

  const targetPresets = [
    { label: language === 'ar' ? 'أقصوصة (30 ألف)' : 'Novella (30k)', words: 30000 },
    { label: language === 'ar' ? 'تحدي نانوري مو (50 ألف)' : 'NaNoWriMo (50k)', words: 50000 },
    { label: language === 'ar' ? 'رواية معيارية (75 ألف)' : 'Standard Novel (75k)', words: 75000 },
    { label: language === 'ar' ? 'ملحمة روائية (100 ألف)' : 'Epic (100k)', words: 100000 },
  ];

  const handleSaveTargets = () => {
    if (customTarget > 0 && customTarget !== book.targetWordCount) {
      onUpdateTargetWordCount(customTarget);
    }
    if (customDaily > 0 && customDaily !== writingGoal.dailyTarget) {
      onUpdateDailyGoal(customDaily);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-2xl max-h-[90vh] bg-surface border border-subtle rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-subtle flex items-center justify-between gap-3 bg-canvas/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/15 border border-indigo-600/30 flex items-center justify-center text-indigo-600">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-main">{t.statsTitle}</h2>
              <p className="text-xs text-sub">{book.title}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-sub hover:text-main hover:bg-elevated"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Main Progress Hero Card */}
          <div className="p-5 rounded-2xl bg-canvas border border-subtle space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-sub">
                  {language === 'ar' ? 'إجمالي تقدم المخطوطة' : 'Manuscript Progress'}
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-main">
                    {totalWords.toLocaleString()}
                  </span>
                  <span className="text-sm font-mono text-sub">
                    / {targetWords.toLocaleString()} {t.words}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="text-2xl font-bold font-mono text-indigo-600">
                  {progressPercent}%
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Sub Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-surface border border-subtle">
                <div className="flex items-center gap-1.5 text-xs text-sub mb-1">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{language === 'ar' ? 'صفحات مطبوعة' : 'Printed Pages'}</span>
                </div>
                <p className="text-lg font-bold font-mono text-main">~{estimatedPages}</p>
                <span className="text-[10px] text-dim">{language === 'ar' ? 'تقدير 250 كلمة/صفحة' : '~250 words / page'}</span>
              </div>

              <div className="p-3 rounded-xl bg-surface border border-subtle">
                <div className="flex items-center gap-1.5 text-xs text-sub mb-1">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span>{language === 'ar' ? 'مدة القراءة' : 'Reading Time'}</span>
                </div>
                <p className="text-lg font-bold font-mono text-main">
                  {readingTimeMinutes > 60
                    ? `${Math.floor(readingTimeMinutes / 60)}h ${readingTimeMinutes % 60}m`
                    : `${readingTimeMinutes} min`}
                </p>
                <span className="text-[10px] text-dim">{language === 'ar' ? 'بمعدل 200 ك/دقيقة' : 'at 200 wpm'}</span>
              </div>

              <div className="p-3 rounded-xl bg-surface border border-subtle">
                <div className="flex items-center gap-1.5 text-xs text-sub mb-1">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  <span>{t.currentStreak}</span>
                </div>
                <p className="text-lg font-bold font-mono text-main">{writingGoal.streakDays} {language === 'ar' ? 'أيام' : 'days'}</p>
                <span className="text-[10px] text-dim">{writingGoal.todayCount} {language === 'ar' ? 'كلمة اليوم' : 'words today'}</span>
              </div>

              <div className="p-3 rounded-xl bg-surface border border-subtle">
                <div className="flex items-center gap-1.5 text-xs text-sub mb-1">
                  <Layers className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{language === 'ar' ? 'الهيكل' : 'Structure'}</span>
                </div>
                <p className="text-lg font-bold font-mono text-main">
                  {totalChapters} <span className="text-xs font-normal text-sub">{t.overviewTotalChapters}</span>
                </p>
                <span className="text-[10px] text-dim">{totalScenes} {t.overviewTotalScenes}</span>
              </div>
            </div>
          </div>

          {/* Forecast & Pacing Box */}
          <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-600/20 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-main uppercase font-mono">{t.pacingEstimate}</h4>
            </div>
            <p className="text-xs text-sub leading-relaxed">
              {language === 'ar' ? (
                <>
                  بمعدل كتابتك اليومي المستهدف (<strong className="text-main">{dailyTarget.toLocaleString()}</strong> كلمة/يوم)، يتبقى لديك <strong className="text-indigo-600">{remainingWords.toLocaleString()}</strong> كلمة لإتمام المسودة الأولى، ومن المتوقع إنجازها بعد <strong className="text-main">{daysToFinish}</strong> يوماً (في حدود <strong className="text-main">{projectedFinishDate}</strong>).
                </>
              ) : (
                <>
                  At your daily target pace of <strong className="text-main">{dailyTarget.toLocaleString()}</strong> words/day, you have <strong className="text-indigo-600">{remainingWords.toLocaleString()}</strong> words remaining to complete your first draft. Projected completion is in <strong className="text-main">{daysToFinish} {t.daysRemaining}</strong> (around <strong className="text-main">{projectedFinishDate}</strong>).
                </>
              )}
            </p>
          </div>

          {/* Bilingual Composition & Vocabulary */}
          <div className="p-4 rounded-xl bg-canvas border border-subtle space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-main uppercase font-mono">
                {language === 'ar' ? 'توزيع لغة المخطوطة' : 'Manuscript Language Distribution'}
              </span>
              <span className="text-xs font-mono text-sub">
                {arabicPercent}% {language === 'ar' ? 'عربي' : 'Arabic'} · {englishPercent}% {language === 'ar' ? 'إنجليزي' : 'English'}
              </span>
            </div>

            <div className="w-full h-2 bg-elevated rounded-full overflow-hidden flex">
              <div className="bg-indigo-600 h-full" style={{ width: `${arabicPercent}%` }} />
              <div className="bg-blue-600 h-full" style={{ width: `${englishPercent}%` }} />
            </div>
          </div>

          {/* Target Word Count Customizer */}
          <div className="p-4 rounded-xl bg-canvas border border-subtle space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-main uppercase font-mono">{t.targetWordCount}</h4>
              </div>
              <span className="text-xs font-mono font-bold text-main">{customTarget.toLocaleString()} {t.words}</span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-2">
              {targetPresets.map((preset) => (
                <button
                  key={preset.words}
                  type="button"
                  onClick={() => setCustomTarget(preset.words)}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                    customTarget === preset.words
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-surface text-sub hover:text-main border border-subtle'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <input
                type="number"
                step="1000"
                min="1000"
                max="500000"
                value={customTarget}
                onChange={(e) => setCustomTarget(parseInt(e.target.value, 10) || 0)}
                className="w-40 bg-surface border border-subtle rounded-lg px-3 py-1.5 text-xs text-main font-mono focus:outline-none"
              />
              <span className="text-xs text-sub">{t.words}</span>
            </div>
          </div>

          {/* Chapter-by-Chapter Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-main uppercase font-mono">
              {language === 'ar' ? 'توزيع الفصول والمشاهد' : 'Chapter & Scene Breakdown'} ({chapterStats.length})
            </h4>

            <div className="border border-subtle rounded-xl overflow-hidden divide-y divide-subtle bg-canvas">
              {chapterStats.map((ch, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <FileText className="w-3.5 h-3.5 text-dim shrink-0" />
                    <div className="truncate">
                      <p className="font-semibold text-main truncate">{ch.chapterTitle}</p>
                      <p className="text-[10px] text-dim truncate">{ch.volTitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 font-mono">
                    <span className="text-[11px] text-sub">{ch.sceneCount} {language === 'ar' ? 'مشهد' : 'scenes'}</span>
                    <span className="font-bold text-main">{ch.wordCount.toLocaleString()} {t.words}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${
                        ch.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : ch.status === 'in_progress'
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'bg-zinc-500/10 text-sub'
                      }`}
                    >
                      {ch.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-subtle bg-canvas flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-sub hover:text-main"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSaveTargets}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{t.save}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
