"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { syncXIdentity, unlinkXIdentity } from "@/lib/actions";
import { buttonClass } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * ====== ربطُ حساب X — تسجيلُ دخولٍ لا حقلُ كتابة (D-839) ======
 *
 * **حكمُ أحمد**: «أبغاه ربط حقيقي مو بس كتابة اسم، بحيث يعمل تسجيل
 * دخول عن طريقهم عشان يكون أكثر مصداقيّة».
 *
 * 🔑 **والحقلُ سقط والزرُّ حلَّ محلَّه**: **معرّفٌ يُكتب باليد يقول
 * «أنا فلان» ولا يثبته** — **وثلاثون ثانيةً تكفي أيَّ أحدٍ ليكتب معرّفَ
 * غيره.** **والذي يثبت هو أن تدخل من عندهم.**
 *
 * ⚠️ **والربطُ في المتصفّح لا في الخادم**: `linkIdentity` **تُحوّل
 * الصفحة** — **وفعلُ خادمٍ لا يحوّل متصفّحاً.** **والكتابةُ بعد العودة
 * في `syncXIdentity`** — **فالخادمُ يسأل GoTrue ولا يثق بما يعود في
 * الرابط** (وهي قاعدةُ D-177: الحارسُ هو الكاتب).
 *
 * 🔴 **والزرُّ يُقفل ما دام في النموذج تعديلٌ لم يُحفظ**: **الربطُ
 * يغادر الصفحة إلى X ويعود** — **وبايو كُتب ولم يُحفظ يضيع في
 * الطريق.** **وسطرٌ يقول لماذا أهونُ من عملٍ يضيع بلا إنذار** (وهي
 * حجّةُ `UnsavedChangesDialog` نفسُها، مطبَّقةً على مغادرةٍ لا يملكها
 * الحوار).
 *
 * ⚠️ **ولا يُرسم أصلاً حتّى يوجد المزوّد** — الشرطُ في `xLinkEnabled`
 * وصاحبُ الصفحة يمرّره (D-217).
 */
