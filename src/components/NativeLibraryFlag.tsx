"use client";

import { useEffect } from "react";

/** اسمُ العلَم على `<html>` — يقرؤه زرُّ «المكتبة» في `BottomNav` لحظةَ الضغط */
export const NATIVE_LIBRARY_ATTR = "data-native-library";

/**
 * 🆕 **علَمُ التجربة على المستند** (Phase 11 · B1): يُركَّب من `NativeLibraryGate`
 * للإدارة داخل الغلاف فقط. **لا يرسم شيئاً ولا يحمل منطقاً** — يضع سمةً
 * على `<html>` **فيبقى `BottomNav` كما هو** (لا خاصيّةَ جديدة تمرّ من التخطيط
 * عبر الشريط لأجل تجربةٍ قد تُحذف في B6-ج).
 *
 * 🔑 **ولماذا سمةٌ لا متغيّرُ نافذة؟** لأنّ السمةَ تُقرأ من أيِّ مكوّنٍ بلا
 * استيرادٍ ولا حالةٍ مشتركة، **وتزول بزوال المكوّن** (التنظيف أدناه) — فإذا
 * سُحبت الإدارةُ زال الزرُّ بلا إعادة تحميل.
 */
export function NativeLibraryFlag() {
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute(NATIVE_LIBRARY_ATTR, "1");
    return () => el.removeAttribute(NATIVE_LIBRARY_ATTR);
  }, []);
  return null;
}

/** هل التجربةُ مفعّلةٌ على هذا المستند وداخل الغلاف؟ — سؤالُ لحظة الضغط */
export function nativeLibraryOn(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.hasAttribute(NATIVE_LIBRARY_ATTR) &&
    !!window.ReactNativeWebView
  );
}

/** يطلب من الغلاف فتحَ الشاشة الأصليّة — `true` إن أُرسل الطلب */
export function openNativeLibrary(): boolean {
  if (!nativeLibraryOn()) return false;
  try {
    window.ReactNativeWebView!.postMessage(JSON.stringify({ type: "native", route: "library" }));
    return true;
  } catch {
    return false;
  }
}
