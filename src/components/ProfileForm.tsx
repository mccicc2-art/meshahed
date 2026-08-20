"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions";
import { GENRES, genreName } from "@/lib/media";
import { THEMES, themeName } from "@/lib/themes";
import { getDict, type Locale } from "@/lib/i18n";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";
import { chipClass } from "./ui/controls";

/** **قسمان لا ستّة** (D-462): الهويّةُ انتقلت إلى `EditProfileForm` */
export type ProfileSection = "theme" | "genres";

export function ProfileForm({
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
  /* ⚠️ **يُقبلان ولا يُقرآن — لعمرِ ترقيةٍ واحدة** (D-028): الصفحاتُ
     ترسلهما اليوم، **ونزعُ العضوِ من النوع قبل أن يكفَّ المرسِلُ عن
     إرساله يكسر العمليّةَ الوسيطة.** يُحذفان في الرفعة التالية. */
  locale: Locale;
  /** ⚠️ **مقبولٌ ولا يُقرأ — لعمرِ رفعةٍ واحدة** (D-028): مستدعيه في `src/app` يسقط في الرفعة التالية، ثم يُنزع. */
  userId?: string;
  email?: string;
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
  const [theme, setTheme] = useState(initialTheme);
  const [genres, setGenres] = useState<number[]>(initialGenres);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  function toggleGenre(id: number) {
    setSaved(false);
    setGenres((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  function save() {
    setError(null);
    start(async () => {
      try {
        await updateProfile({
          /* ⚠️ **تُمرَّر كما جاءت لا كما تُعدَّل**: `updateProfile` يكتب
             `nickname` و`avatar_url` في **كل** نداء — **فحذفُها من هنا
             يمحو الاسمَ والصورةَ عند تبديل ثيم.** تحريرُها بابُه
             `EditProfileForm` وحدَه (D-462). */
          nickname: initialNickname,
          bio: initialBio ?? "",
          avatarUrl: initialAvatarUrl,
          coverUrl: initialCoverUrl,
          coverPos: initialCoverPos,
          avatarPos: initialAvatarPos,
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
          disabled={pending}
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
