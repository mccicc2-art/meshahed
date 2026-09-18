import { createContext, useContext, useSyncExternalStore } from "react";

/**
 * ====== حالةُ البطاقة الواحدة خارج شجرة الشاشة — D-1028 (Phase 11-F · F4) ======
 *
 * **لماذا**: `held` و`overrides` كانا `useState` في جذر `DiscoverScreen`، ويهبطان خاصّيّتين
 * (`heldKey` · `marks`) عبر اللوح إلى كلِّ `CardsRail` — فضغطةٌ مطوّلةٌ واحدة تعيد رسمَ الجذر
 * فاللوح فكلِّ صفٍّ، و`extraData` يجعل كلَّ `FlatList` يعيد المرورَ على بطاقاته. والمتغيّرُ
 * في الحقيقة **بطاقةٌ واحدة**.
 *
 * 🔑 **مخزنٌ تشترك فيه البطاقاتُ بمفتاحها**: كلُّ بطاقةٍ تسأل عن إطارها وخيطها هي
 * (`useSyncExternalStore` يقارن اللقطة) — فما تغيّر لبطاقةٍ يعيد رسمَها وحدَها. والمخزنُ يصل
 * بالسياق **وقيمتُه ثابتةُ المرجع** فلا يعيد السياقُ رسمَ أحد.
 *
 * 🔑 **الطبقتان كما كانتا**: `base` من كاش `me:library`، و`overrides` التفاؤليّةُ فوقها
 * (`null` = «أُزيل للتوّ»). و`setBase` تُبقي كائنَ العلامة القديمَ حين لا تتغيّر قيمُه — وإلّا
 * أعاد كلُّ جلبٍ للمكتبة رسمَ كلِّ بطاقةٍ بلا فرق.
 */
export type CardMark = { saved: boolean; progress: number; completed: boolean; dropped: boolean } | null;

export type CardStore = {
  subscribe: (fn: () => void) => () => void;
  mark: (key: string) => CardMark;
  override: (key: string) => CardMark | undefined;
  setBase: (next: Map<string, CardMark>) => void;
  /** `undefined` يرفع الطبقةَ التفاؤليّة عن المفتاح (تراجع) */
  setOverride: (key: string, v: CardMark | undefined) => void;
  held: () => string | null;
  setHeld: (key: string | null) => void;
};

const same = (a: CardMark, b: CardMark) =>
  a === b || (!!a && !!b && a.saved === b.saved && a.progress === b.progress && a.completed === b.completed && a.dropped === b.dropped);

export function createCardStore(): CardStore {
  let base = new Map<string, CardMark>();
  const overrides = new Map<string, CardMark>();
  let held: string | null = null;
  const subs = new Set<() => void>();
  const tell = () => subs.forEach((fn) => fn());
  return {
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    mark: (key) => (overrides.has(key) ? (overrides.get(key) ?? null) : (base.get(key) ?? null)),
    override: (key) => (overrides.has(key) ? (overrides.get(key) ?? null) : undefined),
    setBase(next) {
      const kept = new Map<string, CardMark>();
      for (const [k, v] of next) {
        const old = base.get(k) ?? null;
        kept.set(k, base.has(k) && same(old, v) ? old : v);
      }
      base = kept;
      tell();
    },
    setOverride(key, v) {
      if (v === undefined) overrides.delete(key);
      else overrides.set(key, v);
      tell();
    },
    held: () => held,
    setHeld(key) {
      if (held === key) return;
      held = key;
      tell();
    },
  };
}

/** `null` = لا مخزنَ فوق هذه البطاقة (صفحةُ الشخص مثلاً) — فتقرأ خاصّيّاتِها كما كانت */
export const CardStoreContext = createContext<CardStore | null>(null);

const noSub = () => () => {};

export function useCardState(key: string): { store: boolean; mark: CardMark; held: boolean } {
  const s = useContext(CardStoreContext);
  const mark = useSyncExternalStore(s ? s.subscribe : noSub, () => (s ? s.mark(key) : null));
  const held = useSyncExternalStore(s ? s.subscribe : noSub, () => (s ? s.held() === key : false));
  return { store: !!s, mark, held };
}
