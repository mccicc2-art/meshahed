package com.loopztv.app.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.app.PendingIntent
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import com.loopztv.app.R

/**
 * ====== 🆕 ودجتاتُ لوبز في أندرويد (خطّةُ الودجتات W1 … W13) ======
 *
 * ثلاثةُ ودجتات: «أكمل المشاهدة» (صغير · متوسط 4×2 · طوليّ 2×4) · «القادم» (صغير) · «فيلم الليلة» (صغير).
 * الأسودُ دائماً (W2). 🆕 W17 — **بطاقةُ «أكمل المشاهدة» هي بطاقةُ الرئيسيّة نفسُها**: الصورةُ العريضة والنسبةُ والشريط
 * (نقضُ W3 بقرار أحمد بعد أوّل تجربة: «لازم يكون شكلها مثل شكل اكمل المشاهدة داخل التطبيق»).
 * 🆕 W18 — **لا زوم**: كلُّ صورةٍ تُرسم بمقاس خانتها كما يقيسه المُشغِّل (`OPTION_APPWIDGET_*`)، ويُعاد الرسمُ حين يتغيّر المقاس.
 *
 * ⚖️ **`LoopzWidget` هو المتوسط** — الاسمُ القديمُ (D-929) باقٍ صنفاً: من وضع الودجتَ القديم على شاشته لا يجده
 * يختفي بعد التحديث، بل يتحوّل إلى المتوسط الجديد في مكانه.
 *
 * ✓ (W14) **مخفيٌّ في هذا البناء**: الرسمُ والمستقبِلُ هنا، والخادمُ يكتب `check: false` حتى الدفعة الثانية (OTA).
 */
abstract class BaseWidget : AppWidgetProvider() {
  abstract fun render(ctx: Context, id: Int, feed: WFeed): RemoteViews
  abstract val layout: Int

  override fun onUpdate(ctx: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { id -> manager.updateAppWidget(id, build(ctx, id)) }
  }

  /** 🆕 W18 — مقاسٌ جديد (تكبيرٌ أو تصغيرٌ أو دوران) ⇒ الصورُ تُرسم بمقاسها الجديد لا تُمَطّ القديمة */
  override fun onAppWidgetOptionsChanged(ctx: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    manager.updateAppWidget(id, build(ctx, id))
  }

  /** مقاسُ الودجت الآن بالـdp — عرضُ الوضع العمودي (`MIN_WIDTH`) وارتفاعُه (`MAX_HEIGHT`)، وإلّا ما يعطيه الصنف */
  open val fallbackDp: Pair<Float, Float> = 150f to 170f

  fun sizeDp(ctx: Context, id: Int): Pair<Float, Float> {
    val o = AppWidgetManager.getInstance(ctx).getAppWidgetOptions(id)
    val w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
    val h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)
    return if (w > 0 && h > 0) w.toFloat() to h.toFloat() else fallbackDp
  }

  override fun onDeleted(ctx: Context, ids: IntArray) {
    val e = prefs(ctx).edit()
    ids.forEach { id ->
      e.remove("src_$id")
      e.remove("tn_$id")
      e.remove("undo_$id")
    }
    e.apply()
  }

  fun build(ctx: Context, id: Int): RemoteViews {
    return when (val f = WFeed.load(ctx)) {
      is WFeed -> try {
        render(ctx, id, f).also { it.setInt(R.id.root, "setLayoutDirection", if (f.rtl) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR) }
      } catch (e: Exception) {
        empty(ctx, id, ctx.getString(R.string.w_open_app))
      }
      WFeed.SIGNED_OUT -> empty(ctx, id, ctx.getString(R.string.w_signed_out))
      else -> empty(ctx, id, ctx.getString(R.string.w_open_app))
    }
  }

  /** لا ملفَّ أو خرج صاحبُه: سطرٌ يقول ماذا يفعل، واللمسةُ تفتح التطبيق */
  fun empty(ctx: Context, id: Int, text: String): RemoteViews {
    val v = RemoteViews(ctx.packageName, layout)
    v.setViewVisibility(R.id.empty, View.VISIBLE)
    v.setTextViewText(R.id.empty, text)
    hideBody(v)
    WLinks.launch(ctx, id * 100)?.let { v.setOnClickPendingIntent(R.id.root, it) }
    return v
  }

  open fun hideBody(v: RemoteViews) {
    v.setViewVisibility(R.id.body, View.GONE)
  }

  fun refreshAll(ctx: Context) {
    val m = AppWidgetManager.getInstance(ctx)
    val ids = m.getAppWidgetIds(ComponentName(ctx, this::class.java))
    onUpdate(ctx, m, ids)
  }

  companion object {
    const val PREFS = "loopz_widget_cfg"
    fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** يعيد رسمَ كلِّ ودجتات لوبز — بعد الضبط أو بعد ✓ */
    fun redrawAll(ctx: Context) {
      val m = AppWidgetManager.getInstance(ctx)
      for (cls in listOf(
        LoopzWidget::class.java, ContinueSmallWidget::class.java, ContinueLargeWidget::class.java,
        ComingUpWidget::class.java, TonightSmallWidget::class.java,
      )) {
        val ids = m.getAppWidgetIds(ComponentName(ctx, cls))
        if (ids.isEmpty()) continue
        ctx.sendBroadcast(Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).setComponent(ComponentName(ctx, cls)).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids))
      }
    }

    const val FADED_TEXT = 0x8CF7F7F7.toInt()
    const val TEXT = 0xFFF7F7F7.toInt()
    const val MUTED = 0xFFB5B5B5.toInt()
    const val FADED_IMAGE = 140
  }
}

