import React, { useState } from 'react';
import { 
  History, 
  Plus, 
  Trash2, 
  RotateCcw, 
  X, 
  Check, 
  FileText,
  Calendar
} from 'lucide-react';
import { Book, Page, Snapshot, AppLanguage } from '../types';
import { useI18n } from '../lib/i18n';

interface SnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  activePage: Page | null;
  onCreateSnapshot: (title: string, description?: string) => void;
  onRestoreSnapshot: (snapshot: Snapshot) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  language: AppLanguage;
}

export const SnapshotModal: React.FC<SnapshotModalProps> = ({
  isOpen,
  onClose,
  book,
  activePage,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  language,
}) => {
  const t = useI18n(language);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [previewSnapshot, setPreviewSnapshot] = useState<Snapshot | null>(null);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreateSnapshot(newTitle.trim(), newDesc.trim() || undefined);
    setNewTitle('');
    setNewDesc('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-3xl max-h-[85vh] bg-surface border border-subtle rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-subtle flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/15 border border-indigo-600/30 flex items-center justify-center text-indigo-600">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-main">{t.snapshots}</h2>
              <p className="text-xs text-sub">
                {language === 'ar'
                  ? 'سجل النسخ واللقطات المحفوظة محلياً للرجوع إليها متى شئت'
                  : 'Manuscript snapshots stored offline in IndexedDB for easy rollback'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-sub hover:text-main hover:bg-elevated"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Snapshots list */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Create Snapshot Form */}
            <form onSubmit={handleCreate} className="p-3.5 rounded-xl bg-canvas border border-subtle space-y-2.5">
              <h4 className="text-xs font-bold text-main uppercase font-mono">
                {language === 'ar' ? 'حفظ لقطة جديدة الآن' : 'Save New Snapshot Now'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={language === 'ar' ? 'عنوان النسخة (مثال: قبل تعديل الحوار)' : 'Snapshot Title (e.g. Pre-rewrite)'}
                  className="bg-surface border border-subtle rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none"
                />
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={language === 'ar' ? 'وصف اختياري...' : 'Optional description...'}
                  className="bg-surface border border-subtle rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'حفظ اللقطة' : 'Take Snapshot'}</span>
                </button>
              </div>
            </form>

            {/* List */}
            <div className="space-y-2">
              {book.snapshots.length === 0 ? (
                <div className="text-center py-8 text-sub text-xs">
                  {language === 'ar' ? 'لم تقم بحفظ أي لقطة بعد' : 'No snapshots recorded yet'}
                </div>
              ) : (
                book.snapshots.map((snap) => {
                  const isPreviewing = previewSnapshot?.id === snap.id;
                  return (
                    <div
                      key={snap.id}
                      onClick={() => setPreviewSnapshot(snap)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                        isPreviewing
                          ? 'border-indigo-600 bg-indigo-600/10'
                          : 'border-subtle bg-canvas hover:bg-elevated'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-main">{snap.title}</span>
                        <div className="flex items-center gap-1 text-[11px] text-dim font-mono">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(snap.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {snap.description && (
                        <p className="text-[11px] text-sub">{snap.description}</p>
                      )}

                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <span className="text-dim truncate max-w-xs font-amiri">
                          {snap.contentSnapshot.slice(0, 70)}...
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(language === 'ar' ? 'هل تريد استعادة هذه النسخة في صفحتك الحالية؟' : 'Restore this snapshot into your active page?')) {
                                onRestoreSnapshot(snap);
                                onClose();
                              }
                            }}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold text-indigo-600 hover:bg-indigo-600/20 flex items-center gap-1"
                            title="Restore"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{language === 'ar' ? 'استعادة' : 'Restore'}</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSnapshot(snap.id);
                            }}
                            className="p-1 rounded text-sub hover:text-red-500 hover:bg-elevated"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Preview Panel */}
          {previewSnapshot && (
            <div className="w-full md:w-80 border-t md:border-t-0 md:border-s border-subtle p-4 bg-canvas/40 flex flex-col justify-between overflow-hidden">
              <div className="overflow-y-auto space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-main">{previewSnapshot.title}</h4>
                  <button
                    onClick={() => setPreviewSnapshot(null)}
                    className="text-sub hover:text-main text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-3 rounded-lg bg-surface border border-subtle text-xs text-main leading-relaxed font-amiri whitespace-pre-wrap max-h-72 overflow-y-auto select-text">
                  {previewSnapshot.contentSnapshot}
                </div>
              </div>

              <div className="pt-3 border-t border-subtle">
                <button
                  onClick={() => {
                    onRestoreSnapshot(previewSnapshot);
                    onClose();
                  }}
                  className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'استعادة هذه النسخة للصفحة' : 'Restore to Active Page'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
