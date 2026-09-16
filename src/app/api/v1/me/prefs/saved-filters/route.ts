import { getProfile } from "@/lib/data";
import { updateUiState } from "@/lib/actions";
import { sanitizeUiState } from "@/lib/uiState";
import { bodyRoute } from "@/lib/v1body";
import { newFilterId, removeFilter, sanitizeFilterName, sanitizeQuery, upsertFilter } from "@/core/savedFilters";
import type { SavedFilterBody, SavedFilterResult } from "@/core/contracts/discover";

/**
 * `POST /api/v1/me/prefs/saved-filters` — «احفظ الفلتر» أصليّاً (D-993، Phase 11-C4).
 *
 * الويبُ يبني القائمةَ في العميل (`SavedFiltersRow`) ثمّ يرسلها كاملةً إلى `updateUiState`؛
 * التطبيقُ لا يحمل القائمةَ، **فالخادمُ يقرؤها ويُدرج فيها** بالدوالّ نفسِها (`upsertFilter` ·
 * `removeFilter` · `sanitizeQuery` · `sanitizeFilterName`) ويكتبها بالفعل نفسِه — فيبقى
 * `needsPlus` وحارسُ بلس حيث كانا.
 */
export const POST = bodyRoute<SavedFilterBody, SavedFilterResult>(
  async (b) => {
    const profile = await getProfile().catch(() => null);
    const list = sanitizeUiState(profile?.ui_state).filters;
    let next = list;
    if (b.remove) {
      /* الحذفُ بالاستعلام والقسم (التطبيقُ لا يرى المعرّف) — وبالمعرّف إن مرّ */
      const rq = sanitizeQuery(String(b.remove));
      const byId = list.find((f) => f.id === String(b.remove));
      next = byId ? removeFilter(list, byId.id) : list.filter((f) => !(f.q === rq && (!b.section || f.section === b.section)));
    } else {
      const name = sanitizeFilterName(String(b.name ?? ""));
      const q = sanitizeQuery(String(b.q ?? ""));
      const section = b.section === "movies" || b.section === "shows" || b.section === "anime" ? b.section : null;
      if (!name || !q || !section) return { ok: false, filters: list.map((f) => ({ id: f.id, name: f.name, section: f.section, q: f.q })) };
      next = upsertFilter(list, { id: newFilterId(), name, section, q });
    }
    const r = await updateUiState({ filters: next });
    const kept = r.ok ? next : list;
    return { ok: r.ok, needsPlus: r.needsPlus, filters: kept.map((f) => ({ id: f.id, name: f.name, section: f.section, q: f.q })) };
  },
  () => ["me:library", "news"],
);
