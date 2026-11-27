import { buttonClass } from "@/components/ui/Button";
import {
  COMMAND_APPROVERS,
  type CommandAgent,
  type CommandItem,
  type RunStatus,
} from "@/lib/command";
import { getUser } from "@/lib/data";
import { decideItemAction } from "@/lib/commandActions";
import { pillClass } from "@/components/admin/style";

/**
 * ====== أجزاءُ غرفة القيادة المشتركة (التصميم «ب — خريطة الأقسام»، اختيارُ أحمد ٢٧ نوفمبر) ======
 * تُستعمل في «غرفة القيادة» و«البنود» و«الوكلاء» — نسخةٌ واحدةٌ لكلّ شيء.
 */

export const DEPT_AR: Record<CommandAgent["department"], string> = {
  ops: "التشغيل",
  security: "الأمان والكود",
  execution: "التنفيذ",
  review: "المراجعة",
  content: "المحتوى",
  product: "المنتج والنمو",
  market: "السوق",
  strategy: "الاستراتيجية",
};

export const DEPT_ORDER: CommandAgent["department"][] = [
  "ops",
  "security",
  "execution",
  "review",
  "content",
  "market",
  "product",
  "strategy",
];

export const SEV_AR: Record<CommandItem["severity"], string> = {
  critical: "حرج",
  high: "عالٍ",
  medium: "متوسّط",
  low: "منخفض",
};

export const STATUS_AR: Record<RunStatus, string> = {
  ok: "سليم",
  warn: "يحتاج نظرة",
  critical: "حرج",
  failed: "فشل التشغيل",
  skipped: "تخطّى",
};

/** لونُ النقطة: الأخضرُ والأحمرُ ثابتان، والأصفرُ هو `accent` فيتبع الثيم (daylight يغمّقه) */
export function dotColor(s: RunStatus | null): string {
  if (s === "ok" || s === "skipped") return "var(--success)";
  if (s === "warn") return "var(--accent)";
  if (s === "critical" || s === "failed") return "var(--error)";
  return "var(--divider)";
}

/** وقتُ الرياض بـ«ص/م» دائماً — مراجعةُ ٢٧ نوفمبر: وقتٌ بلا «ص» يُقرأ ملتبساً */
export function riyadhTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ar-SA-u-nu-latn", {
    timeZone: "Asia/Riyadh",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function riyadhDay(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-SA-u-nu-latn", {
    timeZone: "Asia/Riyadh",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** عمرُ البند بعربيّةٍ تُقرأ: «منذ يومين» لا «منذ 2 يوم» */
export function ageAr(d: number): string {
  if (d <= 0) return "اليوم";
  if (d === 1) return "منذ أمس";
  if (d === 2) return "منذ يومين";
  if (d <= 10) return `منذ ${d} أيام`;
  return `منذ ${d} يوماً`;
}

export function SevBadge({ s }: { s: CommandItem["severity"] }) {
  const hot = s === "critical" || s === "high";
  const mid = s === "medium";
  return <span className={pillClass(hot ? "bad" : mid ? "warn" : "mute")}>{SEV_AR[s]}</span>;
}

/**
 * **بطاقةُ قرارٍ على بند** — ثلاثةُ أزرارٍ من مصنع الأزرار وسببٌ إلزاميّ.
 * «أغلقه دون تنفيذ» لا «اقبله كما هو» (مراجعةُ ٢٧ نوفمبر: الثانيةُ لا تقول ماذا يحدث).
 * وبندٌ موافَقٌ عليه لا يُعرض عليه «وافق» ثانيةً — يقول إنّه ينتظر محادثةَ التنفيذ.
 */
export function DecideForm({
  item,
  back,
  agentName,
  canDecide,
}: {
  item: CommandItem;
  back: string;
  agentName?: string;
  /** حسابُ أحمد أو خالد — غيرُهما يرى البندَ ولا يرى أزراره */
  canDecide: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-12 text-muted">
        <SevBadge s={item.severity} />
        {agentName && <span>{agentName}</span>}
        <span dir="ltr" className="tabular-nums">
          {item.id}
        </span>
        <span>· {ageAr(item.age_days)}</span>
      </div>
      <p className="text-14 font-medium leading-relaxed">{item.title}</p>
      {item.proposal && (
        <p className="text-12 text-muted leading-relaxed">{item.proposal}</p>
      )}
      {item.status === "approved" ? (
        <p className="text-12 text-success">
          ✓ موافَقٌ عليه — ينتظر محادثةً تقول «نفّذ الموافَق عليه».
        </p>
      ) : item.status === "in_queue" ? (
        <p className="text-12 text-muted">
          في طابور الرفع — ينتظر «وافق على الرفع».
        </p>
      ) : !canDecide ? (
        <p className="text-12 text-muted">القرارُ في هذا البند لأحمد وخالد.</p>
      ) : (
        <form action={decideItemAction} className="space-y-2">
          <input type="hidden" name="item" value={item.id} />
          <input type="hidden" name="back" value={back} />
          <input
            name="reason"
            required
            minLength={3}
            maxLength={500}
            placeholder="السبب — يُحفظ مع القرار"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-14"
          />
          <div className="flex flex-wrap gap-2">
            <button
              name="decision"
              value="approve"
              className={buttonClass({ size: "sm", className: "flex-1" })}
            >
              وافق على التنفيذ
            </button>
            <button
              name="decision"
              value="defer"
              className={buttonClass({ variant: "surface", size: "sm" })}
            >
              أجّل
            </button>
            <button
              name="decision"
              value="reject"
              className={buttonClass({ variant: "surface", size: "sm" })}
            >
              أغلقه دون تنفيذ
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** هل الحسابُ الحاليّ أحمدُ أو خالد؟ — يُخفي الأزرارَ عن غيرهما، والحكمُ النهائيّ في `commandActions` */
export async function canDecideNow(): Promise<boolean> {
  const user = await getUser();
  return !!user && user.id in COMMAND_APPROVERS;
}

const SEV_RANK: Record<CommandItem["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** الأخطرُ أوّلاً، ثمّ الأقدم — بندٌ عالٍ عمرُه أسبوعٌ قبل بندٍ عالٍ وُلد اليوم */
export function byUrgency(a: CommandItem, b: CommandItem): number {
  return SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.age_days - a.age_days;
}

/** أسوأُ حالةٍ بين وكلاء القسم — القسمُ بلونِ أضعفِ حلقاته */
export function worst(agents: CommandAgent[]): RunStatus | null {
  const order: RunStatus[] = ["failed", "critical", "warn", "ok", "skipped"];
  const got = agents
    .map((a) => a.last_run?.status)
    .filter(Boolean) as RunStatus[];
  return order.find((s) => got.includes(s)) ?? null;
}
