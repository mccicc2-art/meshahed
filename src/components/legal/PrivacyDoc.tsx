import Link from "next/link";
import type { Locale } from "@/core/i18n";
import { privacyDoc } from "@/core/legal";

/**
 * نصُّ سياسة الخصوصية — **مصدرٌ واحدٌ لصفحتين** (D-1345): `/privacy` العامّة و`/app/privacy` العارية التي تفتحها شاشةُ
 * الدخول الأصليّة. نسختان من وثيقةٍ قانونيّةٍ تفترقان يومَ تُعدَّل إحداهما وتُنسى الأخرى.
 *
 * 🔑 **`bare` = بلا بابٍ يخرج من الوثيقة**: لا «‹ Loopz»، لا رابطَ للوثيقة الأخرى ولا لصفحةٍ في الموقع،
 * والبريدُ نصٌّ يُقرأ لا رابطٌ يُضغط. بلاغُ أحمد (١٠ أكتوبر، بتسجيل): فتح «الشروط» من شاشة الدخول فوجد
 * الموقعَ كلَّه بشريطه السفليّ وتصفّحه من داخل التطبيق قبل أن يسجّل.
 *
 * والنصّ (في `@/core/legal`) لا في `i18n.ts`: القاموس يُشحن كاملاً إلى المتصفّح في كل صفحة، ووثيقتان قانونيتان
 * طويلتان فيه ضريبةٌ على كل شاشةٍ مقابل صفحةٍ تُفتح مرّةً في العمر.
 *
 * 🆕 «لا ويب في التطبيق» ٢ (١٩ أكتوبر ٢٠٢٦) — **النصُّ انتقل إلى `@/core/legal`** حرفاً، وهذا المكوّنُ يرسمه فقط:
 * الشاشةُ الأصليّةُ في التطبيق تقرأ الوثيقةَ نفسَها من `GET /api/v1/legal/privacy`.
 */
export function PrivacyDoc({ locale, bare = false }: { locale: Locale; bare?: boolean }) {
  const ar = locale === "ar";
  const doc = privacyDoc(locale);

  return (
    <article className="max-w-2xl mx-auto pb-16" dir={ar ? "rtl" : "ltr"}>
      {bare ? null : (
        <Link href="/" className="text-xs text-muted hover:text-foreground transition">
          ‹ Loopz
        </Link>
      )}

      <h1 className="text-2xl font-bold mt-3">{doc.title}</h1>
      <p className="text-xs text-muted mt-1.5" dir="ltr">
        {doc.updated}
      </p>

      <div className="mt-7 space-y-7 text-15 leading-relaxed">
        {doc.sections.map((s) => (
          <div key={s.title} className="space-y-7">
            <Block title={s.title} body={s.body} />
            {/* D-907: بيانُ «أمان البيانات» في Google Play يطلب رابطاً مخصّصاً لخطوات الحذف — الصفحةُ تشرح الخطوات
                ومدّة الاحتفاظ، والفقرةُ قبلها تبقى الوعدَ القانونيّ. */}
            {s.deleteLink && !bare ? (
              <p className="text-15 -mt-4">
                <Link href="/account/delete" className="text-accent hover:brightness-110 transition">
                  {ar ? "خطوات حذف الحساب ←" : "How to delete your account →"}
                </Link>
              </p>
            ) : null}
          </div>
        ))}

        <p className="text-15" dir="ltr">
          {bare ? (
            <span className="text-foreground select-text">{doc.contact}</span>
          ) : (
            <a href={`mailto:${doc.contact}`} className="text-accent hover:brightness-110 transition">
              {doc.contact}
            </a>
          )}
        </p>

        {doc.note ? (
          <p className="text-12 text-muted/70 leading-relaxed pt-4 border-t border-[color:var(--divider)]">{doc.note}</p>
        ) : null}

        {bare ? null : (
          <p className="text-12">
            <Link href="/terms" className="text-muted hover:text-foreground transition">
              {ar ? "شروط الاستخدام ←" : "Terms of Use →"}
            </Link>
          </p>
        )}
      </div>
    </article>
  );
}

/** فقرةٌ بعنوان — نفس المقاسات في الصفحتين */
function Block({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h2 className="text-20 font-bold mb-1.5">{title}</h2>
      <p className="text-muted">{body}</p>
    </section>
  );
}
