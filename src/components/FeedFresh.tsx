"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { getDict, type Locale } from "@/core/i18n";

/**
 * ====== 🆕 R255 — فاصلُ «↑ N منشورات جديدة» في خطّ «النشاط» على الويب — توأمُ `FreshMark` في التطبيق (D-1613b) ======
 *
 * أحمد ١ نوفمبر عن التطبيق: «ابغاه يفتح صفحة النشاط … و أنا بنفسي اطلع اشوف المنشورات الجديدة». الويبُ كان بلا ذاكرة: كلُّ
 * فتحةٍ خطٌّ بلا علامة، فلا يعرف عضوُ الحاسوب أين توقّف. هنا **أعلى عشرة مفاتيح رآها** تُحفظ في المتصفّح لكلِّ شريحة
 * (`strangers|sort`)، وفي الزيارة التالية يقع الفاصلُ فوق أوّل ما رآه — والعددُ ما فوقه من منشورات غيره.
 *
 * والقواعدُ قواعدُ التطبيق حرفاً: **في «الأحدث» وحدَه** (D-1623 — «الأكثر تفاعلاً» يرتّب بالإعجاب فالجديدُ قد يقع تحت ما رآه)؛
 * **ومنشوري لا يُعدّ**؛ **وأكثرُ من خمسين — أو لا شيءَ ممّا رآه في الصفحة الأولى — بلا فاصل**. والمفاتيحُ مفاتيحُ التطبيق
 * (`c-…`/`t-…`/`n-…`)، لكنّ الذاكرتين منفصلتان: الجوّالُ في مخزنه الآمن والمتصفّحُ في `localStorage`.
 *
 * ⚠️ **لماذا جزيرتان لا واحدة**: الخطُّ يُرسم على الخادم، والفاصلُ يعرف مكانه من ذاكرة المتصفّح وحدها. `FeedFreshSeen` يحسب مرّةً
 * لكلِّ تركيب، و`FeedFreshMark` بجانب كلِّ صفٍّ يقرأ النتيجةَ من مخزنٍ صغيرٍ ويرسم نفسه إن كان صفُّه هو الموضع — بلا لمسٍ للـDOM.
 * والفشلُ صمت: بلا ذاكرةٍ يفتح الخطُّ كما كان.
 */
const KEY = "loopz.feedSeen";
const KEEP = 10;
const FRESH_OPEN_MAX = 50;

type Mark = { key: string; count: number } | null;
let mark: Mark = null;
const subs = new Set<() => void>();
const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => subs.delete(fn);
};
const setMark = (m: Mark) => {
  mark = m;
  subs.forEach((fn) => fn());
};

function readSeen(slice: string): string[] {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    const keys = p?.[slice];
    return Array.isArray(keys) ? keys.filter((k): k is string => typeof k === "string").slice(0, KEEP) : [];
  } catch {
    return [];
  }
}

function writeSeen(slice: string, keys: string[]) {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    localStorage.setItem(KEY, JSON.stringify({ ...(p && typeof p === "object" ? p : {}), [slice]: keys.slice(0, KEEP) }));
  } catch {
    /* راحةٌ لا شرط */
  }
}

/** يحسب موضعَ الفاصل من لقطة ما رآه قبل هذه الزيارة، ثمّ يحفظ أعلى ما في الخطّ للزيارة التالية */
export function FeedFreshSeen({ rows, slice }: { rows: { key: string; mine: boolean }[]; slice: string }) {
  /* اللقطةُ تُقرأ مرّةً لكلِّ شريحة: تجديدُ الخطّ (منشورٌ جديد · `router.refresh`) يعيد الحسابَ منها لا ممّا حُفظ للتوّ —
     فجديدٌ يصل بعد جديدٍ يقع فوق الفاصل ويزيد عددَه (التطبيق D-1613c)، ومنشوري لا يُعدّ */
  const before = useRef<{ slice: string; keys: string[] } | null>(null);
  useEffect(() => {
    if (before.current?.slice !== slice) before.current = { slice, keys: readSeen(slice) };
    const saved = before.current.keys;
    const at = saved.length ? rows.findIndex((r) => saved.includes(r.key)) : -1;
    const count = at > 0 ? rows.slice(0, at).filter((r) => !r.mine).length : 0;
    setMark(at > 0 && count > 0 && count <= FRESH_OPEN_MAX ? { key: rows[at].key, count } : null);
    writeSeen(slice, rows.map((r) => r.key));
    return () => setMark(null);
  }, [rows, slice]);
  return null;
}

/** الفاصلُ نفسُه — يُرسم فوق صفّه إن كان صفُّه أوّلَ ما رآه */
export function FeedFreshMark({ at, locale }: { at: string; locale: Locale }) {
  const m = useSyncExternalStore(subscribe, () => mark, () => null);
  if (!m || m.key !== at) return null;
  const t = getDict(locale);
  return (
    <div role="separator" aria-label={t.feedNewPosts(m.count)} className="!border-b-0 flex items-center gap-2.5 py-3">
      <span className="h-px flex-1 bg-[color:var(--accent)]/50" />
      <span className="shrink-0 text-12 font-bold text-accent">↑ {t.feedNewPosts(m.count)}</span>
      <span className="h-px flex-1 bg-[color:var(--accent)]/50" />
    </div>
  );
}
