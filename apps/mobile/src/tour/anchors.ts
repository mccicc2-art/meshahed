import { useEffect, useRef } from "react";
import { Dimensions, type View } from "react-native";
import type { TourAnchor } from "@/core/tour";

/**
 * ====== مراسي الجولة — الزرُّ الذي تحيطه الحلقة (🆕 D-1318 · T1) ======
 *
 * 🔑 **الشاشةُ تسجّل زرَّها، والمضيفُ يقيسه** (`measureInWindow`) — لا إحداثيّاتٍ مكتوبةً بيد: مكانُ زرّ الفلتر
 * يتبع عرضَ الشاشة وحجمَ الخطّ والاتّجاه، ورقمٌ ثابتٌ يصدق على هاتفٍ واحد.
 *
 * ⚠️ **ولا حلقةَ في غير مكانها**: زرٌّ لم يُسجَّل، أو خارجَ الشاشة (رأسٌ اختفى مع التمرير)، أو بلا مساحة ⇒ `null`
 * والبطاقةُ وحدَها. حلقةٌ على فراغٍ أسوأُ من لا حلقة.
 *
 * `reveal` اختياريّ: الشاشةُ تعرف كيف تُظهر زرَّها (الرئيسيّةُ تصعد للقمّة، «اكتشف» يعيد رأسَه) — يُنادى قبل القياس.
 */
export type AnchorRect = { x: number; y: number; w: number; h: number };

type Entry = { node: () => View | null; reveal: () => void };
const anchors = new Map<TourAnchor, Entry>();

export function useTourAnchor(id: TourAnchor, reveal?: () => void) {
  const ref = useRef<View>(null);
  const rv = useRef(reveal);
  rv.current = reveal;
  useEffect(() => {
    const entry: Entry = { node: () => ref.current, reveal: () => rv.current?.() };
    anchors.set(id, entry);
    return () => {
      if (anchors.get(id) === entry) anchors.delete(id);
    };
  }, [id]);
  return ref;
}

export function revealAnchor(id: TourAnchor) {
  anchors.get(id)?.reveal();
}

export function measureAnchor(id: TourAnchor): Promise<AnchorRect | null> {
  const node = anchors.get(id)?.node();
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => {
    /* مهلةٌ: نداءُ القياس لا يعود أبداً إن نُزعت العقدةُ بين الطلب والجواب */
    const timer = setTimeout(() => resolve(null), 500);
    node.measureInWindow((x, y, w, h) => {
      clearTimeout(timer);
      /* `screen` لا `window`: حدٌّ أعلى متسامح — المطلوبُ إسقاطُ ما خرج من الشاشة، لا مطابقةُ أشرطة النظام */
      const win = Dimensions.get("screen");
      const ok = w > 0 && h > 0 && x >= 0 && y >= 0 && x + w <= win.width + 1 && y + h <= win.height + 1;
      resolve(ok ? { x, y, w, h } : null);
    });
  });
}
