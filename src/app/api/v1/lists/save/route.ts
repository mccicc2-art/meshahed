import { saveList, setSavedListPlaylist } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { SaveListBody } from "@/core/contracts/library";

/** `POST /api/v1/lists/save` — حفظُ قائمةِ غيري أو إلغاؤه (`ListSaveChip`) */
export const POST = bodyRoute<SaveListBody, { saved: boolean }>(
  async (b) => {
    const id = String(b.listId ?? "");
    await saveList(id, !!b.save);
    /* 🆕 T583 (أحمد «١ب»، ٢٦ نوفمبر) — **الحفظُ يضعها في «تابِع المشاهدة» معاً**: لا خطوةَ ثانية بعد «احفظ»، والزرُّ يصير
       «ابدأ/أكمل المشاهدة». ومفتاحُ «⋯» يُخرجها من الصفّ وتبقى محفوظة؛ وإلغاءُ الحفظ يحذف الصفَّ فتخرج معه */
    if (b.save) await setSavedListPlaylist(id, true).catch(() => {});
    return { saved: !!b.save };
  },
  () => ["me:lists", "me:library", "home"],
);
