import React, { useState } from 'react';
import { 
  Layers, 
  FileText, 
  Plus, 
  BookOpen, 
  Edit3, 
  Check, 
  ExternalLink, 
  Search, 
  Calendar,
  Sparkles,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { Book, Chapter, ChapterStatus, Page, Volume, AppLanguage } from '../types';
import { useI18n } from '../lib/i18n';

interface CorkboardViewProps {
  book: Book;
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  onUpdatePageTitle: (pageId: string, title: string) => void;
  onUpdateChapterSynopsis: (chapterId: string, synopsis: string) => void;
  onUpdateChapterStatus: (chapterId: string, status: ChapterStatus) => void;
  onAddPage: (chapterId: string, title: string) => void;
  onAddChapter: (volumeId: string, title: string) => void;
  language: AppLanguage;
  onSwitchToEditor: () => void;
}

export const CorkboardView: React.FC<CorkboardViewProps> = ({
  book,
  activePageId,
  onSelectPage,
  onUpdatePageTitle,
  onUpdateChapterSynopsis,
  onUpdateChapterStatus,
  onAddPage,
  onAddChapter,
  language,
  onSwitchToEditor,
}) => {
  const t = useI18n(language);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSynopsisChapId, setEditingSynopsisChapId] = useState<string | null>(null);
  const [synopsisText, setSynopsisText] = useState('');
  const [newSceneTitle, setNewSceneTitle] = useState('');
  const [addingSceneChapId, setAddingSceneChapId] = useState<string | null>(null);

  // Compute manuscript totals
  let totalWords = 0;
  let totalChapters = 0;
  let totalScenes = 0;

  for (const vol of book.volumes) {
    totalChapters += vol.chapters.length;
    for (const ch of vol.chapters) {
      totalScenes += ch.pages.length;
      for (const pg of ch.pages) {
        totalWords += pg.wordCount || 0;
      }
    }
  }

  const progressPercent = book.targetWordCount > 0 
    ? Math.min(100, Math.round((totalWords / book.targetWordCount) * 100))
    : 0;

  const handleOpenPage = (pageId: string) => {
    onSelectPage(pageId);
    onSwitchToEditor();
  };

  const handleSaveSynopsis = (chapterId: string) => {
    onUpdateChapterSynopsis(chapterId, synopsisText.trim());
    setEditingSynopsisChapId(null);
  };

  const handleCreateScene = (chapterId: string) => {
    if (!newSceneTitle.trim()) return;
    onAddPage(chapterId, newSceneTitle.trim());
    setNewSceneTitle('');
    setAddingSceneChapId(null);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-canvas p-4 sm:p-8 space-y-8 select-none">
      {/* Top Banner & Stats Overview */}
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-subtle">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-600/15 text-indigo-700 dark:text-indigo-300 border border-indigo-600/30">
                {t.corkboard}
              </span>
              {book.genre && (
                <span className="text-xs text-sub uppercase tracking-wider font-mono">
                  {book.genre}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-main font-amiri">
              {book.title}
            </h1>
            {book.subtitle && (
              <p className="text-sm text-sub font-lora italic">{book.subtitle}</p>
            )}
          </div>

          <button
            onClick={onSwitchToEditor}
            className="self-start sm:self-auto px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-all shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{t.editorView}</span>
          </button>
        </div>

        {/* Statistical Metrics Bento Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-surface border border-subtle flex flex-col justify-between">
            <span className="text-[11px] text-sub font-medium">{t.words}</span>
            <span className="text-xl font-bold font-mono text-main">{totalWords.toLocaleString()}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface border border-subtle flex flex-col justify-between">
            <span className="text-[11px] text-sub font-medium">{t.overviewTotalChapters}</span>
            <span className="text-xl font-bold font-mono text-main">{totalChapters}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface border border-subtle flex flex-col justify-between">
            <span className="text-[11px] text-sub font-medium">{t.overviewTotalScenes}</span>
            <span className="text-xl font-bold font-mono text-main">{totalScenes}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface border border-subtle flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-sub font-medium">{t.overviewTargetProgress}</span>
              <span className="text-xs font-mono font-bold text-indigo-600">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-elevated rounded-full overflow-hidden mt-2">
              <div 
                className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Search filter */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute top-2.5 left-3 rtl:right-3 rtl:left-auto text-sub pointer-events-none" />
          <input
            type="text"
            placeholder={t.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-subtle rounded-xl py-2 px-9 text-xs text-main placeholder:text-dim focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
        </div>
      </div>

      {/* Chapters & Scenes Corkboard Grid */}
      <div className="max-w-6xl mx-auto space-y-10">
        {book.volumes.map((volume) => (
          <div key={volume.id} className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-subtle">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-bold text-main uppercase tracking-wider font-mono">
                {volume.title}
              </h2>
            </div>

            <div className="space-y-8">
              {volume.chapters.map((chapter) => {
                const chapterWords = chapter.pages.reduce((acc, p) => acc + (p.wordCount || 0), 0);
                const filteredPages = chapter.pages.filter(
                  (p) =>
                    !searchQuery ||
                    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.content.toLowerCase().includes(searchQuery.toLowerCase())
                );

                if (searchQuery && filteredPages.length === 0) return null;

                return (
                  <div key={chapter.id} className="space-y-3">
                    {/* Chapter Header Card */}
                    <div className="p-3 sm:p-4 rounded-xl bg-surface border border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-main font-amiri text-base">
                              {chapter.title}
                            </h3>
                            <span className="text-[11px] font-mono text-sub">
                              ({chapterWords.toLocaleString()} {t.words})
                            </span>
                          </div>

                          {/* Editable synopsis */}
                          {editingSynopsisChapId === chapter.id ? (
                            <div className="flex items-center gap-2 mt-1.5">
                              <input
                                type="text"
                                value={synopsisText}
                                onChange={(e) => setSynopsisText(e.target.value)}
                                placeholder={t.cardSynopsisPlaceholder}
                                className="bg-canvas border border-subtle rounded-lg px-2.5 py-1 text-xs text-main focus:outline-none w-72"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveSynopsis(chapter.id)}
                                className="p-1 rounded bg-indigo-600 text-white text-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <p
                              onClick={() => {
                                setSynopsisText(chapter.synopsis || '');
                                setEditingSynopsisChapId(chapter.id);
                              }}
                              className="text-xs text-sub italic hover:text-main cursor-pointer mt-0.5 line-clamp-1"
                              title="Click to edit synopsis"
                            >
                              {chapter.synopsis || t.cardSynopsisPlaceholder}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Status Selector */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <select
                          value={chapter.status}
                          onChange={(e) => onUpdateChapterStatus(chapter.id, e.target.value as ChapterStatus)}
                          className="bg-canvas border border-subtle rounded-lg px-2.5 py-1 text-xs text-sub font-semibold focus:outline-none cursor-pointer"
                        >
                          <option value="draft">{t.statusDraft}</option>
                          <option value="in_progress">{t.statusInProgress}</option>
                          <option value="revised">{t.statusRevised}</option>
                          <option value="completed">{t.statusCompleted}</option>
                        </select>
                      </div>
                    </div>

                    {/* Corkboard Cards Grid for Scenes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {filteredPages.map((page) => {
                        const isActive = page.id === activePageId;
                        const previewSnippet = page.content.slice(0, 120).trim();

                        return (
                          <div
                            key={page.id}
                            onClick={() => handleOpenPage(page.id)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3 group relative overflow-hidden ${
                              isActive
                                ? 'border-indigo-600 bg-indigo-600/10 shadow-xs'
                                : 'border-subtle bg-surface hover:border-indigo-600/50 hover:bg-elevated/80'
                            }`}
                          >
                            <div className="space-y-2">
                              {/* Card Header */}
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-xs font-bold text-main font-amiri text-sm group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                                  {page.title}
                                </h4>
                                <span className="text-[10px] font-mono text-dim shrink-0">
                                  {page.wordCount || 0} {t.words}
                                </span>
                              </div>

                              {/* Excerpt */}
                              <p className="text-xs text-sub leading-relaxed font-amiri line-clamp-3 select-text">
                                {previewSnippet || (
                                  <span className="italic text-dim">
                                    {language === 'ar' ? 'صفحة فارغة... انقر لبدء الكتابة' : 'Blank scene... Click to write'}
                                  </span>
                                )}
                              </p>
                            </div>

                            {/* Card Footer */}
                            <div className="pt-2 border-t border-subtle flex items-center justify-between text-[11px] text-dim">
                              <span className="font-mono">
                                {Math.max(1, Math.ceil((page.wordCount || 0) / 200))} {t.readingTime}
                              </span>

                              <span className="text-indigo-600 opacity-0 group-hover:opacity-100 flex items-center gap-1 font-semibold transition-opacity">
                                <span>{t.jumpToEditor}</span>
                                <ExternalLink className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Add New Scene Card */}
                      {addingSceneChapId === chapter.id ? (
                        <div className="p-4 rounded-xl border border-indigo-600 bg-indigo-600/5 flex flex-col justify-between gap-2.5">
                          <span className="text-xs font-bold text-main">{t.newPage}</span>
                          <input
                            type="text"
                            value={newSceneTitle}
                            onChange={(e) => setNewSceneTitle(e.target.value)}
                            placeholder={language === 'ar' ? 'عنوان المشهد الجديد...' : 'New scene title...'}
                            className="bg-surface border border-subtle rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCreateScene(chapter.id);
                              if (e.key === 'Escape') setAddingSceneChapId(null);
                            }}
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setAddingSceneChapId(null)}
                              className="px-2.5 py-1 text-xs text-sub hover:text-main"
                            >
                              {t.cancel}
                            </button>
                            <button
                              onClick={() => handleCreateScene(chapter.id)}
                              className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg"
                            >
                              {t.save}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddingSceneChapId(chapter.id);
                            setNewSceneTitle(`${t.newPage} ${chapter.pages.length + 1}`);
                          }}
                          className="p-4 rounded-xl border border-dashed border-subtle hover:border-indigo-600/50 bg-canvas/60 hover:bg-elevated/60 text-sub hover:text-main flex flex-col items-center justify-center gap-2 min-h-[120px] transition-all group"
                        >
                          <Plus className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-semibold">{t.newPage}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
