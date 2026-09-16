import { ApiKeyItem, Book, Chapter, CodexEntry, Page } from '../types';

export interface GenerateResult {
  text: string;
  usedKeyId?: string;
  failedKeys?: string[];
}

export interface KeyFailoverListener {
  (failedKey: ApiKeyItem, nextKey?: ApiKeyItem): void;
}

let onKeyFailoverCallback: KeyFailoverListener | null = null;

export function setKeyFailoverListener(listener: KeyFailoverListener | null) {
  onKeyFailoverCallback = listener;
}

export async function testKeyApi(apiKey: string): Promise<{ success: boolean; message?: string; error?: string; isRateLimited?: boolean; isInvalid?: boolean }> {
  try {
    const response = await fetch('/api/gemini/test-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to validate API key',
        isRateLimited: data.isRateLimited || response.status === 429,
        isInvalid: data.isInvalid || response.status === 400 || response.status === 403,
      };
    }

    return {
      success: true,
      message: data.message || 'Key is active and working',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error while testing key',
    };
  }
}

export async function executeWithKeyRotation(
  keys: ApiKeyItem[],
  updateKeyStatus: (keyId: string, status: ApiKeyItem['status'], error?: string) => void,
  payload: {
    prompt: string;
    systemInstruction?: string;
    temperature?: number;
    model?: string;
  }
): Promise<GenerateResult> {
  const activeKeys = keys.filter(k => k.status !== 'invalid');
  const pool = activeKeys.length > 0 ? activeKeys : keys;
  const failedKeyIds: string[] = [];

  // If no keys configured, try server default (apiKey = undefined)
  if (pool.length === 0) {
    const res = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gemini generation failed');
    }

    return { text: data.text || '' };
  }

  // Iterate through keys with automated failover
  for (let i = 0; i < pool.length; i++) {
    const currentKey = pool[i];
    try {
      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          apiKey: currentKey.key,
        }),
      });

      const data = await res.json();

      if (res.ok && data.text) {
        // Mark as active if previously rate limited or unknown
        if (currentKey.status !== 'active') {
          updateKeyStatus(currentKey.id, 'active');
        }
        return {
          text: data.text,
          usedKeyId: currentKey.id,
          failedKeys: failedKeyIds,
        };
      }

      // Check for rate limit or quota exhaustion (429 or quota errors)
      if (res.status === 429 || data.isRateLimited) {
        updateKeyStatus(currentKey.id, 'rate_limited', data.error);
        failedKeyIds.push(currentKey.id);
        const nextKey = pool[i + 1];
        if (onKeyFailoverCallback) {
          onKeyFailoverCallback(currentKey, nextKey);
        }
        console.warn(`Key ${currentKey.label} hit rate limits (429). Rotating to next key...`);
        continue; // Try next key
      }

      // Check for invalid key (403/400)
      if (res.status === 403 || data.isInvalid) {
        updateKeyStatus(currentKey.id, 'invalid', data.error);
        failedKeyIds.push(currentKey.id);
        const nextKey = pool[i + 1];
        if (onKeyFailoverCallback) {
          onKeyFailoverCallback(currentKey, nextKey);
        }
        console.warn(`Key ${currentKey.label} is invalid. Rotating to next key...`);
        continue; // Try next key
      }

      // Other error
      throw new Error(data.error || `HTTP error ${res.status}`);
    } catch (err: any) {
      if (i === pool.length - 1) {
        // Last key also failed
        throw new Error(err.message || 'All keys in the pool failed to generate content');
      }
      // Otherwise continue to next key
      failedKeyIds.push(currentKey.id);
    }
  }

  throw new Error('All configured API keys were exhausted or encountered errors.');
}

