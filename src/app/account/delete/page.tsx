import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/locale";

export const metadata: Metadata = {
  title: "Delete your Loopz account",
  description:
    "How to delete your Loopz account and every piece of data attached to it, from inside the app or by email.",
  alternates: { canonical: "/account/delete" },
};

/**
 * صفحةُ حذف الحساب — **وثيقةٌ عامّة لا زرّ** (D-907).
 *
 * لماذا صفحةٌ مستقلّة وفقرةُ «حقّك في بياناتك» في سياسة الخصوصية تقول
 * الشيءَ نفسه؟ لأن Google Play يشترط في بيان «أمان البيانات» رابطاً
 * **يشرح خطواتِ الحذف بوضوح ويذكر أنواعَ البيانات ومدّةَ الاحتفاظ**، ويفتحه
 * أي زائر بلا حساب — وفقرةٌ في منتصف وثيقةٍ طويلة تنجح عند مراجعٍ وتسقط
 * عند آخر. الصفحةُ المخصّصة تُقرأ في عشر ثوانٍ ولا تترك للمراجع ما يفسّره.
 *
 * ولا `getUser()` هنا عمداً (كما في `/privacy`): الحارسُ يحوّل الزائرَ إلى
 * تسجيل الدخول، والمراجعُ لا يملك حساباً. **وزرُّ الحذف نفسه يبقى في
 * الإعدادات** — لا نكرّر فعلاً لا رجعةَ فيه في صفحةٍ تصل إليها محرّكاتُ
 * البحث؛ هذه الصفحةُ تدلّ على الباب ولا تفتحه.
 *
 * والنصُّ هنا لا في `i18n.ts` للسبب نفسه في `/privacy`: القاموسُ يُشحن إلى
 * كل شاشة، ووثيقةٌ تُفتح مرّةً في العمر لا تستحقّ ضريبةً على كل صفحة.
 */
