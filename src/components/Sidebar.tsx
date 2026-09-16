import React, { useState } from 'react';
import { 
  FolderPlus, 
  FilePlus, 
  Trash2, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  BookMarked,
  Search,
  X,
  Plus,
  Edit2,
  Check,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  FileEdit
} from 'lucide-react';
import { Book, Chapter, ChapterStatus, Page, Volume, AppLanguage } from '../types';
import { useI18n } from '../lib/i18n';

interface SidebarProps {
  book: Book;
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  onAddVolume: (title: string) => void;
  onAddChapter: (volumeId: string, title: string) => void;
  onAddPage: (chapterId: string, title: string) => void;
  onDeletePage: (pageId: string) => void;
  onDeleteChapter: (chapterId: string) => void;
  onUpdateChapterStatus: (chapterId: string, status: ChapterStatus) => void;
  onRenameVolume?: (volumeId: string, title: string) => void;
  onRenameChapter?: (chapterId: string, title: string) => void;
  onRenamePage?: (pageId: string, title: string) => void;
  onMoveChapter?: (chapterId: string, direction: 'up' | 'down') => void;
  onMovePage?: (pageId: string, direction: 'up' | 'down') => void;
  viewMode?: 'editor' | 'corkboard';
  onToggleViewMode?: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  language: AppLanguage;
}

