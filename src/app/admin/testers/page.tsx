import { notFound, redirect } from "next/navigation";
import { getAmAdmin } from "@/lib/data";
import {
  getAdminTesters,
  getAdminTestersDaily,
  getAdminAndroidCandidates,
  revealUserEmail,
  type AdminTesterRow,
} from "@/lib/admin";
import { adminTesterAdd, adminTesterRemove, adminTesterInvited } from "@/lib/adminTesters";
import { Avatar } from "@/components/Avatar";
import { buttonClass } from "@/components/ui/Button";
import { settingsCard } from "@/components/settings/SettingsGroup";
import { fieldClass, pillClass, type PillTone } from "@/components/admin/style";

/**
 * 🆕 **متابعةُ الاختبار المغلق** (D-909، طلبُ أحمد: «أتابع لوبز ١٠٠٪ —
 * الـ١٢ حساباً هل دخلوا، ومن يستخدم أندرويد الآن»).
 *
 * 🔑 **السؤالُ الذي لا تجيبه أيُّ لوحةٍ أخرى**: Play Console يعرف **من
 * دُعي**، والقاعدةُ تعرف **من دخل** — **ولا أحدَ يعرف الاثنين معاً.**
 * فهذه الصفحةُ ضمُّ قائمةِ الدعوة (`play_testers`، مُدخَلُ أحمد) على
 * `auth.users`. **ولا بريدَ يُعرض هنا إلا بريدٌ كتبه أحمد بنفسه**؛
 * بريدُ المرشَّح مقنَّعٌ حتّى يُكشف بفعلٍ يُسجَّل.
 *
 * ⚠️ **ولمَ يبدأ جدولُ المنصّات فارغاً؟** لأنّ الماضي لا يُستردّ:
 * `auth.sessions` وسمُها `node` في ٤٥ صفّاً من ٥٥ (مقيس ٥ سبتمبر) —
 * **خادمُنا هو من يجدّد الرمز فيدهس وسمَ المتصفّح**. فالعدّ يبدأ من
 * أوّل نبضةِ حضورٍ بعد الهجرة ١٨١، **وما نُقل هو ما نجا وحدَه.**
 *
 * 🆕 **D-917 — الصفحةُ صارت فحصاً يوميّاً** (طلبُ أحمد: «كل يوم أدخل
 * وأتأكد أنهم دخلوا وجلسوا وقتاً كافياً، وإذا فيه شخص ما دخل أو مقصّر
 * أراسله مباشرة»). فالترتيبُ **من يحتاج رسالةً أوّلاً**: من له حسابٌ ولم
 * يدخل اليوم، ثمّ من لا حسابَ له، ثمّ من دخل — **والأقلُّ دقائقَ أعلى.**
 * والعدّادُ الأعلى يجيب سؤالَ الأربعةَ عشرَ يوماً: **كم يوماً متّصلاً دخل
 * فيه الجميع؟** — واليومُ يومُ الرياض (`loopz_today`)، والدقائقُ تقديرٌ
 * من نبضات الحضور (ضربةٌ ≈ ٤ دقائق) **فتُكتب بـ«≈» ولا تدّعي ثانية.**
 *
 * عربيّةٌ ثابتةٌ كأخواتها في `/admin`: **صفحةُ مشغّلٍ لا مستخدمين.**
 */
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  not_admin: "لا صلاحية.",
  bad_email: "بريدٌ غير صالح — تأكّد من الشكل.",
};

