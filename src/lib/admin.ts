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

/**
 * 🆕 **ملخّصُ الاختبار المغلق** (D-909) — نداءٌ ثانٍ صغيرٌ بجانب
 * `admin_overview` لا توسيعٌ لها: **توسيعُها كان يعني إعادةَ كتابة مئةٍ
 * وثلاثين سطراً حيّةً لتُضاف إليها ستّةَ عشر**، **وخطأُ نسخٍ في نداءٍ
 * يقرؤه الفهرسُ كلَّ فتحة أغلى من رحلةٍ ثانية.**
 */
export type AdminTestersSummary = {
  testers: { total: number; with_account: number; signed_in: number; active_7d: number };
  /** `app_users` = من فتح **التطبيق** لا الموقع — وهو وحدَه دليلُ التثبيت. */
  platforms: { platform: string; users: number; app_users: number }[];
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

export async function getAdminTestersSummary(): Promise<AdminTestersSummary | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_testers_summary");
    if (error || !data) return null;
    return data as AdminTestersSummary;
  } catch {
    return null;
  }
}

/**
 * 🆕 **صفُّ مختبِرٍ** (D-909) — سطرٌ من قائمة الدعوة مضموماً على حسابه
 * إن وُجد. **و`userId = null` هو الجواب**: بريدٌ دُعي ولم يُفتح به حساب.
 */
export type AdminTesterRow = {
  email: string;
  note: string | null;
  invitedAt: string | null;
  userId: string | null;
  username: string | null;
  nickname: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  lastSeenAt: string | null;
  activeDays30: number;
  platforms: string | null;
  onApp: boolean;
  suspendedAt: string | null;
  /** 🆕 D-917 — اليومُ يومُ الرياض (`loopz_today`)، والدقائقُ تقديرٌ: ضربةُ حضورٍ ≈ ٤ دقائق */
  activeToday: boolean;
  appToday: boolean;
  /** أيّامٌ متّصلةٌ تنتهي اليومَ أو أمس */
  streak: number;
  days14: number;
  appDays14: number;
  minutesToday: number;
  minutes7d: number;
};

/** 🆕 D-917 — العدّادُ الأعلى: كم دخل اليوم، وكم يوماً متّصلاً دخل فيه **الجميع**. */
export type AdminTestersDaily = {
  today: string;
  with_account: number;
  active_today: number;
  all_streak: number;
  all_today: boolean;
};

export async function getAdminTestersDaily(): Promise<AdminTestersDaily | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_testers_daily");
    if (error || !data) return null;
    return data as AdminTestersDaily;
  } catch {
    return null;
  }
}

/** 🆕 **مرشَّحُ اختبار** (D-909) — أندرويديٌّ من المتصفّح، بريدُه مقنَّع. */
export type AdminCandidateRow = {
  userId: string;
  username: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  emailMasked: string | null;
  createdAt: string | null;
  seenAt: string | null;
  activeDays30: number;
  watched: number;
};

/**
 * **قائمةُ المختبِرين.** ⚠️ **والفشلُ قائمةٌ فارغةٌ لا شاشةٌ مكسورة**:
 * الصفحةُ تقول «لا أحد» بنفسها — **ودالّةٌ غائبةٌ قبل تشغيل الهجرة
 * تُقرأ هكذا**، فيُشحن الكودُ قبل SQL بلا ضرر.
 */
