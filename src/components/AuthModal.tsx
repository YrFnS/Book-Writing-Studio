import React, { useState } from 'react';
import { Lock, User, KeyRound, ShieldCheck, Check, Eye, EyeOff } from 'lucide-react';
import { AppLanguage } from '../types';
import { useI18n } from '../lib/i18n';
import { getStoredAuth, saveAuth, verifyCredentials } from '../lib/auth';

interface AuthModalProps {
  language: AppLanguage;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ language, onSuccess }) => {
  const t = useI18n(language);
  const storedAuth = getStoredAuth();
  const [isSetupMode, setIsSetupMode] = useState(!storedAuth.isConfigured);

  const [username, setUsername] = useState(storedAuth.isConfigured ? '' : 'author');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSetupMode) {
      if (!username.trim() || !password) {
        setError(language === 'ar' ? 'يرجى إدخال اسم المستخدم وكلمة المرور' : 'Please enter both username and password.');
        return;
      }
      if (password.length < 4) {
        setError(language === 'ar' ? 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' : 'Password must be at least 4 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError(language === 'ar' ? 'كلمات المرور غير متطابقة' : 'Passwords do not match.');
        return;
      }
      saveAuth(username, password);
      onSuccess();
    } else {
      if (!username.trim() || !password) {
        setError(language === 'ar' ? 'يرجى إدخال بيانات الدخول' : 'Please provide username and password.');
        return;
      }
      const valid = verifyCredentials(username, password);
      if (valid) {
        onSuccess();
      } else {
        setError(language === 'ar' ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'Invalid username or password.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-subtle rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header banner */}
        <div className="bg-canvas px-6 py-6 border-b border-subtle flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-600/30 flex items-center justify-center text-indigo-600 mb-3 shadow-inner">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-main font-serif">
            {isSetupMode
              ? (language === 'ar' ? 'إعداد حساب استوديو الكتابة الآمن' : 'Set Up Secure Writing Studio')
              : (language === 'ar' ? 'تسجيل الدخول إلى الاستوديو' : 'Unlock Writing Studio')}
          </h2>
          <p className="text-xs text-sub mt-1 max-w-xs">
            {isSetupMode
              ? (language === 'ar' ? 'قم بتعيين اسم مستخدم وكلمة مرور لحماية أعمالك الأدبية من الوصول غير المصرح به.' : 'Choose a secure username and master password to protect your literary work.')
              : (language === 'ar' ? 'أدخل اسم المستخدم وكلمة المرور لفتح الاستوديو الخاص بك.' : 'Enter your credentials to access your secure manuscripts.')}
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-sub block">
              {language === 'ar' ? 'اسم المستخدم' : 'Username'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-sub absolute top-3 left-3 rtl:right-3 rtl:left-auto" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="author"
                className="w-full bg-canvas border border-subtle rounded-xl py-2.5 pl-9 pr-3 rtl:pr-9 rtl:pl-3 text-xs text-main focus:outline-none focus:ring-1 focus:ring-indigo-600"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-sub block">
              {language === 'ar' ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-sub absolute top-3 left-3 rtl:right-3 rtl:left-auto" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-canvas border border-subtle rounded-xl py-2.5 pl-9 pr-10 rtl:pr-9 rtl:pl-10 text-xs text-main focus:outline-none focus:ring-1 focus:ring-indigo-600"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-2.5 right-3 rtl:left-3 rtl:right-auto text-sub hover:text-main p-0.5"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isSetupMode && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-sub block">
                {language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
              </label>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-sub absolute top-3 left-3 rtl:right-3 rtl:left-auto" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-canvas border border-subtle rounded-xl py-2.5 pl-9 pr-3 rtl:pr-9 rtl:pl-3 text-xs text-main focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>
                {isSetupMode
                  ? (language === 'ar' ? 'إنشاء حساب الاستوديو' : 'Create Secure Studio Account')
                  : (language === 'ar' ? 'فتح الاستوديو' : 'Unlock Studio')}
              </span>
            </button>
          </div>

          {storedAuth.isConfigured && !isSetupMode && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsSetupMode(true)}
                className="text-[11px] text-sub hover:text-indigo-700 underline"
              >
                {language === 'ar' ? 'إعادة ضبط بيانات الاعتماد؟' : 'Reset credentials?'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
