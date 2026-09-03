/**
 * 🆕 **قارئُ نظرة الإدارة + حقائقُ البنية** (D-901، «تحتاج تطويراً أكثر»).
 *
 * الشقُّ الذي سقط حين أُغلقت لوحةُ `loopz-ops` الخارجية هو **المتابعة**،
 * وقرارُ أحمد «لا نحتاج مكانين للمتابعة والإدارة» — فتسكن هنا.
 * **نداءٌ واحدٌ** (`admin_overview`) يُعيد كلَّ شيءٍ، والحارسُ في جسمه.
 *
 * والحدودُ والخططُ **مصدرُها الوحيد هذا الملفّ** — تغيّرت خطّةٌ؟ يُعدَّل هنا.
 */
import { createClient } from "@/lib/supabase/server";

export type AdminOverview = {
  generated_at: string;
  users: {
    total: number; new_24h: number; new_7d: number; new_30d: number;
    active_24h: number; active_7d: number; active_30d: number; never_returned: number;
  };
  suspended: number;
  signups_daily: { d: string; n: number }[];
  logins_hourly: { h: number; n: number }[];
  visit_langs: { lang: string; hits: number }[];
  db: {
    db_bytes: number; storage_bytes: number; storage_objects: number;
    tables: { name: string; bytes: number; rows: number }[];
  };
  errors: {
    count_24h: number; count_7d: number;
    top: { route: string; kind: string; n: number; last_at: string; sample: string }[];
  };
  health: {
    open_policies: number; open_policy_tables: string[];
    cron: { job: string; schedule: string; active: boolean }[];
  };
  queues: { partners_pending: number; verification_pending: number; payouts_pending: number; partners_total: number };
  content: { follows: number; ratings: number; lists: number; posts: number; messages: number; communities: number };
};

export async function getAdminOverview(): Promise<AdminOverview | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_overview");
    if (error || !data) return null;
    return data as AdminOverview;
  } catch {
    return null;
  }
}

/** رأسُ `main` على GitHub — عامٌّ بلا توكن، ويُخزَّن دقيقةً كي لا تُحرق حصّةُ ٦٠/ساعة. */
export async function getGitHubHead(): Promise<{ sha: string; message: string; date: string } | null> {
  try {
    const res = await fetch("https://api.github.com/repos/mccicc2-art/meshahed/commits/main", {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "loopz-admin" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { sha: string; commit: { message: string; author: { date: string } } };
    return { sha: j.sha, message: j.commit.message.split("\n")[0], date: j.commit.author.date };
  } catch {
    return null;
  }
}

/** بصمةُ النشرة الحيّة — نفسُ ما يُرجعه `/api/build`، بلا رحلةٍ إلى أنفسنا. */
export const LIVE_SHA = process.env.VERCEL_GIT_COMMIT_SHA ?? null;

/** الحدودُ التي نقيس عليها. الخطّةُ المجانيّةُ في Supabase توقف لا تفوتر. */
export const LIMITS = {
  supabaseDbBytes: 500 * 1024 * 1024,
  supabaseStorageBytes: 1024 * 1024 * 1024,
  supabaseMau: 50_000,
  expectedOpenPolicies: 5, // supabase/README.md: user_follows · communities · imdb_ratings · imdb_chart · title_meta
  expectedActiveCron: 1,   // loopz-title-communities (D-140)
} as const;

export type Provider = {
  name: string;
  plan: string;
  paid: boolean;
  what: string;
  risk: string;
  dashboard: string;
};

/** منقولةٌ من 18_Project_Context.md. */
export const PROVIDERS: Provider[] = [
  {
    name: "Vercel", plan: "Pro — مدفوع", paid: true,
    what: "الاستضافة والنشر. كلُّ التزامٍ موسومٍ بـ[deploy] يبني.",
    risk: "دمجُ PR بلا وسمٍ لا يَنشُر — يبقى الإنتاجُ متأخّراً بصمت (وقع في ٣ سبتمبر). والتجاوزُ فاتورةٌ لا توقّف.",
    dashboard: "https://vercel.com/mccicc2-arts-projects/meshahed",
  },
  {
    name: "Supabase", plan: "Free — مجاني", paid: false,
    what: "القاعدة والمصادقة والمخزن وpg_cron.",
    risk: "السقفُ الحقيقي: ٥٠٠MB قاعدة · ١GB مخزن · ٥GB خروج/شهر — والتجاوزُ يوقف لا يفوتر. والمشروعُ يُوقَف بعد ٧ أيام خمول.",
    dashboard: "https://supabase.com/dashboard/project/uvgmvrdrxzpudoldjxaa",
  },
  {
    name: "TMDB", plan: "مفتاح مجاني — غير تجاري", paid: false,
    what: "الكتالوج كلُّه: الأعمال والصور.",
    risk: "الرخصةُ التجاريّةُ شرطٌ عند تحقيق دخل — وفنُّ الأعمال (D-131) مبنيٌّ على صورهم. وJustWatch يجب أن يُعرض مع الأسعار (D-150).",
    dashboard: "https://www.themoviedb.org/settings/api",
  },
  {
    name: "Google OAuth", plan: "مجاني — In production", paid: false,
    what: "طريقةُ الدخول الوحيدة.",
    risk: "أخطرُ نقطةٍ مفردة: لو تعطّلت لا أحدَ يدخل. لا شعارَ مرفوعاً عمداً — رفعُه يفرض تحقّقَ علامة.",
    dashboard: "https://console.cloud.google.com/apis/credentials?project=utility-league-504219-j4",
  },
  {
    name: "GoDaddy", plan: "نطاق مدفوع — loopztv.com", paid: true,
    what: "النطاقُ وسجلّاتُه.",
    risk: "انتهاءُ التجديد يُسقط الموقعَ كلَّه بلا إنذارٍ من Vercel. ⚠️ تاريخُ التجديد غيرُ موثَّقٍ في ملفّات المشروع.",
    dashboard: "https://dcc.godaddy.com/control/portfolio",
  },
  {
    name: "GitHub", plan: "Free — مستودع عام", paid: false,
    what: "الشيفرة، ومصدرُ بناء Vercel.",
    risk: "لا يهدّد الاستقرار. تطبيقُ Vercel مأذونٌ لهذا المستودع وحدَه.",
    dashboard: "https://github.com/mccicc2-art/meshahed",
  },
];
