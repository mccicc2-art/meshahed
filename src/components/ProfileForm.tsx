"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateProfile } from "@/lib/actions";
import { GENRES, genreName } from "@/lib/media";
import { THEMES, themeName } from "@/lib/themes";
import { getDict, type Locale } from "@/lib/i18n";
import { Avatar } from "./Avatar";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";
import { chipClass } from "./ui/controls";

export type ProfileSection = "cover" | "avatar" | "theme" | "nickname" | "bio" | "genres";

export function ProfileForm({
  userId,
  email,
  locale,
  initialNickname,
  initialBio,
  initialAvatarUrl,
  initialCoverUrl,
  initialCoverPos,
  initialAvatarPos,
  initialTheme,
  initialGenres,
  only,
}: {
  userId: string;
  email: string;
  locale: Locale;
  initialNickname: string;
  /** النبذة الحالية — فارغةٌ قبل تشغيل profile_bio.sql */
  initialBio?: string | null;
  initialAvatarUrl: string | null;
  initialCoverUrl: string | null;
  /** التموضع الرأسي المحفوظ للصورتين (٠–١٠٠) */
  initialCoverPos: number;
  initialAvatarPos: number;
  initialTheme: string;
  initialGenres: number[];
  /** الأقسام المعروضة — الحذف يعني عرض الجميع */
  only?: ProfileSection[];
}) {
  const t = getDict(locale);
  const show = (k: ProfileSection) => !only || only.includes(k);
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [bio, setBio] = useState(initialBio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [coverUrl, setCoverUrl] = useState<string | null>(initialCoverUrl);
  const [coverPos, setCoverPos] = useState(initialCoverPos);
  const [avatarPos, setAvatarPos] = useState(initialAvatarPos);
  const [theme, setTheme] = useState(initialTheme);
  const [genres, setGenres] = useState<number[]>(initialGenres);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  /** يستخرج مسار الملف داخل المخزن من رابطه العام، ويرفض ما لا يخصّ هذا المستخدم */
  function storagePathOf(url: string | null, uid: string): string | null {
    if (!url) return null;
    const marker = "/storage/v1/object/public/avatars/";
    const at = url.indexOf(marker);
    if (at < 0) return null;
    const path = decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
    return path.startsWith(`${uid}/`) ? path : null;
  }

  /* ===== إعادة تموضع الصورة بالسحب =====
     سحبٌ مباشر على المعاينة لا مؤشّرٌ منزلق: تحريك الصورة نفسها هو
     الفعل الذي يقصده المستخدم، ولا يضيف عائلة تحكّمٍ ثالثة للنظام.
     المحور الرأسي وحده: الغلاف يملأ العرض دائماً فلا معنى للأفقي،
     والدائرة الشخصية شكواها المتكرّرة وجهٌ مقصوص من أعلى أو أسفل.
     والحساب نسبةٌ من ارتفاع المعاينة: سحبُ كامل الارتفاع يقطع المدى
     كله (٠–١٠٠)، فيبقى الإحساس واحداً مهما اختلف حجم الإطار. */
  const drag = useRef<{
    kind: "avatar" | "cover";
    startY: number;
    startPos: number;
    h: number;
  } | null>(null);

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
    /* سحب الصورة للأسفل يكشف أعلاها — أي يُنقص النسبة — فالإشارة سالبة:
       هكذا تتبع الصورة الإصبعَ لا عكسه */
    const delta = ((e.clientY - d.startY) / d.h) * 100;
    const next = Math.round(Math.min(100, Math.max(0, d.startPos - delta)));
    if (d.kind === "cover") setCoverPos(next);
    else setAvatarPos(next);
    setSaved(false);
  }

  function dragEnd() {
    drag.current = null;
  }

  function toggleGenre(id: number) {
    setSaved(false);
    setGenres((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  async function upload(file: File, kind: "avatar" | "cover") {
    setError(null);
    setSaved(false);

    if (!file.type.startsWith("image/")) {
      setError(t.errPickImage);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(t.errTooLarge);
      return;
    }

    setUploading(kind);
    try {
      // العميل يُجلب عند أول رفعٍ لا مع الصفحة — انظر supabase/client.ts
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

      // احذف الملف السابق — كل تغيير كان يترك نسخة في المخزن للأبد
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

  function save() {
    setError(null);
    start(async () => {
      try {
        await updateProfile({
          nickname,
          bio,
          avatarUrl,
          coverUrl,
          coverPos,
          avatarPos,
          theme,
          favoriteGenres: genres,
        });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(t.errSave + (e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* صورة الغلاف (الهيدر) */}
      {show("cover") && (
  <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
          <h2 className="text-sm font-bold mb-1">{t.coverSection}</h2>
          <p className="text-xs text-muted leading-relaxed mb-3">{t.coverHint}</p>

          <div
            className={`relative h-32 sm:h-40 rounded-xl overflow-hidden border border-border bg-surface-2 ${
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
              <div className="w-full h-full grid place-items-center text-sm text-muted">
                {t.noCover}
              </div>
            )}
          </div>
          {coverUrl && (
            <p className="text-[11px] text-muted mt-1.5">{t.repositionHint}</p>
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
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              disabled={uploading !== null}
              onClick={() => coverRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-surface-2 border border-border text-sm hover:border-accent transition disabled:opacity-60"
            >
              {uploading === "cover" ? t.uploading : t.changeCover}
            </button>
            {coverUrl && (
              <button
                type="button"
                onClick={() => {
                  setCoverUrl(null);
                  setSaved(false);
                }}
                className="px-4 py-2 rounded-xl border border-border text-sm text-muted hover:text-red-300 hover:border-red-400/60 transition"
              >
                {t.removeCover}
              </button>
            )}
          </div>
        </section>
        )}

      {/* الصورة الشخصية */}
      {show("avatar") && (
  <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
          <h2 className="font-bold mb-4">{t.avatarSection}</h2>
          <div className="flex items-center gap-4 flex-wrap">
            {/* دائرةٌ أكبر من دوائر العرض قليلاً: هي هنا سطحُ ضبطٍ يُسحب
                بالإبهام لا صورةً تُرى فحسب */}
            <span
              className={
                avatarUrl
                  ? "inline-block cursor-grab active:cursor-grabbing touch-none select-none"
                  : "inline-block"
              }
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
                size={72}
                alt={t.avatarAlt}
                posY={avatarPos}
                className="pointer-events-none"
              />
            </span>
            <div className="flex flex-wrap gap-2">
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
                className="px-4 py-2 rounded-xl bg-surface-2 border border-border text-sm hover:border-accent transition disabled:opacity-60"
              >
                {uploading === "avatar" ? t.uploading : t.changePhoto}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarUrl(null);
                    setSaved(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-border text-sm text-muted hover:text-red-300 hover:border-red-400/60 transition"
                >
                  {t.remove}
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted mt-3">
            {t.imageHint}
            {avatarUrl ? ` ${t.repositionHint}` : ""}
          </p>
        </section>
        )}

      {/* ثيم الواجهة */}
      {show("theme") && (
  <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
          <h2 className="text-sm font-bold mb-1">{t.themeSection}</h2>
          <p className="text-xs text-muted leading-relaxed mb-3">{t.themeHint}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {THEMES.map((th) => {
              const on = th.id === theme;
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => {
                    setTheme(th.id);
                    setSaved(false);
                  }}
                  aria-pressed={on}
                  className={`rounded-xl border overflow-hidden text-start transition ${
                    on ? "border-accent ring-2 ring-accent/40" : "border-border hover:border-accent/50"
                  }`}
                >
                  <span
                    className="block h-10 w-full"
                    style={{
                      background: `linear-gradient(120deg, ${th.vars.accent} 0%, ${th.vars.accent} 38%, ${th.vars["accent-2"]} 38%, ${th.vars["accent-2"]} 62%, ${th.vars.surface} 62%, ${th.vars.background} 100%)`,
                    }}
                  />
                  <span className="flex items-center justify-between gap-2 px-3 py-2 text-xs bg-surface-2">
                    <span className="truncate">{themeName(th, locale)}</span>
                    {on && <span className="text-accent">✓</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        )}

      {/* الاسم المستعار */}
      {show("nickname") && (
  <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
          <h2 className="font-bold mb-4">{t.nicknameSection}</h2>
          <input
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setSaved(false);
            }}
            maxLength={40}
            placeholder={t.nicknamePlaceholder}
            className="w-full rounded-xl bg-surface-2 border border-border px-3 py-2.5 text-sm outline-none focus:border-accent transition"
          />
          {/* النبذة تحت الاسم لا في قسمٍ خاص: الاسم والنبذة هويةٌ واحدة،
              وقسمٌ مستقلٌّ لسطرٍ واحد يضاعف عدد البطاقات بلا معنى */}
          <label htmlFor="profile-bio" className="block text-xs font-bold text-muted mt-4 mb-1.5">
            {t.bioSection}
          </label>
          <textarea
            id="profile-bio"
            value={bio}
            onChange={(e) => {
              setBio(e.target.value.slice(0, 160));
              setSaved(false);
            }}
            maxLength={160}
            rows={2}
            placeholder={t.bioPlaceholder}
            /* ١٦ بكسلاً (D-033): سفاري iOS يكبّر الصفحة عند التركيز على حقلٍ
               أصغر، ولا يعود عن التكبير */
            className="w-full resize-none rounded-xl bg-surface-2 border border-border px-3 py-2.5 text-base outline-none focus:border-accent transition"
          />
          <div className="flex items-center justify-between gap-3 mt-1.5">
            <p className="text-xs text-muted">{t.bioHint}</p>
            {/* العدّاد يظهر عند الاقتراب من الحدّ فقط: رقمٌ دائمٌ تحت حقلٍ
                يكتب فيه المرء سطراً واحداً ضجيجٌ لا إرشاد */}
            {bio.length >= 130 && (
              <span className="text-[11px] text-muted tabular-nums shrink-0" dir="ltr">
                {bio.length}/160
              </span>
            )}
          </div>

          <p className="text-xs text-muted mt-3" dir="ltr">
            {email}
          </p>
        </section>
        )}

      {/* الأنواع المفضلة */}
      {show("genres") && (
  <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
          <h2 className="text-sm font-bold mb-1">{t.favoriteContent}</h2>
          <p className="text-xs text-muted leading-relaxed mb-3">{t.favoriteHint}</p>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => {
              const on = genres.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleGenre(g.id)}
                  className={chipClass(on)}
                >
                  {genreName(g, locale)}
                </button>
              );
            })}
          </div>
          {genres.length > 0 && <p className="text-xs text-muted mt-4">{t.selectedN(genres.length)}</p>}
        </section>
        )}

      {error && (
        <Alert>{error}</Alert>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending || uploading !== null}
          className={buttonClass()}
        >
          {pending ? t.saving : t.saveChanges}
        </button>
        {saved && (
          <span role="status" className="text-sm text-[color:var(--success)]">
            {t.savedOk}
          </span>
        )}
      </div>
    </div>
  );
}