// Format the Codex and Book context into a system prompt for the AI
export function buildBookContextPrompt(
  book: Book, 
  activeChapter?: Chapter, 
  activePage?: Page,
  globalPersona?: string
): string {
  const isPersonalOrNonFiction = !book.genre || 
    ['personal', 'memoir', 'philosophy', 'guide', 'essays', 'self-development', 'thoughts', 'reflections', 'biography', 'journal', 'شخصي', 'سيرة', 'فلسفة', 'تأملات', 'مقالات', 'تطوير ذات', 'خواطر', 'مذكرات'].some(k => 
      (book.genre?.toLowerCase().includes(k)) || 
      (book.description?.toLowerCase().includes(k)) ||
      (book.aiSettings?.bookType && book.aiSettings.bookType !== 'fiction')
    );

  let context = isPersonalOrNonFiction
    ? `You are an elite personal book scribe, biographer, and non-fiction co-author. The author is writing this book for himself—crystallizing his personal life experiences, reflections, philosophies, life principles, lessons, insights, and thoughts.\n`
    : `You are a professional literary co-author and master book consultant specializing in both Arabic and English prose.\n`;

  if (globalPersona?.trim()) {
    context += `\nAuthor's Global Persona & Core Directives:\n"${globalPersona.trim()}"\n`;
  }

  context += `\n--- ACTIVE BOOK METADATA ---\n`;
  context += `Book Title: "${book.title}" ${book.subtitle ? `(${book.subtitle})` : ''}\n`;
  context += `Genre / Nature: ${book.genre || (isPersonalOrNonFiction ? 'Personal Book & Reflections (كتاب شخصي وتأملات)' : 'Literature')}\n`;
  if (book.description) {
    context += `Book Premise / Purpose: ${book.description}\n`;
  }

  // Book-specific custom AI instructions & style guidelines
  if (book.aiSettings) {
    context += `\n--- BOOK-SPECIFIC AI GUIDELINES ---\n`;
    if (book.aiSettings.authorVoice) {
      context += `- Author's Unique Voice: ${book.aiSettings.authorVoice}\n`;
    }
    if (book.aiSettings.narrativeTone) {
      context += `- Tone & Style: ${book.aiSettings.narrativeTone}\n`;
    }
    if (book.aiSettings.pov) {
      const povLabels: Record<string, string> = {
        first_person: 'First Person ("أنا" / "I") - Direct Personal Perspective',
        third_limited: 'Third Person Limited (ضمير الغائب)',
        third_omniscient: 'Third Person Omniscient (الراوي العليم)',
        second_person: 'Second Person ("أنت" / "You") - Direct Address to Reader',
      };
      context += `- Point of View (POV): ${povLabels[book.aiSettings.pov] || book.aiSettings.pov}\n`;
    }
    if (book.aiSettings.targetAudience) {
      context += `- Target Audience / Purpose: ${book.aiSettings.targetAudience}\n`;
    }
    if (book.aiSettings.customInstructions) {
      context += `- Author Directives: ${book.aiSettings.customInstructions}\n`;
    }
    if (book.aiSettings.rulesToAvoid) {
      context += `- FORBIDDEN RULES & AVOIDANCES: ${book.aiSettings.rulesToAvoid}\n`;
    }
  }

  if (book.codex && book.codex.length > 0) {
    context += `\n--- BOOK CONCEPTS, INSIGHTS & REFERENCES ---\n`;
    for (const entry of book.codex) {
      context += `- [${entry.category.toUpperCase()}] ${entry.name}: ${entry.description}`;
      if (entry.aliases) context += ` (Aliases/Tags: ${entry.aliases})`;
      if (entry.notes) context += ` | Notes: ${entry.notes}`;
      context += `\n`;
    }
  }

  if (activeChapter) {
    context += `\n--- CURRENT CHAPTER ---\nTitle: ${activeChapter.title}\n`;
    if (activeChapter.synopsis) context += `Synopsis / Purpose: ${activeChapter.synopsis}\n`;
  }

  if (activePage) {
    context += `\n--- ACTIVE PAGE ---\nTitle: ${activePage.title}\n`;
    const excerpt = activePage.content.slice(-1500); // Last 1500 chars for continuity
    if (excerpt.trim()) {
      context += `Recent Text Excerpt:\n"""\n${excerpt}\n"""\n`;
    }
  }

  context += `\nCore Execution Rules:
1. Embody the author's real, authentic voice. Avoid generic AI fluff, superficial motivational slogans, or synthetic academic stiffness.
2. When writing in Arabic, use elegant, natural, crystal-clear literary Arabic (فصحى راقية سلسة معبرة خالية من الركاكة) that sounds like the author speaking his deepest truths directly into the page.
3. When writing in English, craft rhythmic, profound, articulate prose with clear transitions and intellectual/emotional weight.
4. Structure ideas thoughtfully with natural paragraph cadence, evocative reflections, and concrete real-life anchor points.
5. Return clean book prose ready for publication in the author's manuscript.`;

  return context;
}

