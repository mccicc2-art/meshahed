import React, { useCallback, useImperativeHandle, useState } from "react";
import { HoldMenu, type HoldAction, type HoldVariant } from "./library/HoldMenu";
import type { CardAnchor, CardItem } from "./library/PosterCard";
import { Toast } from "./ui";
import { haptic } from "./haptics";

/**
 * ====== مضيفا القائمة والإشعار — D-1028 (Phase 11-F · F4) ======
 *
 * **لماذا**: `held` و`busy` و`toast` كانت حالةً في جذر الشاشتين — فكلُّ ضغطةٍ مطوّلة وكلُّ
 * إشعارٍ يعيد رسمَ الشاشة بألواحها وصفوفها، وما تغيّر فعلاً قائمةٌ طافيةٌ أو سطرُ نصّ.
 * الآن كلٌّ منهما **مكوّنٌ يملك حالتَه ويُركَّب مرّةً خارج `TabSlide`**، والشاشةُ تكلّمه بمرجعٍ
 * أمريّ (`open` · `say`) — فلا يعيد رسمَ نفسه إلّا هو.
 *
 * 🔑 **ليسا نسخةً ثانية**: `HoldMenu` هي نفسُها و`Toast` هو نفسُه (مضيفٌ واحد، D-…) — هذان
 * **غلافان للحالة** لا للشكل. لا مقاسَ ولا لونَ هنا.
 */
export type HoldHostRef<P> = { open: (payload: P, anchor: CardAnchor) => void; close: () => void };

export function HoldHost<P>({
  hostRef,
  variant,
  toItem,
  inListOf,
  onAction,
  onHeld,
}: {
  hostRef: React.Ref<HoldHostRef<P>>;
  variant: HoldVariant;
  /** بطاقةُ القائمة بشكل `CardItem` — تُحسب عند الفتح من حال تلك اللحظة */
  toItem: (payload: P) => CardItem;
  inListOf?: (payload: P) => boolean;
  /** الفعلُ نفسُه بوعده — القائمةُ تُغلق فوراً، و`busy` يحجب فعلاً ثانياً حتّى يعود */
  /** `false` = الكتابةُ فشلت (فلا اهتزازَ نجاح — D-1043)؛ غيرُ ذلك نجاح */
  onAction: (a: HoldAction, payload: P) => Promise<void | boolean> | void | boolean;
  /** من يريد أن يعرف أيُّ بطاقةٍ مضغوطةٌ الآن (الإطارُ الذهبيّ في «اكتشف») */
  onHeld?: (payload: P | null) => void;
}) {
  const [held, setHeld] = useState<{ payload: P; anchor: CardAnchor; item: CardItem; inList: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => {
    setHeld(null);
    onHeld?.(null);
  }, [onHeld]);
  useImperativeHandle(
    hostRef,
    () => ({
      open(payload, anchor) {
        haptic.pick();
        setHeld({ payload, anchor, item: toItem(payload), inList: inListOf ? inListOf(payload) : false });
        onHeld?.(payload);
      },
      close,
    }),
    [toItem, inListOf, onHeld, close],
  );
  if (!held) return null;
  return (
    <HoldMenu
      variant={variant}
      item={held.item}
      anchor={held.anchor}
      busy={busy}
      inList={held.inList}
      onAction={(a) => {
        const { payload } = held;
        close();
        setBusy(true);
        void Promise.resolve(onAction(a, payload))
          .then((r) => {
            /* «مراجعة» بابٌ لا كتابة — لا نجاحَ يُحتفى به */
            if (r !== false && a !== "review") haptic.success();
          })
          .finally(() => setBusy(false));
      }}
      onClose={close}
    />
  );
}

export type ToastAction = { label: string; onPress: () => void };
/** D-1047 — `say(text, action, ms)`: فعلٌ اختياريّ («تراجع») ومدّةٌ له؛ بلا فعلٍ المدّةُ ٣٫٢ث كما كانت */
export type ToastHostRef = { say: (text: string, action?: ToastAction, ms?: number) => void };

/** الإشعارُ الواحد بمؤقّته (٣٫٢ث كما كان) — `say` ثابتةُ المرجع فتمرّ إلى الألواح بلا إعادة رسم */
export function ToastHost({ hostRef, bottom }: { hostRef: React.Ref<ToastHostRef>; bottom: number }) {
  const [toast, setToast] = useState<{ text: string; action?: ToastAction; ms: number } | null>(null);
  useImperativeHandle(hostRef, () => ({ say: (text, action, ms) => setToast({ text, action, ms: ms ?? 3200 }) }), []);
  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.ms);
    return () => clearTimeout(id);
  }, [toast]);
  if (!toast) return null;
  const action = toast.action;
  return (
    <Toast
      text={toast.text}
      bottom={bottom}
      action={action ? { label: action.label, onPress: () => { setToast(null); action.onPress(); } } : undefined}
    />
  );
}
