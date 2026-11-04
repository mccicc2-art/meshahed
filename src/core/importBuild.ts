// التجميع — من سجلاتٍ متفرّقة إلى أعمالٍ بحلقاتها. **وحدةٌ نقيّةٌ يقرؤها الطرفان** (🆕 D-1369 · V-C · C6).
//
// كانت هذه المئةُ والعشرون سطراً داخل `ImportPanel` (الويب). الاستيرادُ الأصليُّ يحتاجها بحرفها،
// ونسخُها إلى التطبيق نسختان تنحرفان بصمت: قاعدةٌ تُصحَّح في واحدةٍ («مشاهدةٌ سابقةٌ تغلب قائمةَ
// المشاهدة لاحقاً») وتبقى خطأً في الأخرى — بلا خطأٍ يُرى، فقط مكتبةٌ مستوردةٌ تختلف بين الويب والتطبيق.

import { recordKey, type RawRecord } from "./importParse.ts";
import { earliestAt as earliest, IMPORT_CAPS, type ImportEpisode, type ImportList, type ImportMovie, type ImportShow, type ResolveResult } from "./importer.ts";

export interface BuiltImport {
  shows: ImportShow[];
  movies: ImportMovie[];
  /** 🆕 IMDb («٤ أ») — قوائمُ صاحبها بأعمالها مرتّبة؛ `[]` لكلِّ مصدرٍ آخر */
  lists: ImportList[];
  /** ما لم يُطابَق — بالاسم كما ورد في التصدير، مرّةً واحدةً لكلِّ اسم */
  unmatched: string[];
}

