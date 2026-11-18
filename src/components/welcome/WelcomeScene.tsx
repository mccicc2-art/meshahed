"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { Dict, Locale } from "@/core/i18n";
import { GENRES, backdropUrl, posterUrl } from "@/core/media";
import type { InviterLite } from "@/core/contracts/referral";
import type { WelcomeSeason, WelcomeSeasonsPayload, WelcomeUpTo } from "@/core/contracts/welcome";
import { peoplePosters } from "@/lib/welcomeActions";
import { v1Get } from "../InboxComposer";
import { AccountBadges } from "../AccountIdentity";
import { Avatar } from "../Avatar";
import { Icon } from "../Icon";
import { Logo, LogoWordmark } from "../Logo";
import { RailScroll } from "../RailScroll";
import { buttonClass } from "../ui/Button";
import { chipClass } from "../ui/controls";
import type { SeedTitle, Suggested, Progress } from "../Onboarding";
import { WelcomeInvite } from "./WelcomeInvite";
import { sceneWords, type SceneWords } from "./sceneWords";
import type { SceneEpisode, SceneEpisodesPayload } from "./sceneTypes";

/**
 * ====== 🆕 T414 — «المشهد»: الترحيبُ على الحاسوب العريض (التصميم «ج»، أحمد ١٨ نوفمبر: «ابغى شيء مميز للمتصفح») ======
 *
 * خلفيّةُ العمل تملأ الشاشة وعنوانٌ كبيرٌ ولوحةٌ زجاجيّة — في الخطوات الخمس:
 *  ١ **بطاقةُ العضوية** تُطبع حيّةً مع كلِّ حرف، والدعوةُ ختمٌ عليها · ٢ **صفوفُ منصّة بثّ**: المرورُ على عملٍ يضعه على الشاشة ·
 *  ٣ **شريطُ حلقاتٍ بالصور** يُضغط («السحب سيء» — بدلُ المؤشّر المسحوب) · ٤ **الأنواعُ الاثنا عشر بمشاهدها** كاملةً بلا قصّ ·
 *  ٥ **بطاقاتٌ واقفة** عليها ما يشاهده كلُّ شخص.
 *
 * 🔑 **وجهٌ ثانٍ للمكوّن نفسِه لا ترحيبٌ ثانٍ**: الحالةُ والحفظُ والقفلُ كلُّها في `Onboarding` — هنا رسمٌ وحده، يقرأ ما يقرؤه
 * وجهُ الجوال ويكتب بالدوالّ نفسِها. فلا تختلف قاعدةٌ بين الوجهين (اسمٌ إجباريّ · عملٌ واحدٌ على الأقلّ · «تخطّي» يتخطّى).
 * 🔑 **يظهر ≥1280 خارج غلاف التطبيق وحدَه** (`.lz-wscene` في `globals.css`) — ما دونه وجهُ الجوال كما هو بلا تغيير.
 * 🔑 **جزيرةُ حبرٍ داكن** (`data-ink="dark"`): الخلفيّةُ صورةٌ تحت حجابٍ أسود في كلِّ ثيم — في «النهاري» تلبس اللوحةَ الرسميّة
 * فلا يقع نصٌّ أسودُ على مشهدٍ مظلم.
 */
export interface SceneProps {
  locale: Locale;
  t: Dict;
  nameOnly: boolean;
  step: number;
  go: (step: number) => void;
  error: string | null;
  pending: boolean;
  uploading: boolean;
  email: string | null;
  joinedAt: string | null;
  name: string;
  setName: (v: string) => void;
  handle: string;
  setHandle: (v: string) => void;
  cleanHandle: string;
  userLine: { text: string; tone: "ok" | "bad" | "muted" };
  userInvalid: boolean;
  photo: string | null;
  pickPhoto: () => void;
  seeds: SeedTitle[];
  picked: Set<number>;
  toggle: (id: number) => void;
  progress: Record<number, Progress>;
  upTo: Record<number, WelcomeUpTo>;
  setTitle: (id: number, progress: Progress, upTo: WelcomeUpTo | null) => void;
  genres: number[];
  toggleGenre: (id: number) => void;
  genreArt: Record<number, string>;
  people: Suggested[];
  peopleLoaded: boolean;
  toFollow: Set<string>;
  toggleFollow: (id: string) => void;
  primaryLabel: string;
  primaryDisabled: boolean;
  onPrimary: () => void;
  onSkip: (() => void) | null;
}

const ME = 1;
const PICK = 2;
const PROGRESS = 3;
const TASTE = 4;
const PEOPLE = 5;

