"use client";

// حدود الأخطاء يجب أن تكون مكوّن عميل.
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useEffect } from "react";
import { useUiLocale } from "@/lib/useUiLocale";
import { buttonClass } from "@/components/ui/Button";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { t } = useUiLocale();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-md mx-auto text-center py-20">
      <div className="text-5xl mb-4" aria-hidden>
        <Logo size={44} gradientId="error-logo" />
      </div>
      <h1 className="text-xl font-bold">{t.errorTitle}</h1>
      <p className="text-sm text-muted leading-relaxed mt-2">{t.errorBody}</p>

      <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
        <button
          onClick={() => unstable_retry()}
          className={buttonClass()}
        >
          {t.errorRetry}
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-foreground hover:bg-surface-2 transition"
        >
          {t.errorHome}
        </Link>
      </div>

      {error.digest && (
        <p className="text-12 text-muted/70 mt-6" dir="ltr">
          {t.errorCode(error.digest)}
        </p>
      )}
    </div>
  );
}