export async function getAdminTesters(): Promise<AdminTesterRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_testers");
    if (error || !Array.isArray(data)) return [];
    return (data as Record<string, unknown>[]).map((r) => ({
      email: String(r.email),
      note: (r.note as string) ?? null,
      invitedAt: (r.invited_at as string) ?? null,
      userId: (r.user_id as string) ?? null,
      username: (r.username as string) ?? null,
      nickname: (r.nickname as string) ?? null,
      createdAt: (r.created_at as string) ?? null,
      lastSignInAt: (r.last_sign_in_at as string) ?? null,
      lastSeenAt: (r.last_seen_at as string) ?? null,
      activeDays30: Number(r.active_days_30 ?? 0),
      platforms: (r.platforms as string) ?? null,
      onApp: r.on_app === true,
      suspendedAt: (r.suspended_at as string) ?? null,
      activeToday: r.active_today === true,
      appToday: r.app_today === true,
      streak: Number(r.streak ?? 0),
      days14: Number(r.days_14 ?? 0),
      appDays14: Number(r.app_days_14 ?? 0),
      minutesToday: Number(r.minutes_today ?? 0),
      minutes7d: Number(r.minutes_7d ?? 0),
    }));
  } catch {
    return [];
  }
}

/** **مرشَّحو أندرويد** — نافذةُ الأيّام معاملٌ لأنّ «الآن» تضيق وتتّسع. */
export async function getAdminAndroidCandidates(days = 30): Promise<AdminCandidateRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_android_candidates", { p_days: days });
    if (error || !Array.isArray(data)) return [];
    return (data as Record<string, unknown>[]).map((r) => ({
      userId: String(r.user_id),
      username: (r.username as string) ?? null,
      nickname: (r.nickname as string) ?? null,
      avatarUrl: (r.avatar_url as string) ?? null,
      emailMasked: (r.email_masked as string) ?? null,
      createdAt: (r.created_at as string) ?? null,
      seenAt: (r.seen_at as string) ?? null,
      activeDays30: Number(r.active_days_30 ?? 0),
      watched: Number(r.watched ?? 0),
    }));
  } catch {
    return [];
  }
}

/**
 * **كشفُ بريدٍ واحد** — ⚠️ **فعلٌ لا عرض**: القوائمُ مقنَّعةٌ دائماً،
 * **وكلُّ كشفٍ يُكتب في `admin_audit`** بجسم الدالّة. **ودعوةُ مرشَّحٍ
 * إلى Play تحتاج بريدَه كاملاً** — فالبابُ يُفتح بقدر حاجته لا أكثر
 * (D-138 روحاً)، **وتحديثُ الصفحة يُسجَّل من جديد لأنّه كشفٌ من جديد.**
 */
export async function revealUserEmail(userId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_reveal_email", { p_user: userId });
    if (error || typeof data !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

/** رأسُ `main` على GitHub — عامٌّ بلا توكن، ويُخزّن دقيقةً كي لا تُحرق حصّةُ ٦٠/ساعة. */
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
    risk: "انتهاءُ التجديد يُسقط الموقعَ كلَّه بلا إنذارٍ من Vercel. ⚠️ تاريخُ التجديد غيرُ موثّقٍ في ملفّات المشروع.",
    dashboard: "https://dcc.godaddy.com/control/portfolio",
  },
  {
    name: "GitHub", plan: "Free — مستودع عام", paid: false,
    what: "الشيفرة، ومصدرُ بناء Vercel.",
    risk: "لا يهدّد الاستقرار. تطبيقُ Vercel مأذونٌ لهذا المستودع وحدَه.",
    dashboard: "https://github.com/mccicc2-art/meshahed",
  },
];

/**
 * 🆕 **سجلُّ الإدارة يُقرأ** (D-923، الهجرة ١٨٣) — `admin_audit` (١٧٢) تمتلئ
 * منذ أسابيع وبصفرِ سياساتٍ على الجدول **لم يكن لها بابٌ في الواجهة**.
 *
 * 🔑 **وصار للسؤال صاحبان**: منذ ٥ سبتمبر في اللوحة مديران — **«من فعل ماذا
 * ومتى» سؤالُ فريقٍ لا سؤالُ مالكٍ وحيد.** والأسماءُ تُضَمّ في القاعدة لا
 * هنا: صفٌّ فيه `uuid` وحدَه يفرض رحلةً ثانيةً لكلِّ سطر.
 */
export type AdminAuditRow = {
  at: string;
  actor: string | null;
  actorName: string | null;
  action: string;
  target: string | null;
  targetName: string | null;
  detail: Record<string, unknown> | null;
};

