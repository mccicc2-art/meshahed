// التجميع — من سجلاتٍ متفرّقة إلى أعمالٍ بحلقاتها. **وحدةٌ نقيّةٌ يقرؤها الطرفان** (🆕 D-1369 · V-C · C6).
//
// كانت هذه المئةُ والعشرون سطراً داخل `ImportPanel` (الويب). الاستيرادُ الأصليُّ يحتاجها بحرفها،
// ونسخُها إلى التطبيق نسختان تنحرفان بصمت: قاعدةٌ تُصحَّح في واحدةٍ («مشاهدةٌ سابقةٌ تغلب قائمةَ
// المشاهدة لاحقاً») وتبقى خطأً في الأخرى — بلا خطأٍ يُرى، فقط مكتبةٌ مستوردةٌ تختلف بين الويب والتطبيق.

import { recordKey, type RawRecord } from "./importParse.ts";
import { IMPORT_CAPS, type ImportMovie, type ImportShow, type ResolveResult } from "./importer.ts";

export interface BuiltImport {
  shows: ImportShow[];
  movies: ImportMovie[];
  /** ما لم يُطابَق — بالاسم كما ورد في التصدير، مرّةً واحدةً لكلِّ اسم */
  unmatched: string[];
}

/** `resolved`: مفتاحُ `recordKey` → نتيجةُ المطابقة (ما وصل بمعرّف TMDB لا يمرّ من المطابقة أصلاً — D-154) */
export function buildImport(records: RawRecord[], resolved: Map<string, ResolveResult>): BuiltImport {
  const showMap = new Map<number, ImportShow>();
  const movieMap = new Map<number, ImportMovie>();
  const unmatched = new Set<string>();

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
  }

  return {
    shows: [...showMap.values()].slice(0, IMPORT_CAPS.shows),
    movies: [...movieMap.values()].slice(0, IMPORT_CAPS.movies),
    unmatched: [...unmatched],
  };
}

/** دفعاتُ الكتابة — خمسةُ مسلسلاتٍ أو ستّون فيلماً في الطلب (سقفُ `applyImportChunk` نفسُه) */
export const IMPORT_CHUNK = { resolve: 40, shows: 5, movies: 60 } as const;
