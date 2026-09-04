import { getDict, type Locale } from "@/core/i18n";
import { Icon } from "./Icon";
import { buttonClass } from "./ui/Button";

/**
 * 🆕 **تنبيهُ الحساب المكرّر** (D-885 — حادثةُ دعمٍ حقيقيّة، حكمُ أحمد ①+②).
 *
 * **العلّة**: «الدخولُ بجوجل» منفذٌ واحد لا حسابٌ واحد — جوجل يستضيف عدّة
 * حساباتٍ للشخص نفسِه، وSupabase يفتح ملفّاً لكلِّ `sub`. فعضوٌ بمكتبةٍ
 * كاملةٍ دخل بحسابه الثاني فرأى مكتبةً فارغةً وظنّ أنّ قوائمَه ضاعت —
 * **والخادمُ والقاعدةُ سليمان** (جُرد قبل أن يُبنى شيء).
 *
 * **الموضع**: صفحةُ البداية وحدَها — **لا تُفتح إلا لمن مكتبتُه فارغة**،
 * وهي بعينها الشاشةُ التي أربكته. لا كوكي ولا حالةَ ولا تخمينَ «هل له
 * حسابٌ آخر» (لا نعرف ولا نبحث): **البريدُ يُقال باسمه والمخرجُ زرٌّ
 * واحد** يمرّ من `/auth/signout` نفسِه (يمسح الكوكي والكاشَ الشخصيّ
 * معاً — D-514). **مكوّنُ خادمٍ بلا عميل**: نموذجٌ وزرٌّ من المصنع.
 */
export function AccountNotice({ email, locale }: { email: string; locale: Locale }) {
  const t = getDict(locale);
  return (
    <div className="mb-6 rounded-xl border border-dashed border-border bg-surface px-4 py-3 flex items-start gap-3">
      <Icon name="mail" size={18} className="shrink-0 mt-0.5 text-muted" />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <p className="font-semibold break-all">{t.accountNoticeSignedInAs(email)}</p>
        <p className="text-muted mt-1">{t.accountNoticeHint}</p>
      </div>
      <form action="/auth/signout" method="post" className="shrink-0">
        <button type="submit" className={buttonClass({ variant: "surface", size: "sm" })}>
          {t.accountNoticeSwitch}
        </button>
      </form>
    </div>
  );
}
