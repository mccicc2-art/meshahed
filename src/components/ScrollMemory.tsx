"use client";

import { useScrollMemory } from "@/lib/useScrollMemory";

/**
 * مُركّب ذاكرة التمرير — سطرٌ واحد في أي صفحة «قائمة» يعود إليها الناس
 * (اكتشف، المكتبة، الأصدقاء). لا يرسم شيئاً؛ التفصيل في useScrollMemory.
 * (حزمة «ذاكرة التنقل» — تدقيق 8 Aug، م٢.)
 */
export function ScrollMemory() {
  useScrollMemory();
  return null;
}
