/**
 * 🆕 **بابُ قراءةِ أخطاء الخادم** (D-668) — **لا يرسم شيئاً ولا يغيّر
 * سلوكاً، يكتب سطراً واحداً حين يسقط شيء.**
 *
 * 🔴 **ولماذا لزم**: شاشةُ «صار خلل غير متوقّع» ظهرت لحساب `teamesh`
 * **في ثلاثة تحقيقاتٍ متتالية** (D-612 · D-626 · D-652) — **وفي كلِّها
 * شُخِّصت بالاستنتاج لا بالنصّ**: سجلّاتُ Vercel محجوبةٌ عن هذا المشروع
 * (`403 Forbidden`، أُعيد فحصُها اليوم عبر MCP). **والرمزُ الذي يراه
 * المستخدمُ (`digest`) بصمةٌ بلا معنى ما لم تُقابَل بنصّها** — **وهو
 * كلُّ ما بأيدينا اليوم عن عطلٍ يتكرّر.**
 *
 * 🔑 **فالبابُ الذي نملكه قاعدتُنا**: `onRequestError` يستدعيه Next عند
 * كلِّ خطأ خادمٍ (رسمُ صفحةٍ · فعلُ خادم · مسار API) — **فيُكتب المسارُ
 * والبصمةُ والنوعُ والنصّ**، **ويصير أوّلُ تكرارٍ للعطل مقروءاً.**
 *
 * ⚠️ **ولا هويّةَ تُكتب**: لا معرّفَ مستخدمٍ ولا IP ولا ترويسات —
 * **المسارُ عامٌّ والنصُّ نصُّنا نحن**، **والقصُّ في القاعدة نفسِها**
 * (٤٠٠ حرفٍ للنصّ) فلا يتسرّب متنٌ طويلٌ من رسالةٍ غير متوقّعة.
 *
 * ⚠️ **ولا يُنادى عميلُ Supabase المعتاد هنا**: هذا المسارُ يجري **خارج
 * سياق الطلب** (لا كوكيز ولا جلسة) — **ونداءُ REST مباشرٌ بمفتاح البيئة
 * العامّ** (يُذكر باسمه ولا يُكتب، القاعدة ١٤)، **والدالّةُ `definer`
 * فالصلاحيّةُ في القاعدة لا في المفتاح.**
 *
 * ⚠️ **والفشلُ صامتٌ مطلقاً**: **بابُ تشخيصٍ يرفع استثناءً داخل معالج
 * الاستثناءات يُخفي العطلَ الأصليَّ ويضيف عطلاً ثانياً** — **فلا شيءَ
 * هنا يُرمى إلى الأعلى.**
 */
export async function onRequestError(
  err: unknown,
  request: { path?: string },
): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const e = err as { message?: string; digest?: string; name?: string };

    await fetch(`${url}/rest/v1/rpc/log_runtime_error`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        apikey: key,
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        p_route: String(request?.path ?? ""),
        p_digest: String(e?.digest ?? ""),
        p_kind: String(e?.name ?? "Error"),
        p_message: String(e?.message ?? ""),
      }),
    });
  } catch {
    /* لا شيء — انظر رأسَ الملفّ */
  }
}