export async function askLibraryAI(
  keys: ApiKeyItem[],
  updateKeyStatus: (keyId: string, status: ApiKeyItem['status'], error?: string) => void,
  book: Book,
  question: string,
  activeChapter?: Chapter,
  activePage?: Page,
  globalPersona?: string,
  modelOverride?: string,
  temperatureOverride?: number
): Promise<string> {
  const systemInstruction = buildBookContextPrompt(book, activeChapter, activePage, globalPersona);
  const prompt = `The author is asking you a question about their book, characters, plot consistency, or next scenes:
"""
${question}
"""
Provide an insightful, helpful, and specific response directly referencing the book's world, characters, or text.`;

  const result = await executeWithKeyRotation(keys, updateKeyStatus, {
    prompt,
    systemInstruction,
    model: modelOverride || 'gemini-3.8-flash',
    temperature: temperatureOverride ?? 0.7,
  });

  return result.text;
}

export async function tellAiToType(
  keys: ApiKeyItem[],
  updateKeyStatus: (keyId: string, status: ApiKeyItem['status'], error?: string) => void,
  book: Book,
  instruction: string,
  targetLang: 'ar' | 'en' | 'auto',
  activeChapter?: Chapter,
  activePage?: Page,
  globalPersona?: string,
  modelOverride?: string,
  temperatureOverride?: number
): Promise<string> {
  const systemInstruction = buildBookContextPrompt(book, activeChapter, activePage, globalPersona);
  let langGuidance = 'Match the language of the active page or request.';
  if (targetLang === 'ar') langGuidance = 'Write strictly in beautiful literary Arabic (فصحى بليغة).';
  if (targetLang === 'en') langGuidance = 'Write strictly in elegant English prose.';

  const prompt = `Instruction from author: "${instruction}"
Target language requirement: ${langGuidance}

Generate the exact prose ready to be inserted directly into the chapter. Do not include markdown codeblocks or quotes around the whole text unless they are dialogue. Return ONLY the narrative prose.`;

  const result = await executeWithKeyRotation(keys, updateKeyStatus, {
    prompt,
    systemInstruction,
    model: modelOverride || 'gemini-3.8-flash',
    temperature: temperatureOverride ?? 0.8,
  });

  return result.text.trim();
}

export async function translateAndType(
  keys: ApiKeyItem[],
  updateKeyStatus: (keyId: string, status: ApiKeyItem['status'], error?: string) => void,
  text: string,
  targetLang: 'ar' | 'en'
): Promise<string> {
  const prompt = targetLang === 'ar'
    ? `Translate the following English passage into literary, eloquent Arabic prose (لغة عربية أدبية فصيحة وبليغة). Ensure the cadence, emotional depth, and metaphors are preserved for book reading:
"""
${text}
"""
Return ONLY the translated Arabic prose.`
    : `Translate the following Arabic passage into evocative, high-quality literary English prose. Ensure lyrical flow and literary depth:
"""
${text}
"""
Return ONLY the translated English prose.`;

  const result = await executeWithKeyRotation(keys, updateKeyStatus, {
    prompt,
    systemInstruction: 'You are an award-winning literary translator specializing in Arabic and English novels.',
    temperature: 0.4,
  });

  return result.text.trim();
}

export async function cleanUpVoiceSpeech(
  keys: ApiKeyItem[],
  updateKeyStatus: (keyId: string, status: ApiKeyItem['status'], error?: string) => void,
  rawTranscript: string,
  language: string
): Promise<string> {
  const isArabic = language.startsWith('ar');
  const prompt = isArabic
    ? `النص التالي تم التقاطه عبر الإملاء الصوتي للكاتب، وقد يحتوي على أخطاء ترقيم أو انقطاع في الجمل:
"""
${rawTranscript}
"""
المطلوب:
1. تصحيح علامات الترقيم (فواصل، نقاط، علامات تنصيص للحوار).
2. تقسيم النص إلى فقرات سردية متناسقة.
3. إصلاح عثرات اللسان والهمزات دون تغيير المعنى أو كلمات الكاتب.
أعد النص المصحح فقط.`
    : `The following is raw dictated speech from a book author, which may lack punctuation or have run-on sentences:
"""
${rawTranscript}
"""
Format this into clean, properly punctuated literary prose with natural paragraphs and dialogue quotes. Preserve the author's original words and voice. Return ONLY the cleaned text.`;

  const result = await executeWithKeyRotation(keys, updateKeyStatus, {
    prompt,
    systemInstruction: 'You are an expert editorial proofreader and voice-to-prose formatter.',
    temperature: 0.3,
  });

  return result.text.trim();
}

