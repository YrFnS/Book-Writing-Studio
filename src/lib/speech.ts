// Web Speech API Voice Recognition & Synthesis Utility

export interface SpeechRecognitionHandlers {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createSpeechRecognizer(
  language: string,
  handlers: SpeechRecognitionHandlers
) {
  if (!isSpeechRecognitionSupported()) {
    handlers.onError('Speech recognition is not supported in this browser.');
    return null;
  }

  const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechClass();

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = language || 'ar-SA';

  recognition.onresult = (event: any) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }

    handlers.onResult(final || interim, Boolean(final));
  };

  recognition.onerror = (event: any) => {
    handlers.onError(event.error || 'Speech recognition error');
  };

  recognition.onend = () => {
    handlers.onEnd();
  };

  return recognition;
}

// Text-to-Speech Proofreading Player
export interface TTSPlayer {
  play: (text: string, lang?: string, rate?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  isPlaying: boolean;
  isPaused: boolean;
}

let activeUtterance: SpeechSynthesisUtterance | null = null;

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    activeUtterance = null;
  }
}

export function pauseSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.pause();
  }
}

export function resumeSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.resume();
  }
}

export function speakText(
  text: string,
  options: {
    lang?: string;
    rate?: number;
    pitch?: number;
    onEnd?: () => void;
    onError?: (err: any) => void;
  } = {}
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported');
    return;
  }

  window.speechSynthesis.cancel();

  if (!text.trim()) return;

  const utterance = new SpeechSynthesisUtterance(text);
  const lang = options.lang || (isArabicText(text) ? 'ar' : 'en-US');
  utterance.lang = lang;
  utterance.rate = options.rate || 1.0;
  utterance.pitch = options.pitch || 1.0;

  // Attempt to select an appropriate voice
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(v => v.lang.startsWith(lang)) || voices.find(v => v.lang.startsWith(lang.slice(0, 2)));
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  utterance.onend = () => {
    activeUtterance = null;
    options.onEnd?.();
  };

  utterance.onerror = (e) => {
    activeUtterance = null;
    options.onError?.(e);
  };

  activeUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function isArabicText(text: string): boolean {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  return arabicRegex.test(text);
}

export function calculateTextStats(text: string) {
  if (!text) {
    return {
      words: 0,
      characters: 0,
      arabicChars: 0,
      englishChars: 0,
      arabicPercentage: 0,
      readingTimeMinutes: 0,
    };
  }

  // Count words across English and Arabic
  const words = (text.trim().match(/[\p{L}\p{N}'-]+/gu) || []).length;
  const characters = text.length;

  let arabicCount = 0;
  let englishCount = 0;

  for (const char of text) {
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(char)) {
      arabicCount++;
    } else if (/[a-zA-Z]/.test(char)) {
      englishCount++;
    }
  }

  const totalLetters = arabicCount + englishCount || 1;
  const arabicPercentage = Math.round((arabicCount / totalLetters) * 100);

  // Average reading speed: 200 words per minute
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

  return {
    words,
    characters,
    arabicChars: arabicCount,
    englishChars: englishCount,
    arabicPercentage,
    readingTimeMinutes,
  };
}
