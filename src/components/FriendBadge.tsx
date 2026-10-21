import { friendBadge, type HomeFriendState } from "@/core/contracts/home";

/**
 * 🆕 D-1445 — **شارةُ صديقك على الملصق** في «ماذا يشاهد أصدقاؤك» — توأمُ `FriendBadge` في التطبيق («٣ أ»: التطبيقُ والويب):
 * وجهُ أحدثِ صديقٍ له حال، ثمّ ★ تقييمُه (ذهبيّ) · ✓ خلّصه (أخضر) · ▶ آخرُ موسمٍ وحلقة (أبيض). الاختيارُ واحدٌ في
 * `friendBadge` فلا يفترق الطرفان. فوق الزاوية المقابلة لعلامة «عندك»، ولا تأخذ اللمسةَ من الملصق.
 */
export function FriendBadge({ people }: { people: { name: string; avatar_url: string | null; state?: HomeFriendState | null }[] }) {
  const who = people.find((p) => friendBadge(p.state));
  const b = who ? friendBadge(who.state) : null;
  if (!who || !b) return null;
  const color = b.kind === "rated" || b.kind === "ep_rated" ? "var(--accent)" : b.kind === "done" ? "var(--success)" : "#fff";
  /* 🆕 D-1503 — «★ ٩ · E3»: تقييمُه للحلقة التي وصلها (توأمُ التطبيق) */
  const label =
    b.kind === "rated" ? `★ ${b.rating}` : b.kind === "ep_rated" ? `★ ${b.rating} · E${b.episode}` : b.kind === "done" ? "✓" : b.episode ? `▶ S${b.season} · E${b.episode}` : `▶ S${b.season}`;
  return (
    <span
      aria-label={`${who.name} · ${label}`}
      className="pointer-events-none absolute top-1.5 end-1.5 z-10 inline-flex h-[22px] items-center gap-1 rounded-full border bg-black/70 ps-[2px] pe-2 text-[11px] font-bold"
      style={{ borderColor: color, color }}
      dir="ltr"
    >
      {who.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- صورةُ الملفّ الصغيرة بحجم ١٦: لا تمرّ بالمحسّن
        <img src={who.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" loading="lazy" />
      ) : (
        <span className="h-4 w-4 rounded-full bg-surface-2" />
      )}
      {label}
    </span>
  );
}