export async function adjustTone(
  keys: ApiKeyItem[],
  updateKeyStatus: (keyId: string, status: ApiKeyItem['status'], error?: string) => void,
  text: string,
  toneKey: 'poetic' | 'dramatic' | 'descriptive' | 'classicalArabic' | 'concise'
): Promise<string> {
  const prompt = `Rewrite the following passage in the requested tone (${toneKey}):
"""
${text}
"""
Tone description:
- poetic: Lyrical, metaphorical, rhythmic.
- dramatic: High tension, vivid verbs, heightened emotional stakes.
- descriptive: Rich sensory details of sight, sound, scent, and atmosphere.
- classicalArabic: فصحى بليغة كلاسيكية بجزالة لفظية وأسلوب رصين.
- concise: Lean, punchy, stripping all unnecessary filler.

Return ONLY the rewritten prose.`;

  const result = await executeWithKeyRotation(keys, updateKeyStatus, {
    prompt,
    temperature: 0.7,
  });

  return result.text.trim();
}

export async function enhanceArabicPunctuationAndTashkeel(
  keys: ApiKeyItem[],
  updateKeyStatus: (keyId: string, status: ApiKeyItem['status'], error?: string) => void,
  text: string
): Promise<string> {
  const prompt = `أنت خبير تدقيق لغوي وطباعي للروايات العربية. قم بمراجعة النص التالي وتطبيق المعايير الأدبية التالية:
1. ضبط وتصحيح علامات الترقيم العربية السليمة (الفواصل العربية "،"، علامات الاستفهام "؟"، النقاط، وتنسيق الحوار بعلامات التنصيص المزدوجة « » أو الشرطات الطويلة —).
2. إضافة تشكيل خفيف ودقيق (ضبط أواخر الكلمات والكلمات الملتبسة فقط لمنع اللبس دون إثقال الصفحة بالحركات الزائدة، للحفاظ على راحة العين أثناء القراءة).
3. إصلاح همزات الوصل والقطع والألف اللينة.
4. الحفاظ التام على أسلوب الكاتب وصوته الأدبي دون تغيير كلماته الأصلية.

النص:
"""
${text}
"""

أعد النص المنقّح والمضبوط فقط دون أي مقدمات أو شروحات.`;

  const result = await executeWithKeyRotation(keys, updateKeyStatus, {
    prompt,
    systemInstruction: 'أنت محرر أدبي رفيع المستوى مختص بنشر الروايات والمؤلفات الأدبية الفاخرة.',
    temperature: 0.2,
  });

  return result.text.trim();
}

export async function suggestSynonymsAndRhetoric(
  keys: ApiKeyItem[],
  updateKeyStatus: (keyId: string, status: ApiKeyItem['status'], error?: string) => void,
  text: string,
  language: string
): Promise<string> {
  const isArabic = language.startsWith('ar') || /[\u0600-\u06FF]/.test(text);
  const prompt = isArabic
    ? `اقترح 4 إلى 5 بدائل أدبية وبلاغية رفيعة المستوى (مترادفات غنية، تشبيهات مبتكرة، أو صياغة بلاغية معبرة) للكلمة أو العبارة التالية:
"""
${text}
"""
قدم البدائل في قائمة نقطية موجزة ومباشرة تناسب سياق الروايات الأدبية الفاخرة.`
    : `Suggest 4 to 5 rich literary alternatives, evocative synonyms, or metaphorical phrasings for the following word or sentence:
"""
${text}
"""
Present them in a clean, concise bulleted list suitable for high-caliber literary fiction.`;

  const result = await executeWithKeyRotation(keys, updateKeyStatus, {
    prompt,
    systemInstruction: 'You are a master literary stylist and novelist advising an author on diction and wordcraft.',
    temperature: 0.7,
  });

  return result.text.trim();
}