/* ============ «أكمل المشاهدة» — مصدرُ الخانات (W4 · W5 · W10) ============ */

/** خانةٌ مرسومة: عملٌ، أو باهتةٌ من «للمشاهدة»، أو «ابدأ عملاً» */
sealed class Slot {
  data class Item(val t: WTitle, val sub: String?, val link: String, val checkable: WContinue?) : Slot()
  data class Faded(val t: WTitle, val sub: String, val link: String) : Slot()
  data class Start(val text: String) : Slot()
}

data class Source(val title: String, val all: Pair<String, String>?, val slots: List<Slot>, val headerLink: String?)

fun sourceOf(ctx: Context, id: Int, f: WFeed, max: Int = 3): Source {
  val src = BaseWidget.prefs(ctx).getString("src_$id", "continue") ?: "continue"
  if (src == "towatch") {
    val slots = f.towatchAll.take(max).map { t ->
      Slot.Item(t, if (t.kind == "movie") f.s("movieType") else f.s("seriesType"), WLinks.title(t), null)
    }
    return Source(f.s("towatchTitle"), null, slots, WLinks.all("towatch"))
  }
  if (src.startsWith("list:")) {
    val l = f.lists.firstOrNull { it.id == src.removePrefix("list:") }
    if (l != null) {
      val slots = l.items.take(max).map { t -> Slot.Item(t, if (t.kind == "movie") f.s("movieType") else f.s("seriesType"), WLinks.title(t), null) }
      return Source(l.name, null, slots, WLinks.list(l.id))
    }
    /* قائمةٌ حُذفت بعد اختيارها: الافتراضيّ لا ودجتٌ فارغ */
  }
  val slots = mutableListOf<Slot>()
  f.cont.take(max).forEach { c -> slots.add(Slot.Item(c.t, c.sub ?: c.label, WLinks.title(c.t), c)) }
  val seen = slots.map { (it as Slot.Item).t.id }.toMutableSet()
  for (w in f.towatch) {
    if (slots.size >= max) break
    if (w.t.id in seen) continue
    seen.add(w.t.id)
    slots.add(Slot.Faded(w.t, f.s("towatchStart"), WLinks.start(w.t, w.action)))
  }
  if (slots.size < max && f.towatch.isEmpty()) slots.add(Slot.Start(f.s("startSomething")))
  val all = if (f.contTotal > max) f.s("allCount").replace("%d", f.contTotal.toString()) to WLinks.all("continue") else null
  return Source(f.s("continueTitle"), all, slots, WLinks.all("continue"))
}


/* ============ البطاقات (W17 · W19 · W20 · W22) ============ */