export async function getAdminAudit(limit = 12): Promise<AdminAuditRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_audit_recent", { p_limit: limit });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => ({
      at: String(r.at),
      actor: (r.actor as string) ?? null,
      actorName: (r.actor_name as string) ?? null,
      action: String(r.action),
      target: (r.target as string) ?? null,
      targetName: (r.target_name as string) ?? null,
      detail: (r.detail as Record<string, unknown>) ?? null,
    }));
  } catch {
    return [];
  }
}

/** الاسمُ العربيُّ لفعلِ الإدارة — **مكانٌ واحدٌ لا خريطةٌ في كلِّ صفحة.** */
export const AUDIT_AR: Record<string, string> = {
  grant_admin: "منح صلاحية إدارة",
  revoke_admin: "سحب صلاحية إدارة",
  suspend: "إيقاف حساب",
  unsuspend: "فكّ إيقاف",
  reveal_email: "كشف بريد",
  tester_add: "إضافة مختبِر",
  tester_remove: "حذف مختبِر",
  tester_invited: "تعليم الدعوة",
};

/**
 * 🆕 **أرقامُ الشريط** (D-923) — أربعةُ طوابيرَ وواجبُ اليوم في نداءٍ واحدٍ خفيف.
 *
 * ⚖️ **ولماذا دالّةٌ ثانيةٌ لا `admin_overview`؟** لأنّ الشريطَ يُرسم في
 * **كلِّ** صفحةِ إدارة، و`admin_overview` تقيس أحجامَ الجداول وتجمع أخطاءَ
 * ثلاثين يوماً — **ثمنُ لوحةِ قيادةٍ كاملةٍ لأربعة أرقام.** (وهي حجّةُ
 * `admin_testers_summary` نفسُها في D-909.)
 */
export type AdminNavCounts = {
  partners: number;
  verify: number;
  payouts: number;
  suspended: number;
  /** من له حسابٌ ولم يدخل اليومَ (يومُ الرياض) — **الرقمُ الذي يُراسَل صاحبُه** */
  testers_missing: number;
};

export async function getAdminNavCounts(): Promise<AdminNavCounts | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_nav_counts");
    if (error || !data) return null;
    return data as AdminNavCounts;
  } catch {
    return null;
  }
}

/**
 * 🆕 **الأداءُ والحمايةُ تُقاس لا تُوصف** (D-924، الهجرة ١٨٤، طلبُ أحمد:
 * «أحتاج أعرف فيها حالة الأداء والسرعة والتأخير، وحالة الأمان وحفظ البيانات
 * وأنواع البيانات التي نجمعها ومستوى الحماية والثغرات والتوصيات»).
 *
 * 🔑 **كلُّ رقمٍ من مصدرٍ حيّ**: `pg_stat_statements` للزمن، `pg_policies`
 * و`pg_proc` للحماية، `pg_class` للنموّ. **والتصنيفُ وحدَه مكتوبٌ هنا**
 * (`DATA_MAP`) لأنّه حكمٌ لا قياس — **والقاعدة تقول كم وكم عمرُه، والشيفرةُ
 * تقول ما هو ولماذا نحتفظ به.**
 */
export type AdminHealth = {
  at: string;
  perf: {
    since: string;
    calls: number;
    total_s: number;
    avg_ms: number;
    cache_hit: number;
    db_bytes: number;
    unused_indexes: number;
    top: { name: string; calls: number; mean_ms: number; pct: number }[];
  };
  sec: {
    tables: number;
    rls_off: number;
    policies: number;
    open_policies: number;
    /** سياساتٌ تُعيد تقييم `auth.uid()` لكلِّ صفّ — رقمُ مستشار Supabase نفسُه */
    initplan: number;
    definer: number;
    definer_anon: number;
    mutable_path: number;
    providers: { provider: string; n: number }[];
    buckets: { id: string; public: boolean; objects: number }[];
  };
  data: Record<string, { rows: number; oldest: string | null }>;
};

