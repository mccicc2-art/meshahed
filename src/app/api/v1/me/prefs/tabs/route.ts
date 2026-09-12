import { setTabPrefs } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { TabPref } from "@/core/tabPrefs";

/**
 * `POST /api/v1/me/prefs/tabs` — ترتيبُ تبويبات المكتبة وإخفاؤها (D-179/D-819).
 * الجسمُ `{surface, prefs}` كما تمرّره `TabsPrefs`؛ الحارسُ (بلس) في الفعل نفسِه.
 */
export const POST = bodyRoute<{ surface: string; prefs: TabPref[] }, { ok: boolean; needsPlus?: true }>(
  (b) => setTabPrefs(String(b.surface ?? ""), Array.isArray(b.prefs) ? b.prefs : []),
  () => ["me:library"],
);
