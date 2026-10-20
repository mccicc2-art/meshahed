import Link from "next/link";
import Image from "next/image";
import { posterUrl, backdropUrl } from "@/lib/tmdb";
import { getDict, type Locale } from "@/core/i18n";
import { timeAgo } from "@/core/when";
import { displayNameOf } from "@/core/people";
import type { TalkRoom } from "@/lib/data";
import { bulletinEpisodeShort } from "@/core/bulletinLine";
import { talkActivity } from "@/core/talkSort";
import { Avatar } from "./Avatar";
import { RoomPinButton } from "./RoomPinButton";
import { Icon } from "./Icon";

/**
 * **بطاقاتُ غرف النقاش** (D-257).
 *
 * ================= ما كان خطأً وصُحّح =================
 *
 * **تصحيحُ أحمد بنصّه: «عندك لبس — النقاش ليس الريفيو، يختلف».** كانت
 * هذه البطاقاتُ تُبنى من خطّ الآراء (`groupByWork`): **عملٌ كتب فيه
 * ثلاثةٌ آراءً يصير «غرفةَ نقاشٍ بثلاث مشاركات»** — وذلك ليس نقاشاً، هو
 * ثلاثةُ أحكامٍ متجاورة لم يخاطب أحدُها الآخر. **وغرفةٌ مبنيّةٌ من آراءٍ
 * تعِد بحوارٍ لا تجده حين تُفتح.**
 *
 * **فالمصدرُ صار `title_talk_rooms`** (الهجرة ٧٨): غرفةٌ لا تولد إلا
 * بمشاركةٍ كُتبت فيها قصداً، **وعدّادُها مشاركاتٌ حقيقيّة ووقتُها وقتُ
 * آخرها.**
 *
 * ================= وثلاثةٌ من لقطة أحمد حرفاً =================
 *
 * **١ · الملصقُ في البداية** (طلبُه: «البوستر يسار» ثم تصحيحُه «يسار في
 * الإنجليزية ويمين في العربية» = `start`). **وكان في النهاية** بحجّة
 * D-222 — «الهويّةُ في البداية والملصقُ في النهاية» على وزن صفّ النشاط.
 * **والحجّةُ سقطت هنا لأن الصفَّ ليس صفَّ إنسان:** لا وجهَ في بدايته،
 * **فالملصقُ هو هويّةُ البطاقة** — ومن أزاحه إلى النهاية ترك البدايةَ
 * لنصٍّ وحده.
 *
 * **٢ · الخلفيّةُ من غلاف العمل** (طلبُه: «والخلفية تكون من غلاف الفلم»).
 * **وهي ١٤٪ لا أكثر**: الغلافُ صورةٌ عريضةٌ عاليةُ التباين، **وفوق ٢٠٪
 * يصير النصُّ عليها مقروءاً على نصفِ البطاقة وضائعاً على نصفها** — وطبقةُ
 * التدرّج فوقها تضمن القاع.
 *
 * **٣ · وجوهُ من يتكلّم** متراكبةً بحلقةِ فصل — **أشخاصٌ لا مشاركات**:
 * من كتب خمسَ مشاركاتٍ وجهٌ واحد.
 *
 * **ولا نجمةَ في البطاقة** (كانت في D-216): **النجمةُ حكمٌ، والغرفةُ
 * ليست حكماً** — ورقمُ التقييم يعيش في صفحة العمل وفي `/review` حيث
 * معناه واضح. **وعنصرٌ يبقى بعد أن سقط سببُه هو كيف تتراكم الفوضى.**
 */
