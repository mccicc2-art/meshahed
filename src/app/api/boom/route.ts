import { NextResponse } from "next/server";

/**
 * 🧪 **مسبارٌ مؤقّتٌ يُحذف في الكوميت التالي** (D-668) — **غرضُه إثباتُ
 * أن `onRequestError` يكتب فعلاً في القاعدة على المنشور.**
 *
 * ⚠️ **ولا يرمي إلّا بالكلمة**: بلا `?t=lz-probe` يعود 204 — **فمسارٌ
 * عامٌّ يسقط دائماً يملأ سجلَّ الأخطاء بضجيجِ الزوّاحف**، وهو نقيضُ
 * الغرض. **ويُحذف بعد اللقطة** (D-028: المسبارُ يموت بعد قياسه).
 */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t");
  if (t !== "lz-probe") return new NextResponse(null, { status: 204 });
  throw new Error("lz-probe: deliberate error to verify onRequestError");
}
