"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateProfile } from "@/lib/actions";
import type { ProfilePrefs } from "@/lib/profilePrefs";
import { getDict, type Locale } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import { Avatar } from "../Avatar";
import { Icon } from "../Icon";
import { SOCIALS, cleanHandle, type Socials } from "@/lib/socials";
import { Alert } from "../ui/Alert";
import { SettingsPageLayout } from "./SettingsPageLayout";
import { SettingsRow } from "./SettingsRow";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

/** حدُّ النبذة في هذه الشاشة (مواصفةُ أحمد) — والقاعدةُ تقبل ١٦٠ */
const BIO_MAX = 120;

type Snapshot = {
  nickname: string;
  username: string;
  bio: string;
  /**
   * 🆕 **اللقب** (D-561) — **يسكن `profile_prefs` لا عموداً خاصّاً به**
   * (انظر `profilePrefs.ts`)، **ويُحرَّر هنا** لأن مكانَه بين الاسم
   * والنبذة: **ثلاثتُها ما يقرؤه زائرُك عن هويّتك**، **وحقلٌ يعيش في
   * شاشةٍ ثانيةٍ لأن عمودَه في مكانٍ آخر تسريبُ تنظيمِ القاعدة إلى
   * الواجهة.**
   *
   * ⚠️ **واختياريٌّ في النوع** (D-028): **النموذجُ في `settings`
   * والصفحةُ في `app/profile/edit` — دليلان فكوميتان.**
   */
  title?: string;
  /**
   * 🆕 **روابطُ التواصل** (D-546) — **داخل اللقطة لا خارجها**: زرُّ
   * الحفظ يستيقظ بتغيّرها كما يستيقظ بتغيّر الاسم، **وحوارُ «تعديلاتٌ
   * لم تُحفظ» يحرسها** — **وحقلٌ خارج اللقطة يُفقد بلا إنذار.**
   *
   * ⚠️ **واختياريّةٌ في النوع** (D-028): **النموذجُ في `settings`
   * والصفحةُ في `app/profile/edit` — دليلان فكوميتان**، **والكوميتُ
   * الأوّل تقرؤه الصفحةُ القديمةُ التي لا تمرّرها.**
   */
  socials?: Socials;
  avatarUrl: string | null;
  coverUrl: string | null;
  coverPos: number;
  avatarPos: number;
};

/**
 * تعديلُ الملفّ — **صفحةٌ واحدةٌ لهويّتك وحدَها** (D-462، مواصفةُ أحمد).
 *
 * **وكانت الهويّةُ موزّعةً على نموذجين**: الصورةُ والاسمُ المستعار في
 * `ProfileForm`، **واسمُ المستخدم في `AccountSettings`** — **ونموذجان
 * يكتبان صفَّ `profiles` نفسَه لا يجوز أن يظهرا معاً**: حفظُ أحدهما
 * يكتب قيمَ الآخر الابتدائيّة فوق تعديلٍ لم يُحفظ. **فصار الكاتبُ
 * واحداً هنا**، وذهب الثيمُ والأنواعُ وبلدُ المشاهدة إلى صفحاتِ
 * التفضيلات، والبريدُ إلى «الحساب».
 *
 * ⚠️ **و«حفظ» في الترويسة لا تحت كلِّ بطاقة**: أربعةُ حقولٍ وصورتان
 * بزرِّ حفظٍ واحدٍ **يُرى دائماً ولا يُمرَّر إليه** — **ولا يستيقظ إلّا
 * حين يوجد ما يُحفظ** (`dirty`)، **فزرٌّ حيٌّ بلا تغييرٍ يَعِد بفعلٍ لا
 * يقع** (D-217).
 *
 * ⚠️ **والصورتان معاينةٌ واحدةٌ لا بطاقتان**: الغلافُ والصورةُ يظهران
 * للناس متراكبين — **وضبطُهما في صندوقين متباعدين يجعل النتيجةَ تُخمَّن
 * لا تُرى.**
 */