export function WelcomeScene(p: SceneProps) {
  const w = sceneWords(p.locale);
  const chosen = useMemo(() => p.seeds.filter((s) => p.picked.has(s.id)), [p.seeds, p.picked]);
  const [focusId, setFocusId] = useState<number | null>(p.seeds[0]?.id ?? null);
  const [cur, setCur] = useState(0);
  const [stamp, setStamp] = useState<InviterLite | null>(null);
  const at = Math.min(cur, Math.max(0, chosen.length - 1));
  const focus = p.seeds.find((s) => s.id === focusId) ?? p.seeds[0] ?? null;
  const current = chosen[at] ?? null;

  /* خلفيّةُ كلِّ خطوة: عملٌ رائجٌ للأولى · ما تحت المؤشّر · العملُ الذي يُسأل عنه · آخرُ نوعٍ اختير · أوّلُ ما اختاره */
  const lastGenre = [...p.genres].reverse().find((g) => p.genreArt[g]);
  const art =
    p.step === ME
      ? (p.seeds.find((s) => s.backdropPath)?.backdropPath ?? null)
      : p.step === PICK
        ? (focus?.backdropPath ?? null)
        : p.step === PROGRESS
          ? (current?.backdropPath ?? null)
          : p.step === TASTE
            ? (lastGenre ? p.genreArt[lastGenre] : (Object.values(p.genreArt)[0] ?? null))
            : (chosen.find((s) => s.backdropPath)?.backdropPath ?? null);

  return (
    <div
      data-ink="dark"
      className="lz-wscene fixed inset-0 z-[80] flex-col overflow-hidden bg-[#050505] text-white"
      aria-label={p.t.obStep(p.step, 5)}
    >
      <Backdrop path={art} heavy={p.step === ME || p.step === TASTE || p.step === PEOPLE} />
      <div className="relative flex-1 min-h-0 flex flex-col px-14 pt-8 pb-7">
        <header className="flex items-center justify-between gap-6">
          <Logo size={42} on="art" />
          {p.nameOnly ? <span /> : <Timeline step={p.step} w={w} go={p.go} busy={p.pending} />}
          {p.email ? (
            <form action="/auth/signout" method="post" className="flex items-center gap-1.5 text-12 text-white/60">
              <span dir="ltr" className="max-w-56 truncate">
                {p.email}
              </span>
              <span aria-hidden>·</span>
              <button type="submit" className="font-bold text-accent hover:underline">
                {p.t.accountNoticeSwitch}
              </button>
            </form>
          ) : (
            <span />
          )}
        </header>

        {p.step === ME && <StepMe p={p} w={w} stamp={stamp} onStamp={setStamp} />}
        {p.step === PICK && <StepPick p={p} w={w} focus={focus} setFocusId={setFocusId} />}
        {p.step === PROGRESS && current && <StepProgress p={p} w={w} chosen={chosen} at={at} setCur={setCur} />}
        {p.step === TASTE && <StepTaste p={p} w={w} />}
        {p.step === PEOPLE && <StepPeople p={p} w={w} stamp={stamp} />}

        {p.error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-[color:var(--error)]">
            {p.error}
          </p>
        )}
        <Footer p={p} w={w} chosen={chosen} at={at} setCur={setCur} />
      </div>
    </div>
  );
}

/* ───────── الخلفيّة: صورةٌ تملأ الشاشة تحت حجابين — والمفتاحُ مسارُها فتتلاشى الجديدةُ فوق السابقة ───────── */
function Backdrop({ path, heavy }: { path: string | null; heavy: boolean }) {
  const url = backdropUrl(path, "w1280");
  return (
    <div className="absolute inset-0" aria-hidden>
      {url && (
        <Image
          key={url}
          src={url}
          alt=""
          fill
          priority
          sizes="100vw"
          className="lz-wfade object-cover"
        />
      )}
      <div
        className={`absolute inset-0 ${
          heavy
            ? "bg-[linear-gradient(to_top,#050505_22%,rgba(5,5,5,.78)_58%,rgba(5,5,5,.55))]"
            : "bg-[linear-gradient(to_top,#050505_12%,rgba(5,5,5,.6)_48%,rgba(5,5,5,.32))]"
        }`}
      />
      <div className="absolute inset-0 ltr:bg-linear-to-r rtl:bg-linear-to-l from-[rgba(5,5,5,.88)] via-transparent to-transparent" />
    </div>
  );
}