export async function getAdminHealth(): Promise<AdminHealth | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_health");
    if (error || !data) return null;
    return data as AdminHealth;
  } catch {
    return null;
  }
}

/**
 * **ما نجمعه ولماذا** — التصنيفُ حكمٌ فيسكن الشيفرة، والعددُ والعمرُ من
 * القاعدة. **والعمودُ الأهمّ «يُحذف؟»**: جدولٌ بلا سياسةِ حذفٍ ينمو إلى الأبد،
 * **وبياناتٌ لا تنتهي صلاحيّتُها هي بياناتٌ تُسرَّب يوماً ما.**
 */
export type DataKind = "identity" | "financial" | "behaviour" | "technical";

export const DATA_MAP: {
  table: string;
  what: string;
  kind: DataKind;
  keep: string;
  /** `false` = ينمو بلا حدّ: لا وظيفةَ حذفٍ دوريّ تمسّه اليوم */
  pruned: boolean;
}[] = [
  { table: "partner_details", what: "IBAN وهاتفُ الشريك", kind: "financial",
    keep: "ما دام الشريك", pruned: false },
  { table: "payout_requests", what: "لقطةُ IBAN مع كلِّ طلبِ تحويل", kind: "financial",
    keep: "بلا حدّ", pruned: false },
  { table: "play_testers", what: "بريدُ المختبِر (مُدخَلُ أحمد لا قراءةُ القاعدة)", kind: "identity",
    keep: "حتى يُحذف يدويّاً", pruned: false },
  { table: "user_devices", what: "صنفُ المنصّة فقط — لا وكيلَ متصفّحٍ كاملاً (D-666)", kind: "technical",
    keep: "بلا حدّ", pruned: false },
  { table: "user_active_days", what: "يومُ نشاطٍ وعدّادُ نبضات", kind: "behaviour",
    keep: "بلا حدّ", pruned: false },
  { table: "profile_views", what: "من زار ملفَّ من", kind: "behaviour",
    keep: "بلا حدّ", pruned: false },
  { table: "admin_audit", what: "فعلُ مديرٍ وهدفُه", kind: "technical",
    keep: "بلا حدّ (مقصود: سجلٌّ يُحذف ليس سجلّاً)", pruned: false },
  { table: "runtime_errors", what: "خطأُ خادمٍ ومسارُه — بلا هويّةٍ ولا IP", kind: "technical",
    keep: "بلا حدّ", pruned: false },
];

export const KIND_AR: Record<DataKind, string> = {
  identity: "هويّة",
  financial: "ماليّ",
  behaviour: "سلوك",
  technical: "تقنيّ",
};

/**
 * **الثغراتُ تُشتَقّ من الأرقام لا تُكتب قائمةً** — فتختفي وحدَها متى عولجت.
 * **قائمةُ توصياتٍ ثابتةٌ في الشيفرة تكذب بعد أوّل إصلاح**، وهذه لا تستطيع.
 */
export type Finding = {
  id: string;
  sev: "high" | "med" | "low";
  title: string;
  why: string;
  fix: string;
};