private val CARD = intArrayOf(R.id.card_1, R.id.card_2, R.id.card_3)
private val CARD_IMG = intArrayOf(R.id.card_img_1, R.id.card_img_2, R.id.card_img_3)
private val CARD_PLUS = intArrayOf(R.id.card_plus_1, R.id.card_plus_2, R.id.card_plus_3)
private val CARD_CHECK = intArrayOf(R.id.card_check_1, R.id.card_check_2, R.id.card_check_3)
private val CARD_TEXT = intArrayOf(R.id.card_text_1, R.id.card_text_2, R.id.card_text_3)
private val CARD_NAME = intArrayOf(R.id.card_name_1, R.id.card_name_2, R.id.card_name_3)
private val CARD_SUB = intArrayOf(R.id.card_sub_1, R.id.card_sub_2, R.id.card_sub_3)
private val CARD_PCT = intArrayOf(R.id.card_pct_1, R.id.card_pct_2, R.id.card_pct_3)

fun drawHeader(ctx: Context, v: RemoteViews, id: Int, s: Source) {
  v.setTextViewText(R.id.hdr_title, s.title)
  s.headerLink?.let { v.setOnClickPendingIntent(R.id.hdr_title, WLinks.open(ctx, it, id * 100 + 1)) }
  if (s.all != null) {
    v.setViewVisibility(R.id.hdr_all, View.VISIBLE)
    v.setTextViewText(R.id.hdr_all, s.all.first)
    v.setOnClickPendingIntent(R.id.hdr_all, WLinks.open(ctx, s.all.second, id * 100 + 2))
  } else v.setViewVisibility(R.id.hdr_all, View.GONE)
}

/** يرسم `n` بطاقةً بمقاس `wDp × hDp` لكلٍّ منها — الصورةُ بمقاس خانتها، والنصوصُ فوقها */
fun drawCards(ctx: Context, v: RemoteViews, id: Int, f: WFeed, s: Source, n: Int, wDp: Float, hDp: Float) {
  for (i in 0 until n) {
    val slot = s.slots.getOrNull(i)
    /* خانةٌ بلا محتوى تبقى مكانَها (INVISIBLE) — العرضُ لا يتمدّد فيتبدّل مقاسُ البطاقات بين حالةٍ وأخرى */
    if (slot == null) {
      v.setViewVisibility(CARD[i], View.INVISIBLE)
      continue
    }
    v.setViewVisibility(CARD[i], View.VISIBLE)
    v.setViewVisibility(CARD_CHECK[i], View.GONE)
    when (slot) {
      is Slot.Item -> {
        val c = slot.checkable
        val bmp = WArt.card(ctx, c?.backdrop, slot.t.poster, wDp, hDp, f.rtl, c?.pct)
        if (bmp != null) v.setImageViewBitmap(CARD_IMG[i], bmp) else v.setImageViewResource(CARD_IMG[i], android.R.color.transparent)
        v.setViewVisibility(CARD_IMG[i], View.VISIBLE)
        v.setViewVisibility(CARD_PLUS[i], View.GONE)
        v.setViewVisibility(CARD_TEXT[i], View.VISIBLE)
        v.setTextViewText(CARD_NAME[i], slot.t.title)
        v.setTextColor(CARD_NAME[i], 0xFFFFFFFF.toInt())
        v.setTextViewText(CARD_SUB[i], slot.sub ?: "")
        v.setTextColor(CARD_SUB[i], 0xBFFFFFFF.toInt())
        if (c != null) {
          v.setViewVisibility(CARD_PCT[i], View.VISIBLE)
          v.setTextViewText(CARD_PCT[i], "${c.pct}%")
        } else v.setViewVisibility(CARD_PCT[i], View.GONE)
        v.setOnClickPendingIntent(CARD[i], WLinks.open(ctx, slot.link, id * 100 + 10 + i))
        if (f.check && c?.season != null && c.episode != null) {
          v.setViewVisibility(CARD_CHECK[i], View.VISIBLE)
          v.setOnClickPendingIntent(CARD_CHECK[i], CheckReceiver.intent(ctx, id * 100 + 20 + i, c))
        }
      }
      is Slot.Faded -> {
        val bmp = WArt.card(ctx, null, slot.t.poster, wDp, hDp, f.rtl, null, BaseWidget.FADED_IMAGE)
        if (bmp != null) v.setImageViewBitmap(CARD_IMG[i], bmp) else v.setImageViewResource(CARD_IMG[i], android.R.color.transparent)
        v.setViewVisibility(CARD_IMG[i], View.VISIBLE)
        v.setViewVisibility(CARD_PLUS[i], View.GONE)
        v.setViewVisibility(CARD_TEXT[i], View.VISIBLE)
        v.setViewVisibility(CARD_PCT[i], View.GONE)
        v.setTextViewText(CARD_NAME[i], slot.t.title)
        v.setTextColor(CARD_NAME[i], BaseWidget.FADED_TEXT)
        v.setTextViewText(CARD_SUB[i], slot.sub)
        v.setTextColor(CARD_SUB[i], 0xFFFFD400.toInt())
        v.setOnClickPendingIntent(CARD[i], WLinks.open(ctx, slot.link, id * 100 + 10 + i))
      }
      is Slot.Start -> {
        v.setViewVisibility(CARD_IMG[i], View.GONE)
        v.setViewVisibility(CARD_TEXT[i], View.GONE)
        v.setViewVisibility(CARD_PLUS[i], View.VISIBLE)
        v.setTextViewText(CARD_PLUS[i], "+  " + slot.text)
        v.setOnClickPendingIntent(CARD[i], WLinks.open(ctx, WLinks.discover(), id * 100 + 10 + i))
      }
    }
  }
}