/* ───────── خطُّ الخطوات: الماضيةُ تُضغط للرجوع، والقادمةُ لا — القفلُ قفلُ الخطوة لا الشريط ───────── */
function Timeline({ step, w, go, busy }: { step: number; w: SceneWords; go: (n: number) => void; busy: boolean }) {
  return (
    <ol className="flex items-start">
      {w.steps.map((label, i) => {
        const k = i + 1;
        const done = k < step;
        const on = k === step;
        return (
          <li key={k} className="flex items-start">
            <button
              type="button"
              disabled={!done || busy}
              onClick={() => go(k)}
              aria-current={on ? "step" : undefined}
              className="flex flex-col items-center gap-1.5 w-[74px] disabled:cursor-default"
            >
              <span
                className={`w-[30px] h-[30px] rounded-full grid place-items-center text-12 font-bold transition ${
                  on
                    ? "bg-accent text-[color:var(--on-accent)] shadow-[0_0_0_6px_rgba(255,212,0,.18)]"
                    : done
                      ? "bg-accent/25 text-accent"
                      : "bg-white/10 text-white/60"
                }`}
              >
                {done ? <Icon name="check-line" size={14} strokeWidth={2.6} /> : k}
              </span>
              <span className={`text-12 ${on ? "font-bold text-white" : "text-white/55"}`}>{label}</span>
            </button>
            {k < 5 && <span aria-hidden className={`w-12 h-0.5 mt-[15px] rounded ${k < step ? "bg-accent" : "bg-white/15"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function Head({ kicker, title, hint, big = false }: { kicker: string; title: string; hint?: string; big?: boolean }) {
  return (
    <div>
      <p className="text-[13px] font-bold text-accent">{kicker}</p>
      <h1
        className={`font-extrabold leading-[1.06] mt-2 ${
          big ? "text-[clamp(40px,4vw,62px)]" : "text-[clamp(34px,3.3vw,50px)]"
        }`}
      >
        {title}
      </h1>
      {hint && <p className="text-[clamp(14px,1.15vw,17px)] text-white/80 mt-2 max-w-[640px] leading-relaxed">{hint}</p>}
    </div>
  );
}

/* ───────── ١ — بطاقةُ العضوية ───────── */
function StepMe({
  p,
  w,
  stamp,
  onStamp,
}: {
  p: SceneProps;
  w: SceneWords;
  stamp: InviterLite | null;
  onStamp: (who: InviterLite | null) => void;
}) {
  const field =
    "mt-1.5 h-[54px] rounded-[14px] border bg-black/55 px-[18px] flex items-center gap-1 focus-within:border-accent transition";
  return (
    <div className="flex-1 min-h-0 flex items-center gap-[clamp(32px,4vw,64px)] py-6">
      <div className="w-[min(470px,42%)] shrink-0">
        <Head
          kicker={p.nameOnly ? p.t.usernameSection : p.t.obStep(1, 5)}
          title={w.cardTitle}
          hint={p.nameOnly ? p.t.obNameOnlyHint : w.cardHint}
        />
        <div className="flex items-center gap-3.5 mt-6">
          <Avatar src={p.photo} name={p.name || p.cleanHandle} size={56} alt={p.t.avatarAlt} />
          <button
            type="button"
            disabled={p.uploading}
            onClick={p.pickPhoto}
            className={buttonClass({ variant: "surface", size: "md" })}
          >
            <Icon name={p.uploading ? "hourglass" : "edit"} size={16} />
            {w.changePhoto}
          </button>
        </div>
        <label className="block mt-5 text-[13px] text-white/70" htmlFor="ws-name">
          {p.t.displayNameSection}
        </label>
        <div className={`${field} border-white/15`}>
          <input
            id="ws-name"
            value={p.name}
            onChange={(e) => p.setName(e.target.value)}
            maxLength={40}
            placeholder={p.t.displayNamePlaceholder}
            className="flex-1 min-w-0 bg-transparent text-[17px] outline-none placeholder:text-white/35"
          />
        </div>
        <label className="block mt-4 text-[13px] text-white/70" htmlFor="ws-user">
          {p.t.usernameSection}
        </label>
        <div
          dir="ltr"
          className={`${field} ${
            p.userLine.tone === "ok" ? "border-[color:var(--success)]" : p.userLine.tone === "bad" ? "border-[color:var(--error)]" : "border-white/15"
          }`}
        >
          <span className="text-[17px] font-extrabold text-accent">@</span>
          <input
            id="ws-user"
            value={p.handle}
            onChange={(e) => p.setHandle(e.target.value)}
            maxLength={24}
            placeholder="username"
            dir="ltr"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={p.userInvalid}
            aria-describedby="ws-user-state"
            className="flex-1 min-w-0 bg-transparent text-[17px] font-medium outline-none text-left placeholder:text-white/35"
          />
          {p.userLine.tone === "ok" && <Icon name="check-line" size={18} strokeWidth={2.4} className="text-[color:var(--success)]" />}
        </div>
        <p
          id="ws-user-state"
          aria-live="polite"
          className={`text-12 mt-1.5 ${
            p.userLine.tone === "ok"
              ? "text-[color:var(--success)] font-bold"
              : p.userLine.tone === "bad"
                ? "text-[color:var(--error)]"
                : "text-white/55"
          }`}
        >
          {p.userLine.text}
        </p>
        {!p.nameOnly && (
          <div className="mt-4">
            <WelcomeInvite t={p.t} w={w} onStamp={onStamp} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 grid place-items-center">
        <MemberCard p={p} w={w} stamp={stamp} />
      </div>
    </div>
  );
}

function MemberCard({ p, w, stamp }: { p: SceneProps; w: SceneWords; stamp: InviterLite | null }) {
  const since = p.joinedAt
    ? new Date(p.joinedAt).toLocaleDateString(p.locale === "en" ? "en-US" : "ar-SA-u-nu-latn-ca-gregory", {
        month: "long",
        year: "numeric",
      })
    : null;
  return (
    <div className="w-[clamp(440px,42vw,640px)]">
      <div
        className="relative aspect-[1.62] rounded-[30px] overflow-hidden border border-accent/50 bg-[linear-gradient(135deg,#1d1d1d,#090909_70%)] shadow-[0_50px_100px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.14)] [transform:perspective(1400px)_rotateY(var(--tilt))_rotateX(5deg)] rtl:[--tilt:-9deg] ltr:[--tilt:9deg]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(90%_80%_at_0%_0%,rgba(255,212,0,.28),transparent_55%),linear-gradient(115deg,transparent_40%,rgba(255,255,255,.10)_48%,transparent_56%)]" />
        <span aria-hidden className="absolute -bottom-[30%] ltr:-right-[14%] rtl:-left-[14%] opacity-[0.07]">
          <Logo size={420} on="art" />
        </span>
        <div className="relative h-full flex flex-col p-[clamp(22px,2.4vw,34px)]">
          <div className="flex items-center justify-between">
            <LogoWordmark size={26} on="art" />
            <span className="text-[11px] font-extrabold tracking-[3px] text-accent border border-accent/50 rounded-full px-3 py-1">
              {w.member}
            </span>
          </div>
          <div className="flex items-center gap-[clamp(14px,1.6vw,24px)] mt-auto">
            <Avatar
              src={p.photo}
              name={p.name || p.cleanHandle}
              size={120}
              alt={p.t.avatarAlt}
              boxClass="w-[clamp(84px,8vw,120px)] h-[clamp(84px,8vw,120px)] text-3xl"
              className="ring-4 ring-accent shadow-[0_10px_30px_rgba(0,0,0,.6)]"
            />
            <div className="min-w-0">
              <p className="font-extrabold text-[clamp(30px,3.2vw,48px)] leading-tight truncate">{p.name || "—"}</p>
              <p dir="ltr" className="text-[clamp(16px,1.4vw,20px)] font-semibold text-accent mt-1 truncate text-start">
                @{p.cleanHandle || "username"}
              </p>
            </div>
          </div>
          <div className="flex items-end justify-between mt-auto">
            {since ? (
              <span>
                <span className="block text-12 text-white/55">{w.since}</span>
                <b className="block text-[17px]">{since}</b>
              </span>
            ) : (
              <span />
            )}
            {stamp && (
              <span className="rotate-[-9deg] border-[2.5px] border-accent text-accent rounded-xl px-4 py-2 text-center leading-tight shadow-[inset_0_0_0_3px_rgba(255,212,0,.15)]">
                <span className="block text-[12.5px] font-extrabold">{w.invitedBy}</span>
                <span className="block text-[19px] font-extrabold truncate max-w-40" dir="auto">
                  {stamp.name ?? (stamp.username ? `@${stamp.username}` : "")}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
      <div aria-hidden className="w-4/5 h-10 mx-auto mt-6 bg-[radial-gradient(50%_50%_at_50%_50%,rgba(0,0,0,.8),transparent)] blur-md" />
    </div>
  );
}

/* ───────── ٢ — صفوفُ منصّة البثّ ───────── */
function StepPick({
  p,
  w,
  focus,
  setFocusId,
}: {
  p: SceneProps;
  w: SceneWords;
  focus: SeedTitle | null;
  setFocusId: (id: number) => void;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = term ? p.seeds.filter((s) => s.title.toLowerCase().includes(term)) : p.seeds;
  const shelves = (["show", "movie", "anime"] as const)
    .map((k) => ({ k, items: shown.filter((s) => (s.shelf ?? (s.mediaType === "movie" ? "movie" : "show")) === k) }))
    .filter((r) => r.items.length > 0);
  const on = focus ? p.picked.has(focus.id) : false;
  const meta = focus
    ? [focus.year, focus.mediaType === "tv" && focus.seasons ? w.seasons(focus.seasons) : null, (focus.genres ?? []).join("، ")]
        .filter(Boolean)
        .join(" · ")
    : "";
  return (
    <>
      <div className="flex items-end justify-between gap-8 mt-[clamp(16px,3vh,44px)]">
        <div className="min-w-0">
          <Head kicker={`${p.t.obStep(2, 5)} · ${w.pickKicker}`} title={focus?.title ?? p.t.obPickTitle} />
          <p className="text-[clamp(14px,1.15vw,17px)] text-white/80 mt-2">{meta || w.pickHint}</p>
          {focus && (
            <button
              type="button"
              onClick={() => p.toggle(focus.id)}
              aria-pressed={on}
              className={buttonClass({ variant: on ? "surface" : "primary", size: "lg", className: "mt-4" })}
            >
              <Icon name={on ? "check-line" : "plus"} size={18} strokeWidth={2.2} />
              {on ? w.added : w.watched}
            </button>
          )}
        </div>
        <label className="w-[min(360px,30%)] shrink-0 h-12 rounded-[14px] border border-white/15 bg-black/55 px-4 flex items-center gap-2.5 focus-within:border-accent">
          <Icon name="search" size={18} className="text-white/55" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={w.findHere}
            aria-label={w.findHere}
            className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-white/40"
          />
        </label>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-14 ps-14 mt-5 [mask-image:linear-gradient(to_bottom,#000_86%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shelves.length === 0 && <p className="text-white/60 py-10">{w.noMatch}</p>}
        {shelves.map(({ k, items }) => (
          <section key={k} className="mb-4">
            <h2 className="text-[17px] font-bold mb-2">{w.shelves[k]}</h2>
            <RailScroll prevLabel={w.prevRail} nextLabel={w.nextRail}>
              {items.map((s) => {
                const sel = p.picked.has(s.id);
                const url = posterUrl(s.posterPath, "w342");
                return (
                  <button
                    key={`${s.mediaType}-${s.id}`}
                    type="button"
                    onClick={() => p.toggle(s.id)}
                    onMouseEnter={() => setFocusId(s.id)}
                    onFocus={() => setFocusId(s.id)}
                    aria-pressed={sel}
                    aria-label={s.title}
                    className={`relative snap-start shrink-0 w-[clamp(140px,11.6vw,196px)] aspect-[2/3] my-2.5 rounded-xl overflow-hidden bg-white/5 transition ${
                      sel ? "ring-[3px] ring-accent ring-offset-[3px] ring-offset-[#050505]" : ""
                    } ${focus?.id === s.id ? "shadow-[0_18px_44px_rgba(0,0,0,.75)] brightness-110" : "brightness-90 hover:brightness-100"}`}
                  >
                    {url ? (
                      <Image src={url} alt="" fill sizes="196px" className="object-cover" />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center p-3 text-center text-sm font-semibold">{s.title}</span>
                    )}
                    {sel && (
                      <span className="absolute top-2 start-2 w-7 h-7 rounded-full bg-accent text-[color:var(--on-accent)] grid place-items-center">
                        <Icon name="check-line" size={15} strokeWidth={2.6} />
                      </span>
                    )}
                  </button>
                );
              })}
            </RailScroll>
          </section>
        ))}
      </div>
    </>
  );
}

/* ───────── ٣ — أين وصلت: شريطُ الحلقات ───────── */
function StepProgress({
  p,
  w,
  chosen,
  at,
  setCur,
}: {
  p: SceneProps;
  w: SceneWords;
  chosen: SeedTitle[];
  at: number;
  setCur: (n: number) => void;
}) {
  const item = chosen[at];
  const state = p.progress[item.id];
  return (
    <>
      <div className="flex-1 min-h-0" />
      <Head
        kicker={`${p.t.obStep(3, 5)} · ${p.t.obProgressTitle}`}
        title={item.title}
        hint={item.mediaType === "tv" ? w.progressHint : w.movieHint}
        big
      />
      <div className="mt-5 rounded-3xl border border-white/10 bg-[rgba(12,12,12,.62)] backdrop-blur-xl p-5">
        {item.mediaType === "tv" ? (
          <EpisodeStrip key={item.id} p={p} w={w} item={item} />
        ) : (
          <div className="flex gap-3">
            {(
              [
                ["none", p.t.obNotStarted],
                ["done", p.t.obFinished],
              ] as [Progress, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={state === k}
                onClick={() => p.setTitle(item.id, k, null)}
                className={chipClass(state === k, "md", "!h-12 !px-7 !text-[15px]")}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-3 mt-4">
        {chosen.map((s, i) => {
          const pr = p.progress[s.id];
          const up = p.upTo[s.id];
          const line = !pr ? w.notSet : pr === "some" && up ? w.at(up.season, up.episode) : pr === "some" ? p.t.obSomeOf : pr === "done" ? p.t.obFinished : p.t.obNotStarted;
          const url = posterUrl(s.posterPath, "w185");
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setCur(i)}
              aria-current={i === at ? "true" : undefined}
              className={`flex items-center gap-3 rounded-[14px] py-2 ps-2 pe-4 border transition ${
                i === at ? "bg-accent/15 border-accent/60" : "bg-white/5 border-white/10 hover:border-white/25"
              }`}
            >
              <span className="relative w-11 h-[66px] rounded-lg overflow-hidden bg-white/10 shrink-0">
                {url && <Image src={url} alt="" fill sizes="44px" className="object-cover" />}
              </span>
              <span className="text-start">
                <span className="block text-[15px] font-bold max-w-44 truncate">{s.title}</span>
                <span className="block text-[13px] text-white/60 mt-0.5">{line}</span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function EpisodeStrip({ p, w, item }: { p: SceneProps; w: SceneWords; item: SeedTitle }) {
  const up = p.upTo[item.id];
  const state = p.progress[item.id];
  const [seasons, setSeasons] = useState<WelcomeSeason[] | null>(null);
  const [season, setSeason] = useState<number | null>(up?.season ?? null);
  const [eps, setEps] = useState<Record<number, SceneEpisode[] | null>>({});

  useEffect(() => {
    let live = true;
    v1Get<WelcomeSeasonsPayload>(`/api/v1/welcome/seasons?id=${item.id}`).then((r) => {
      if (live) setSeasons(r?.seasons ?? []);
    });
    return () => {
      live = false;
    };
  }, [item.id]);

  const sel = season ?? seasons?.[0]?.season ?? null;
  const list = sel != null ? eps[sel] : undefined;
  useEffect(() => {
    if (sel == null || list !== undefined) return;
    let live = true;
    v1Get<SceneEpisodesPayload>(`/api/v1/welcome/episodes?id=${item.id}&season=${sel}`).then((r) => {
      if (live) setEps((m) => ({ ...m, [sel]: r?.episodes ?? [] }));
    });
    return () => {
      live = false;
    };
  }, [item.id, sel, list]);

  const seen = (s: number, e: number) =>
    state === "done" || (state === "some" && !!up && (s < up.season || (s === up.season && e <= up.episode)));

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {(seasons ?? []).map((s) => (
            <button
              key={s.season}
              type="button"
              aria-pressed={sel === s.season}
              onClick={() => setSeason(s.season)}
              className={chipClass(sel === s.season, "md", "!h-10 !px-4 gap-1.5")}
            >
              {p.t.seasonLabel(s.season)}
              {seen(s.season, s.first + s.count - 1) && sel !== s.season && (
                <span aria-hidden className="w-2 h-2 rounded-full bg-accent" />
              )}
            </button>
          ))}
          {seasons === null && <span className="h-10 w-72 rounded-full bg-white/10 animate-pulse" />}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            aria-pressed={state === "none"}
            onClick={() => p.setTitle(item.id, "none", null)}
            className={chipClass(state === "none", "md", "!h-10")}
          >
            {p.t.obNotStarted}
          </button>
          <button
            type="button"
            aria-pressed={state === "done"}
            onClick={() => p.setTitle(item.id, "done", null)}
            className={chipClass(state === "done", "md", "!h-10")}
          >
            {p.t.obFinished}
          </button>
        </div>
      </div>
      <div className="mt-4 -mx-1">
        {list === undefined || list === null ? (
          <div className="flex gap-4 px-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="w-[clamp(200px,17vw,250px)] aspect-[16/12] rounded-xl bg-white/10 animate-pulse shrink-0" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="text-white/60 py-8 text-center">{w.noEpisodes}</p>
        ) : (
          <RailScroll prevLabel={w.prevEps} nextLabel={w.nextEps}>
            {list.map((e) => {
              const last = state === "some" && up?.season === sel && up.episode === e.episode;
              const was = sel != null && seen(sel, e.episode);
              const still = backdropUrl(e.still, "w500");
              return (
                <button
                  key={e.episode}
                  type="button"
                  onClick={() => sel != null && p.setTitle(item.id, "some", { season: sel, episode: e.episode })}
                  aria-pressed={last}
                  className={`snap-start shrink-0 w-[clamp(200px,17vw,250px)] my-2.5 rounded-xl overflow-hidden bg-[#111] border text-start transition ${
                    last
                      ? "border-accent ring-[3px] ring-accent ring-offset-2 ring-offset-[#0c0c0c] -translate-y-1.5 shadow-[0_18px_40px_rgba(0,0,0,.7)]"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <span className="relative block aspect-video bg-white/5">
                    {still ? (
                      <Image src={still} alt="" fill sizes="250px" className={`object-cover ${was && !last ? "brightness-[.78]" : ""}`} />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center text-2xl font-extrabold text-white/30">{w.ep(e.episode)}</span>
                    )}
                    {was && (
                      <span className="absolute top-2 start-2 w-6 h-6 rounded-full bg-accent text-[color:var(--on-accent)] grid place-items-center">
                        <Icon name="check-line" size={13} strokeWidth={2.6} />
                      </span>
                    )}
                  </span>
                  <span className="block h-1 bg-white/15">
                    <span className={`block h-full bg-accent ${was ? "w-full" : "w-0"}`} />
                  </span>
                  <span className="block px-3 py-2.5">
                    <span className="flex items-baseline gap-1.5 text-[13.5px] min-w-0">
                      <b className={last ? "text-accent" : ""}>{w.ep(e.episode)}</b>
                      {e.name && <span className="text-white/60 truncate">· {e.name}</span>}
                    </span>
                    {last && <span className="block text-[11.5px] font-bold text-accent mt-1">{w.lastSeen}</span>}
                  </span>
                </button>
              );
            })}
          </RailScroll>
        )}
      </div>
    </div>
  );
}

/* ───────── ٤ — الأنواع بمشاهدها: ستّ عشرةَ إلى تسعٍ كاملةً بلا قصّ، أربعٌ في الصفّ ───────── */
function StepTaste({ p, w }: { p: SceneProps; w: SceneWords }) {
  return (
    <>
      <div className="mt-[clamp(8px,2vh,24px)]">
        <Head
          kicker={`${p.t.obStep(4, 5)} · ${w.optional}`}
          title={p.t.obGenresTitle}
          hint={p.t.obGenresHint}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-5 -mx-2 px-2 py-2 [scrollbar-width:thin]">
        <div className="grid grid-cols-4 gap-4 max-w-[min(100%,calc((100vh_-_422px)*64/27_+_48px))] mx-auto">
          {GENRES.map((g) => {
            const on = p.genres.includes(g.id);
            const url = backdropUrl(p.genreArt[g.id] ?? null, "w780");
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={on}
                onClick={() => p.toggleGenre(g.id)}
                className={`relative aspect-video rounded-[18px] overflow-hidden border text-start transition ${
                  on ? "border-accent ring-[3px] ring-accent ring-offset-[3px] ring-offset-[#050505]" : "border-white/10 hover:border-white/30"
                }`}
              >
                {url ? (
                  <Image src={url} alt="" fill sizes="(min-width: 1600px) 400px, 300px" className={`object-cover ${on ? "" : "brightness-90"}`} />
                ) : (
                  <span className="absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(255,212,0,.25),#151515_60%)]" />
                )}
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.85),rgba(0,0,0,.05)_65%)]" />
                {on && (
                  <span className="absolute top-2.5 start-2.5 w-7 h-7 rounded-full bg-accent text-[color:var(--on-accent)] grid place-items-center">
                    <Icon name="check-line" size={15} strokeWidth={2.6} />
                  </span>
                )}
                <b className="absolute bottom-3.5 start-4 text-[clamp(17px,1.5vw,23px)] font-extrabold">
                  {p.locale === "en" ? g.en : g.ar}
                </b>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ───────── ٥ — بطاقاتٌ واقفة ───────── */
function StepPeople({ p, w, stamp }: { p: SceneProps; w: SceneWords; stamp: InviterLite | null }) {
  const [posters, setPosters] = useState<Record<string, string[]>>({});
  const ids = p.people.map((x) => x.id).join(",");
  useEffect(() => {
    if (!ids) return;
    let live = true;
    peoplePosters(ids.split(","))
      .then((m) => {
        if (live) setPosters(m);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [ids]);

  return (
    <>
      <div className="flex-1 min-h-0" />
      <Head kicker={`${p.t.obStep(5, 5)} · ${w.last}`} title={p.t.obPeopleTitle} hint={p.t.obPeopleHint} big />
      <div className="flex flex-wrap gap-4 mt-6">
        {!p.peopleLoaded ? (
          [0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="w-[clamp(170px,14vw,206px)] h-[300px] rounded-[20px] bg-white/10 animate-pulse" />
          ))
        ) : p.people.length === 0 ? (
          <p className="text-white/70 py-10">{p.t.obPeopleNone}</p>
        ) : (
          p.people.map((x) => {
            const on = p.toFollow.has(x.id);
            const name = x.nickname || x.username || p.t.anonymousUser;
            const why = x.shared > 0 ? p.t.suggestShared(x.shared) : x.followers > 0 ? p.t.suggestFollowers(x.followers) : null;
            const invited = !!stamp?.username && stamp.username === x.username;
            return (
              <button
                key={x.id}
                type="button"
                aria-pressed={on}
                onClick={() => p.toggleFollow(x.id)}
                className={`w-[clamp(170px,14vw,206px)] rounded-[20px] px-4 pt-4 pb-4 text-center bg-[rgba(12,12,12,.7)] backdrop-blur-lg border transition ${
                  on ? "border-accent shadow-[inset_0_0_0_2px_var(--accent)]" : "border-white/10 hover:border-white/25"
                }`}
              >
                <span className="block h-6">
                  {invited && (
                    <span className="inline-block text-[11px] font-extrabold text-[color:var(--on-accent)] bg-accent rounded-md px-2 py-0.5">
                      {w.invitedYou}
                    </span>
                  )}
                </span>
                <Avatar
                  src={x.avatar_url}
                  name={name}
                  size={76}
                  alt={p.t.avatarAlt}
                  className={`mx-auto ring-[3px] ${on ? "ring-accent" : "ring-white/15"}`}
                />
                <span className="flex items-center justify-center gap-1 mt-2.5 min-w-0">
                  <span className="text-[16px] font-bold truncate">{name}</span>
                  <AccountBadges profile={x} t={p.t} />
                </span>
                <span className="block text-12 text-white/60 mt-0.5 truncate">{why ?? " "}</span>
                <span className="flex justify-center my-3 h-[58px]">
                  {(posters[x.id] ?? []).map((path, i) => {
                    const u = posterUrl(path, "w185");
                    return u ? (
                      <span
                        key={path}
                        className={`relative w-[39px] h-[58px] rounded-md overflow-hidden border-2 border-[#0c0c0c] ${i ? "-ms-2.5" : ""}`}
                      >
                        <Image src={u} alt="" fill sizes="40px" className="object-cover" />
                      </span>
                    ) : null;
                  })}
                </span>
                <span
                  className={buttonClass({
                    variant: on ? "surface" : "primary",
                    size: "sm",
                    full: true,
                    className: on ? "!text-[color:var(--success)] !border-[color:var(--success)]/50" : "",
                  })}
                >
                  <Icon name={on ? "check-line" : "plus"} size={15} strokeWidth={2.4} />
                  {on ? w.followingNow : w.follow}
                </span>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

/* ───────── الشريطُ السفليّ: ما اختير على اليمين، والرجوعُ و«تخطّي» والزرُّ الأساسيُّ على الطرف الآخر ───────── */
function Footer({
  p,
  w,
  chosen,
  at,
  setCur,
}: {
  p: SceneProps;
  w: SceneWords;
  chosen: SeedTitle[];
  at: number;
  setCur: (n: number) => void;
}) {
  const nextTitle = p.step === PROGRESS && at < chosen.length - 1 ? chosen[at + 1] : null;
  return (
    <div className="flex items-center justify-between gap-6 mt-5">
      <div className="flex items-center gap-3 min-w-0 text-[13px] text-white/65">
        {p.step === PICK && (
          <>
            <span className="flex">
              {chosen.slice(0, 5).map((s, i) => {
                const u = posterUrl(s.posterPath, "w185");
                return (
                  <span
                    key={s.id}
                    className={`relative w-[34px] h-[50px] rounded-md overflow-hidden border-2 border-[#050505] bg-white/10 ${i ? "-ms-2" : ""}`}
                  >
                    {u && <Image src={u} alt="" fill sizes="34px" className="object-cover" />}
                  </span>
                );
              })}
            </span>
            <span>
              <b className="text-white">{chosen.length ? w.picked(chosen.length) : ""}</b>
              {chosen.length ? " — " : ""}
              {w.oneIsEnough}
            </span>
          </>
        )}
        {p.step === TASTE && p.genres.length > 0 && <b className="text-white">{w.genresN(p.genres.length)}</b>}
        {p.step > ME && (
          <button type="button" disabled={p.pending} onClick={() => p.go(p.step - 1)} className="hover:text-white">
            {p.t.obBack}
          </button>
        )}
        {p.onSkip && (
          <>
            <span aria-hidden>·</span>
            <button type="button" disabled={p.pending} onClick={p.onSkip} className="font-bold text-white/85 hover:text-white">
              {p.t.obSkip}
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        disabled={nextTitle ? false : p.primaryDisabled}
        onClick={() => (nextTitle ? setCur(at + 1) : p.onPrimary())}
        className={buttonClass({ size: "lg", className: "!h-[54px] !px-9 !text-[15px] shrink-0" })}
      >
        {nextTitle ? w.next(nextTitle.title) : p.primaryLabel}
      </button>
    </div>
  );
}