export function EditProfileForm({
  userId,
  email,
  locale,
  isPrivate,
  genres,
  prefs,
  initial,
}: {
  userId: string;
  email: string;
  locale: Locale;
  /** لعرضِ حالةِ الظهور — تُضبط في «الخصوصية»، وتُقرأ هنا فقط */
  isPrivate: boolean;
  /** تمرُّ كما هي: `updateProfile` يطلب الأنواعَ في كلِّ نداء */
  genres: number[];
  /**
   * 🆕 **سجلُّ تخصيص الملفّ كاملاً** (D-561) — **يُقرأ ليُعاد كتابتُه.**
   *
   * **و`updateProfile` تستبدل العمودَ كلَّه** (`sanitizeProfilePrefs`
   * على ما وصل)، **فحفظُ اللقب وحدَه كان سيمحو الترتيبَ والكثافةَ
   * وجمهورَ الزيارات** — **وهو عطلُ النموذجين نفسُه** (D-462): **حقلٌ
   * لا يعرضه نموذجٌ لا يجوز أن يمحوَه.** **فالسجلُّ يمرّ كاملاً ويعود
   * كاملاً بحرفٍ واحدٍ مبدَّل.**
   */
  prefs?: ProfilePrefs;
  initial: Snapshot;
}) {
  const t = getDict(locale);
  const router = useRouter();

  const [base, setBase] = useState<Snapshot>(initial);
  const [nickname, setNickname] = useState(initial.nickname);
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [title, setTitle] = useState(initial.title ?? "");
  const [socials, setSocials] = useState<Socials>(initial.socials ?? {});
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl);
  const [coverPos, setCoverPos] = useState(initial.coverPos);
  const [avatarPos, setAvatarPos] = useState(initial.avatarPos);

  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ask, setAsk] = useState(false);
  const [pending, start] = useTransition();

  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const cleaned = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  const usernameInvalid = cleaned.length > 0 && cleaned.length < 3;

  const dirty =
    nickname !== base.nickname ||
    username !== base.username ||
    bio !== base.bio ||
    title !== (base.title ?? "") ||
    avatarUrl !== base.avatarUrl ||
    coverUrl !== base.coverUrl ||
    coverPos !== base.coverPos ||
    avatarPos !== base.avatarPos ||
    /* **مقارنةٌ بالقيمة لا بالمرجع** — الكائنُ يُعاد بناؤه مع كلِّ حرف */
    SOCIALS.some((sp) => (socials[sp.key] ?? "") !== (base.socials?.[sp.key] ?? ""));

  /* ===== الرفع ===== منقولٌ بحرفه من `ProfileForm`: نفسُ المخزن ونفسُ
     الحدّ (٢ ميجابايت) ونفسُ حذفِ السابق — **وملفٌّ قديمٌ يبقى في المخزن
     مع كلِّ تغييرٍ يملأ السعةَ بصورٍ لا يراها أحد.** */
  function storagePathOf(url: string | null, uid: string): string | null {
    if (!url) return null;
    const marker = "/storage/v1/object/public/avatars/";
    const at = url.indexOf(marker);
    if (at < 0) return null;
    const path = decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
    return path.startsWith(`${uid}/`) ? path : null;
  }

  async function upload(file: File, kind: "avatar" | "cover") {
    setError(null);
    if (!file.type.startsWith("image/")) return setError(t.errPickImage);
    if (file.size > 2 * 1024 * 1024) return setError(t.errTooLarge);

    setUploading(kind);
    try {
      const supabase = await createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      if (kind === "avatar") setAvatarUrl(data.publicUrl);
      else setCoverUrl(data.publicUrl);

      const previous = kind === "avatar" ? avatarUrl : coverUrl;
      const oldPath = storagePathOf(previous, userId);
      if (oldPath && oldPath !== path) {
        await supabase.storage.from("avatars").remove([oldPath]);
      }
    } catch (e) {
      setError(t.errUpload + (e as Error).message);
    } finally {
      setUploading(null);
    }
  }

  /* ===== السحبُ لضبط التموضع ===== المحورُ الرأسيُّ وحدَه: الغلافُ يملأ
     العرضَ دائماً، **وشكوى الصورة الدائرية وجهٌ مقصوصٌ من أعلى أو أسفل.** */
  const drag = useRef<{ kind: "avatar" | "cover"; startY: number; startPos: number; h: number } | null>(
    null,
  );

  function dragStart(e: React.PointerEvent, kind: "avatar" | "cover") {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    drag.current = {
      kind,
      startY: e.clientY,
      startPos: kind === "cover" ? coverPos : avatarPos,
      h: el.clientHeight || 1,
    };
  }

  function dragMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const delta = ((e.clientY - d.startY) / d.h) * 100;
    const next = Math.round(Math.min(100, Math.max(0, d.startPos - delta)));
    if (d.kind === "cover") setCoverPos(next);
    else setAvatarPos(next);
  }

  function dragEnd() {
    drag.current = null;
  }

  function save() {
    setError(null);
    if (usernameInvalid) return setError(t.usernameShort);
    const next: Snapshot = { nickname, username, bio, title, avatarUrl, coverUrl, coverPos, avatarPos, socials };
    start(async () => {
      try {
        await updateProfile({
          nickname,
          username: cleaned,
          bio,
          /* **السجلُّ كاملاً بحرفٍ واحدٍ مبدَّل** — **وغيابُه يعني
             «اتركه كما هو»**، فالصفحةُ القديمةُ التي لا تمرّره لا
             تمحو شيئاً (D-028). */
          ...(prefs ? { profilePrefs: { ...prefs, title } } : {}),
          avatarUrl,
          coverUrl,
          coverPos,
          avatarPos,
          favoriteGenres: genres,
          /* **يُرسل خاماً ويُنقّى في الفعل** (D-177): الواجهةُ تُعين
             وتُنبّه، **والكاتبُ هو الحارس** — ومن لصق رابطاً كاملاً
             يُقشَّر هناك لا هنا. */
          socials: SOCIALS.reduce<Record<string, string>>((acc, sp) => {
            acc[sp.key] = socials[sp.key] ?? "";
            return acc;
          }, {}),
        });
        /* **الخطُّ الأساسُ يتقدّم بعد النجاح وحدَه**: لو تقدّم قبله لأطفأ
           زرَّ الحفظ على تعديلٍ لم يصل — **وأسوأُ من فشلٍ ظاهرٍ فشلٌ
           يبدو نجاحاً.** */
        setBase(next);
        setToast(true);
        window.setTimeout(() => setToast(false), 2400);
        router.refresh();
      } catch (e) {
        setError(t.errSave + (e as Error).message);
      }
    });
  }

  function leave() {
    setAsk(false);
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/profile/settings");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${SITE_URL}/u/${cleaned}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* لا رسالةَ خطأ لنسخةٍ فاشلة: الرابطُ ظاهرٌ في السطر فيُحدَّد يدوياً */
    }
  }

  return (
    <SettingsPageLayout
      title={t.setEditProfile}
      onBack={() => {
        if (dirty) {
          setAsk(true);
          return false;
        }
      }}
      action={
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending || uploading !== null}
          className="h-11 px-2 -me-2 text-14 font-bold text-accent disabled:text-[color:var(--disabled)] transition active:scale-95 disabled:active:scale-100"
        >
          {pending ? t.saving : t.setSave}
        </button>
      }
    >
      {/* ===== المعاينةُ المدمجة ===== */}
      {/* ===== بطاقةُ الهويّة — الصورةُ وحقولُها معاً ===== */}
      {/* 🆕 **بطاقةٌ واحدةٌ لا بطاقتان** (D-641، بلاغُ أحمد بلقطة: «الترتيب
          سيّئ، المفروض البايو بعد الاسم وتكون في كارد واحد مع الصورة»).
          **الصورةُ والاسمُ واللقبُ والمعرّفُ والنبذةُ شيءٌ واحد: هويّتُك**
          — **وبطاقتان تفصلان وجهَك عن اسمك تجعلانهما موضوعين.**
          **وهي `SettingsSection boxed` بروحها** (D-555): كتلةُ محتوًى
          مختلطٍ لا قائمةُ صفوف. */}
      <section>
        <h2 className="px-1 mb-2 text-12 font-semibold uppercase tracking-wide text-muted">
          {t.setProfileDetails}
        </h2>
        <div className="rounded-2xl border border-border bg-surface divide-y divide-[color:var(--divider)] overflow-hidden">
        {/* ⚠️ **وكتلةُ الصورة ابنٌ واحدٌ للبطاقة لا ثلاثة**: `divide-y`
            تفصل بين كلِّ ابنَين، **فغلافٌ وصورةٌ وتلميحٌ عراةً كانوا
            سيكتسبون خطَّين لا يفصلان معنًى.** */}
        <div>
        <div
          className={`relative h-32 sm:h-40 bg-surface-2 ${
            coverUrl ? "cursor-grab active:cursor-grabbing touch-none select-none" : ""
          }`}
          role={coverUrl ? "slider" : undefined}
          aria-label={coverUrl ? t.repositionAria : undefined}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={coverUrl ? coverPos : undefined}
          onPointerDown={coverUrl ? (e) => dragStart(e, "cover") : undefined}
          onPointerMove={coverUrl ? dragMove : undefined}
          onPointerUp={dragEnd}
          onPointerCancel={dragEnd}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              draggable={false}
              className="w-full h-full object-cover pointer-events-none"
              style={{ objectPosition: `50% ${coverPos}%` }}
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-14 text-muted">
              {t.noCover}
            </span>
          )}

          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f, "cover");
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={uploading !== null}
            onClick={() => coverRef.current?.click()}
            aria-label={t.setEditCover}
            title={t.setEditCover}
            className="absolute top-2 end-2 grid place-items-center w-9 h-9 rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/70 active:scale-95 transition disabled:opacity-60"
          >
            <Icon name={uploading === "cover" ? "hourglass" : "image"} size={16} />
          </button>
          {coverUrl && (
            <button
              type="button"
              onClick={() => setCoverUrl(null)}
              aria-label={t.removeCover}
              title={t.removeCover}
              className="absolute top-2 end-12 grid place-items-center w-9 h-9 rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/70 active:scale-95 transition"
            >
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>

        <div className="px-4 pb-3.5 flex items-end gap-3 -mt-9">
          <span
            className={`relative shrink-0 ${
              avatarUrl ? "cursor-grab active:cursor-grabbing touch-none select-none" : ""
            }`}
            role={avatarUrl ? "slider" : undefined}
            aria-label={avatarUrl ? t.repositionAria : undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={avatarUrl ? avatarPos : undefined}
            onPointerDown={avatarUrl ? (e) => dragStart(e, "avatar") : undefined}
            onPointerMove={avatarUrl ? dragMove : undefined}
            onPointerUp={dragEnd}
            onPointerCancel={dragEnd}
          >
            <Avatar
              src={avatarUrl}
              name={nickname || email}
              size={76}
              alt={t.avatarAlt}
              posY={avatarPos}
              className="pointer-events-none ring-4 ring-[color:var(--surface)]"
            />
            <input
              ref={avatarRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f, "avatar");
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading !== null}
              onClick={() => avatarRef.current?.click()}
              aria-label={t.setEditAvatar}
              title={t.setEditAvatar}
              className="absolute bottom-0 end-0 grid place-items-center w-8 h-8 rounded-full bg-accent text-[color:var(--on-accent)] ring-2 ring-[color:var(--surface)] active:scale-95 transition disabled:opacity-60"
            >
              <Icon name={uploading === "avatar" ? "hourglass" : "image"} size={14} />
            </button>
          </span>

          <span className="flex-1 min-w-0 flex justify-end pb-1">
            {cleaned.length >= 3 && (
              <Link
                href={`/u/${cleaned}`}
                className="rounded-2xl border border-border px-3.5 h-9 inline-flex items-center text-12 font-semibold hover:border-accent/50 active:scale-95 transition"
              >
                {t.setPreviewProfile}
              </Link>
            )}
          </span>
        </div>

        {/* **السطرُ يُكتب حين يمكن السحبُ فقط** — **وتلميحٌ فوق صندوقٍ
            فارغٍ يشرح فعلاً لا يقع** (D-044) */}
        {(coverUrl || avatarUrl) && (
          <p className="px-4 pb-3.5 text-12 text-muted leading-relaxed">{t.repositionHint}</p>
        )}
        </div>
          {/* الاسمُ الظاهر — **واحدٌ لا اثنان**: كان «الاسم المستعار» في
              نموذجٍ و«الاسم الظاهر» في آخر لعمود `nickname` نفسِه
              (مواصفةُ أحمد: احذف المكرَّر). */}
          <div className="px-4 py-3.5">
            <label className="block text-12 font-semibold text-muted mb-1.5" htmlFor="ep-name">
              {t.displayNameSection}
            </label>
            <input
              id="ep-name"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={40}
              placeholder={t.displayNamePlaceholder}
              /* ١٦ بكسلاً استثناءٌ موثَّق: أصغرُ منها يجعل سفاري يقرّب الصفحة عند التركيز */
              className="w-full bg-transparent text-[16px] outline-none placeholder:text-[color:var(--disabled)]"
            />
          </div>

          {/* 🆕 **اللقب** (D-561، تصميمُ أحمد: «Story lover» تحت الصورة).

              **وموضعُه بين الاسم والمعرّف قصداً**: **هو الاسمُ الثاني
              لا الحقلُ الخامس** — **وترتيبُ الحقول هنا هو ترتيبُ
              قراءتها في الملفّ** (اسمٌ ثم لقبٌ ثم معرّفٌ ثم نبذة).
              **وأربعةٌ وعشرون حرفاً** لأنه يجلس في سطرٍ فيه عدّادان. */}
          <div className="px-4 py-3.5">
            <label className="block text-12 font-semibold text-muted mb-1.5" htmlFor="ep-title">
              {t.profileTitleLabel}
            </label>
            <input
              id="ep-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={24}
              placeholder={t.profileTitlePlaceholder}
              disabled={!prefs}
              /* ١٦ بكسلاً استثناءٌ موثَّق: أصغرُ منها يجعل سفاري يقرّب الصفحة عند التركيز */
              className="w-full bg-transparent text-[16px] outline-none placeholder:text-[color:var(--disabled)] disabled:opacity-50"
            />
            <p className="text-12 text-muted mt-1.5 leading-relaxed">{t.profileTitleHint}</p>
          </div>

          <div className="px-4 py-3.5">
            <label className="block text-12 font-semibold text-muted mb-1.5" htmlFor="ep-user">
              {t.usernameSection}
            </label>
            <div className="flex items-center gap-1" dir="ltr">
              <span className="text-[16px] text-muted">@</span>
              <input
                id="ep-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={24}
                placeholder="ahmed_92"
                dir="ltr"
                className="flex-1 min-w-0 bg-transparent text-[16px] outline-none text-left placeholder:text-[color:var(--disabled)]"
              />
            </div>
            {cleaned !== username.trim().toLowerCase() && username.trim() !== "" && (
              <p className="text-12 text-muted mt-1.5" dir="ltr">
                {t.willSaveAs(cleaned || "—")}
              </p>
            )}
          </div>

          <div className="px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <label className="text-12 font-semibold text-muted" htmlFor="ep-bio">
                {t.bioSection}
              </label>
              {/* **العدّادُ يُقرأ عدّاً لا تحذيراً** حتى الحرف الأخير */}
              <span
                className={`text-12 tabular-nums ${
                  bio.length >= BIO_MAX ? "text-[color:var(--error)]" : "text-muted"
                }`}
                dir="ltr"
              >
                {t.setBioCount(String(bio.length), String(BIO_MAX))}
              </span>
            </div>
            <textarea
              id="ep-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
              maxLength={BIO_MAX}
              rows={2}
              placeholder={t.bioPlaceholder}
              className="w-full bg-transparent text-[16px] leading-relaxed outline-none resize-none placeholder:text-[color:var(--disabled)]"
            />
          </div>

          {/* رابطُ الملفّ — **يُعرض حين يوجد اسمُ مستخدمٍ صالحٌ فقط**:
              **رابطٌ يُنسخ ولا يُفتح أسوأُ من غيابه** (D-217) */}
          {cleaned.length >= 3 && (
            <SettingsRow
              icon="share"
              title={t.setProfileLink}
              subtitle={`${SITE_URL.replace(/^https?:\/\//, "")}/u/${cleaned}`}
              trailing={
                <button
                  type="button"
                  onClick={copyLink}
                  className="shrink-0 rounded-2xl border border-border px-3 h-8 inline-flex items-center gap-1.5 text-12 font-semibold hover:border-accent/50 active:scale-95 transition"
                >
                  <Icon name={copied ? "check" : "bookmark"} size={13} />
                  {copied ? t.setCopied : t.setCopyLink}
                </button>
              }
            />
          )}

          {/* **الظهورُ يُعرض هنا ويُضبط هناك**: مفتاحان لقيمةٍ واحدةٍ في
              صفحتين يجعلان الحفظَين يتسابقان (القاعدة ٦) */}
          <SettingsRow
            href="/profile/settings/privacy"
            icon="eye"
            title={t.setProfileVisibility}
            value={isPrivate ? t.setVisibilityPrivate : t.setVisibilityPublic}
          />
        </div>
      </section>

      {/* ===== حساباتُ التواصل — مجموعةٌ مستقلّة ===== */}
      {/* 🆕 ⚖️ **خرجت من بطاقة الهويّة** (D-641، بحكمه). **وموضعُها في
          D-546 كان «بعد المعرّف مباشرةً» بحجّةٍ صحيحة** (هي معرّفاتُك في
          أماكنَ أخرى) — **لكنّ تنفيذَها دَسَّ أربعةَ حقولٍ بين المعرّف
          والنبذة فكسر ترتيباً كان الملفُّ نفسُه ينصّ عليه**: «اسمٌ ثمّ
          لقبٌ ثمّ معرّفٌ ثمّ نبذة».
          🔑 **والقرابةُ لا تعني المجاورة**: المعرّفاتُ الخارجيّةُ قريبةٌ
          من معرّفك معنًى، **وبُعدُها عنه سطراً واحداً لا يقطع تلك
          القرابة** — **بينما دَسُّها في منتصف الهويّة يقطع تسلسلَ
          قراءتها.** **فمجموعةٌ بعنوانها أصدقُ من جوارٍ يزاحم.** */}
      <section>
        <h2 className="px-1 mb-2 text-12 font-semibold uppercase tracking-wide text-muted">
          {t.setSocialAccounts}
        </h2>
        <div className="rounded-2xl border border-border bg-surface divide-y divide-[color:var(--divider)] overflow-hidden">
          {/* ===== 🆕 حساباتُ التواصل (D-546) =====

              **طلبُ أحمد: «تحت كتابة النِّك نيم أماكنُ مخصّصةٌ لكتابة
              حساب تويتر وسناب شات وإنستقرام وفيسبوك».** **وموضعُها
              بعد المعرّف مباشرةً** — **هي معرّفاتُك في أماكنَ أخرى**،
              فتسكن مع معرّفك هنا لا مع النبذة ولا في صفحةٍ ثالثة.

              **وصفٌّ لكلِّ منصّةٍ بنفس شكلِ صفِّ المعرّف** (اسمُ المنصّة
              مكانَ العنوان، و`@` بادئةً ثابتة) — **ولا عائلةَ حقولٍ
              ثانية** (القاعدة ٣). **وسقفُ الحروف سقفُ المنصّة نفسِها**
              فلا يُكتب ما لا يقبله موقعُها.

              ⚠️ **ولا أيقوناتِ علاماتٍ تجاريّة هنا**: مجموعةُ الأيقونات
              واحدةٌ في التطبيق (القاعدة ٣) **وليست فيها شعاراتُ منصّات**
              — **وإضافةُ أربعةِ شعاراتٍ لأجل نموذجٍ مكتوبِ التسميات
              عائلةٌ ثانيةٌ بلا مكسب.** **ومكانُها صفُّ الملفّ حين يصل
              تصميمُه.**

              ⚠️ **و`dir="ltr"` على الحقل**: المعرّفاتُ لاتينيّةٌ دائماً،
              **وحقلٌ يتبع اتّجاهَ الصفحة يقفز فيه المؤشّرُ عند أوّل
              حرف** (وهو نفسُ سببِ `dir="ltr"` في حقل المعرّف أعلاه). ===== */}
          {SOCIALS.map((sp) => {
            const value = socials[sp.key] ?? "";
            /* **تنبيهٌ لا منع**: الحقلُ يقبل ما يُكتب، **ويقول إن كان
               لا يصلح** — **ومنعُ الكتابة حرفاً بحرفٍ يمنع اللصق نفسَه**
               (رابطٌ ملصوقٌ يمرّ بحالاتٍ غير صالحةٍ قبل أن يكتمل). */
            const bad = value.trim() !== "" && cleanHandle(sp.key, value) === null;
            return (
              <div key={sp.key} className="px-4 py-3.5">
                <label
                  className="block text-12 font-semibold text-muted mb-1.5"
                  htmlFor={`ep-social-${sp.key}`}
                >
                  {sp.label}
                </label>
                <div className="flex items-center gap-1" dir="ltr">
                  <span className="text-[16px] text-muted">@</span>
                  <input
                    id={`ep-social-${sp.key}`}
                    value={value}
                    onChange={(e) =>
                      setSocials((prev) => ({ ...prev, [sp.key]: e.target.value }))
                    }
                    maxLength={120}
                    placeholder={sp.placeholder}
                    dir="ltr"
                    inputMode="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="flex-1 min-w-0 bg-transparent text-[16px] outline-none text-left placeholder:text-[color:var(--disabled)]"
                  />
                </div>
                {bad ? (
                  <p className="text-12 text-[color:var(--error)] mt-1.5" dir="ltr">
                    {t.socialInvalid}
                  </p>
                ) : (
                  /* **ما سيُحفظ فعلاً، حين يختلف عمّا كُتب** — نفسُ
                     وصفةِ `willSaveAs` في حقل المعرّف: **من لصق رابطاً
                     يرى المعرّفَ الذي استُخرج منه قبل أن يحفظ.** */
                  value.trim() !== "" &&
                  cleanHandle(sp.key, value) !== value.trim() && (
                    <p className="text-12 text-muted mt-1.5" dir="ltr">
                      {t.willSaveAs(cleanHandle(sp.key, value) ?? "—")}
                    </p>
                  )
                )}
              </div>
            );
          })}
        </div>
      </section>

      {error && <Alert>{error}</Alert>}

      {/* **بشارةُ الحفظ تمرّ ولا تُقيم**: سطرٌ ثابتٌ «حُفظ» يبقى صادقاً
          بعد تعديلٍ جديدٍ فيكذب (D-030) */}
      {toast && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center pointer-events-none px-4"
        >
          <span className="rounded-2xl bg-[color:var(--surface-inverse)] text-[color:var(--on-surface-inverse)] px-4 py-2.5 text-14 font-semibold shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
            {t.setSaved}
          </span>
        </div>
      )}

      <UnsavedChangesDialog
        open={ask}
        title={t.setUnsavedTitle}
        body={t.setUnsavedBody}
        discardLabel={t.setDiscard}
        keepLabel={t.setKeepEditing}
        closeLabel={t.setKeepEditing}
        onDiscard={leave}
        onKeep={() => setAsk(false)}
      />
    </SettingsPageLayout>
  );
}