/**
 * 🆕 **بطاقةُ الغرفة الواحدة، مُخرَجةً باسمها** (D-291) — **مكوّنٌ واحدٌ
 * لسطحين لا نسختان تتباعدان** (حجّةُ `CommunityListCard` نفسُها، D-068).
 *
 * **والسببُ المباشر:** لوحةُ الأعضاء صارت تحمل بطاقةً عريضةً واحدةً
 * لأكثرِ عملٍ يدور حوله الكلام، **وهي هذه البطاقةُ بحجمٍ أكبر لا بطاقةٌ
 * ثانية.** **ولو نُسخت لعاد عطلُ D-289 بعينه**: تدرّجُ الغطاء هنا صُحّح
 * مرّتين — شفافيّتُه ثم اتّجاهُه — **ونسخةٌ ثانيةٌ منه تُصلَح مرّةً
 * وتبقى الأخرى مقلوبةً في اتّجاهٍ واحد** (D-145).
 *
 * ⚠️ **و`hero` تغيّر المقاساتِ وحدَها**: لا لوناً ولا ترتيباً ولا تدرّجاً
 * ولا حقلاً يظهر أو يغيب — **متغيّرٌ يغيّر أكثرَ من الحجم يصير عائلةً
 * ثانيةً باسمِ متغيّر** (القاعدة ٣).
 */