export async function generateCodexEntryDetails(
  keys: ApiKeyItem[],
  updateKeyStatus: (keyId: string, status: ApiKeyItem['status'], error?: string) => void,
  category: CodexEntry['category'],
  name: string,
  bookContext: {
    title: string;
    genre?: string;
    description?: string;
    primaryLanguage: string;
  }
): Promise<{ description: string; aliases?: string; notes?: string }> {
  const isAr = bookContext.primaryLanguage === 'ar' || /[\u0600-\u06FF]/.test(name);
  const prompt = isAr
    ? `أنت مساعد كاتب روائي خبير في بناء العوالم والشخصيات الأدبية.
الكتاب: "${bookContext.title}" (${bookContext.genre || 'رواية'})
موجز الرواية: ${bookContext.description || 'عمل أدبي روائي'}
التصنيف المطلوب: ${category}
الاسم / العنوان: "${name}"

قم بتوليد تفاصيل غنية ومبتكرة تناسب أجواء الرواية بتنسيق JSON:
{
  "description": "فقرة أو فقرتان تحتويان على الخلفية، السمات، الدوافع، والأثر الدرامي بأسلوب أدبي فصيح.",
  "aliases": "ألقاب، كنى، أو مسميات بديلة (مفصولة بفاصلة)",
  "notes": "ملاحظة سرية أو خيط درامي غامض للكاتب"
}
أعد JSON فقط دون أي نصوص إضافية.`
    : `You are an expert novelist's worldbuilding and character design assistant.
Book: "${bookContext.title}" (${bookContext.genre || 'Fiction'})
Synopsis: ${bookContext.description || 'Literary fiction project'}
Category: ${category}
Name / Title: "${name}"

Generate compelling, nuanced worldbuilding details matching the story's tone in strict JSON format:
{
  "description": "One or two paragraphs detailing backstory, sensory traits, psychological motivations, and dramatic narrative role.",
  "aliases": "Alternative names, epithets, or titles separated by commas",
  "notes": "A secret author's note, twist, or hidden motive for the plot"
}
Return ONLY valid JSON.`;

  const result = await executeWithKeyRotation(keys, updateKeyStatus, {
    prompt,
    systemInstruction: 'You generate structured literary worldbuilding and character profile data in clean JSON.',
    temperature: 0.8,
  });

  try {
    const cleanJson = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      description: parsed.description || '',
      aliases: parsed.aliases || '',
      notes: parsed.notes || '',
    };
  } catch {
    return {
      description: result.text.trim(),
    };
  }
}

export interface TalkAndWriteResult {
  title?: string;
  prose: string;
  keyTakeaway?: string;
  suggestedFollowUp?: string;
}

/**
 * Transforms raw spoken thoughts/conversations into publication-ready book prose
 * for personal books, memoirs, philosophy, and non-fiction.
 */
