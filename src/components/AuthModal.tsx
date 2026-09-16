import React, { useState } from 'react';
import { Lock, User, KeyRound, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AppLanguage } from '../types';
import { login } from '../lib/auth';

interface AuthModalProps {
  language: AppLanguage;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ language, onSuccess }) => {
  const isAr = language === 'ar';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError(isAr ? 'يرجى إدخال بيانات الدخول' : 'Please provide username and password.');
      return;
    }

    setIsSubmitting(true);
    const result = await login(username, password);
    setIsSubmitting(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(
        isAr
          ? 'اسم المستخدم أو كلمة المرور غير صحيحة'
          : result.error || 'Invalid username or password.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-subtle rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="bg-canvas px-6 py-6 border-b border-subtle flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-600/30 flex items-center justify-center text-indigo-600 mb-3 shadow-inner">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-main font-serif">
            {isAr ? 'تسجيل الدخول إلى الاستوديو' : 'Unlock Writing Studio'}
          </h2>
          <p className="text-xs text-sub mt-1 max-w-xs">
            {isAr
              ? 'أدخل اسم المستخدم وكلمة المرور لفتح الاستوديو الخاص بك.'
              : 'Enter your credentials to access your secure manuscripts.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-sub block">
              {isAr ? 'اسم المستخدم' : 'Username'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-sub absolute top-3 left-3 rtl:right-3 rtl:left-auto" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="author"
                className="w-full bg-canvas border border-subtle rounded-xl py-2.5 pl-9 pr-3 rtl:pr-9 rtl:pl-3 text-xs text-main focus:outline-none focus:ring-1 focus:ring-indigo-600"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-sub block">
              {isAr ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-sub absolute top-3 left-3 rtl:right-3 rtl:left-auto" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{isAr ? 'فتح الاستوديو' : 'Unlock Studio'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