export default async function DeleteAccountPage() {
  const { locale } = await getT();
  const ar = locale === "ar";

  return (
    <article className="max-w-2xl mx-auto pb-16" dir={ar ? "rtl" : "ltr"}>
      <Link href="/" className="text-xs text-muted hover:text-foreground transition">
        ‹ Loopz
      </Link>

      <h1 className="text-2xl font-bold mt-3">
        {ar ? "حذف حسابك في Loopz" : "Delete your Loopz account"}
      </h1>
      <p className="text-xs text-muted mt-1.5" dir="ltr">
        {ar ? "آخر تحديث: ٥ سبتمبر ٢٠٢٦" : "Last updated: 5 September 2026"}
      </p>

      <div className="mt-7 space-y-7 text-15 leading-relaxed">
        <Block
          title={ar ? "الخلاصة" : "The short version"}
          body={
            ar
              ? "الحذف بيدك، فوريّ، ولا يحتاج مراسلة أحد: من الإعدادات داخل التطبيق أو الموقع، ضغطتان، ويُمحى الحساب وكلُّ ما يشير إليه في اللحظة نفسها. لا فترة انتظار ولا نسخة محفوظة."
              : "Deletion is in your hands, immediate, and needs no email to anyone: from Settings inside the app or on the website, two taps, and the account and everything attached to it is erased at that moment. No waiting period, no retained copy."
          }
        />

        <section>
          <h2 className="text-20 font-bold mb-1.5">
            {ar ? "الخطوات — من التطبيق أو الموقع" : "Steps — in the app or on the website"}
          </h2>
          <ol className="text-muted list-decimal ps-5 space-y-1.5">
            <li>
              {ar
                ? "سجّل الدخول بحساب Google نفسه الذي تستعمله في Loopz."
                : "Sign in with the same Google account you use for Loopz."}
            </li>
            <li>
              {ar ? (
                <>
                  افتح <b className="text-foreground">الإعدادات ← الحساب</b> (أو افتح الرابط
                  المباشر أدناه).
                </>
              ) : (
                <>
                  Open <b className="text-foreground">Settings → Account</b> (or use the direct
                  link below).
                </>
              )}
            </li>
            <li>
              {ar ? (
                <>
                  في أسفل الصفحة اضغط <b className="text-foreground">«حذف الحساب نهائياً»</b>، ثم
                  اضغطه مرّةً ثانية للتأكيد.
                </>
              ) : (
                <>
                  At the bottom of the page tap{" "}
                  <b className="text-foreground">“Delete account permanently”</b>, then tap it once
                  more to confirm.
                </>
              )}
            </li>
          </ol>
          <p className="mt-3">
            <Link
              href="/profile/settings/account"
              className="text-accent hover:brightness-110 transition"
            >
              {ar ? "افتح الإعدادات ← الحساب ←" : "Open Settings → Account →"}
            </Link>
          </p>
        </section>

        <Block
          title={ar ? "ما الذي يُحذف" : "What gets deleted"}
          body={
            ar
              ? "كل شيء، في نداءٍ واحد على قاعدة البيانات: سجلّ تسجيل الدخول نفسه، وملفك الشخصي (الاسم والمعرّف والصورة والغلاف)، وبريدك الإلكتروني، والأعمال التي تتابعها، والحلقات والأفلام التي أشّرت عليها، وتقييماتك ومراجعاتك وتعليقاتك، وقوائمك، ومتابعاتك ومتابعيك، وإعجاباتك، ورسائلك، ومشاركاتك، وبلاغاتك، والصور التي رفعتها. لا يبقى صفٌّ واحد يشير إليك."
              : "Everything, in a single database call: the sign-in record itself, your profile (name, username, avatar, cover), your email address, the titles you follow, the episodes and films you marked, your ratings, reviews and comments, your lists, your follows and followers, your likes, your messages, your posts, your reports, and the images you uploaded. Not one row that points at you remains."
          }
        />

        <Block
          title={ar ? "مدّة الاحتفاظ" : "Retention"}
          body={
            ar
              ? "لا شيء. الحذف نهائيّ ولحظيّ ولا يمكن التراجع عنه، ولا نحتفظ بنسخةٍ «لمدّة ٣٠ يوماً» ولا لأي مدّة. الاستثناء الوحيد سجلّات طلبات الخادم المعتادة لدى مزوّد الاستضافة (عناوين IP وأوقات الطلبات) وتنتهي تلقائياً خلال أيام، ولا تحمل اسمك ولا محتواك."
              : "None. Deletion is final, instant and irreversible; we keep no “30-day” copy or any other. The only exception is the hosting provider’s ordinary server request logs (IP addresses and request times), which expire automatically within days and carry neither your name nor your content."
          }
        />

        <Block
          title={ar ? "لا تستطيع الدخول؟" : "Can’t sign in?"}
          body={
            ar
              ? "إن فقدت الوصول إلى حساب Google أو لم يعد التطبيق مثبّتاً، أرسل طلب الحذف من البريد المرتبط بحسابك إلى العنوان أدناه، ونحذفه يدويّاً خلال ٧ أيام ونردّ عليك بالتأكيد. نتحقّق فقط من أن الرسالة جاءت من بريد الحساب نفسه — لا نطلب أي معلومةٍ إضافية."
              : "If you have lost access to the Google account or the app is no longer installed, send a deletion request from the email address linked to your account to the address below; we delete it manually within 7 days and reply to confirm. The only check is that the message comes from the account’s own email — we ask for nothing else."
          }
        />

        <p className="text-15" dir="ltr">
          <a
            href="mailto:alharbiahmed3bd@gmail.com?subject=Delete%20my%20Loopz%20account"
            className="text-accent hover:brightness-110 transition"
          >
            alharbiahmed3bd@gmail.com
          </a>
        </p>

        <Block
          title={ar ? "حذف بعض البيانات دون الحساب" : "Deleting some data without the account"}
          body={
            ar
              ? "لا يلزم حذف الحساب كلّه لحذف شيءٍ منه: أي تقييمٍ أو مراجعةٍ أو تعليقٍ أو قائمةٍ أو متابعة يُحذف من مكانه داخل التطبيق فوراً، وإزالة عملٍ من مكتبتك تمحو حلقاته المؤشَّرة معه. وخيار «إخفاء الاسم» في الإعدادات يُخرجك من المجتمع وبحث المستخدمين مع بقاء مكتبتك."
              : "You do not have to delete the whole account to delete part of it: any rating, review, comment, list or follow is deleted in place inside the app, immediately, and removing a title from your library erases its marked episodes with it. The “hide my name” switch in Settings takes you out of the community and people search while keeping your library."
          }
        />

        <p className="text-12 pt-4 border-t border-[color:var(--divider)]">
          <Link href="/privacy" className="text-muted hover:text-foreground transition">
            {ar ? "سياسة الخصوصية ←" : "Privacy Policy →"}
          </Link>
        </p>
      </div>
    </article>
  );
}

/** فقرةٌ بعنوان — نفس المقاسات في `/privacy` و`/terms` */
function Block({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h2 className="text-20 font-bold mb-1.5">{title}</h2>
      <p className="text-muted">{body}</p>
    </section>
  );
}
