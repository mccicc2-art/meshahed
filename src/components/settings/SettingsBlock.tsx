import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import { settingsCard } from "./SettingsGroup";

/**
 * 🆕 R260 — **كتلةُ إعدادٍ مفتوحة على الحاسوب** (إعداداتُ اللوحتين، اختيارُ أحمد «ب»): عنوانٌ برمزه ثمّ الخيارُ نفسُه ظاهراً.
 * على الجوّال يبقى الصفُّ الذي يُفتح (`SettingsExpandRow`) — الشاشةُ ضيّقةٌ فالطيُّ يوفّرها؛ وعلى الحاسوب المساحةُ موجودة،
 * فطيُّ خيارٍ خلف ضغطةٍ كلفةٌ بلا فائدة. **والبطاقةُ `settingsCard` نفسُها** لا بطاقةٌ ثانية (القاعدة ٣).
 */
export function SettingsBlock({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <section className={`${settingsCard} p-4`}>
      <h3 className="mb-3 flex items-center gap-2.5 text-15 font-bold">
        <Icon name={icon} size={19} className="shrink-0 text-muted" />
        {title}
      </h3>
      {children}
    </section>
  );
}