/** المتوسط 4×2 — `LoopzWidget` باسمه القديم (D-929): بطاقتان وسطرُ «القادم» (W19) */
class LoopzWidget : BaseWidget() {
  override val layout = R.layout.loopz_w_continue_m
  override val fallbackDp = 320f to 170f
  override fun render(ctx: Context, id: Int, feed: WFeed): RemoteViews {
    val v = RemoteViews(ctx.packageName, layout)
    v.setViewVisibility(R.id.empty, View.GONE)
    v.setViewVisibility(R.id.body, View.VISIBLE)
    val s = sourceOf(ctx, id, feed, max = 2)
    drawHeader(ctx, v, id, s)
    val (w, h) = sizeDp(ctx, id)
    /* حشوةٌ ١٢ جانباً و١١ + ٦ · الرأسُ ٢٤ · سطرُ «القادم» ٣٨ · بين البطاقتين ٩ */
    val cardW = ((w - 24f - 9f) / 2f).coerceAtLeast(40f)
    val cardH = (h - 17f - 24f - 38f).coerceAtLeast(40f)
    drawCards(ctx, v, id, feed, s, 2, cardW, cardH)
    drawUpLine(ctx, v, id, feed)
    return v
  }
}

/** سطرُ «القادم» تحت البطاقتين: أقربُ موعدٍ لمسلسلٍ يتابعه، ولمستُه التقويم */
fun drawUpLine(ctx: Context, v: RemoteViews, id: Int, f: WFeed) {
  val u = f.upcomingNow().firstOrNull()
  v.setOnClickPendingIntent(R.id.up_line, WLinks.open(ctx, WLinks.calendar(), id * 100 + 3))
  if (u == null) {
    v.setViewVisibility(R.id.up_day, View.GONE)
    v.setViewVisibility(R.id.up_img, View.GONE)
    v.setViewVisibility(R.id.up_name, View.GONE)
    v.setTextViewText(R.id.up_label, f.s("noUpcoming"))
    return
  }
  if (u.date != null) {
    v.setViewVisibility(R.id.up_day, View.VISIBLE)
    v.setTextViewText(R.id.up_day, f.dayLabel(u.date))
  } else v.setViewVisibility(R.id.up_day, View.GONE)
  val bmp = WPosters.load(ctx, u.t.poster, 15f, 22f, 3f)
  if (bmp != null) {
    v.setViewVisibility(R.id.up_img, View.VISIBLE)
    v.setImageViewBitmap(R.id.up_img, bmp)
  } else v.setViewVisibility(R.id.up_img, View.GONE)
  v.setViewVisibility(R.id.up_name, View.VISIBLE)
  v.setTextViewText(R.id.up_name, u.t.title)
  v.setTextViewText(R.id.up_label, listOfNotNull(u.behind ?: u.label).joinToString("").let { if (it.isEmpty()) "" else "· $it" })
}

/** الطوليّ 2×4 (W20) — الصنفُ اسمُ «الكبير» القديم، فمن وضع الكبيرَ يجده طوليّاً في مكانه */
class ContinueLargeWidget : BaseWidget() {
  override val layout = R.layout.loopz_w_continue_l
  override val fallbackDp = 160f to 380f
  override fun render(ctx: Context, id: Int, feed: WFeed): RemoteViews {
    val v = RemoteViews(ctx.packageName, layout)
    v.setViewVisibility(R.id.empty, View.GONE)
    v.setViewVisibility(R.id.body, View.VISIBLE)
    val s = sourceOf(ctx, id, feed, max = 3)
    drawHeader(ctx, v, id, s)
    val (w, h) = sizeDp(ctx, id)
    /* حشوةٌ ٨ جانباً و١٠ + ٨ · الرأسُ ٢٣ · فاصلان ٧ */
    val cardW = (w - 16f).coerceAtLeast(40f)
    val cardH = ((h - 18f - 23f - 14f) / 3f).coerceAtLeast(40f)
    drawCards(ctx, v, id, feed, s, 3, cardW, cardH)
    return v
  }
}

