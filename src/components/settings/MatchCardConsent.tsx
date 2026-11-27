"use client";

import { useEffect, useState } from "react";
import { getDict, type Locale } from "@/core/i18n";
import { toast } from "@/lib/toast";
import { settingsCardRows } from "./SettingsGroup";
import { ToggleRow } from "../ui/SectionOrderList";

/**
 * 🆕 T596 — **«اسمح بظهور اسمي في بطاقات التطابق»** (أحمد ٢٧ نوفمبر «س٩ أ»: إعدادٌ واحدٌ في الخصوصيّة، مطفأٌ افتراضيّاً).
 * مطفأٌ ⇒ من يشارك تطابقَ ذوقه معك يُظهرك «صديقاً» بلا اسمٍ ولا صورة. بطاقةٌ بصفٍّ واحد تحت مفاتيح الخصوصيّة الثلاثة —
 * `ToggleRow` نفسُه. **ويغيب قبل الهجرة ٢٧٣** (`ready: false`): مفتاحٌ لا يُحفظ وعدٌ كاذب.
 * النصُّ في السطر لا في القاموس: مفتاحٌ واحدٌ في سطحين، والكلمتان هنا وفي `PrivacyScreen` بحرفهما.
 */
export function MatchCardConsent({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const en = locale === "en";
  const [state, setState] = useState<{ allow: boolean; ready: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/v1/me/settings/match-card", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: { allow: boolean; ready: boolean } } | null) => {
        if (live && j?.data) setState(j.data);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!state?.ready) return null;

  async function flip() {
    if (!state || busy) return;
    const prev = state.allow;
    setState({ ...state, allow: !prev });
    setBusy(true);
    try {
      const r = await fetch("/api/v1/me/settings/match-card", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allow: !prev }),
      });
      if (!r.ok) throw new Error(String(r.status));
    } catch {
      /* الفشلُ يعيد المفتاح: مفتاحُ خصوصيّةٍ يبقى مقلوباً بعد فشلٍ يكذب على صاحبه */
      setState({ ...state, allow: prev });
      toast(t.errSaveShort, { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${settingsCardRows} ${busy ? "opacity-70" : ""}`}>
      <ToggleRow
        icon="sparkles"
        label={en ? "Show my name on taste-match cards" : "اسمح بظهور اسمي في بطاقات التطابق"}
        hint={
          en
            ? "When someone shares how close your tastes are, your name and photo appear. Off: you show as «a friend»."
            : "حين يشارك أحدٌ نسبةَ تطابق ذوقه معك يظهر اسمُك وصورتُك. مطفأ: تظهر «صديقاً» بلا اسم."
        }
        checked={state.allow}
        onChange={() => void flip()}
      />
    </div>
  );
}
