import Link from "next/link";
import { Avatar } from "./Avatar";
import { displayNameOf, type PersonLite } from "@/lib/people";
import type { Dict } from "@/lib/i18n";

/**
 * سطر شخص: صورة + اسم قابل للضغط.
 * من أخفى اسمه لا يُعرض اسمه ولا يُفتح ملفه من هنا — الإخفاء يعني الإخفاء.
 *
 * **⚠️ و`vertical` تخطيطٌ ثانٍ لا مكوّنٌ ثانٍ** (D-264، على وزن D-257):
 * بطاقاتُ لوحة «الناس» تضع الوجهَ فوق الاسم لا قبله، **وحرّاسُ الاسم
 * والرابط هي هي** — فمن نسخ الصفَّ ليقلبه نسخ معه قاعدةَ الإخفاء،
 * **وقاعدتان للاسم أسوأُ من تخطيطين في مكوّن** (درسُ `Inbox` في D-193).
 *
 * **و`sub` صارت `ReactNode`** لأن بطاقةَ اللوحة تحمل سطرين تحت الاسم:
 * الرقمَ ومكوّناتِه — **والمراجعةُ تُكتب ولا تُترك ممكنة** (D-219/D-263).
 */
export function PersonName({
  person,
  t,
  size = 28,
  sub,
  vertical = false,
  badge,
  end,
}: {
  person: PersonLite;
  t: Dict;
  size?: number;
  sub?: React.ReactNode;
  /** الوجهُ فوق الاسم لا قبله — لبطاقات لوحة «الناس» (D-264) */
  vertical?: boolean;
  /** شارةٌ تلتصق بالوجه — رقمُ المرتبة في اللوحة (D-264) */
  badge?: React.ReactNode;
  /**
   * 🆕 **ما يقف في آخر سطر الاسم** — الوسمُ الزمنيّ في صفّ التعليق
   * (D-272، على وزن صفّ «النشاط»).
   *
   * ⚠️ **وهو خارج رابط الملفّ عمداً**: العمرُ بابٌ إلى التعليق لا إلى
   * صاحبه، **ورابطٌ داخل رابط ترميزٌ باطل** قبل أن يكون خطأَ وجهة.
   * **ولذلك انقسم الرابطُ الواحد إلى رابطين** — وجهٌ واسمٌ — **وهو
   * تشريحُ صفّ «النشاط» حرفاً** (D-242).
   */
  end?: React.ReactNode;
}) {
  const name = displayNameOf(person, t.anonymousUser);
  /* من أخفى اسمه لا يُفتح ملفه؛ ومن لم يختر معرّفاً يُفتح بهويته —
     المعرّف اختياريّ، وغيابه كان يجعل الاسم نصّاً ميتاً لا يُنقر */
  const linkable = !person.hide_name;
  const handle = person.username ?? person.id;

  /* **الغلافُ نسبيٌّ دائماً** حتى لا يقفز الوجه حين تظهر الشارة —
     ولا شيءَ يتغيّر حجمه بعد أن يُرسم (D-046) */
  const face = (
    <span className="relative shrink-0">
      <Avatar
        src={person.hide_name ? null : person.avatar_url}
        name={name}
        size={size}
        alt={t.avatarAlt}
      />
      {badge}
    </span>
  );
  const nameText = <span className="block text-sm font-semibold truncate">{name}</span>;

  /** **بابُ الملفّ في موضعٍ واحد** — ومن أخفى اسمه لا بابَ له */
  const door = (children: React.ReactNode, cls: string) =>
    linkable ? (
      <Link
        href={`/u/${handle}`}
        prefetch={false}
        title={t.viewProfileOf(name)}
        className={`${cls} hover:text-accent transition`}
      >
        {children}
      </Link>
    ) : (
      <span className={cls}>{children}</span>
    );

  if (vertical) {
    return (
      <span className="flex flex-col items-center text-center gap-1.5 min-w-0 w-full">
        {door(
          <>
            {face}
            <span className="min-w-0 w-full">{nameText}</span>
          </>,
          "flex flex-col items-center gap-1.5 min-w-0 w-full",
        )}
        {sub && (
          <span className="block w-full text-[11px] text-muted leading-tight">{sub}</span>
        )}
      </span>
    );
  }

  /* **والقصُّ ملكُ المستدعي في الأفقيّ** (D-272): `sub` صارت تحمل سطراً
     مرنـاً فيه عنوانٌ ونجمة، **و`truncate` على غلافٍ مرنٍ يقصّ الأبناءَ
     كلَّهم** — فالغلافُ يحدّ العرضَ ولا يقصّ، ومن يقصّ يقول ذلك بنفسه. */
  return (
    <div className="flex items-center gap-2 min-w-0">
      {door(face, "shrink-0")}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {door(nameText, "min-w-0")}
          {end && <span className="ms-auto shrink-0">{end}</span>}
        </div>
        {sub && <div className="min-w-0 text-[11px] text-muted">{sub}</div>}
      </div>
    </div>
  );
}
