import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { write } from "../api";
import { useApp } from "../state";
import { haptic } from "../haptics";
import { messageOf } from "../settings/api";
import type { ToastHostRef } from "../HoldHost";
import type { StremioSignal } from "@/core/contracts/stremio";
import type { EpisodeRateBody, RateBody } from "../contracts";
import { episodeLabel } from "./api";

/**
 * 🆕 T485 — **مراحلُ النجوم بعد «✓»** (أحمد ٢٠ نوفمبر «١ أ · ٢ أ»): كلُّ حلقةٍ تُقيَّم هي أوّلاً (`ep` → `track/episode-rate`، تقييمُ
 * الحلقة نفسِه في صفحة المسلسل)، ثمّ نهايةُ الموسم أو المسلسل تُقيِّم العملَ كلَّه (`work` → `track/rate`، T415 كما هو). الفيلمُ مرحلةُ
 * العمل وحدَها. إشارةٌ بلا موسمٍ أو حلقةٍ معروفين لا مرحلةَ حلقةٍ لها. القائمةُ الفارغة = «حسناً» بلا نجوم.
 */
export type RateStage = "ep" | "work";
export function rateStages(s: StremioSignal): RateStage[] {
  const ep = s.kind === "tv" && s.season != null && s.episode != null;
  /* `rate` غائبٌ = خادمٌ أقدم: التلقائيُّ يبقى كما كان (الفيلمُ بنجومه) — حكمُ T415 */
  const work = s.rate !== undefined ? !!s.rate : !!s.auto && s.kind === "movie";
  return [...(ep ? (["ep"] as const) : []), ...(work ? (["work"] as const) : [])];
}

/** مدّةُ «تراجع» — وبعدها يُرسل الجواب */
const UNDO_MS = 4500;

/**
 * 🆕 **جوابُ إشارة Stremio مع «تراجع»** — للبطاقة والقائمة معاً (قرار ٥: ✓ أو ✕ تُخفي الإشارة فوراً وتُظهر التي بعدها،
 * والإشعارُ الواحد يعرض «تراجع»).
 *
 * 🔑 **الجوابُ يُرسل بعد مهلة التراجع لا قبلها**: ✓ على حلقةٍ يعلّم كلَّ ما قبلها ويتابع المسلسل — كتابةٌ لا تُعكس بنقرة
 * (لا نعرف ما كان معلَّماً قبلها). فالإخفاءُ فوريّ والكتابةُ مؤجّلة، و«تراجع» يُلغي المؤقّتَ فلا يصل الخادمَ شيء.
 * ⚠️ **ومغادرةُ الشاشة لا تُسقط الجواب**: ما بقي في الانتظار يُرسل عند الإزالة — من ضغط ✓ ثمّ خرج قد أجاب.
 * 🆕 R76 — **وعند فقد التركيز والخروج إلى الخلفيّة أيضاً** (أحمد ٢٢ أكتوبر: «اغير الصفحة او اقفل التطبيق و اندو ديسميس
 * ما راح»): الرئيسيّةُ تبقى مركّبةً خلف التبويبات فلا «إزالة»، والتطبيقُ في الخلفيّة يُوقف المؤقّتات وإغلاقُه يقتلها — فكان
 * الجوابُ يضيع ويعود السؤال. فمغادرةُ الشاشة أو التطبيق أثناء «تراجع» = تثبيتُ الجواب فوراً (لا تراجعَ لمن غادر).
 */