export function TalkRoomCard({
  room: r,
  locale,
  hero = false,
  weekly = false,
  activity = false,
  pinned,
  globalPinned,
  admin,
}: {
  room: TalkRoom;
  locale: Locale;
  /** **البطاقةُ العريضةُ الواحدة** في لوحة الأعضاء — المقاساتُ وحدَها تكبر */
  hero?: boolean;
  /**
   * 🆕 **العدّادُ يعدّ الأسبوعَ لا العمرَ كلَّه** (D-311) — لبطاقة D-291
   * وحدَها: عنوانُها يقول «هذا الأسبوع» **فالرقمُ تحته يملك النافذةَ
   * نفسَها** (D-219). **وليس داخل `hero` عمداً**: ذاك مقاساتٌ فقط
   * (القاعدة ٣)، **وهذا معنى الرقم** — علَمان لهمّين مختلفين.
   */
  weekly?: boolean;
  /** 🆕 D-1201 — **ترتيبُ «الأكثر تفاعلاً»**: الرقمُ رقمُ الترتيب (تفاعلُ الأسبوع) — وإلّا بدا الترتيبُ عشوائيّاً (D-219) */
  activity?: boolean;
  /**
   * 🆕 **حالةُ التثبيت** (D-301) — **وغيابُها يعني «لا دبّوس هنا»** لا
   * «غيرُ مثبَّتة»: **بطاقةُ لوحة الأعضاء ليست قائمةً تُرتَّب** (D-291)،
   * **ودبّوسٌ لا يرتّب شيئاً وعدٌ مكسور** (D-217).
   * **فالتمييزُ `undefined` مقابلَ `boolean`، لا عَلَمٌ ثانٍ** (D-182).
   */
  pinned?: boolean;
  /** 🆕 **مثبَّتةٌ للجميع** (D-314) — علامةٌ لغير الإدارة وزرٌّ لها */
  globalPinned?: boolean;
  /** 🆕 **القارئُ إدارة** (D-314) */
  admin?: boolean;
}) {
  const t = getDict(locale);
  const poster = posterUrl(r.posterPath, "w185");
  /* ⚠️ **والمقاسُ تبع الظهور** (بلاغُ أحمد: «الغلاف ماهو واضح»):
     كان `w300` **لأن الطبقة كانت ١٤٪ فلا تكاد تُرى** — ومنطقُ ذلك
     سليمٌ لتلك الشفافية. **ولمّا صارت ٤٠٪ صار `w300` ممدوداً على
     ٦٨٠px يُقرأ ضبابياً**، فالحجّةُ التي اشترت الصغَر ماتت بموت
     سببها (D-250). */
  const backdrop = backdropUrl(r.backdropPath, "w780");
  const title = r.title?.trim() || t.talkFallbackTitle;
  /* **آخرُ حلقةٍ نشرها Loopz هنا** (D-273 · الهجرة ٨٧) — **وقارئٌ
     ثالثٌ لـ`bulletinLine`** لا نسخةٌ ثالثة من فكّ `data`: نفسُ
     الحقول (`s` · `e` · `name_*`) ونفسُ اختيار اللغة، **والصيغةُ
     وحدَها تختلف** فتُمرَّر من هنا (D-261: الصيغةُ التي يقرؤها
     أكثرُ من موضع تملكها دالّةٌ واحدة). */
  const episode = bulletinEpisodeShort(r.bulletin, t); // D-1494 — الصيغةُ المختصرة

  return (
    /* ⚠️ **والغلافُ نسبيٌّ لأن الدبّوسَ مطلقٌ فيه** (D-301) — **وهو أخٌ
       للرابط لا ابنٌ له**: **زرٌّ داخل رابطٍ عطلٌ يمسكه فحصُنا** (D-155).
       **ولا غلافَ حين لا دبّوس**: عقدةٌ في الشجرة بلا سبب (D-229). */
    <Wrap pinned={pinned} globalPinned={globalPinned} admin={admin} room={r} locale={locale}>
    <Link
      href={`/talk/${r.mediaType}/${r.tmdbId}`}
      className="relative overflow-hidden flex gap-3.5 p-3 rounded-2xl bg-surface border border-border group active:scale-[0.99] hover:border-[color:var(--divider)] transition"
    >
        {/* 🆕 D-1494 — **التصميمُ الجديد** (لقطةُ أحمد ٢٠ أكتوبر، نظيرُ `RoomCard` في التطبيق): الغلافُ ظاهرٌ كاملاً تحت ظلٍّ من
            لون السطح قويٍّ في البداية (حيث البوسترُ والنصّ) خفيفٍ في النهاية — كان باهتاً (٤٠٪) تحت ظلٍّ ينتهي عند ٥٥٪.
            ⚠️ والاتّجاهُ كما صُحّح في D-289: `to-r` يضع البدايةَ يساراً (LTR) و`rtl:to-l` يميناً. */}
        {backdrop && (
          <>
            <Image src={backdrop} alt="" fill sizes="680px" className="object-cover pointer-events-none" />
            <span
              aria-hidden
              className="absolute inset-0 pointer-events-none bg-gradient-to-r rtl:bg-gradient-to-l from-[color:var(--surface)]/95 via-[color:var(--surface)]/80 via-[45%] to-[color:var(--surface)]/20"
            />
          </>
        )}

        {/* ============ البوسترُ الكبيرُ في البداية ============ */}
        <div
          className={`relative shrink-0 rounded-xl overflow-hidden bg-surface-2 border border-border aspect-[2/3] ${
            hero ? "w-24" : "w-[84px]"
          }`}
        >
          {poster ? (
            <Image src={poster} alt="" fill sizes={hero ? "96px" : "84px"} className="object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-muted">
              <Icon name={r.mediaType === "tv" ? "tv" : "film"} size={18} />
            </span>
          )}
        </div>

        {/* ============ ثلاثةُ أسطرٍ قصيرة ثمّ الوجوه ============ */}
        <div className="relative min-w-0 flex-1 flex flex-col gap-1.5 py-1">
          {/* ⚠️ ولا `dir` على العنوان (D-273): الجملةُ جملتُنا فتتبع لغةَ الواجهة، والاسمُ معزولٌ داخل `i18n` */}
          <h3 className={`font-bold leading-snug line-clamp-1 pe-8 group-hover:text-accent transition ${hero ? "text-20" : "text-lg"}`}>
            {t.talkRoomTitle(title, r.mediaType === "tv")}
          </h3>
          {/* «الحلقة ١٠ · الموسم ٣» — آخرُ حلقةٍ نشرها Loopz هنا؛ والأفلامُ بلا سطر (D-181) */}
          {episode && <p className="text-14 line-clamp-1">{episode}</p>}
          <p className="text-12 text-muted tabular-nums line-clamp-1">
            {activity ? t.talkRoomActivityMonth(talkActivity(r)) : weekly ? t.talkRoomPostsWeek(r.postsWeek) : t.talkRoomPosts(r.posts)}
            {/* 🔴 D-1207 — الوقتُ من مشاركات الأعضاء لا من إشعار الحلقة */}
            {r.lastPostAt ? ` · ${timeAgo(r.lastPostAt, t)}` : null}
          </p>
          {r.faces.length ? (
            <div className="mt-auto flex items-center">
              {r.faces.slice(0, 3).map((p, i) => (
                <span key={p.id} className="rounded-full ring-2 ring-[color:var(--surface)]" style={{ marginInlineStart: i === 0 ? 0 : -8 }}>
                  <Avatar src={p.avatar_url} name={displayNameOf(p, t.anonymousUser)} size={28} alt="" />
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
    </Wrap>
  );
}

/**
 * **الغلافُ النسبيُّ ودبّوسُه — أو لا شيء** (D-301).
 *
 * **وصفةٌ لا مكوّنٌ عامّ** (D-145): سطرانِ يخصّان هذه البطاقةَ وحدَها،
 * **ومكوّنٌ مُصدَّرٌ لهما كان سيوحي بأنه يخدم غيرها.**
 */
function Wrap({
  pinned,
  globalPinned,
  admin,
  room,
  locale,
  children,
}: {
  pinned?: boolean;
  /** 🆕 **مثبَّتةٌ للجميع** (D-314) — علامةٌ لا زرٌّ لغير الإدارة */
  globalPinned?: boolean;
  /** 🆕 **القارئُ إدارة** — دبّوسُه يكتب للجميع (D-314) */
  admin?: boolean;
  room: TalkRoom;
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = getDict(locale);
  if (pinned === undefined && !globalPinned && !admin) return <>{children}</>;
  return (
    <div className="relative">
      {children}
      {admin ? (
        /* **زرُّ الإدارة يحلّ محلَّ الشخصيّ** — دبّوسان في زاويةٍ واحدة
           التباسٌ (D-216)، **والإدارةُ حين تثبّت تثبّت للناس.** */
        <RoomPinButton
          tmdbId={room.tmdbId}
          mediaType={room.mediaType}
          pinned={globalPinned === true}
          locale={locale}
          global
        />
      ) : globalPinned ? (
        /* **علامةٌ لا زرّ**: التثبيتُ الرسميُّ ليس فعلَ القارئ —
           **وزرٌّ لا يفعل شيئاً وعدٌ مكسور** (D-217). */
        <span
          title={t.talkPinnedByLoopz}
          aria-label={t.talkPinnedByLoopz}
          className="absolute top-2 end-2 z-10 w-7 h-7 grid place-items-center text-accent drop-shadow"
        >
          <Icon name="pin-filled" size={17} strokeWidth={2.2} />
        </span>
      ) : pinned !== undefined ? (
        <RoomPinButton
          tmdbId={room.tmdbId}
          mediaType={room.mediaType}
          pinned={pinned}
          locale={locale}
        />
      ) : null}
    </div>
  );
}

export function WorksTalk({
  rooms,
  locale,
  pins,
  globalPins,
  admin = false,
  activity = false,
}: {
  rooms: TalkRoom[];
  /** 🆕 D-1201 — «الأكثر تفاعلاً»: البطاقاتُ تقول رقمَ الترتيب */
  activity?: boolean;
  locale: Locale;
  /**
   * 🆕 **مفاتيحُ غرفي المثبَّتة** (D-301) — **مجموعةٌ لا خريطة**:
   * السؤالُ «أمثبَّتةٌ؟» سؤالُ وجود. **وغيابُها يُسقط الدبّوسَ كلَّه**
   * (زائرٌ لا يثبّت شيئاً — D-221).
   */
  pins?: Set<string>;
  /** 🆕 **مفاتيحُ المثبَّت للجميع** (D-314) — نفسُ الصيغة (D-237) */
  globalPins?: Set<string>;
  /** 🆕 **القارئُ إدارة** — دبّوسُه يكتب للجميع (D-314) */
  admin?: boolean;
}) {
  return (
    /* **بطاقاتٌ متباعدة لا صفوفٌ يفصلها خطّ**: الخطُّ الفاصل يقول «هذه
       عناصرُ قائمةٍ تُمسح» — وهو صوابُ خطّ النشاط حيث الصفُّ جملةٌ تُقرأ
       ثم تُترك. **والبطاقةُ تقول «هذا مكانٌ يُدخَل»**، وغرفةُ نقاشٍ مكانٌ
       لا جملة. */
    <div className="space-y-2.5">
      {rooms.map((r) => (
        <TalkRoomCard
          key={`${r.mediaType}-${r.tmdbId}`}
          room={r}
          locale={locale}
          pinned={pins ? pins.has(`${r.mediaType}-${r.tmdbId}`) : undefined}
          globalPinned={globalPins?.has(`${r.mediaType}-${r.tmdbId}`) ?? false}
          admin={admin}
          activity={activity}
        />
      ))}
    </div>
  );
}