export async function talkAndWriteProse(
  keys: ApiKeyItem[],
  updateKeyStatus: (keyId: string, status: ApiKeyItem['status'], error?: string) => void,
  book: Book,
  spokenContent: string,
  options: {
    targetLang?: 'ar' | 'en' | 'auto';
    writingStyle?: 'personal_memoir' | 'philosophical' | 'clear_guide' | 'deep_reflections' | 'principles' | 'candid';
    activeChapter?: Chapter;
    activePage?: Page;
    globalPersona?: string;
    temperature?: number;
  } = {}
): Promise<TalkAndWriteResult> {
  const systemInstruction = buildBookContextPrompt(
    book, 
    options.activeChapter, 
    options.activePage, 
    options.globalPersona
  );

  const isArabic = options.targetLang === 'ar' || 
    (options.targetLang !== 'en' && (/[\u0600-\u06FF]/.test(spokenContent) || book.primaryLanguage === 'ar'));

  const styleGuides: Record<string, string> = {
    personal_memoir: isArabic 
      ? 'سيرة ذاتية وذكريات شخصية صادقة وحميمية تمس القلب وتستحضر تفاصيل اللحظات الحقيقية' 
      : 'Intimate, candid personal memoir with heartfelt emotional resonance and lived truth',
    philosophical: isArabic 
      ? 'تأمل فلسفي عميق يفكك المفاهيم ويصل إلى بواطن الحكمة الإنسانية بأسلوب رصين' 
      : 'Deep, contemplative philosophy dissecting fundamental human truths and wisdom',
    clear_guide: isArabic 
      ? 'دليل كتابي عملي واضح ومنظم، يقدم المبادئ والخطوات بلغة مقنعة وبصيرة نافذة' 
      : 'Clear, structured non-fiction handbook with persuasive insights and actionable principles',
    deep_reflections: isArabic 
      ? 'خواطر وتأملات أدبية رفيعة، مشحونة بالدهشة والتفكر في مسيرة الحياة والقرارات' 
      : 'Reflective literary essays exploring life choices, growth, and inner transformations',
    principles: isArabic 
      ? 'صياغة مبادئ وقواعد حياة صارمة ومضيئة مستخلصة من التجارب الشخصية' 
      : 'Core life principles and mental models crystallized from real-world trial and error',
    candid: isArabic 
      ? 'حديث مباشر بلا تكلف أو تصنع، صوت حقيقي يعبر عن المشاعر والخواطر كما هي' 
      : 'Direct, authentic, unvarnished voice speaking directly from the heart to the page',
  };

  const selectedStyle = styleGuides[options.writingStyle || 'personal_memoir'] || styleGuides.personal_memoir;

  const prompt = isArabic
    ? `أنا المؤلف، وتحدثت إليك للتو بأفكاري وخواطري العفوية التالية لكتابي:
"""
${spokenContent}
"""

المطلوب منك ككاتب مشارك ومحرر لكتابي:
1. صياغة هذه الأفكار الشفهية إلى نثر كتابي مكتمل وجذاب وجاهز للنشر في صلب كتابي.
2. النمط المطلوب: (${selectedStyle}).
3. التحدث بصوتي وبضمير المتكلم ("أنا")، مع تعميق الفكرة، ربط الجمل بسلاسة بديعة، وحذف الحشو وعثرات الكلام العفوي.
4. تقسيم النص إلى فقرات مقروءة ومريحة للعين، واستخدام عناوين فرعية أنيقة إن كانت الفكرة غنية.
5. أعد النتيجة بتنسيق JSON نظيف:
{
  "title": "عنوان مقترح لهذا المقطع أو الفصل",
  "prose": "النص الكامل المصاغ للكتاب بأسلوب أدبي رفيع وجاهز للإدراج في الصفحة",
  "keyTakeaway": "خلاصة أو حكمة مكثفة في سطر واحد تلخص جوهر ما تحدثت عنه",
  "suggestedFollowUp": "سؤال ذكي تطرحه عليّ كمؤلف لنتعمق في الفكرة القادمة أو نستكمل السرد"
}
أعد JSON فقط.`
    : `I am the author. Here are my raw spoken thoughts and reflections for my book:
"""
${spokenContent}
"""

As my personal scribe and co-author, your mission is to:
1. Transform these spoken thoughts into publication-grade, beautifully composed book prose.
2. Requested style: (${selectedStyle}).
3. Write from my authentic first-person voice ("I"), honoring my lived experience, stripping verbal crutches, and elevating the rhythm and insight.
4. Structure into well-paced paragraphs with subtle subheadings if appropriate.
5. Return clean JSON format:
{
  "title": "Suggested section or chapter title",
  "prose": "The complete, elegant manuscript prose ready to be inserted directly into my book",
  "keyTakeaway": "A one-sentence core principle or memorable truth from this passage",
  "suggestedFollowUp": "An insightful question to ask me next to expand on this or explore the next facet"
}
Return ONLY valid JSON.`;

  const result = await executeWithKeyRotation(keys, updateKeyStatus, {
    prompt,
    systemInstruction,
    model: 'gemini-3.8-flash',
    temperature: options.temperature ?? 0.75,
  });

  try {
    const cleanJson = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      title: parsed.title || '',
      prose: parsed.prose || result.text.trim(),
      keyTakeaway: parsed.keyTakeaway || '',
      suggestedFollowUp: parsed.suggestedFollowUp || '',
    };
  } catch {
    return {
      prose: result.text.trim(),
    };
  }
}

/**
 * Biographer / Interviewer mode: Generates thought-provoking questions to help the author speak his thoughts.
 */
