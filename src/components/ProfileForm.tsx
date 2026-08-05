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

export type ProfileSection = "cover" | "avatar" | "theme" | "nickname" | "genres";

export function ProfileForm({
  userId,
  email,
  locale,
  initialNickname,
  initialAvatarUrl,
  initialCoverUrl,
  initialTheme,
  initialGenres,
  only,
}: {
  userId: string;
  email: string;
  locale: Locale;
  initialNickname: string;
  initialAvatarUrl: string | null;
  initialCoverUrl: string | null;
  initialTheme: string;
  initialGenres: number[];
  /** الأقسام المعروضة — الحذف يعني عرض الجميع */
  only?: ProfileSection[];
}) {
  const t = getDict(locale);
  const show = (k: ProfileSection) => !only || only.includes(k);
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [coverUrl, setCoverUrl] = useState<string | null>(initialCoverUrl);
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
      const supabase = createClient();
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
          avatarUrl,
          coverUrl,
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

          <div className="relative h-32 sm:h-40 rounded-xl overflow-hidden border border-border bg-surface-2">
            {coverUrl ? (
              <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-sm text-muted">
                {t.noCover}
              </div>
            )}
          </div>

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
            <Avatar src={avatarUrl} name={nickname || email} size={72} alt={t.avatarAlt} />
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
          <p className="text-xs text-muted mt-3">{t.imageHint}</p>
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
          <p className="text-xs text-muted mt-2" dir="ltr">
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
