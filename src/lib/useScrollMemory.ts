"use client";

import { useEffect } from "react";

/**
 * ذاكرة موضع التمرير (حزمة «ذاكرة التنقل» — تدقيق 8 Aug، م٢).
 *
 * لماذا لا يُترك الأمر للمتصفح؟ لأن الصفحات تُبثّ (Suspense): الاستعادة
 * الأصلية تجري قبل اكتمال ارتفاع الصفحة فتفشل بصمت، والعائد من عملٍ
 * فتحه يجد نفسه في قمّة الصفحة (شكوى أحمد نصاً). وكاش الراوتر (D-088)
 * يغطي العودة السريعة وحدها — بعد ٣٠ ثانية تعود الصفحة من الخادم.
 *
 * الحفظ عند كل تمرير (مخنوقاً بإطار الرسم) بمفتاح المسار+البحث في
 * sessionStorage — ذاكرة تبويبٍ واحد تموت بموته. والاستعادة عند
 * **العودة وحدها**: زيارةٌ جديدة تبدأ من القمة كما يجب. علمَ العودة
 * يضعه مستمعُ popstate على مستوى الوحدة — يعيش بعد unmount لأن
 * popstate يسبق إعادة تركيب صفحة الوجهة.
 */

const FLAG = "loopz:scroll:back";
const keyOf = () => `loopz:scroll:${location.pathname}${location.search}`;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    try {
      sessionStorage.setItem(FLAG, "1");
    } catch {
      /* تصفح خاص/ذاكرة ممتلئة — الميزة تتعطل بصمت لا الصفحة */
    }
  });
}

/** يحاول الوصول للموضع المحفوظ حتى يثبت أو تنقضي ثانيتان (البثّ) */
function restore(): () => void {
  let y = NaN;
  try {
    y = parseInt(sessionStorage.getItem(keyOf()) ?? "", 10);
  } catch {
    /* تجاهل */
  }
  if (!Number.isFinite(y) || y <= 0) return () => {};
  let tries = 0;
  const t = window.setInterval(() => {
    window.scrollTo(0, y);
    if (Math.abs(window.scrollY - y) < 2 || ++tries >= 20) window.clearInterval(t);
  }, 100);
  return () => window.clearInterval(t);
}

export function useScrollMemory() {
  useEffect(() => {
    let cancel: () => void = () => {};
    try {
      if (sessionStorage.getItem(FLAG) === "1") {
        sessionStorage.removeItem(FLAG);
        cancel = restore();
      }
    } catch {
      /* تجاهل */
    }

    let raf = 0;
    const save = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(keyOf(), String(Math.round(window.scrollY)));
        } catch {
          /* تجاهل */
        }
      });
    };
    /* عودةٌ والصفحة نفسها مركّبة (تبويب ← تبويب): استهلك العلم الذي
       وضعته الوحدة للتوّ، واستعد موضع الرابط الجديد بعد أن يحدّثه
       المتصفح — مهلة قصيرة تكفي لتبدّل location */
    const onPop = () => {
      try {
        sessionStorage.removeItem(FLAG);
      } catch {
        /* تجاهل */
      }
      cancel();
      setTimeout(() => {
        cancel = restore();
      }, 60);
    };
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("scroll", save);
      window.removeEventListener("popstate", onPop);
      cancelAnimationFrame(raf);
      cancel();
    };
  }, []);
}
