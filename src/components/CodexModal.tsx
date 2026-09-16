import React, { useState } from 'react';
import { 
  Compass, 
  Plus, 
  Trash2, 
  Edit3, 
  Sparkles, 
  User, 
  MapPin, 
  Bookmark, 
  BookOpen, 
  Package, 
  X,
  Search,
  Check
} from 'lucide-react';
import { Book, CodexEntry, AppLanguage, ApiKeyItem } from '../types';
import { useI18n } from '../lib/i18n';
import { generateCodexEntryDetails } from '../lib/gemini';

interface CodexModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onAddEntry: (entry: Omit<CodexEntry, 'id' | 'bookId' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateEntry: (entryId: string, updates: Partial<CodexEntry>) => void;
  onDeleteEntry: (entryId: string) => void;
  language: AppLanguage;
  apiKeys?: ApiKeyItem[];
  onUpdateKeyStatus?: (keyId: string, status: ApiKeyItem['status'], error?: string) => void;
}

export const CodexModal: React.FC<CodexModalProps> = ({
  book,
  isOpen,
  onClose,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  language,
  apiKeys = [],
  onUpdateKeyStatus = () => {},
}) => {
  const t = useI18n(language);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<CodexEntry['category']>('character');
  const [description, setDescription] = useState('');
  const [aliases, setAliases] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleAiBrainstorm = async () => {
    if (!name.trim() || isAiGenerating) return;
    setIsAiGenerating(true);
    try {
      const result = await generateCodexEntryDetails(
        apiKeys,
        onUpdateKeyStatus,
        category,
        name.trim(),
        {
          title: book.title,
          genre: book.genre,
          description: book.description,
          primaryLanguage: book.primaryLanguage,
        }
      );
      if (result.description) setDescription(result.description);
      if (result.aliases && !aliases) setAliases(result.aliases);
      if (result.notes && !notes) setNotes(result.notes);
    } catch (err: any) {
      console.error('Codex AI error:', err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const categories = [
    { id: 'all', label: language === 'ar' ? 'الكل' : 'All', icon: Compass },
    { id: 'character', label: t.codexCategories.character, icon: User },
    { id: 'location', label: t.codexCategories.location, icon: MapPin },
    { id: 'plot', label: t.codexCategories.plot, icon: Bookmark },
    { id: 'lore', label: t.codexCategories.lore, icon: BookOpen },
    { id: 'item', label: t.codexCategories.item, icon: Package },
  ];

  const filteredEntries = book.codex.filter((entry) => {
    const matchesCat = selectedCategory === 'all' || entry.category === selectedCategory;
    const matchesQuery = !searchQuery || 
      entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.aliases && entry.aliases.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesQuery;
  });

  const handleStartAdd = () => {
    setIsAddingNew(true);
    setEditingEntryId(null);
    setName('');
    setCategory('character');
    setDescription('');
    setAliases('');
    setNotes('');
  };

  const handleStartEdit = (entry: CodexEntry) => {
    setEditingEntryId(entry.id);
    setIsAddingNew(false);
    setName(entry.name);
    setCategory(entry.category);
    setDescription(entry.description);
    setAliases(entry.aliases || '');
    setNotes(entry.notes || '');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingEntryId) {
      onUpdateEntry(editingEntryId, {
        name: name.trim(),
        category,
        description: description.trim(),
        aliases: aliases.trim() || undefined,
        notes: notes.trim() || undefined,
        updatedAt: Date.now(),
      });
      setEditingEntryId(null);
    } else {
      onAddEntry({
        name: name.trim(),
        category,
        description: description.trim(),
        aliases: aliases.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setIsAddingNew(false);
    }
  };

  const getCategoryIcon = (cat: CodexEntry['category']) => {
    switch (cat) {
      case 'character': return <User className="w-4 h-4 text-blue-500" />;
      case 'location': return <MapPin className="w-4 h-4 text-emerald-500" />;
      case 'plot': return <Bookmark className="w-4 h-4 text-purple-500" />;
      case 'lore': return <BookOpen className="w-4 h-4 text-indigo-500" />;
      case 'item': return <Package className="w-4 h-4 text-rose-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-4xl max-h-[90vh] bg-surface border border-subtle rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-subtle flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/15 border border-indigo-600/30 flex items-center justify-center text-indigo-600">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-main">{t.codex}</h2>
              <p className="text-xs text-sub flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>
                  {language === 'ar'
                    ? 'المدونة الموسوعية لشخصيات وروايات كتابك (يقرأها الذكاء الاصطناعي تلقائياً للحفاظ على الاتساق)'
                    : 'Worldbuilding Bible & Character Codex (Gemini reads this for seamless continuity)'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAddingNew && !editingEntryId && (
              <button
                onClick={handleStartAdd}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'إضافة مدخل' : 'Add Entry'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-sub hover:text-main hover:bg-elevated"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Main List Section */}
          <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-hidden">
            {/* Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
              {/* Category pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-colors ${
                        isActive 
                          ? 'bg-indigo-600/20 text-indigo-950 dark:text-indigo-200 font-bold border border-indigo-600/40' 
                          : 'bg-canvas text-sub hover:text-main border border-subtle'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute top-2.5 left-2.5 rtl:right-2.5 rtl:left-auto text-sub pointer-events-none" />
                <input
                  type="text"
                  placeholder={t.search}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-48 bg-canvas border border-subtle rounded-lg py-1 px-8 text-xs text-main placeholder:text-dim focus:outline-none"
                />
              </div>
            </div>

            {/* Entries Grid */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pe-1">
              {filteredEntries.length === 0 ? (
                <div className="text-center py-12 text-sub text-xs">
                  {language === 'ar' ? 'لا توجد مدخلات في هذا التصنيف' : 'No entries found in this category'}
                </div>
              ) : (
                filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3.5 rounded-xl bg-canvas border border-subtle hover:border-indigo-600/40 transition-all flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(entry.category)}
                        <h4 className="text-sm font-bold text-main font-amiri text-base">{entry.name}</h4>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-elevated text-sub">
                          {t.codexCategories[entry.category]}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStartEdit(entry)}
                          className="p-1 rounded text-sub hover:text-main hover:bg-elevated"
                          title={t.edit}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`${t.delete} "${entry.name}"?`)) {
                              onDeleteEntry(entry.id);
                            }
                          }}
                          className="p-1 rounded text-sub hover:text-red-500 hover:bg-elevated"
                          title={t.delete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-main leading-relaxed select-text font-amiri text-sm">{entry.description}</p>

                    {(entry.aliases || entry.notes) && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-dim border-t border-subtle/40">
                        {entry.aliases && (
                          <span>
                            <strong>{language === 'ar' ? 'الأسماء المستعارة:' : 'Aliases:'}</strong> {entry.aliases}
                          </span>
                        )}
                        {entry.notes && (
                          <span>
                            <strong>{language === 'ar' ? 'ملاحظات:' : 'Notes:'}</strong> {entry.notes}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add / Edit Form Panel */}
          {(isAddingNew || editingEntryId) && (
            <div className="w-full md:w-80 border-t md:border-t-0 md:border-s border-subtle p-4 bg-canvas/60 overflow-y-auto">
              <form onSubmit={handleSaveForm} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-main uppercase font-mono">
                    {editingEntryId ? (language === 'ar' ? 'تعديل المدخل' : 'Edit Entry') : (language === 'ar' ? 'مدخل جديد' : 'New Entry')}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNew(false);
                      setEditingEntryId(null);
                    }}
                    className="text-sub hover:text-main text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-sub block">
                      {language === 'ar' ? 'الاسم / العنوان' : 'Name / Title'}
                    </label>
                    <button
                      type="button"
                      onClick={handleAiBrainstorm}
                      disabled={isAiGenerating || !name.trim()}
                      className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-40 flex items-center gap-1 transition-colors"
                      title={language === 'ar' ? 'توليد تفاصيل واقتراحات بالذكاء الاصطناعي بناء على الاسم وسياق الرواية' : 'Generate details with AI based on name and story context'}
                    >
                      <Sparkles className={`w-3 h-3 ${isAiGenerating ? 'animate-spin' : ''}`} />
                      <span>{isAiGenerating ? (language === 'ar' ? 'جارٍ التوليد...' : 'Generating...') : t.codexAiGenerate}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Tariq the Archivist"
                    className="w-full bg-surface border border-subtle rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-sub block mb-1">
                    {language === 'ar' ? 'التصنيف' : 'Category'}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-surface border border-subtle rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none"
                  >
                    <option value="character">{t.codexCategories.character}</option>
                    <option value="location">{t.codexCategories.location}</option>
                    <option value="plot">{t.codexCategories.plot}</option>
                    <option value="lore">{t.codexCategories.lore}</option>
                    <option value="item">{t.codexCategories.item}</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-sub block mb-1">
                    {language === 'ar' ? 'الوصف والتفاصيل' : 'Description & Details'}
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={language === 'ar' ? 'الخلفية، السمات، السلوك، الأثر الدرامي...' : 'Backstory, physical appearance, motivations...'}
                    className="w-full bg-surface border border-subtle rounded-lg p-2.5 text-xs text-main focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-sub block mb-1">
                    {language === 'ar' ? 'ألقاب أو أسماء بديلة' : 'Aliases / Alternate Names'}
                  </label>
                  <input
                    type="text"
                    value={aliases}
                    onChange={(e) => setAliases(e.target.value)}
                    placeholder="e.g. The Watcher, حارس الأختام"
                    className="w-full bg-surface border border-subtle rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-sub block mb-1">
                    {language === 'ar' ? 'ملاحظات سرية للكاتب' : 'Author Notes'}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={language === 'ar' ? 'سر سينكشف بالفصل 5...' : 'Secret reveal in Chapter 5...'}
                    className="w-full bg-surface border border-subtle rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{t.save}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNew(false);
                      setEditingEntryId(null);
                    }}
                    className="py-1.5 px-3 rounded-lg text-xs text-sub hover:text-main"
                  >
                    {t.cancel}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