export function useStremioAnswer(toast: RefObject<ToastHostRef | null>, opts?: { rateInCard?: boolean }) {
  /* T415 — النجومُ في بطاقة الرئيسيّة وحدَها؛ قائمةُ «عرض الكل» صفوفٌ صغيرةٌ تختفي بالجواب كما كانت */
  const rateInCard = !!opts?.rateInCard;
  const { t } = useApp();
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set());
  /* 🆕 T415 — ما أُجيب عنه بـ✓ وينتظر نجومه، **بنسخته** لا برقمه: حين يُحفظ الجوابُ (مهلةُ «تراجع» أو مغادرةُ الشاشة) يُعاد جلبُ
     الرئيسيّة والإشارةُ لم تعد «منتظرة» فتغيب من القائمة — والنجومُ يجب أن تبقى حتى يقيّم أو يتخطّى (مراجعةٌ مستقلّة) */
  const [rating, setRating] = useState<ReadonlyMap<number, StremioSignal>>(() => new Map());
  const pending = useRef(new Map<number, { watched: boolean; timer: ReturnType<typeof setTimeout> }>());
  /* 🆕 T415 — كتابةُ الجواب الجارية لكلِّ إشارة: النجومُ تنتظرها كي يُحفظ «شفتها» قبل التقييم */
  const sent = useRef(new Map<number, Promise<unknown>>());

  const unhide = useCallback((id: number) => {
    setHidden((h) => {
      const n = new Set(h);
      n.delete(id);
      return n;
    });
  }, []);

  const unrate = useCallback((id: number) => {
    setRating((r) => {
      if (!r.has(id)) return r;
      const n = new Map(r);
      n.delete(id);
      return n;
    });
  }, []);

  const commit = useCallback(
    (id: number) => {
      const p = pending.current.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.current.delete(id);
      const w = write("/api/v1/me/stremio/answer", { id, watched: p.watched });
      sent.current.set(id, w);
      w.catch((e: unknown) => {
        sent.current.delete(id);
        unhide(id);
        unrate(id);
        toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal));
      });
    },
    [t, toast, unhide, unrate],
  );

  const answer = useCallback(
    (s: StremioSignal, watched: boolean) => {
      /* 🆕 T361 — **ما سجّله Loopz بنفسه لا جوابَ له**: «حسناً» أو تقييمٌ من البطاقة = «رأيتُه» (`notice`) — يُخفى ويُرسل في الحال، بلا
         «تراجع»: لا كتابةَ تُعكس هنا، المشاهدةُ محفوظةٌ قبله */
      if (s.auto) {
        setHidden((h) => new Set(h).add(s.id));
        write("/api/v1/me/stremio/notice", { id: s.id }).catch(() => unhide(s.id));
        return;
      }
      haptic.pick();
      /* 🆕 T415 — ✓ على فيلمٍ أو نهايةٍ (`rate`) لا يُخفي البطاقة: تنقلب إلى النجوم في مكانها، و«تراجع» يبقى في الإشعار.
         🆕 T485 — وعلى أيِّ حلقة: نجومُ الحلقة أوّلاً (`rateStages`) */
      const rateNext = rateInCard && watched && rateStages(s).length > 0;
      if (rateNext) setRating((r) => new Map(r).set(s.id, s));
      else setHidden((h) => new Set(h).add(s.id));
      pending.current.set(s.id, { watched, timer: setTimeout(() => commit(s.id), UNDO_MS) });
      const text = !watched
        ? s.kind === "movie"
          ? t.stremioDismissedMovie
          : t.stremioDismissed
        : s.kind === "movie"
          ? t.stremioMarkedMovie
          : t.stremioMarkedUpTo(episodeLabel(s, t.stremioMovie));
      toast.current?.say(
        text,
        {
          label: t.undoWatched,
          onPress: () => {
            const p = pending.current.get(s.id);
            if (!p) return;
            clearTimeout(p.timer);
            pending.current.delete(s.id);
            unhide(s.id);
            unrate(s.id);
          },
        },
        UNDO_MS,
        watched ? "success" : "info",
      );
    },
    [commit, rateInCard, t, toast, unhide, unrate],
  );

  /**
   * 🆕 T415 — **النجومُ تُثبّت الجواب**: «✓ شفتها» يُحفظ فوراً (لا ينتظر مهلةَ التراجع)، ثمّ التقييمُ — بهذا الترتيب، فلا يسبق
   * التقييمُ المشاهدةَ (التقييمُ الأوّلُ لمسلسلٍ بلا حلقاتٍ مشاهَدة يعلّم كلَّ ما عُرض، D-1467). و«تراجع» يغيب من الإشعار لحظةَ
   * اللمس (أحمد: «عند اختيار النجوم يختفي تراجع») — يحلّ محلَّه نصُّه نفسُه بلا فعل، و«انحفظ تقييمك ✓» بعد الحفظ لا قبله.
   * فشلُ الجواب: إشعارُه وإعادةُ البطاقة سؤالاً عند من كتبه (`commit`/`flushAll`) — لا إشعارَ ثانٍ هنا. فشلُ التقييم وحدَه:
   * النجومُ تفرغ ليعيد المحاولة. يعيد `true` إن حُفظ.
   */
  const rate = useCallback(
    async (s: StremioSignal, stars: number): Promise<boolean> => {
      commit(s.id);
      toast.current?.say(s.kind === "movie" ? t.stremioMarkedMovie : t.stremioMarkedUpTo(episodeLabel(s, t.stremioMovie)), undefined, 2200, "success");
      try {
        await sent.current.get(s.id);
      } catch {
        return false;
      }
      try {
        await write("/api/v1/track/rate", {
          tmdbId: s.tmdb_id,
          mediaType: s.kind,
          rating: stars,
          review: "",
          title: s.title,
          posterPath: s.poster_path ?? null,
        } satisfies RateBody);
      } catch (e) {
        toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal));
        return false;
      }
      haptic.success();
      toast.current?.say(t.ratedThanks, undefined, 2200, "success");
      setHidden((h) => new Set(h).add(s.id));
      unrate(s.id);
      sent.current.delete(s.id);
      return true;
    },
    [commit, t, toast, unrate],
  );

  /**
   * 🆕 T485 — **نجومُ الحلقة** (`track/episode-rate`) بترتيب `rate` نفسِه: الجوابُ يُثبَّت أوّلاً ثمّ التقييم. `last` — لا مرحلةَ بعدها
   * فتخرج البطاقة؛ وإلّا تبقى لنجوم العمل (`rate` ينتظر الجوابَ المحفوظ نفسَه، فلا يُكتب مرّتين).
   */
  const rateEpisode = useCallback(
    async (s: StremioSignal, stars: number, last: boolean): Promise<boolean> => {
      if (s.season == null || s.episode == null) return false;
      commit(s.id);
      toast.current?.say(t.stremioMarkedUpTo(episodeLabel(s, t.stremioMovie)), undefined, 2200, "success");
      try {
        await sent.current.get(s.id);
      } catch {
        return false;
      }
      try {
        await write("/api/v1/track/episode-rate", { showTmdbId: s.tmdb_id, season: s.season, episode: s.episode, rating: stars } satisfies EpisodeRateBody);
      } catch (e) {
        toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal));
        return false;
      }
      haptic.success();
      toast.current?.say(t.ratedThanks, undefined, 2200, "success");
      if (last) {
        setHidden((h) => new Set(h).add(s.id));
        unrate(s.id);
        sent.current.delete(s.id);
      }
      return true;
    },
    [commit, t, toast, unrate],
  );

  /** 🆕 T415 — «بدون تقييم»: تخرج البطاقة، والجوابُ باقٍ في مهلة «تراجع» كما كان */
  const skipRate = useCallback((s: StremioSignal) => {
    setHidden((h) => new Set(h).add(s.id));
    unrate(s.id);
    sent.current.delete(s.id);
  }, [unrate]);

  /* إرسالُ كلِّ ما ينتظر — بلا رسائل: الشاشةُ غادرت أو التطبيقُ نزل إلى الخلفيّة */
  const flushAll = useCallback(() => {
    const map = pending.current;
    for (const [id, p] of map) {
      clearTimeout(p.timer);
      const w = write("/api/v1/me/stremio/answer", { id, watched: p.watched });
      sent.current.set(id, w);
      /* T415 — جوابٌ لم يصل: البطاقةُ تعود سؤالاً (لا نجومَ تنتظر وعداً مرفوضاً إلى الأبد) */
      void w.catch(() => {
        sent.current.delete(id);
        unhide(id);
        unrate(id);
      });
    }
    map.clear();
  }, [unhide, unrate]);

  /* الإزالة */
  useEffect(() => flushAll, [flushAll]);

  /* فقدُ التركيز: تبويبٌ آخر أو شاشةٌ فوقها — الرئيسيّةُ تبقى مركّبة فلا تصلها الإزالة */
  useFocusEffect(useCallback(() => flushAll, [flushAll]));

  /* الخلفيّة: المؤقّتاتُ تتوقّف هناك، وإغلاقُ التطبيق يقتلها */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") flushAll();
    });
    return () => sub.remove();
  }, [flushAll]);

  return { hidden, answer, rating, rate, rateEpisode, skipRate };
}
