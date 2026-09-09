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

declare global {
  interface Window {
    /** 🆕 يحقنه الغلافُ (≥ 1.4.1) قبل تحميل المستند: ما يستطيع فتحَه أصليّاً */
    LoopzNative?: { library?: boolean };
  }
}

/**
 * هل التجربةُ مفعّلةٌ على هذا المستند **وداخل غلافٍ يعرف الشاشة**؟ — سؤالُ لحظة الضغط.
 *
 * 🔴 **الدرسُ (٩ سبتمبر، بلاغُ أحمد: «لا أستطيع الدخول إلى المكتبة من التطبيق»)**:
 * الويبُ كان يبتلع الضغطةَ (`preventDefault`) لكلِّ غلافٍ يحمل وسم `LoopzApp/`،
 * **والغلافُ المثبَّت كان 1.2.3 الذي لا يعرف رسالةَ `native`** — فلا صفحةَ ولا
 * شاشة. **الجسرُ وحدَه لا يثبت القدرة**؛ الغلافُ الذي يعرف الشاشةَ يحقن
 * `window.LoopzNative.library` قبل المستند، **ومن لا يحقنها يبقى الرابطُ رابطاً.**
 */
export function nativeLibraryOn(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.hasAttribute(NATIVE_LIBRARY_ATTR) &&
    !!window.ReactNativeWebView &&
    window.LoopzNative?.library === true
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
