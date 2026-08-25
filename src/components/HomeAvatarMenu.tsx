"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { Dropdown, DropdownRow } from "./ui/Dropdown";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * 🆕 **صورةُ الترحيب صارت مقبضَ قائمةٍ صغيرة** (D-620، حكمُ أحمد بلقطةٍ
 * محوَّطة: «الإعدادات احذف الأيقونة، وخلّ الشخص إذا ضغط على الصورة
 * تطلع قائمة صغيرة عند محل الضغط ويختار إعدادات أو بروفايل»).
 *
 * **والقائمةُ `Dropdown` القائمة لا صنفٌ جديد** (D-226: «منسدلةٌ لخيارٍ
 * سريعٍ ملتصقٍ بمقبضه» — وهذا نصُّ حالتها): تُفتح ملتصقةً بالصورة حيث
 * ضغط، وصفّاها `DropdownRow` بعينهما. **وترسُ الإعدادات سقط من صفِّ
 * الأيقونات** — بابُه صار هنا، **فلا بابان لوجهةٍ واحدة في ترويسةٍ
 * واحدة** (D-145 من جهة الأبواب).
 *
 * ⚠️ **والهلالُ ومداره لم يتبدّلا**: نفسُ حلقة المستوى المخروطيّة التي
 * كانت على رابط `/profile` — الذي تبدّل أن الضغطةَ تفتح قائمةً بدل
 * أن تنتقل مباشرة.
 */
export function HomeAvatarMenu({
  locale,
  name,
  avatarUrl,
  avatarPos,
  levelPercent,
}: {
  locale: Locale;
  name: string;
  avatarUrl?: string | null;
  avatarPos?: number | null;
  levelPercent?: number;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.profile}
        title={name || t.profile}
        onClick={() => {
          tap(6);
          setOpen((v) => !v);
        }}
        className="block rounded-full p-[2px] active:scale-95 transition"
        style={
          levelPercent && levelPercent > 0
            ? {
                background: `conic-gradient(var(--accent) ${levelPercent}%, var(--border) 0)`,
              }
            : undefined
        }
      >
        <span className="block rounded-full p-[2px] bg-[color:var(--background)]">
          <Avatar src={avatarUrl} name={name} size={44} posY={avatarPos} alt={t.avatarAlt} />
        </span>
      </button>

      <Dropdown open={open} onClose={() => setOpen(false)} align="start" className="min-w-44">
        <DropdownRow icon="person-check" label={t.profile} onClick={() => go("/profile")} />
        <DropdownRow
          icon="settings"
          label={t.settingsNavHeading}
          onClick={() => go("/profile/settings")}
        />
      </Dropdown>
    </div>
  );
}
