import React, { useState } from 'react';
import { 
  Download, 
  FileText, 
  Printer, 
  FileCode, 
  X, 
  Check, 
  BookOpen, 
  Layers,
  Sparkles
} from 'lucide-react';
import { Book, Chapter, Page, AppLanguage } from '../types';
import { useI18n } from '../lib/i18n';
import { 
  exportDocx, 
  exportEpub,
  exportMarkdown, 
  exportText, 
  compileToMarkdown,
  triggerPrintPdf 
} from '../lib/export';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  activeChapter: Chapter | null;
  activePage: Page | null;
  language: AppLanguage;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  book,
  activeChapter,
  activePage,
  language,
}) => {
  const t = useI18n(language);
  const [scope, setScope] = useState<'page' | 'chapter' | 'book'>('book');
  const [format, setFormat] = useState<'docx' | 'epub' | 'pdf' | 'md' | 'txt'>('docx');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  // Calculate scope words
  let scopeWordCount = 0;
  if (scope === 'page' && activePage) {
    scopeWordCount = activePage.wordCount || 0;
  } else if (scope === 'chapter' && activeChapter) {
    scopeWordCount = activeChapter.pages.reduce((acc, p) => acc + (p.wordCount || 0), 0);
  } else {
    for (const vol of book.volumes) {
      for (const ch of vol.chapters) {
        for (const pg of ch.pages) {
          scopeWordCount += pg.wordCount || 0;
        }
      }
    }
  }

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const sanitizedTitle = book.title.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
      const filename = scope === 'page' && activePage
        ? `${sanitizedTitle}_${activePage.title}`
        : scope === 'chapter' && activeChapter
        ? `${sanitizedTitle}_${activeChapter.title}`
        : `${sanitizedTitle}_Complete_Book`;

      if (format === 'pdf') {
        onClose();
        setTimeout(() => {
          triggerPrintPdf();
        }, 300);
        return;
      }

      if (format === 'docx') {
        await exportDocx(
          filename,
          book,
          scope,
          activePage || undefined,
          activeChapter || undefined
        );
      } else if (format === 'epub') {
        await exportEpub(
          filename,
          book,
          scope,
          activePage || undefined,
          activeChapter || undefined
        );
      } else if (format === 'md') {
        const mdContent = compileToMarkdown(
          book,
          scope,
          activePage || undefined,
          activeChapter || undefined
        );
        exportMarkdown(filename, mdContent);
      } else if (format === 'txt') {
        const txtContent = compileToMarkdown(
          book,
          scope,
          activePage || undefined,
          activeChapter || undefined
        ).replace(/[#*_]/g, '');
        exportText(filename, txtContent);
      }

      onClose();
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg bg-surface border border-subtle rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-subtle flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/15 border border-indigo-600/30 flex items-center justify-center text-indigo-600">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-main">{t.exportTitle}</h2>
              <p className="text-xs text-sub">{book.title} (~{scopeWordCount.toLocaleString()} {t.words})</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-sub hover:text-main hover:bg-elevated"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-5">
          {/* Scope Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-main uppercase font-mono block">
              {language === 'ar' ? 'نطاق التصدير' : 'Export Scope'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'page', label: t.exportCurrentPage, icon: FileText, disabled: !activePage },
                { id: 'chapter', label: t.exportCurrentChapter, icon: Layers, disabled: !activeChapter },
                { id: 'book', label: t.exportFullBook, icon: BookOpen, disabled: false },
              ].map((s) => {
                const Icon = s.icon;
                const isSelected = scope === s.id;
                return (
                  <button
                    key={s.id}
                    disabled={s.disabled}
                    onClick={() => setScope(s.id as any)}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs text-center transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-600/15 text-main font-bold'
                        : 'border-subtle bg-canvas text-sub hover:bg-elevated disabled:opacity-30'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-indigo-600" />
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Format Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-main uppercase font-mono block">
              {language === 'ar' ? 'صيغة الملف' : 'File Format'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'docx', label: t.exportDocx, desc: 'Microsoft Word' },
                { id: 'epub', label: t.exportEpub, desc: language === 'ar' ? 'قارئات الكتب الإلكترونية' : 'E-Readers & Tablets' },
                { id: 'pdf', label: t.exportPdf, desc: 'Print / PDF Book' },
                { id: 'md', label: t.exportMd, desc: 'Markdown syntax' },
                { id: 'txt', label: t.exportTxt, desc: 'Plain text' },
              ].map((fmt) => (
                <label
                  key={fmt.id}
                  onClick={() => setFormat(fmt.id as any)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1 ${
                    format === fmt.id
                      ? 'border-indigo-600 bg-indigo-600/15 text-main font-semibold'
                      : 'border-subtle bg-canvas text-sub hover:bg-elevated'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{fmt.label}</span>
                    {format === fmt.id && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <span className="text-[10px] text-dim">{fmt.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Bilingual formatting note */}
          <div className="p-3 rounded-xl bg-canvas border border-subtle text-[11px] text-sub leading-relaxed">
            <span className="font-semibold text-main">
              {language === 'ar' ? 'تنسيق ثنائي اللغة التلقائي:' : 'Automatic Bilingual Alignment:'}
            </span>{' '}
            {language === 'ar'
              ? 'يتم ضبط اتجاه النصوص العربية لليمين (RTL) والنصوص الإنجليزية لليسار (LTR) مع مراعاة الهوامش البصرية لراحة القراءة.'
              : 'Arabic passages are rendered RTL and English passages LTR with optical book margins.'}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-subtle bg-canvas flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-sub hover:text-main"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-colors shadow-sm"
          >
            {isExporting ? <span className="animate-spin">⏳</span> : <Download className="w-3.5 h-3.5" />}
            <span>{language === 'ar' ? 'تصدير وتحميل' : 'Export & Download'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