/* ============ الصغار (W21 · W22) ============ */

/** صغير «أكمل المشاهدة» = بطاقةٌ واحدةٌ تملأ الودجت (ص١: عملٌ ثابت، «كذا تسير لخبطه») */
class ContinueSmallWidget : BaseWidget() {
  override val layout = R.layout.loopz_w_card_s
  override fun render(ctx: Context, id: Int, feed: WFeed): RemoteViews {
    val v = RemoteViews(ctx.packageName, layout)
    v.setViewVisibility(R.id.empty, View.GONE)
    v.setViewVisibility(R.id.body, View.VISIBLE)
    val s = sourceOf(ctx, id, feed, max = 1)
    val (w, h) = sizeDp(ctx, id)
    drawCards(ctx, v, id, feed, s, 1, w, h)
    /* اللمسةُ على الودجت كلِّه لا على البطاقة وحدَها */
    when (val slot = s.slots.firstOrNull()) {
      is Slot.Item -> v.setOnClickPendingIntent(R.id.root, WLinks.open(ctx, slot.link, id * 100 + 10))
      is Slot.Faded -> v.setOnClickPendingIntent(R.id.root, WLinks.open(ctx, slot.link, id * 100 + 10))
      else -> v.setOnClickPendingIntent(R.id.root, WLinks.open(ctx, WLinks.discover(), id * 100 + 10))
    }
    return v
  }
}

/** الصغيرُ بالملصق: بطاقةُ «To watch» — الملصقُ كلُّه بمقاس الودجت، والشارةُ فوق، والاسمُ على الحافة السفلى */
abstract class PosterWidget : BaseWidget() {
  override val layout = R.layout.loopz_w_small
  override fun hideBody(v: RemoteViews) {
    listOf(R.id.full_img, R.id.full_scrim, R.id.full_top, R.id.full_name, R.id.full_sub, R.id.full_action, R.id.full_plus)
      .forEach { v.setViewVisibility(it, View.GONE) }
  }

  fun base(ctx: Context): RemoteViews {
    val v = RemoteViews(ctx.packageName, layout)
    v.setViewVisibility(R.id.empty, View.GONE)
    v.setViewVisibility(R.id.full_plus, View.GONE)
    v.setViewVisibility(R.id.full_action, View.GONE)
    /* التظليلُ مرسومٌ في الصورة نفسِها (`WArt.posterFull`) — الحجابُ القديمُ الكاملُ لا يُرسم */
    v.setViewVisibility(R.id.full_scrim, View.GONE)
    v.setInt(R.id.full_top, "setBackgroundResource", 0)
    v.setTextColor(R.id.full_top, 0xFFFFD400.toInt())
    return v
  }

  fun poster(ctx: Context, v: RemoteViews, id: Int, t: WTitle) {
    val (w, h) = sizeDp(ctx, id)
    v.setViewVisibility(R.id.full_img, View.VISIBLE)
    val bmp = WArt.posterFull(ctx, t.poster, w, h)
    if (bmp != null) v.setImageViewBitmap(R.id.full_img, bmp) else v.setImageViewResource(R.id.full_img, android.R.color.transparent)
    v.setViewVisibility(R.id.full_name, View.VISIBLE)
    v.setTextViewText(R.id.full_name, t.title)
    v.setTextColor(R.id.full_name, TEXT)
  }

  fun emptyText(ctx: Context, v: RemoteViews, id: Int, text: String, link: String?) {
    hideBody(v)
    v.setViewVisibility(R.id.empty, View.VISIBLE)
    v.setTextViewText(R.id.empty, text)
    if (link != null) v.setOnClickPendingIntent(R.id.root, WLinks.open(ctx, link, id * 100 + 5))
  }
}

