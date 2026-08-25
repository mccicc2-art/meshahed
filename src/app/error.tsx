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

  /* 🔴 🆕 **إعادةُ تحميلٍ كاملةٌ واحدةٌ قبل عرض الشاشة** (D-626، بلاغُ
     أحمد مرّتين في يومٍ واحد: «فيه حسابات يطلع لهم هذا إذا دخلوا على
     البروفايل» ثمّ «ما زالت فيه مشكلة») — **الدليلُ أن الرقمَ نفسَه
     (2321772793) ظهر صباحاً ومساءً عبر نشرتين مختلفتين**، واليومُ
     وحدَه فيه ٣٠+ نشرة: **قشرةُ PWA قديمةٌ من كاش عامل الخدمة تقابل
     خادماً أحدثَ فيفشل خيطُ RSC** — **و«حاول مجدّداً» يعيد الرسمَ
     بالعميل القديم نفسِه فيفشل مثلَه.** العلاجُ الوحيدُ الصادقُ
     إعادةُ تحميلٍ كاملةٌ تجلب حزمَ العميل الجديدة.

     ⚠️ **ومرّةً واحدةً لكلِّ رقمِ خطأٍ في الجلسة** (`sessionStorage`)
     — **فخطأٌ حقيقيٌّ ثابتٌ لا يدخل في دوّامة تحميلٍ أبديّة**: تعود
     الشاشةُ بعد المحاولة الواحدة كما كانت. */
  useEffect(() => {
    try {
      const key = `lz-reload-once-${error.digest ?? "nodigest"}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    } catch {
      /* تخزينٌ محجوبٌ (تصفّحٌ خاصّ) — تبقى الشاشةُ بيدَيها القديمتين */
    }
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
