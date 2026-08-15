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
}: {
  person: PersonLite;
  t: Dict;
  size?: number;
  sub?: React.ReactNode;
  /** الوجهُ فوق الاسم لا قبله — لبطاقات لوحة «الناس» (D-264) */
  vertical?: boolean;
  /** شارةٌ تلتصق بالوجه — رقمُ المرتبة في اللوحة (D-264) */
  badge?: React.ReactNode;
}) {
  const name = displayNameOf(person, t.anonymousUser);
  /* من أخفى اسمه لا يُفتح ملفه؛ ومن لم يختر معرّفاً يُفتح بهويته —
     المعرّف اختياريّ، وغيابه كان يجعل الاسم نصّاً ميتاً لا يُنقر */
  const linkable = !person.hide_name;
  const handle = person.username ?? person.id;

  const inner = (
    <>
      {/* **الغلافُ نسبيٌّ دائماً** حتى لا يقفز الوجه حين تظهر الشارة —
          ولا شيءَ يتغيّر حجمه بعد أن يُرسم (D-046) */}
      <span className="relative shrink-0">
        <Avatar
          src={person.hide_name ? null : person.avatar_url}
          name={name}
          size={size}
          alt={t.avatarAlt}
        />
        {badge}
      </span>
      <span className={vertical ? "min-w-0 w-full" : "min-w-0"}>
        <span className="block text-sm font-semibold truncate">{name}</span>
        {sub && (
          <span
            className={`block text-[11px] text-muted ${vertical ? "leading-tight" : "truncate"}`}
          >
            {sub}
          </span>
        )}
      </span>
    </>
  );

  const cls = vertical
    ? "flex flex-col items-center text-center gap-1.5 min-w-0 w-full"
    : "flex items-center gap-2 min-w-0";

  if (!linkable) {
    return <span className={cls}>{inner}</span>;
  }

  return (
    <Link
      href={`/u/${handle}`}
      prefetch={false}
      title={t.viewProfileOf(name)}
      className={`${cls} hover:text-accent transition`}
    >
      {inner}
    </Link>
  );
}