/** صغير «القادم»: أقربُ موعدٍ دائماً (W9) — «+١» حين ينزل اثنان في اليوم نفسِه */
class ComingUpWidget : PosterWidget() {
  override fun render(ctx: Context, id: Int, feed: WFeed): RemoteViews {
    val v = base(ctx)
    val up = feed.upcomingNow()
    val u = up.firstOrNull()
    if (u == null) {
      emptyText(ctx, v, id, feed.s("noUpcoming"), WLinks.calendar())
      return v
    }
    poster(ctx, v, id, u.t)
    v.setViewVisibility(R.id.full_sub, View.VISIBLE)
    v.setTextViewText(R.id.full_sub, u.behind ?: u.label ?: "")
    v.setOnClickPendingIntent(R.id.root, WLinks.open(ctx, WLinks.title(u.t), id * 100 + 10))
    v.setViewVisibility(R.id.full_top, View.VISIBLE)
    val same = if (u.date != null) up.drop(1).count { it.date == u.date } else 0
    val day = if (u.date != null) feed.dayLabel(u.date) else null
    v.setTextViewText(R.id.full_top, listOfNotNull(feed.s("comingUpTitle"), day).joinToString(" · ") + if (same > 0) "  +$same" else "")
    if (same > 0) v.setOnClickPendingIntent(R.id.full_top, WLinks.open(ctx, WLinks.calendar(), id * 100 + 11))
    return v
  }
}

/* ============ «فيلم الليلة» (W12): «↻» يقلّب محلّيّاً بلا شبكةٍ ولا رمز ============ */

object Tonight {
  const val ACTION_CYCLE = "com.loopztv.app.widget.TONIGHT_CYCLE"

  fun current(ctx: Context, id: Int, f: WFeed): WMovie? {
    if (f.tonight.isEmpty()) return null
    val n = BaseWidget.prefs(ctx).getInt("tn_$id", 0)
    return f.tonight[((n % f.tonight.size) + f.tonight.size) % f.tonight.size]
  }

  fun cycleIntent(ctx: Context, cls: Class<*>, id: Int): PendingIntent {
    val i = Intent(ctx, cls).setAction(ACTION_CYCLE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
    return PendingIntent.getBroadcast(ctx, id * 100 + 40, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun subOf(f: WFeed, m: WMovie): String {
    val parts = mutableListOf<String>()
    if (m.rating != null) parts.add("★ " + String.format(f.locale(), "%.1f", m.rating))
    f.runtime(m.runtime)?.let { parts.add(it) }
    return parts.joinToString(" · ")
  }
}

/** صغير «فيلم الليلة» (W21) — والمتوسطُ أُلغي (W24، «متوسط فلم الليلة احذفه») */
class TonightSmallWidget : PosterWidget() {
  override fun onReceive(ctx: Context, intent: Intent) {
    if (intent.action == Tonight.ACTION_CYCLE) {
      val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1)
      if (id >= 0) {
        val p = prefs(ctx)
        p.edit().putInt("tn_$id", p.getInt("tn_$id", 0) + 1).apply()
        AppWidgetManager.getInstance(ctx).updateAppWidget(id, build(ctx, id))
      }
      return
    }
    super.onReceive(ctx, intent)
  }

  override fun render(ctx: Context, id: Int, feed: WFeed): RemoteViews {
    val v = base(ctx)
    val m = Tonight.current(ctx, id, feed)
    if (m == null) {
      emptyText(ctx, v, id, feed.s("noTowatchMovies"), WLinks.discover())
      return v
    }
    poster(ctx, v, id, m.t)
    v.setViewVisibility(R.id.full_top, View.VISIBLE)
    v.setTextViewText(R.id.full_top, feed.s("tonightTitle"))
    v.setViewVisibility(R.id.full_sub, View.VISIBLE)
    v.setTextViewText(R.id.full_sub, Tonight.subOf(feed, m))
    v.setOnClickPendingIntent(R.id.root, WLinks.open(ctx, WLinks.title(m.t), id * 100 + 10))
    if (feed.tonight.size > 1) {
      v.setViewVisibility(R.id.full_action, View.VISIBLE)
      v.setImageViewResource(R.id.full_action, R.drawable.widget_ic_repeat)
      v.setOnClickPendingIntent(R.id.full_action, Tonight.cycleIntent(ctx, TonightSmallWidget::class.java, id))
    } else v.setViewVisibility(R.id.full_action, View.GONE)
    return v
  }
}