export function XLinkRow({
  locale,
  handle,
  verified,
  dirty,
}: {
  locale: Locale;
  handle: string | null;
  /** **تاريخُ الثبوت موجود؟** — والمعرّفُ بلا تاريخٍ ليس موثَّقاً */
  verified: boolean;
  /** **في النموذج تعديلٌ لم يُحفظ** — فالمغادرةُ تُقفل (أعلاه) */
  dirty: boolean;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  /* **والعودةُ من X تُقرأ مرّةً واحدة**: `?x=1` علامةُ رجوعٍ لا حالة —
     **وحارسٌ في `ref` لأنّ التأثيرَ قد يُعاد تشغيلُه في التطوير.** */
  const done = useRef(false);
  const returned = params.get("x") === "1";

  useEffect(() => {
    if (!returned || done.current) return;
    done.current = true;
    start(async () => {
      try {
        await syncXIdentity();
      } catch (e) {
        setErr(t.xError + (e as Error).message);
      } finally {
        /* **والعلامةُ تُمسح من الرابط** — **رابطٌ يُشارَك أو يُحدَّث
           فيعيد الفعلَ عطلٌ** (D-805: `replace` لا `push`). */
        router.replace("/profile/edit");
        router.refresh();
      }
    });
  }, [returned, router, t]);

  async function connect() {
    setErr(null);
    setBusy(true);
    try {
      const supabase = await createClient();
      /* 🔴 **والعودةُ تمرّ بـ`/auth/callback` لا بالصفحة مباشرةً**:
         **تدفّقُ PKCE يعود بـ`?code=` يجب أن يُبادَل بجلسة** — **ورابطُ
         عودةٍ يقفز فوق المبادِل يصل الصفحةَ بلا هويّةٍ جديدة**،
         **فتقول `syncXIdentity` «لم يكتمل الربط» وقد اكتمل نصفُه.**
         **والمسارُ يُمرَّر في `next` كما يفعل زرُّ Google بالضبط** —
         وصفةٌ واحدةٌ للعودة من كلِّ مزوّد (D-145).
         🔴 **والأصلُ من `resolveAuthBase` لا `window.location.origin`
         خاماً** (D-623، بلاغُ مشعل): **تطبيقٌ مثبَّتٌ من أصلٍ قديمٍ
         تهبط كوكيزُه في نطاقٍ ولا تصل أصلَه**، **فيخرج من حسابه في
         كلِّ فتح.** */
      const { resolveAuthBase } = await import("@/lib/siteOrigin");
      const base = resolveAuthBase(window.location.origin);
      const back = encodeURIComponent("/profile/edit?x=1");
      const { error } = await supabase.auth.linkIdentity({
        /* 🔴 **والمفتاحُ `x` لا `twitter` — وقد كتبتُها `twitter` تخميناً**:
     **`twitter` مزوّدُ OAuth 1.0a المهجور** («Twitter (Deprecated)» في
     اللوحة)، **و`x` مزوّدُ OAuth 2.0** («X / Twitter (OAuth 2.0)»).
     **والدليلُ من اللوحة نفسِها لا من الوثائق**: حقلا استمارتِه
     `EXTERNAL_X_CLIENT_ID` و`EXTERNAL_X_SECRET` — **و`auth-js` تفصل
     بينهما في نوعها بتعليقين: الأوّلُ OAuth 1.0a والثاني OAuth 2.0.**
     ⚠️ **فمن فعّل «Twitter (Deprecated)» لن يعمل عنده شيء** — **والصوابُ
     تفعيلُ الثاني.** 🔑 **والدرس: اسمُ المفتاح يُقرأ من الاستمارة لا
     يُشتقّ من اسم العلامة.** */
        provider: "x",
        options: { redirectTo: `${base}/auth/callback?next=${back}` },
      });
      if (error) throw new Error(error.message);
      /* **ولا `setBusy(false)` عند النجاح**: الصفحةُ تغادر الآن،
         **وزرٌّ يستيقظ قبل أن تنتقل يُضغط مرّتين.** */
    } catch (e) {
      setErr(t.xError + (e as Error).message);
      setBusy(false);
    }
  }

  function disconnect() {
    setErr(null);
    start(async () => {
      try {
        await unlinkXIdentity();
        router.refresh();
      } catch (e) {
        setErr(t.xError + (e as Error).message);
      }
    });
  }

  const working = busy || pending;

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-12 font-semibold text-muted mb-1">X</span>
          {handle && verified ? (
            <span className="flex items-center gap-1.5 min-w-0">
              <bdi className="truncate text-[16px]" dir="ltr">
                @{handle}
              </bdi>
              {/* **والشارةُ كلمةٌ مع رمزها** (D-142): **لونٌ وحدَه لا
                  يُقرأ**، **و«موثَّق» هي الكلمةُ التي طلبها المعنى.** */}
              <span
                className="shrink-0 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-12 font-bold text-accent"
                title={t.xVerifiedTip}
              >
                <Icon name="check" size={12} className="shrink-0" />
                {t.xVerified}
              </span>
            </span>
          ) : (
            <span className="block text-14 text-muted" dir="auto">
              {t.xHint}
            </span>
          )}
        </span>

        {handle && verified ? (
          <button
            type="button"
            onClick={disconnect}
            disabled={working}
            className={buttonClass({
              variant: "surface",
              size: "xs",
              className: "shrink-0 disabled:opacity-60",
            })}
          >
            {t.xDisconnect}
          </button>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={working || dirty}
            className={buttonClass({
              variant: "surface",
              size: "sm",
              className: "shrink-0 gap-1.5 disabled:opacity-60",
            })}
          >
            {/* **ولا أيقونةَ جديدة** (D-489): `person-check` هي أقربُ ما في
                المجموعة إلى «أثبِت أنّ الحساب حسابُك» */}
            <Icon name="person-check" size={14} className="shrink-0" />
            {t.xConnect}
          </button>
        )}
      </div>

      {/* **والسببُ يُكتب حين يُقفل الزرّ** — **زرٌّ باهتٌ بلا سبب
          يُقرأ عطلاً** (D-044) */}
      {dirty && !(handle && verified) && (
        <p className="mt-2 text-12 text-muted leading-relaxed" dir="auto">
          {t.xSaveFirst}
        </p>
      )}
      {err && (
        <p className="mt-2 text-12 text-[color:var(--error)] leading-relaxed" dir="auto">
          {err}
        </p>
      )}
    </div>
  );
}