const riyadh = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("ar-SA", {
        timeZone: "Asia/Riyadh",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

/** «منذ» بلا مكتبة — الصفحةُ تُقرأ بالنظرة لا بالتاريخ الكامل. */
function since(iso: string | null): string {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return "الآن";
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.round(h / 24);
  return `قبل ${d} يوم`;
}

async function addTester(formData: FormData) {
  "use server";
  try {
    await adminTesterAdd(String(formData.get("email") ?? ""), String(formData.get("note") ?? ""));
  } catch (e) {
    redirect(`/admin/testers?err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect("/admin/testers?ok=added");
}

async function removeTester(formData: FormData) {
  "use server";
  try {
    await adminTesterRemove(String(formData.get("email") ?? ""));
  } catch (e) {
    redirect(`/admin/testers?err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect("/admin/testers?ok=removed");
}

async function toggleInvited(formData: FormData) {
  "use server";
  try {
    await adminTesterInvited(String(formData.get("email") ?? ""), formData.get("on") === "1");
  } catch (e) {
    redirect(`/admin/testers?err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect("/admin/testers?ok=invited");
}

/** الكشفُ فعلٌ بنموذجٍ لا رابط: **الروابطُ تُسبَق تحميلاً**، والسجلُّ يمتلئ بلا سبب. */
async function revealCandidate(formData: FormData) {
  "use server";
  redirect(`/admin/testers?reveal=${encodeURIComponent(String(formData.get("user") ?? ""))}`);
}

/**
 * كم مختبِراً دخل خلال آخر ن يوماً — **والساعةُ تُقرأ هنا لا في جسم
 * المكوّن**: قارئُ الوقت في الرسم دالّةٌ غيرُ صافية يرفضها مصرّفُ React،
 * **والقاعدةُ صحيحةٌ حتّى على الخادم** (رسمتان بالثانية نفسِها تختلفان).
 */
function countActiveWithin(rows: AdminTesterRow[], days: number): number {
  const cut = Date.now() - days * 864e5;
  return rows.filter((t) => t.lastSignInAt && new Date(t.lastSignInAt).getTime() > cut).length;
}

/** حالةُ المختبِر **اليومَ** في كلمةٍ واحدة — **الترتيبُ من الأسوأ إلى الأفضل.** */
function testerState(t: AdminTesterRow): { label: string; tone: "bad" | "warn" | "ok" | "best" } {
  if (t.suspendedAt) return { label: "موقوف", tone: "bad" };
  if (!t.userId) return { label: "لا حساب بعد", tone: "warn" };
  if (!t.activeToday) return { label: t.streak > 0 ? "لم يدخل اليوم بعد" : "انقطع", tone: t.streak > 0 ? "warn" : "bad" };
  if (t.appToday) return { label: "اليوم من التطبيق", tone: "best" };
  return { label: "اليوم من الويب", tone: "ok" };
}

/**
 * **من يحتاج رسالةً أوّلاً**: صاحبُ حسابٍ لم يدخل اليوم (٠)، ثمّ من لا
 * حسابَ له (١)، ثمّ من دخل (٢) — **والأقلُّ دقائقَ يعلو**، فالمقصّرُ لا
 * يختبئ تحت النشيط.
 */
function attentionRank(t: AdminTesterRow): number {
  if (t.suspendedAt) return 3;
  if (t.userId && !t.activeToday) return 0;
  if (!t.userId) return 1;
  return 2;
}

/** الفرقُ بين «ما لدينا» و«ما تشترطه Google» يُقال رقماً لا شعوراً. */
const NEEDED = 12;

const TONE: Record<string, string> = {
  bad: "bg-error/15 text-error",
  warn: "bg-accent/15 text-accent",
  ok: "bg-surface-2 text-muted",
  best: "bg-success/15 text-success",
};
/* ٦٠١ — الشاراتُ بشارة الإدارة الواحدة (`pillClass`)؛ و`TONE` يبقى لخلفيّة لافتة العدّاد وحدها */
const PILL: Record<string, PillTone> = { bad: "bad", warn: "warn", ok: "mute", best: "ok" };

export default async function AdminTestersPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; reveal?: string }>;
}) {
  const admin = await getAmAdmin();
  if (!admin) notFound();

  const sp = await searchParams;
  const [rawTesters, daily, candidates, revealed] = await Promise.all([
    getAdminTesters(),
    getAdminTestersDaily(),
    getAdminAndroidCandidates(30),
    sp.reveal ? revealUserEmail(sp.reveal) : Promise.resolve(null),
  ]);
  const testers = [...rawTesters].sort(
    (a, b) => attentionRank(a) - attentionRank(b) || a.minutesToday - b.minutesToday || a.email.localeCompare(b.email),
  );

  const err = sp.err
    ? (Object.entries(ERRORS).find(([k]) => sp.err!.includes(k))?.[1] ?? sp.err)
    : null;

  const signedIn = testers.filter((t) => t.userId).length;
  const activeToday = testers.filter((t) => t.activeToday).length;
  const appToday = testers.filter((t) => t.appToday).length;
  const active7 = countActiveWithin(testers, 7);
  const needMessage = testers.filter((t) => attentionRank(t) === 0);
  const allStreak = daily?.all_streak ?? 0;
  const complete = signedIn >= NEEDED;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-22 font-bold">المختبِرون</h1>
          <p className="text-12 text-muted">
            قائمةُ دعوة Play مضمومةً على من دخل فعلاً
          </p>
        </div>
        <span
          className={pillClass(
            activeToday >= NEEDED ? "ok" : activeToday === signedIn && signedIn > 0 ? "mute" : "warn",
          )}
        >
          اليوم {activeToday} / {NEEDED}
        </span>
      </header>

      {err && <p className="text-14 text-[color:var(--error)]">⚠ {err}</p>}
      {sp.ok === "added" && <p className="text-14 text-[color:var(--success)]">✓ أُضيف إلى القائمة</p>}
      {sp.ok === "removed" && <p className="text-14 text-[color:var(--success)]">✓ حُذف من القائمة</p>}
      {sp.ok === "invited" && <p className="text-14 text-[color:var(--success)]">✓ حُدّثت حالةُ الدعوة</p>}

      {/* ——— ١) العدّادُ اليوميّ — يُقرأ في ثلاث ثوانٍ ——— */}
      <section className={`${settingsCard} p-4`}>
        <div
          className={`rounded-control px-4 py-3 ${
            complete && (daily?.all_today ?? false) ? TONE.best : complete ? TONE.ok : TONE.warn
          }`}
        >
          <p className="text-12 opacity-80">
            {complete ? "القائمةُ مكتملة" : `القائمةُ ناقصة: ${signedIn} من ${NEEDED} لهم حساب`}
            {" · "}
            {daily?.all_today ? "ودخل الجميعُ اليوم" : "ولم يدخل الجميعُ اليوم بعد"}
          </p>
          <p className="mt-1 text-22 font-bold tabular-nums">
            <span dir="ltr">{allStreak}</span> / 14 يوماً متّصلاً دخل فيها الجميع
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: "دخلوا اليوم", v: `${activeToday} / ${signedIn}` },
            { k: "من التطبيق اليوم", v: `${appToday}` },
            { k: "يحتاجون رسالة", v: `${needMessage.length}` },
            { k: "نشطون ٧ أيّام", v: `${active7}` },
          ].map((s) => (
            <div key={s.k} className="rounded-control bg-surface-2 px-3 py-2.5">
              <p className="text-12 text-muted">{s.k}</p>
              <p className="mt-0.5 text-20 font-bold tabular-nums" dir="ltr">{s.v}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-12 text-muted leading-relaxed">
          اليومُ بتوقيت الرياض. «من التطبيق» = نبضةٌ من تطبيق أندرويد لا من المتصفّح —{" "}
          <b>وهي وحدَها دليلُ التثبيت</b>. الدقائقُ تقديرٌ من نبضات الحضور (كلُّ نبضةٍ ≈ ٤
          دقائق). Google تشترط {NEEDED} مختبِراً منضمّاً ١٤ يوماً متّصلة، والعدّادُ الكبيرُ
          يعدّ الأيّامَ التي دخل فيها <b>كلُّ</b> من له حساب — فإن نقص واحدٌ يوماً عاد إلى الصفر.
          {" "}
          <a
            href="https://play.google.com/console/u/0/developers/6000185498301388341/email-lists/5630686807996412066/update-email-list"
            target="_blank"
            rel="noopener"
            className="underline"
          >
            قائمةُ البريد في Play Console
          </a>{" "}
          — كلُّ بريدٍ يُضاف هنا يُضاف هناك أيضاً.
        </p>
      </section>

      {needMessage.length > 0 && (
        <section className={`${settingsCard} p-4`}>
          <p className="text-14 font-bold">يحتاجون رسالةً الآن</p>
          <ul className="mt-2 space-y-1 text-13">
            {needMessage.map((t) => (
              <li key={t.email} className="flex flex-wrap items-center gap-2">
                <a href={`mailto:${t.email}`} className="underline" dir="ltr">{t.email}</a>
                <span className="text-muted">
                  {/* ٦٠١ — الاسمُ معزولٌ اتّجاهيّاً بلا قوسين: قوسان حول اسمٍ لاتينيٍّ في سطرٍ عربيّ ينقلبان */}
                  {t.nickname || t.username ? <bdi>{t.nickname || t.username}</bdi> : null}
                  {t.nickname || t.username ? " · " : ""}
                  {t.streak > 0 ? `كان على ${t.streak} يوماً متّصلاً` : `آخر ظهور ${since(t.lastSeenAt)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ——— ٢) إضافةٌ إلى القائمة ——— */}
      <form action={addTester} className={`${settingsCard} flex flex-wrap gap-2 p-4`}>
        <input
          type="email"
          name="email"
          required
          dir="ltr"
          placeholder="tester@gmail.com"
          aria-label="بريد المختبِر"
          className={`${fieldClass} min-w-[220px] flex-1`}
        />
        <input
          type="text"
          name="note"
          maxLength={120}
          placeholder="ملاحظة (اختياري)"
          aria-label="ملاحظة"
          className={`${fieldClass} min-w-[140px] flex-1`}
        />
        <button type="submit" className={buttonClass({ size: "sm" })}>أضِف</button>
      </form>

      {/* ——— ٣) الصفوف ——— */}
      {testers.length === 0 && (
        <p className="text-14 text-muted">
          القائمةُ فارغة — أضِف بريدات المختبِرين الذين دعوتَهم في Play Console.
        </p>
      )}

      {testers.map((t) => {
        const st = testerState(t);
        const name = t.nickname || t.username || null;
        return (
          <section key={t.email} className="rounded-card border border-border bg-surface p-4 space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-14 font-bold" dir="ltr">
                  <a href={`mailto:${t.email}`} className="hover:underline">{t.email}</a>
                </p>
                <p className="truncate text-12 text-muted">
                  {name ? `${name}${t.username ? ` · @${t.username}` : ""}` : "لا حساب بهذا البريد"}
                  {t.note ? ` · ${t.note}` : ""}
                </p>
              </div>
              <span className={pillClass(PILL[st.tone] ?? "mute")}>
                {st.label}
              </span>
            </div>

            {t.userId && (
              <div className="flex flex-wrap gap-1.5 text-12">
                <span className={pillClass(t.activeToday ? "ok" : "bad")}>
                  {t.activeToday ? `اليوم ✓ ≈ ${t.minutesToday} د` : "اليوم ✗"}
                </span>
                <span className={pillClass(t.streak >= 3 ? "ok" : t.streak > 0 ? "mute" : "bad")}>
                  متّصل {t.streak} يوم
                </span>
                <span className={pillClass("mute")}>
                  ١٤ يوماً: {t.days14} (من التطبيق {t.appDays14})
                </span>
                <span className={pillClass("mute")}>
                  ٧ أيّام ≈ {t.minutes7d} د
                </span>
              </div>
            )}

            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-13 text-muted">
              <div className="flex gap-1.5">
                <dt>آخر دخول:</dt>
                <dd>{since(t.lastSignInAt)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>آخر ظهور:</dt>
                <dd>{since(t.lastSeenAt)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>أيّام نشاطٍ (٣٠):</dt>
                <dd className="tabular-nums" dir="ltr">{t.activeDays30}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>المنصّات:</dt>
                <dd dir="ltr">{t.platforms ?? "—"}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>الدعوة:</dt>
                <dd>{t.invitedAt ? riyadh(t.invitedAt) : "لم تُرسَل"}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2 pt-1">
              <form action={toggleInvited}>
                <input type="hidden" name="email" value={t.email} />
                <input type="hidden" name="on" value={t.invitedAt ? "0" : "1"} />
                <button type="submit" className={buttonClass({ variant: "surface", size: "sm" })}>
                  {t.invitedAt ? "ألغِ علامة الدعوة" : "علّم: أُرسلت الدعوة"}
                </button>
              </form>
              <form action={removeTester}>
                <input type="hidden" name="email" value={t.email} />
                <button type="submit" className={buttonClass({ variant: "surface", size: "sm" })}>
                  احذف
                </button>
              </form>
            </div>
          </section>
        );
      })}

      {/* ——— ٤) مرشَّحو أندرويد ——— */}
      <section className="space-y-3 pt-2">
        <div>
          <h2 className="text-18 font-bold">مرشَّحون على أندرويد</h2>
          <p className="text-12 text-muted leading-relaxed">
            من فتح Loopz من متصفّح أندرويد في آخر ٣٠ يوماً وليس بريدُه في القائمة —
            <b> أقربُ الناس إلى قبول دعوةِ اختبار</b>. البريدُ مقنَّعٌ حتّى تكشفه،
            <b> وكلُّ كشفٍ يُكتب في سجلّ الإدارة.</b>
          </p>
        </div>

        {candidates.length === 0 ? (
          <p className="text-14 text-muted">
            لا مرشَّحين بعد — العدُّ يبدأ من أوّل نبضةِ حضورٍ بعد تشغيل الهجرة ١٨١.
          </p>
        ) : (
          candidates.map((c) => {
            const name = c.nickname || c.username || "مستخدم";
            const shown = sp.reveal === c.userId ? revealed : null;
            return (
              <section key={c.userId} className="rounded-card border border-border bg-surface p-4 space-y-2.5">
                <div className="flex items-center gap-3">
                  <Avatar src={c.avatarUrl} name={name} size={40} alt="" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-14 font-bold">{name}</p>
                    <p className="truncate text-12 text-muted" dir="ltr">
                      {shown ?? c.emailMasked ?? c.userId.slice(0, 8)}
                    </p>
                  </div>
                  <span className={pillClass("warn")}>
                    {since(c.seenAt)}
                  </span>
                </div>

                <dl className="flex flex-wrap gap-x-4 gap-y-1 text-13 text-muted">
                  <div className="flex gap-1.5">
                    <dt>انضمّ:</dt>
                    <dd dir="ltr">{c.createdAt?.slice(0, 10) ?? "—"}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>أيّام نشاطٍ (٣٠):</dt>
                    <dd className="tabular-nums" dir="ltr">{c.activeDays30}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>حلقاتٌ سُجّلت:</dt>
                    <dd className="tabular-nums" dir="ltr">{c.watched}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2 pt-1">
                  {shown ? (
                    <form action={addTester}>
                      <input type="hidden" name="email" value={shown} />
                      <input type="hidden" name="note" value={name} />
                      <button type="submit" className={buttonClass({ size: "sm" })}>
                        أضِفه إلى قائمة الدعوة
                      </button>
                    </form>
                  ) : (
                    <form action={revealCandidate}>
                      <input type="hidden" name="user" value={c.userId} />
                      <button type="submit" className={buttonClass({ variant: "surface", size: "sm" })}>
                        اكشف البريد
                      </button>
                    </form>
                  )}
                </div>
              </section>
            );
          })
        )}
      </section>
    </div>
  );
}