export const Sidebar: React.FC<SidebarProps> = ({
  book,
  activePageId,
  onSelectPage,
  onAddVolume,
  onAddChapter,
  onAddPage,
  onDeletePage,
  onDeleteChapter,
  onUpdateChapterStatus,
  onRenameVolume,
  onRenameChapter,
  onRenamePage,
  onMoveChapter,
  onMovePage,
  viewMode = 'editor',
  onToggleViewMode,
  isOpenMobile,
  onCloseMobile,
  language,
}) => {
  const t = useI18n(language);
  const [collapsedVolumes, setCollapsedVolumes] = useState<Record<string, boolean>>({});
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Inline Creation states
  const [isAddingVolume, setIsAddingVolume] = useState(false);
  const [newVolumeTitle, setNewVolumeTitle] = useState('');
  const [addingChapterVolId, setAddingChapterVolId] = useState<string | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [addingPageChapId, setAddingPageChapId] = useState<string | null>(null);
  const [newPageTitle, setNewPageTitle] = useState('');

  // Inline Renaming states
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Inline Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Calculate total book word count
  let totalBookWords = 0;
  for (const vol of book.volumes) {
    for (const ch of vol.chapters) {
      for (const pg of ch.pages) {
        totalBookWords += pg.wordCount || 0;
      }
    }
  }

  const toggleVolume = (volId: string) => {
    setCollapsedVolumes(prev => ({ ...prev, [volId]: !prev[volId] }));
  };

  const toggleChapter = (chapId: string) => {
    setCollapsedChapters(prev => ({ ...prev, [chapId]: !prev[chapId] }));
  };

  const getStatusBadge = (status: ChapterStatus) => {
    switch (status) {
      case 'completed':
        return <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title={t.statusCompleted} />;
      case 'revised':
        return <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" title={t.statusRevised} />;
      case 'in_progress':
        return <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" title={t.statusInProgress} />;
      default:
        return <span className="w-2 h-2 rounded-full bg-stone-400 shrink-0" title={t.statusDraft} />;
    }
  };

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingItemId(id);
    setEditingTitle(currentTitle);
  };

  const handleSaveRename = (type: 'volume' | 'chapter' | 'page', id: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setEditingItemId(null);
      return;
    }
    if (type === 'volume' && onRenameVolume) onRenameVolume(id, trimmed);
    if (type === 'chapter' && onRenameChapter) onRenameChapter(id, trimmed);
    if (type === 'page' && onRenamePage) onRenamePage(id, trimmed);
    setEditingItemId(null);
  };

  const handleCreateVolume = () => {
    const trimmed = newVolumeTitle.trim();
    if (trimmed) {
      onAddVolume(trimmed);
      setNewVolumeTitle('');
      setIsAddingVolume(false);
    }
  };

  const handleCreateChapter = (volId: string) => {
    const trimmed = newChapterTitle.trim();
    if (trimmed) {
      onAddChapter(volId, trimmed);
      setNewChapterTitle('');
      setAddingChapterVolId(null);
    }
  };

  const handleCreatePage = (chapId: string) => {
    const trimmed = newPageTitle.trim();
    if (trimmed) {
      onAddPage(chapId, trimmed);
      setNewPageTitle('');
      setAddingPageChapId(null);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-surface border-e border-subtle select-none">
      {/* Book header summary */}
      <div className="p-3.5 border-b border-subtle space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${
              book.customization?.coverColor === 'emerald' ? 'bg-emerald-600' :
              book.customization?.coverColor === 'indigo' ? 'bg-indigo-600' :
              book.customization?.coverColor === 'rose' ? 'bg-rose-600' :
              book.customization?.coverColor === 'slate' ? 'bg-slate-700' :
              'bg-indigo-600'
            }`} />
            <BookMarked className={`w-4 h-4 shrink-0 ${
              book.customization?.coverColor === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' :
              book.customization?.coverColor === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' :
              book.customization?.coverColor === 'rose' ? 'text-rose-600 dark:text-rose-400' :
              book.customization?.coverColor === 'slate' ? 'text-slate-600 dark:text-slate-400' :
              'text-indigo-700 dark:text-indigo-300'
            }`} />
            <h2 className="text-sm font-bold text-main truncate font-amiri text-base">{book.title}</h2>
          </div>
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1 rounded-lg text-sub hover:text-main"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Mode Toggle: Editor vs Corkboard */}
        {onToggleViewMode && (
          <div className="grid grid-cols-2 p-0.5 bg-canvas rounded-lg border border-subtle text-xs">
            <button
              onClick={() => viewMode !== 'editor' && onToggleViewMode()}
              className={`py-1 px-2 rounded-md font-medium flex items-center justify-center gap-1.5 transition-all ${
                viewMode === 'editor'
                  ? 'bg-surface text-indigo-700 dark:text-indigo-300 shadow-xs font-semibold'
                  : 'text-sub hover:text-main'
              }`}
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>{t.editorView}</span>
            </button>
            <button
              onClick={() => viewMode !== 'corkboard' && onToggleViewMode()}
              className={`py-1 px-2 rounded-md font-medium flex items-center justify-center gap-1.5 transition-all ${
                viewMode === 'corkboard'
                  ? 'bg-surface text-indigo-700 dark:text-indigo-300 shadow-xs font-semibold'
                  : 'text-sub hover:text-main'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{t.corkboard}</span>
            </button>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-sub font-mono">
          <span>{totalBookWords.toLocaleString()} {t.words}</span>
          {book.targetWordCount > 0 && (
            <span>{Math.round((totalBookWords / book.targetWordCount) * 100)}%</span>
          )}
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute top-2.5 left-2.5 rtl:right-2.5 rtl:left-auto text-sub pointer-events-none" />
          <input
            type="text"
            placeholder={t.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-canvas border border-subtle rounded-lg py-1 px-8 text-xs text-main placeholder:text-dim focus:outline-none focus:ring-1 focus:ring-indigo-600/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute top-2 right-2 rtl:left-2 rtl:right-auto text-sub hover:text-main"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Hierarchy Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2.5">
        {book.volumes.map((volume) => {
          const isVolCollapsed = collapsedVolumes[volume.id];
          const isEditingVol = editingItemId === volume.id;

          return (
            <div key={volume.id} className="space-y-1">
              {/* Volume Header */}
              <div className="flex items-center justify-between group px-2 py-1 rounded-lg hover:bg-elevated/70 transition-colors">
                {isEditingVol ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename('volume', volume.id);
                        if (e.key === 'Escape') setEditingItemId(null);
                      }}
                      className="bg-canvas border border-indigo-600 rounded px-1.5 py-0.5 text-xs text-main flex-1 focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveRename('volume', volume.id)}
                      className="p-1 text-emerald-600 hover:bg-canvas rounded"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => toggleVolume(volume.id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-sub hover:text-main flex-1 min-w-0 text-start"
                  >
                    {isVolCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">{volume.title}</span>
                  </button>
                )}

                {!isEditingVol && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartRename(volume.id, volume.title)}
                      className="p-1 rounded text-sub hover:text-main hover:bg-canvas"
                      title={t.rename}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        setAddingChapterVolId(volume.id);
                        setNewChapterTitle(`${t.newChapter} ${volume.chapters.length + 1}`);
                      }}
                      className="p-1 rounded text-sub hover:text-main hover:bg-canvas"
                      title={t.newChapter}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Inline Add Chapter Form */}
              {addingChapterVolId === volume.id && (
                <div className="ms-4 p-2 rounded-lg bg-canvas border border-indigo-600/30 space-y-1.5">
                  <span className="text-[11px] font-semibold text-main">{t.newChapter}</span>
                  <input
                    type="text"
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    placeholder={t.newChapter}
                    className="w-full bg-surface border border-subtle rounded px-2 py-1 text-xs text-main focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateChapter(volume.id);
                      if (e.key === 'Escape') setAddingChapterVolId(null);
                    }}
                  />
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setAddingChapterVolId(null)}
                      className="px-2 py-0.5 text-[11px] text-sub hover:text-main"
                    >
                      {t.cancel}
                    </button>
                    <button
                      onClick={() => handleCreateChapter(volume.id)}
                      className="px-2.5 py-0.5 text-[11px] font-semibold bg-indigo-600 text-white rounded"
                    >
                      {t.save}
                    </button>
                  </div>
                </div>
              )}

              {/* Chapters list */}
              {!isVolCollapsed && (
                <div className="ps-2.5 border-s border-subtle/60 ms-2 space-y-1">
                  {volume.chapters.map((chapter, chapIndex) => {
                    const isChapCollapsed = collapsedChapters[chapter.id];
                    const isEditingChap = editingItemId === chapter.id;
                    const isConfirmingDeleteChap = confirmDeleteId === chapter.id;

                    return (
                      <div key={chapter.id} className="space-y-0.5">
                        {/* Chapter item */}
                        <div className="flex items-center justify-between group px-1.5 py-1 rounded-md hover:bg-elevated transition-colors">
                          {isEditingChap ? (
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename('chapter', chapter.id);
                                  if (e.key === 'Escape') setEditingItemId(null);
                                }}
                                className="bg-canvas border border-indigo-600 rounded px-1.5 py-0.5 text-xs text-main flex-1 focus:outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveRename('chapter', chapter.id)}
                                className="p-1 text-emerald-600 hover:bg-canvas rounded"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : isConfirmingDeleteChap ? (
                            <div className="flex items-center justify-between w-full px-1 py-0.5 bg-red-500/10 rounded text-[11px] text-red-600">
                              <span>{t.confirmDelete}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    onDeleteChapter(chapter.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-1.5 py-0.2 bg-red-600 text-white rounded font-bold"
                                >
                                  {language === 'ar' ? 'نعم' : 'Yes'}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-1.5 py-0.2 text-sub hover:text-main"
                                >
                                  {t.cancel}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => toggleChapter(chapter.id)}
                                className="flex items-center gap-1.5 text-xs font-medium text-main flex-1 min-w-0 text-start"
                              >
                                {isChapCollapsed ? (
                                  <ChevronRight className="w-3 h-3 text-sub shrink-0" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 text-sub shrink-0" />
                                )}
                                {getStatusBadge(chapter.status)}
                                <span className="truncate">{chapter.title}</span>
                              </button>

                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* Move up/down */}
                                {onMoveChapter && (
                                  <>
                                    <button
                                      disabled={chapIndex === 0}
                                      onClick={() => onMoveChapter(chapter.id, 'up')}
                                      className="p-0.5 rounded text-dim hover:text-main disabled:opacity-30"
                                      title={t.moveUp}
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      disabled={chapIndex === volume.chapters.length - 1}
                                      onClick={() => onMoveChapter(chapter.id, 'down')}
                                      className="p-0.5 rounded text-dim hover:text-main disabled:opacity-30"
                                      title={t.moveDown}
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>
                                  </>
                                )}

                                {/* Status Cycle */}
                                <select
                                  value={chapter.status}
                                  onChange={(e) => onUpdateChapterStatus(chapter.id, e.target.value as ChapterStatus)}
                                  className="text-[10px] bg-canvas border border-subtle rounded px-1 py-0.5 text-sub focus:outline-none cursor-pointer"
                                  title="Chapter status"
                                >
                                  <option value="draft">{t.statusDraft}</option>
                                  <option value="in_progress">{t.statusInProgress}</option>
                                  <option value="revised">{t.statusRevised}</option>
                                  <option value="completed">{t.statusCompleted}</option>
                                </select>

                                <button
                                  onClick={() => handleStartRename(chapter.id, chapter.title)}
                                  className="p-1 rounded text-sub hover:text-main hover:bg-canvas"
                                  title={t.rename}
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>

                                <button
                                  onClick={() => {
                                    setAddingPageChapId(chapter.id);
                                    setNewPageTitle(`${t.newPage} ${chapter.pages.length + 1}`);
                                  }}
                                  className="p-1 rounded text-sub hover:text-main hover:bg-canvas"
                                  title={t.newPage}
                                >
                                  <FilePlus className="w-3 h-3" />
                                </button>

                                <button
                                  onClick={() => setConfirmDeleteId(chapter.id)}
                                  className="p-1 rounded text-sub hover:text-red-500 hover:bg-canvas"
                                  title={t.delete}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Inline Add Page Form */}
                        {addingPageChapId === chapter.id && (
                          <div className="ms-4 p-2 rounded-lg bg-canvas border border-indigo-600/30 space-y-1.5">
                            <span className="text-[11px] font-semibold text-main">{t.newPage}</span>
                            <input
                              type="text"
                              value={newPageTitle}
                              onChange={(e) => setNewPageTitle(e.target.value)}
                              placeholder={t.newPage}
                              className="w-full bg-surface border border-subtle rounded px-2 py-1 text-xs text-main focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreatePage(chapter.id);
                                if (e.key === 'Escape') setAddingPageChapId(null);
                              }}
                            />
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setAddingPageChapId(null)}
                                className="px-2 py-0.5 text-[11px] text-sub hover:text-main"
                              >
                                {t.cancel}
                              </button>
                              <button
                                onClick={() => handleCreatePage(chapter.id)}
                                className="px-2.5 py-0.5 text-[11px] font-semibold bg-indigo-600 text-white rounded"
                              >
                                {t.save}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Pages list */}
                        {!isChapCollapsed && (
                          <div className="ps-3 space-y-0.5">
                            {chapter.pages
                              .filter(p => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.content.toLowerCase().includes(searchQuery.toLowerCase()))
                              .map((page, pageIndex) => {
                                const isActive = activePageId === page.id;
                                const isEditingPage = editingItemId === page.id;
                                const isConfirmingDeletePage = confirmDeleteId === page.id;

                                return (
                                  <div
                                    key={page.id}
                                    onClick={() => {
                                      if (!isEditingPage && !isConfirmingDeletePage) {
                                        onSelectPage(page.id);
                                        if (isOpenMobile) onCloseMobile();
                                      }
                                    }}
                                    className={`flex items-center justify-between group px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                                      isActive 
                                        ? 'bg-elevated text-main font-bold border-s-4 border-indigo-600 dark:border-indigo-400 shadow-xs' 
                                        : 'text-sub hover:text-main hover:bg-elevated/60'
                                    }`}
                                  >
                                    {isEditingPage ? (
                                      <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="text"
                                          value={editingTitle}
                                          onChange={(e) => setEditingTitle(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveRename('page', page.id);
                                            if (e.key === 'Escape') setEditingItemId(null);
                                          }}
                                          className="bg-canvas border border-indigo-600 rounded px-1.5 py-0.5 text-xs text-main flex-1 focus:outline-none"
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => handleSaveRename('page', page.id)}
                                          className="p-1 text-emerald-600 hover:bg-canvas rounded"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : isConfirmingDeletePage ? (
                                      <div className="flex items-center justify-between w-full px-1 py-0.5 bg-red-500/10 rounded text-[10px] text-red-600" onClick={(e) => e.stopPropagation()}>
                                        <span>{t.confirmDelete}</span>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => {
                                              onDeletePage(page.id);
                                              setConfirmDeleteId(null);
                                            }}
                                            className="px-1.5 py-0.2 bg-red-600 text-white rounded font-bold"
                                          >
                                            {language === 'ar' ? 'نعم' : 'Yes'}
                                          </button>
                                          <button
                                            onClick={() => setConfirmDeleteId(null)}
                                            className="px-1.5 py-0.2 text-sub hover:text-main"
                                          >
                                            {t.cancel}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-dim'}`} />
                                          <span className="truncate">{page.title}</span>
                                        </div>

                                        <div className="flex items-center gap-1 text-[10px] font-mono text-dim">
                                          <span>{page.wordCount || 0}</span>

                                          {/* Reorder page */}
                                          {onMovePage && (
                                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                              <button
                                                disabled={pageIndex === 0}
                                                onClick={() => onMovePage(page.id, 'up')}
                                                className="p-0.5 hover:text-main disabled:opacity-20"
                                                title={t.moveUp}
                                              >
                                                <ArrowUp className="w-2.5 h-2.5" />
                                              </button>
                                              <button
                                                disabled={pageIndex === chapter.pages.length - 1}
                                                onClick={() => onMovePage(page.id, 'down')}
                                                className="p-0.5 hover:text-main disabled:opacity-20"
                                                title={t.moveDown}
                                              >
                                                <ArrowDown className="w-2.5 h-2.5" />
                                              </button>
                                            </div>
                                          )}

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStartRename(page.id, page.title);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-main hover:bg-canvas transition-all"
                                            title={t.rename}
                                          >
                                            <Edit2 className="w-2.5 h-2.5" />
                                          </button>

                                          {chapter.pages.length > 1 && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setConfirmDeleteId(page.id);
                                              }}
                                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 hover:bg-canvas transition-all"
                                              title={t.delete}
                                            >
                                              <Trash2 className="w-2.5 h-2.5" />
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Add Volume inline form or trigger button */}
        {isAddingVolume ? (
          <div className="p-2.5 rounded-lg bg-canvas border border-indigo-600/30 space-y-1.5">
            <span className="text-xs font-semibold text-main">{t.newVolume}</span>
            <input
              type="text"
              value={newVolumeTitle}
              onChange={(e) => setNewVolumeTitle(e.target.value)}
              placeholder={t.newVolume}
              className="w-full bg-surface border border-subtle rounded px-2 py-1 text-xs text-main focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateVolume();
                if (e.key === 'Escape') setIsAddingVolume(false);
              }}
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => setIsAddingVolume(false)}
                className="px-2 py-0.5 text-xs text-sub hover:text-main"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleCreateVolume}
                className="px-3 py-0.5 text-xs font-semibold bg-indigo-600 text-white rounded"
              >
                {t.save}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setIsAddingVolume(true);
              setNewVolumeTitle(`${t.newVolume} ${book.volumes.length + 1}`);
            }}
            className="w-full mt-2 py-2 px-3 border border-dashed border-subtle hover:border-indigo-600/50 rounded-lg text-xs font-medium text-sub hover:text-main hover:bg-elevated/50 flex items-center justify-center gap-1.5 transition-all"
          >
            <FolderPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{t.newVolume}</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="no-print hidden md:block w-64 lg:w-72 h-[calc(100vh-3.5rem)] shrink-0 overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {isOpenMobile && (
        <div className="no-print fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
            onClick={onCloseMobile} 
          />
          <div className="relative w-72 sm:w-80 h-full max-w-[85vw] shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