export function findingsOf(h: AdminHealth): Finding[] {
  const f: Finding[] = [];
  const hot = h.perf.top?.[0];
  if (hot && hot.pct >= 20 && hot.name !== "sql")
    f.push({
      id: "hot-fn", sev: "high",
      title: `${hot.name} تأكل ${hot.pct}٪ من زمن القاعدة`,
      why: `${hot.calls.toLocaleString("en-US")} نداءً بمتوسّط ${hot.mean_ms} م.ث. شارةٌ في الترويسة تُحسب في كلِّ رسمةِ صفحة — وNext يرسم مسبقاً عند كلِّ تحويم.`,
      fix: "عدُّ الجديد بسؤالٍ مباشرٍ بدل تشغيل دالّة الإشارات كاملةً ثمّ عدِّها، أو تخزينُ الرقم في الملفّ ويُبطَل عند الحدث.",
    });
  if (h.sec.initplan > 0)
    f.push({
      id: "initplan", sev: "high",
      title: `${h.sec.initplan} سياسةً تُعيد تقييم auth.uid() لكلِّ صفّ`,
      why: "الدالّةُ تُنادى مرّةً لكلِّ صفٍّ بدل مرّةٍ للاستعلام — الأثرُ يكبر مع كلِّ صفٍّ يُقرأ، وهو أوسعُ مكسبٍ منهجيٍّ متاح.",
      fix: "(select auth.uid()) بدل auth.uid() داخل كلِّ سياسة — تغييرٌ آليٌّ في security*.sql وحدَها، بلا مساسِ منطق.",
    });
  const noPrune = DATA_MAP.filter((d) => !d.pruned && (h.data?.[d.table]?.rows ?? 0) > 0);
  if (noPrune.length > 0)
    f.push({
      id: "retention", sev: "med",
      title: `لا وظيفةَ حذفٍ دوريّ — ${noPrune.length} جداولَ تنمو بلا حدّ`,
      why: "وظيفةُ cron الوحيدةُ صيانةٌ لا تنظيف. runtime_errors وحدَها تكتب آلافَ الصفوف شهريّاً، والاحتفاظُ بلا سببٍ التزامٌ لا أصل.",
      fix: "وظيفةٌ ليليّةٌ واحدة: حذفُ runtime_errors فوق ٩٠ يوماً وprofile_views فوق ١٨٠. والماليُّ والسجلُّ يبقيان بقرارٍ مكتوب.",
    });
  const extra = (h.sec.providers ?? []).filter((p) => p.provider !== "google");
  if (extra.length > 0)
    f.push({
      id: "providers", sev: "med",
      title: `بابُ دخولٍ ثانٍ مفعَّل: ${extra.map((p) => `${p.provider} (${p.n})`).join(" · ")}`,
      why: "قواعدُ المشروع وصفحةُ الخصوصيّة وإقرارُ «أمان البيانات» في Play تقول Google وحدَها — وبابٌ لا تذكره الوثيقةُ بابٌ لا يراجعه أحد.",
      fix: "إمّا يُعطَّل، أو يُوثَّق في 18/07 و/privacy وإقرارِ Play — والقرارُ لأحمد.",
    });
  if (h.sec.definer_anon > 0)
    f.push({
      id: "definer-anon", sev: "med",
      title: `${h.sec.definer_anon} دالّةَ definer ينفّذها anon`,
      why: "الحكمُ في جسم الدالّة (am_admin/auth.uid) وهو صحيح — لكنّ المنحَ أوسعُ من الحاجة، فالدفاعُ طبقةٌ واحدةٌ لا طبقتان.",
      fix: "سحبُ execute عن anon من كلِّ دالّةٍ لا يحتاجها زائر — دفعةً واحدةً بجردٍ مولَّد.",
    });
  if (h.sec.mutable_path > 0)
    f.push({
      id: "search-path", sev: "low",
      title: `${h.sec.mutable_path} دوالّ بمسارِ بحثٍ متغيّر`,
      why: "دالّةٌ بلا search_path مثبَّت قد تُخدع بجدولٍ يُزرع في مسارِ المنادي.",
      fix: "set search_path = public, pg_temp على كلٍّ منها.",
    });
  if (h.perf.unused_indexes >= 50)
    f.push({
      id: "idx", sev: "low",
      title: `${h.perf.unused_indexes} فهرساً لم يُقرأ قطّ`,
      why: "كلُّ فهرسٍ ثمنُه في كلِّ كتابة. وعلى قاعدةٍ صغيرةٍ الأثرُ محتمَل، ومع النموّ يصير كلفةً.",
      fix: "لا يُحذف شيءٌ الآن: بعضُها لمسارٍ لم يُستعمل بعد. يُراجَع عند ألفِ مستخدم.",
    });
  return f;
}

export const SEV_AR: Record<Finding["sev"], string> = { high: "عالٍ", med: "متوسّط", low: "منخفض" };