export async function getNextInterviewQuestion(
  keys: ApiKeyItem[],
  updateKeyStatus: (keyId: string, status: ApiKeyItem['status'], error?: string) => void,
  book: Book,
  conversationHistory: { role: 'author' | 'interviewer'; text: string }[],
  activeChapter?: Chapter,
  targetLang: 'ar' | 'en' = 'ar'
): Promise<string> {
  const isAr = targetLang === 'ar' || book.primaryLanguage === 'ar';
  const historyText = conversationHistory
    .map(h => `${h.role === 'author' ? (isAr ? 'المؤلف' : 'Author') : (isAr ? 'المحاور' : 'Interviewer')}: ${h.text}`)
    .join('\n');

  const prompt = isAr
    ? `أنت المحاور الشخصي ومستشار السيرة الذاتية للمؤلف.
كتاب المؤلف: "${book.title}" (${book.genre || 'كتاب شخصي وتأملات'})
موجز الكتاب: ${book.description || 'توثيق الأفكار والرحلة الشخصية'}
${activeChapter ? `الفصل الحالي: "${activeChapter.title}" (${activeChapter.synopsis || ''})` : ''}

سجل الحوار حتى الآن:
"""
${historyText || '(بدء الحوار)'}
"""

المطلوب:
اطرح سؤالاً واحداً عميقاً وملهماً ومحدداً يستخرج من المؤلف قصة شخصية حقيقية، أو قراراً مصيرياً، أو درساً تعلمه، أو شعوراً عميقاً لم يفصح عنه بعد.
كن دافئاً ومحفزاً للبوح الصادق. أعد السؤال مباشرة دون أي مقدمات.`
    : `You are the author's personal biographer and editorial interviewer.
Book: "${book.title}" (${book.genre || 'Personal Book & Reflections'})
Description: ${book.description || 'Personal memoir and life principles'}
${activeChapter ? `Current Chapter: "${activeChapter.title}"` : ''}

Dialogue so far:
"""
${historyText || '(Starting interview)'}
"""

Task:
Ask ONE deep, evocative, specific question that invites the author to reveal a lived story, a pivotal turning point, an honest struggle, or a foundational life lesson.
Be warm, intelligent, and insightful. Return ONLY the question.`;

  const result = await executeWithKeyRotation(keys, updateKeyStatus, {
    prompt,
    systemInstruction: 'You are an acclaimed biographer and interviewer helping authors write their memoirs and personal books.',
    model: 'gemini-3.8-flash',
    temperature: 0.8,
  });

  return result.text.trim();
}

/**
 * Compiles an entire author-AI interview session into a cohesive book chapter
 */
export async function compileInterviewToChapter(
  keys: ApiKeyItem[],
  updateKeyStatus: (keyId: string, status: ApiKeyItem['status'], error?: string) => void,
  book: Book,
  conversationHistory: { role: 'author' | 'interviewer'; text: string }[],
  activeChapter?: Chapter,
  targetLang: 'ar' | 'en' = 'ar'
): Promise<string> {
  const isAr = targetLang === 'ar' || book.primaryLanguage === 'ar';
  const authorStatements = conversationHistory
    .filter(h => h.role === 'author')
    .map(h => h.text)
    .join('\n\n---\n\n');

  const prompt = isAr
    ? `إليك الإجابات والأفكار الشفهية التي أدلى بها المؤلف خلال جلسة الحوار:
"""
${authorStatements}
"""

المطلوب منك ككاتب مشارك ومحرر:
اجمع كل هذه الأفكار والذكريات، وقم بنسجها في فصل أو مقطع كتابي متماسك بأسلوب السيرة الذاتية والتأملات الفلسفية الراقية.
- اكتب بصوت المؤلف المباشر ("أنا").
- اربط بين الأفكار بروابط منطقية وعاطفية سلسة.
- رتّب الفقرات بتسلسل تصاعدي ذي مغزى وعمق.
- أعد النص النهائي الجاهز للوضع في الكتاب مباشرة دون أي تعليقات جانبية.`
    : `Here are the author's answers and spoken insights during an interview session:
"""
${authorStatements}
"""

As their personal co-author:
Synthesize all these answers and anecdotes into a seamless, poignant non-fiction chapter written in the author's first-person voice ("I").
Weave the insights together with natural transitions, vivid pacing, and profound takeaways.
Return ONLY the polished manuscript text ready for the book.`;

  const result = await executeWithKeyRotation(keys, updateKeyStatus, {
    prompt,
    systemInstruction: buildBookContextPrompt(book, activeChapter),
    model: 'gemini-3.8-flash',
    temperature: 0.7,
  });

  return result.text.trim();
}
