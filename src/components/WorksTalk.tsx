import Link from "next/link";
import Image from "next/image";
import { posterUrl, backdropUrl } from "@/lib/tmdb";
import { getDict, type Locale } from "@/lib/i18n";
import { timeAgo } from "@/lib/when";
import { displayNameOf } from "@/lib/people";
import type { TalkRoom } from "@/lib/data";
import { bulletinLine } from "@/lib/bulletinLine";
import { Avatar } from "./Avatar";
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
 * **وسمُ الحلقة على البطاقة** — `bulletinLine` بصيغةٍ أخرى.
 *
 * **ولماذا لا تُستعمل جملتُها كما هي:** تلك خبرٌ («نزلت الحلقة ٣…»)
 * يصلح يومَ نزولها، **والبطاقةُ تُقرأ بعد أسبوعين** — فيصير الخبرُ
 * كذبةً صغيرة. **ونفسُ الحقول، ونفسُ اختيار اللغة، وصيغةٌ ثانية.**
 */
function bulletinLabel(
  data: Record<string, unknown> | null,
  t: ReturnType<typeof getDict>,
  locale: Locale,
): string | null {
  if (!data) return null;
  /* **والتحقّقُ من الشكل يبقى في `bulletinLine`** — فإن عادت `null` فلا
     موسمَ ولا حلقة، **ولا يُعاد فحصُ ما فُحص** (D-148: العلاج عند المصدر). */
  if (!bulletinLine("episode", data, t, locale)) return null;
  const season = Number(data.s);
  const episode = Number(data.e);
  const raw = locale === "en" ? data.name_en : data.name_ar;
  const alt = locale === "en" ? data.name_ar : data.name_en;
  const pick = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return t.talkRoomEpisode(season, episode, pick(raw) ?? pick(alt));
}
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
}: {
  room: TalkRoom;
  locale: Locale;
  /** **البطاقةُ العريضةُ الواحدة** في لوحة الأعضاء — المقاساتُ وحدَها تكبر */
  hero?: boolean;
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
  const episode = bulletinLabel(r.bulletin, t, locale);

  return (
    <Link
      href={`/talk/${r.mediaType}/${r.tmdbId}`}
      className={`relative overflow-hidden flex rounded-2xl bg-surface border border-border group active:scale-[0.99] hover:border-[color:var(--divider)] transition ${
        hero ? "gap-4 p-4" : "gap-3.5 p-3.5"
      }`}
    >
        {/* ============ خلفيّةُ الغلاف ============ */}
        {backdrop && (
          <>
            <Image
              src={backdrop}
              alt=""
              fill
              sizes="680px"
              className="object-cover opacity-[0.40] pointer-events-none"
            />
            {/* **طبقةٌ من لون السطح إلى الشفّاف باتّجاه البداية**:
                النصُّ والملصقُ كلاهما في البداية، **فالحمايةُ حيث
                يُقرأ لا على البطاقة كلِّها**.
                ⚠️ **وهنا كان نصفُ العطل** (بلاغُ أحمد): الوسَطُ كان
                `‎/85` **بلا موضعٍ محدَّد، فيمتدّ الغطاءُ الكثيفُ إلى
                نحو ٨٥٪ من العرض** — فيجتمع على الغلاف خفوتان:
                شفافيّتُه، والغطاءُ فوقه. **وطبقتان تخفتان معاً حاصلُهما
                الغياب.**
                **والآن الكثافةُ تنتهي عند ٥٥٪** (`via-[55%]`) بقيمةٍ
                أخفّ (`‎/70`)، **فالنصفُ الأوّل محميٌّ والثاني يُرى فيه
                العمل.**

                ⚠️⚠️ **والنصفُ الثاني من العطل كان الاتّجاهَ نفسَه، ولم
                يُمسك إلا بقياس `getComputedStyle`:** كان
                `bg-gradient-to-l` في LTR — **و`to left` تضع `from`
                عند اليمين** — بينما الملصقُ والنصُّ في البداية
                (اليسار). **فالغطاءُ كان على الفراغ، والغلافُ مكشوفٌ
                تحت النصّ حيث لا يُنظر إليه** — وهو سببُ «الغلاف ماهو
                واضح» أكثرَ من الشفافية.
                **والقاعدة: `to-r` تضع البدايةَ يساراً و`to-l` تضعها
                يميناً — فالمحاذاةُ مع `start` عكسُ ما يوحي به الاسم.**
                (وكان مقلوباً في الاتّجاهين معاً منذ D-257.) */}
            <span
              aria-hidden
              className="absolute inset-0 pointer-events-none bg-gradient-to-r rtl:bg-gradient-to-l from-[color:var(--surface)] via-[color:var(--surface)]/70 via-[55%] to-transparent"
            />
          </>
        )}

        {/* ============ الملصقُ في البداية ============ */}
        <div
          className={`relative shrink-0 self-start rounded-xl overflow-hidden bg-surface-2 border border-border ${
            hero ? "w-[78px] h-[117px]" : "w-16 h-24"
          }`}
        >
          {poster ? (
            <Image src={poster} alt="" fill sizes={hero ? "78px" : "64px"} className="object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-muted">
              <Icon name={r.mediaType === "tv" ? "tv" : "film"} size={18} />
            </span>
          )}
        </div>

        <div className="relative min-w-0 flex-1 flex flex-col">
          {/* **العنوانُ المولَّد هو البطاقة** — وأكبرُ نصٍّ فيها لأنه
              سببُ الضغط. و`line-clamp-2` لا `truncate`: عنوانٌ مقصوصٌ
              عند الحرف يفقد اسمَ العمل وهو أهمُّ ما فيه. */}
          {/* ⚠️ **ولا `dir` على العنوان** (D-273، بلاغُ أحمد «كيف طلع
              الاسم بالعربي؟»): **الجملةُ جملتُنا نحن** («نقاش مسلسل
              …») **فتتبع لغة الواجهة لا لغةَ الاسم المخزَّن** — وكان
              `dirOf(title)` يقلب السطرَ كلَّه لأن الاسمَ عربيّ.
              **والمعزولُ هو الاسمُ وحدَه، داخل `i18n`.**
              **والاسمُ نفسُه صار يُترجَم قبل أن يصل** (`localizeTalkRooms`). */}
          <h3
            className={`font-bold leading-snug line-clamp-2 group-hover:text-accent transition ${
              hero ? "text-[18px]" : "text-[16px]"
            }`}
          >
            {t.talkRoomTitle(title, r.mediaType === "tv")}
          </h3>

          {/* **وفي موضع العدّاد صارت الحلقة** (طلبُ أحمد): **رقمُ
              الموسم والحلقة وعنوانُها**، **ويتحدّث مع كل نشرٍ للوبز**
              لأن الدالّة تقرأ الأحدث.
              ⚠️ **وغرفةٌ بلا نشرةٍ لا تُرسم لها سطرٌ فارغ** (D-181):
              الأفلامُ لا حلقاتِ لها أصلاً، **وسطرٌ يظهر أحياناً خيرٌ
              من سطرٍ يقول «—» دائماً.** */}
          {episode && (
            <p className="mt-1.5 text-[12px] text-accent/90 line-clamp-1">{episode}</p>
          )}

          {/* **والقاعُ صفٌّ واحد: الوجوهُ في البداية والعدّادُ في
              النهاية** (طلبُ أحمد: «١ بوست وآخر بوست يكون تحت في
              الزاوية»).
              ⚠️ **و«النهاية» موضعٌ لا «اليمين»** (D-216): يمينٌ في
              الإنجليزية ويسارٌ في العربية — **وهو ما رسمه أحمد على
              واجهةٍ إنجليزية**، فتُكتب `ms-auto` لا `right`.
              **و`mt-auto` تُثبّت الصفَّ في القاع** مهما طال العنوان
              (D-224)، **والصفُّ يبقى وإن غابت الوجوه** فلا يقفز
              العدّادُ صعوداً في بطاقةٍ دون أخرى (D-234). */}
          <div className="mt-auto pt-2.5 flex items-end gap-2">
            <div className="flex items-center min-w-0">
              {r.faces.map((p, i) => (
                <span
                  key={p.id}
                  className="rounded-full ring-2 ring-[color:var(--surface)]"
                  style={{ marginInlineStart: i === 0 ? 0 : -8 }}
                >
                  <Avatar
                    src={p.avatar_url}
                    name={displayNameOf(p, t.anonymousUser)}
                    size={22}
                    alt=""
                  />
                </span>
              ))}
            </div>
            <div className="ms-auto shrink-0 text-[11px] text-muted text-end leading-tight">
              <span className="tabular-nums">{t.talkRoomPosts(r.posts)}</span>
              <span className="block">{t.talkRoomLastAt(timeAgo(r.lastAt, t))}</span>
            </div>
          </div>
        </div>
      </Link>
  );
}

export function WorksTalk({ rooms, locale }: { rooms: TalkRoom[]; locale: Locale }) {
  return (
    /* **بطاقاتٌ متباعدة لا صفوفٌ يفصلها خطّ**: الخطُّ الفاصل يقول «هذه
       عناصرُ قائمةٍ تُمسح» — وهو صوابُ خطّ النشاط حيث الصفُّ جملةٌ تُقرأ
       ثم تُترك. **والبطاقةُ تقول «هذا مكانٌ يُدخَل»**، وغرفةُ نقاشٍ مكانٌ
       لا جملة. */
    <div className="space-y-2.5">
      {rooms.map((r) => (
        <TalkRoomCard key={`${r.mediaType}-${r.tmdbId}`} room={r} locale={locale} />
      ))}
    </div>
  );
}
