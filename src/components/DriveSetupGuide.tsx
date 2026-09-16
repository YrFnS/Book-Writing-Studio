import React, { useState } from 'react';
import { Check, Copy, ExternalLink, KeyRound, Loader2 } from 'lucide-react';
import { AppLanguage } from '../types';
import { getRequiredOrigin, isLikelyClientId } from '../lib/googleDrive';

interface Step {
  title: string;
  body: string;
  link?: { label: string; url: string };
  /** Value the user copies out of the app and pastes into the Google console. */
  copyValue?: string;
}

interface DriveSetupGuideProps {
  language: AppLanguage;
  clientId: string;
  onChangeClientId: (value: string) => void;
  onConnect: () => void;
  isConnecting: boolean;
}

const CopyButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked in some browsers; the value stays selectable.
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-canvas border border-subtle">
      <code className="flex-1 text-[11px] text-main font-mono break-all select-all">{value}</code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={label}
        className="shrink-0 p-1.5 rounded-md text-sub hover:text-indigo-600 hover:bg-surface transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};

export const DriveSetupGuide: React.FC<DriveSetupGuideProps> = ({
  language,
  clientId,
  onChangeClientId,
  onConnect,
  isConnecting,
}) => {
  const isAr = language === 'ar';
  const origin = getRequiredOrigin();
  const looksValid = isLikelyClientId(clientId);

  const stepsAr: Step[] = [
    {
      title: 'أنشئ مشروعاً في Google Cloud',
      body: 'سجل الدخول بحساب Google الخاص بك، اكتب أي اسم للمشروع مثل Writing Studio، ثم اضغط Create. هذه الخطوة مجانية ولا تحتاج بطاقة بنكية.',
      link: { label: 'فتح صفحة إنشاء المشروع', url: 'https://console.cloud.google.com/projectcreate' },
    },
    {
      title: 'فعل خدمة Google Drive',
      body: 'تأكد أن المشروع الجديد مختار في الأعلى، ثم اضغط زر Enable.',
      link: { label: 'فتح صفحة تفعيل Drive API', url: 'https://console.cloud.google.com/apis/library/drive.googleapis.com' },
    },
    {
      title: 'اكتب بيانات التطبيق',
      body: 'في خانة App name اكتب Writing Studio، وفي خانتي البريد الإلكتروني اختر بريدك، ثم احفظ. بعدها افتح تبويب Audience واضغط Publish app حتى لا تظهر لك رسالة تحذير عند تسجيل الدخول.',
      link: { label: 'فتح صفحة بيانات التطبيق', url: 'https://console.cloud.google.com/auth/branding' },
    },
    {
      title: 'أنشئ المفتاح واسمح لهذا الموقع',
      body: 'اضغط Create client، اختر Web application من قائمة Application type، ثم انزل إلى Authorized JavaScript origins واضغط ADD URI والصق العنوان التالي بالضبط، ثم اضغط Create.',
      link: { label: 'فتح صفحة إنشاء المفتاح', url: 'https://console.cloud.google.com/auth/clients/create' },
      copyValue: origin,
    },
    {
      title: 'انسخ رقم العميل والصقه هنا',
      body: 'ستظهر لك نافذة فيها Client ID ينتهي بـ apps.googleusercontent.com. انسخه والصقه في الخانة أسفل هذه الخطوات. تحتاج لعمل هذه الخطوات مرة واحدة فقط.',
    },
  ];

  const stepsEn: Step[] = [
    {
      title: 'Create a Google Cloud project',
      body: 'Sign in with your own Google account, give the project any name such as Writing Studio, then click Create. This is free and needs no credit card.',
      link: { label: 'Open the project creation page', url: 'https://console.cloud.google.com/projectcreate' },
    },
    {
      title: 'Turn on Google Drive',
      body: 'Make sure your new project is selected at the top, then click the Enable button.',
      link: { label: 'Open the Drive API page', url: 'https://console.cloud.google.com/apis/library/drive.googleapis.com' },
    },
    {
      title: 'Fill in your app details',
      body: 'Put Writing Studio as the App name, pick your own email for both email fields, and save. Then open the Audience tab and click Publish app so you do not get a warning screen when signing in.',
      link: { label: 'Open the app details page', url: 'https://console.cloud.google.com/auth/branding' },
    },
    {
      title: 'Create the key and allow this site',
      body: 'Click Create client, choose Web application as the Application type, scroll down to Authorized JavaScript origins, click ADD URI, paste the address below exactly, then click Create.',
      link: { label: 'Open the create key page', url: 'https://console.cloud.google.com/auth/clients/create' },
      copyValue: origin,
    },
    {
      title: 'Copy your Client ID and paste it here',
      body: 'A box appears with a Client ID ending in apps.googleusercontent.com. Copy it and paste it into the field below. You only ever do these steps once.',
    },
  ];

  const steps = isAr ? stepsAr : stepsEn;

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-surface border border-subtle space-y-1.5">
        <p className="text-xs font-semibold text-main">
          {isAr ? 'اربط Google Drive الخاص بك' : 'Connect your own Google Drive'}
        </p>
        <p className="text-[11px] text-sub leading-relaxed">
          {isAr
            ? 'كتبك تحفظ في حسابك أنت، داخل مجلد اسمه InkWeaver Studio. التطبيق يطلب صلاحية الملفات التي ينشئها فقط (drive.file)، فلا يستطيع رؤية أي ملف آخر في Drive الخاص بك.'
            : 'Your books are saved to your own account, in a folder called InkWeaver Studio. The app asks only for the drive.file permission, so it can never see any of your other Drive files.'}
        </p>
        <p className="text-[11px] text-sub leading-relaxed">
          {isAr
            ? 'تحتاج مرة واحدة فقط إلى إنشاء رقم عميل مجاني من Google. اتبع الخطوات بالترتيب:'
            : 'One time only, you need a free Client ID from Google. Follow these steps in order:'}
        </p>
      </div>

      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step.title} className="p-4 rounded-xl bg-surface border border-subtle">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600/10 border border-indigo-600/30 text-indigo-600 text-[11px] font-bold flex items-center justify-center">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-xs font-semibold text-main">{step.title}</p>
                <p className="text-[11px] text-sub leading-relaxed">{step.body}</p>
                {step.link && (
                  <a
                    href={step.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>{step.link.label}</span>
                  </a>
                )}
                {step.copyValue && (
                  <CopyButton value={step.copyValue} label={isAr ? 'نسخ العنوان' : 'Copy address'} />
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="p-4 rounded-xl bg-surface border border-subtle space-y-3">
        <label className="text-xs font-semibold text-main block">
          {isAr ? 'رقم العميل (Client ID)' : 'Your Client ID'}
        </label>
        <div className="relative">
          <KeyRound className="w-4 h-4 text-sub absolute top-3 left-3 rtl:right-3 rtl:left-auto" />
          <input
            type="text"
            value={clientId}
            onChange={(e) => onChangeClientId(e.target.value.trim())}
            dir="ltr"
            spellCheck={false}
            placeholder="123456789-abcdef.apps.googleusercontent.com"
            className="w-full bg-canvas border border-subtle rounded-xl py-2.5 pl-9 pr-3 rtl:pr-9 rtl:pl-3 text-[11px] font-mono text-main focus:outline-none focus:ring-1 focus:ring-indigo-600"
          />
        </div>

        {clientId && !looksValid && (
          <p className="text-[11px] text-amber-600 font-medium">
            {isAr
              ? 'الرقم يجب أن ينتهي بـ apps.googleusercontent.com — تأكد أنك نسخت Client ID وليس Client secret.'
              : 'It should end in apps.googleusercontent.com — check you copied the Client ID and not the Client secret.'}
          </p>
        )}

        <button
          type="button"
          onClick={onConnect}
          disabled={isConnecting || !looksValid}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        >
          {isConnecting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>
            {isConnecting
              ? (isAr ? 'جارٍ الاتصال...' : 'Connecting...')
              : (isAr ? 'تسجيل الدخول وربط Google Drive' : 'Sign in with Google & Connect Drive')}
          </span>
        </button>
      </div>
    </div>
  );
};