/** `resolved`: مفتاحُ `recordKey` → نتيجةُ المطابقة (ما وصل بمعرّف TMDB لا يمرّ من المطابقة أصلاً — D-154) */
export function buildImport(records: RawRecord[], resolved: Map<string, ResolveResult>): BuiltImport {
  const showMap = new Map<number, ImportShow>();
  const movieMap = new Map<number, ImportMovie>();
  const unmatched = new Set<string>();
  /** 🆕 IMDb — اسمُ القائمة ⇐ أعمالُها بمواضعها (تُرتَّب وتُطوى في الختام) */
  const listMap = new Map<string, (ImportList["items"][number] & { pos: number })[]>();
  /** 🆕 MyAnimeList — تقييماتُ مواسم العمل الواحد (يُؤخذ متوسّطها)، وحالةُ أبعدِ مواسمه */
  const malScores = new Map<number, number[]>();
  const malFront = new Map<number, { pos: number; state: ImportShow["state"] | "active" }>();

  const addShow = (hit: NonNullable<ResolveResult>) => {
    let sh = showMap.get(hit.tmdbId);
    if (!sh) {
      sh = { tmdbId: hit.tmdbId, title: hit.title, posterPath: hit.posterPath, episodes: [] };
      showMap.set(hit.tmdbId, sh);
    }
    return sh;
  };

  for (const r of records) {
    /* المعرّف بيده — يُبنى مباشرةً. والعنوان من المصدر، والملصق
       يُترك فارغاً تملؤه `FollowMetaSync` عند أوّل زيارة (نفس قاعدة
       مستورد الخادم: مئاتُ طلبات TMDB داخل استيرادٍ واحد تُنهي المهلة) */
    if (r.kind === "tmdb-show") {
      const sh = showMap.get(r.tmdbId) ?? {
        tmdbId: r.tmdbId,
        title: r.title,
        posterPath: null,
        episodes: [],
      };
      sh.episodes.push(...r.episodes);
      if (r.rating != null) sh.rating = r.rating;
      showMap.set(r.tmdbId, sh);
      continue;
    }
    if (r.kind === "tmdb-movie") {
      const prev = movieMap.get(r.tmdbId);
      movieMap.set(r.tmdbId, {
        tmdbId: r.tmdbId,
        title: r.title,
        posterPath: null,
        /* «أنوي مشاهدته» لا يُختم مشاهَداً — ومشاهدةٌ سابقة تغلبه */
        watched: (prev?.watched ?? false) || !r.planned,
        at: prev?.at ?? r.at,
        rating: r.rating ?? prev?.rating,
      });
      continue;
    }

    /* 🆕 **صفُّ IMDb** — معناه في `role` (`imdb.ts` يشرح القرارات)، وأبكرُ تاريخٍ يُحفظ في كلِّ دمجٍ كما في الأفلام */
    /* 🆕 **صفُّ MyAnimeList** — الموسمُ والإزاحةُ من المطابقة (`span`)، والحلقاتُ نفسُها على الخادم (`spans`) */
    if (r.kind === "mal") {
      const hit = resolved.get(recordKey(r));
      if (!hit) {
        unmatched.add(r.name); // «٣ أ»: أوفا وخاصّاتٌ بلا موسمٍ عاديٍّ، وما ليس في الجدول
        continue;
      }
      if (hit.mediaType === "movie") {
        const prev = movieMap.get(hit.tmdbId);
        const watched = r.status === "completed";
        movieMap.set(hit.tmdbId, {
          tmdbId: hit.tmdbId,
          title: prev?.title || r.name,
          posterPath: hit.posterPath,
          watched: (prev?.watched ?? false) || watched,
          at: watched ? earliest(prev?.at, r.at) : prev?.at,
          rating: r.rating ?? prev?.rating,
        });
        continue;
      }
      if (!hit.span) continue;
      const sh = addShow({ ...hit, title: hit.title || r.name });
      /* «١ أ»: المكتملُ موسمُه كلُّه (بعدده المعلن إن عُرف — موسمُ TMDB قد يحمل جزأين من MAL بإزاحتين)، وغيرُه ما سجّله */
      const count = r.status === "completed" ? Math.max(r.watched, r.total) || null : r.watched;
      if (r.status !== "plan" && count !== 0) (sh.spans ??= []).push({ season: hit.span.season, offset: hit.span.offset, count, at: r.at });
      if (r.rating != null) malScores.set(hit.tmdbId, [...(malScores.get(hit.tmdbId) ?? []), r.rating]);
      /* حالةُ العمل حالةُ **أبعدِ** مواسمه: تَرَكَ الثالثَ بعد أن أكمل الأوّلين ⇐ متروك؛ أكمل الثالثَ بعد أن ترك الأوّل ⇐ لا */
      const pos = (hit.span.season ?? 0) * 100_000 + hit.span.offset;
      const state = r.status === "dropped" ? "dropped" : r.status === "onhold" ? "paused" : "active";
      const front = malFront.get(hit.tmdbId);
      if (!front || pos >= front.pos) malFront.set(hit.tmdbId, { pos, state });
      continue;
    }

    if (r.kind === "imdb") {
      const hit = resolved.get(recordKey(r));
      if (!hit) {
        unmatched.add(r.media === "episode" ? showOfEpisodeTitle(r.name) : r.name);
        continue;
      }
      if (r.role === "list") {
        if (hit.season != null) continue; // حلقةٌ لا تدخل قائمة
        const items = listMap.get(r.list ?? "IMDb") ?? [];
        items.push({ tmdbId: hit.tmdbId, mediaType: hit.mediaType, title: hit.title, posterPath: hit.posterPath, pos: r.pos ?? items.length + 1 });
        listMap.set(r.list ?? "IMDb", items);
      } else if (r.media === "movie") {
        const prev = movieMap.get(hit.tmdbId);
        const watched = r.role === "rated";
        movieMap.set(hit.tmdbId, {
          tmdbId: hit.tmdbId,
          title: hit.title,
          posterPath: hit.posterPath,
          /* «أشاهده لاحقاً» لا يدهس مشاهدةً — والتقييمُ يختمه مشاهَداً أينما ورد */
          watched: (prev?.watched ?? false) || watched,
          at: watched ? earliest(prev?.at, r.at) : prev?.at,
          rating: r.rating ?? prev?.rating,
        });
      } else if (r.media === "tv") {
        const sh = addShow(hit);
        if (r.role === "rated") {
          if (r.rating != null) sh.rating = r.rating;
          sh.all = { at: earliest(sh.all?.at, r.at) };
        }
      } else if (r.role === "rated" && hit.season != null && hit.episode != null) {
        /* حلقةٌ قيّمها: هي بتاريخها، وما قبلها يُعلَّم على الخادم (`upTo`) — والعنوانُ من الملف لا من الحلقة */
        const sh = addShow({ ...hit, title: showOfEpisodeTitle(r.name) });
        const ep: ImportEpisode = { s: hit.season, e: hit.episode, at: r.at };
        sh.episodes.push(ep);
        (sh.upTo ??= []).push({ ...ep });
      }
      continue;
    }

    /* المفتاح من `importParse` نفسه لا نسخةً منه: لو انحرف أحدهما عن
       الآخر لفشلت كل مطابقةٍ بصمتٍ تامّ — لا خطأ، فقط نتيجةٌ فارغة */
    const hit = resolved.get(recordKey(r));
    if (!hit) {
      const label =
        r.kind === "ep-name" || r.kind === "rating-show"
          ? r.show
          : r.kind === "movie-name" || r.kind === "movie-watchlist"
            ? r.name
            : "";
      if (label) unmatched.add(label);
      continue;
    }

    if (r.kind === "ep-name") {
      addShow(hit).episodes.push({ s: r.s, e: r.e, at: r.at });
    } else if (r.kind === "ep-tvdb") {
      // المطابقة أعادت المسلسل والموسم والحلقة معاً
      if (hit.season != null && hit.episode != null) {
        addShow(hit).episodes.push({ s: hit.season, e: hit.episode, at: r.at });
      }
    } else if (r.kind === "show-tvdb") {
      addShow(hit);
    } else if (r.kind === "rating-show") {
      addShow(hit).rating = r.rating;
    } else if (r.kind === "movie-watchlist") {
      /* لا يدهس مشاهدةً سبقته: من شاهد الفيلم ثم بقي في قائمته،
         المشاهدة هي الحقيقة الأقوى */
      if (!movieMap.has(hit.tmdbId)) {
        movieMap.set(hit.tmdbId, {
          tmdbId: hit.tmdbId,
          title: hit.title,
          posterPath: hit.posterPath,
          watched: false,
        });
      }
    } else if (r.kind === "movie-name") {
      const prev = movieMap.get(hit.tmdbId);
      movieMap.set(hit.tmdbId, {
        tmdbId: hit.tmdbId,
        title: hit.title,
        posterPath: hit.posterPath,
        watched: true,
        /* أقدمُ تاريخٍ يُحفظ: اليوميات تحمل يوم المشاهدة الحقيقي،
           وملفُّ «watched» يحمل يوم التسجيل — والأوّل أصدق */
        at: prev?.at && r.at ? (prev.at < r.at ? prev.at : r.at) : (prev?.at ?? r.at),
        rating: r.rating ?? prev?.rating,
      });
    }
  }

  // حلقةٌ واحدة مهما تكرّرت في التصدير (إعادة مشاهدةٍ أو خطأ تصدير)
  for (const sh of showMap.values()) {
    const seen = new Set<string>();
    sh.episodes = sh.episodes.filter((ep) => {
      const k = `${ep.s}-${ep.e}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    /* 🆕 ومرساةُ «حتى هنا» واحدةٌ لكلِّ حلقة — بأبكر تاريخها (قيّمها في ملفّين) */
    if (sh.upTo) {
      const best = new Map<string, ImportEpisode>();
      for (const a of sh.upTo) {
        const k = `${a.s}-${a.e}`;
        const prev = best.get(k);
        best.set(k, prev ? { ...a, at: earliest(prev.at, a.at) } : a);
      }
      sh.upTo = [...best.values()];
    }
  }

  /* 🆕 MyAnimeList: تقييمُ المسلسل متوسّطُ تقييمات مواسمه هناك (مقياسُنا من عشرة واحد) — وحالتُه حالةُ أبعدِ مواسمه */
  for (const [id, scores] of malScores) {
    const sh = showMap.get(id);
    if (sh) sh.rating = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  for (const [id, f] of malFront) {
    const sh = showMap.get(id);
    if (sh && f.state !== "active") sh.state = f.state;
  }

  /* 🆕 القوائمُ بترتيب IMDb، والعملُ مرّةً في قائمته — وسقفاها سقفا `upsertListWithItems` وحساب القوائم */
  const lists: ImportList[] = [...listMap].slice(0, IMPORT_CAPS.lists).map(([name, items]) => {
    const seen = new Set<string>();
    return {
      name,
      items: items
        .sort((a, b) => a.pos - b.pos)
        .filter((it) => {
          const k = `${it.mediaType}-${it.tmdbId}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, IMPORT_CAPS.listItems)
        .map(({ tmdbId, mediaType, title, posterPath }) => ({ tmdbId, mediaType, title, posterPath })),
    };
  });

  return {
    shows: [...showMap.values()].slice(0, IMPORT_CAPS.shows),
    movies: [...movieMap.values()].slice(0, IMPORT_CAPS.movies),
    lists: lists.filter((l) => l.items.length),
    unmatched: [...unmatched],
  };
}

/** «Breaking Bad: Pilot» ⇐ «Breaking Bad» — عنوانُ الحلقة في IMDb يحمل اسمَ مسلسلها قبل النقطتين */
export function showOfEpisodeTitle(name: string): string {
  const i = name.indexOf(": ");
  return (i > 0 ? name.slice(0, i) : name).trim();
}

/** دفعاتُ الكتابة — خمسةُ مسلسلاتٍ أو ستّون فيلماً أو قائمةٌ في الطلب (تحت سقوف `applyImportChunk`) */
export const IMPORT_CHUNK = { resolve: 40, shows: 5, movies: 60, lists: 1 } as const;
