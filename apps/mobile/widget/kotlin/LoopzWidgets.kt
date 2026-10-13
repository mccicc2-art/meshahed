package com.loopztv.app.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.app.PendingIntent
import android.view.View
import android.widget.RemoteViews
import com.loopztv.app.R

/**
 * ====== 🆕 ودجتاتُ لوبز في أندرويد (خطّةُ الودجتات W1 … W13) ======
 *
 * ثلاثةُ ودجتات: «أكمل المشاهدة» (صغير · متوسط · كبير) · «القادم» (صغير) · «فيلم الليلة» (صغير · متوسط).
 * الأسودُ دائماً (W2)، ولا شريطَ تقدّم (W3).
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
        ComingUpWidget::class.java, TonightSmallWidget::class.java, TonightMediumWidget::class.java,
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
  f.cont.take(max).forEach { c -> slots.add(Slot.Item(c.t, c.label, WLinks.title(c.t), c)) }
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

private val SLOT_ROOT = intArrayOf(R.id.slot_1, R.id.slot_2, R.id.slot_3)
private val SLOT_IMG = intArrayOf(R.id.img_1, R.id.img_2, R.id.img_3)
private val SLOT_PLUS = intArrayOf(R.id.plus_1, R.id.plus_2, R.id.plus_3)
private val SLOT_CHECK = intArrayOf(R.id.check_1, R.id.check_2, R.id.check_3)
private val SLOT_NAME = intArrayOf(R.id.name_1, R.id.name_2, R.id.name_3)
private val SLOT_SUB = intArrayOf(R.id.sub_1, R.id.sub_2, R.id.sub_3)

fun drawRow(ctx: Context, v: RemoteViews, id: Int, f: WFeed, s: Source) {
  v.setTextViewText(R.id.hdr_title, s.title)
  s.headerLink?.let { v.setOnClickPendingIntent(R.id.hdr_title, WLinks.open(ctx, it, id * 100 + 1)) }
  if (s.all != null) {
    v.setViewVisibility(R.id.hdr_all, View.VISIBLE)
    v.setTextViewText(R.id.hdr_all, s.all.first)
    v.setOnClickPendingIntent(R.id.hdr_all, WLinks.open(ctx, s.all.second, id * 100 + 2))
  } else v.setViewVisibility(R.id.hdr_all, View.GONE)

  for (i in 0 until 3) {
    val slot = s.slots.getOrNull(i)
    /* خانةٌ بلا محتوى تبقى مكانَها (INVISIBLE) — العرضُ لا يتمدّد فيتبدّل حجمُ الملصقات بين حالة وأخرى */
    if (slot == null) {
      v.setViewVisibility(SLOT_ROOT[i], View.INVISIBLE)
      continue
    }
    v.setViewVisibility(SLOT_ROOT[i], View.VISIBLE)
    v.setViewVisibility(SLOT_CHECK[i], View.GONE)
    when (slot) {
      is Slot.Item -> {
        v.setViewVisibility(SLOT_IMG[i], View.VISIBLE)
        v.setViewVisibility(SLOT_PLUS[i], View.GONE)
        val bmp = WPosters.load(ctx, slot.t.poster, 100f, 62f, 8f)
        if (bmp != null) v.setImageViewBitmap(SLOT_IMG[i], bmp) else v.setImageViewResource(SLOT_IMG[i], android.R.color.transparent)
        v.setInt(SLOT_IMG[i], "setImageAlpha", 255)
        v.setTextViewText(SLOT_NAME[i], slot.t.title)
        v.setTextColor(SLOT_NAME[i], BaseWidget.TEXT)
        v.setTextViewText(SLOT_SUB[i], slot.sub ?: "")
        v.setTextColor(SLOT_SUB[i], BaseWidget.MUTED)
        v.setOnClickPendingIntent(SLOT_ROOT[i], WLinks.open(ctx, slot.link, id * 100 + 10 + i))
        val c = slot.checkable
        if (f.check && c?.season != null && c.episode != null) {
          v.setViewVisibility(SLOT_CHECK[i], View.VISIBLE)
          v.setOnClickPendingIntent(SLOT_CHECK[i], CheckReceiver.intent(ctx, id * 100 + 20 + i, c))
        }
      }
      is Slot.Faded -> {
        v.setViewVisibility(SLOT_IMG[i], View.VISIBLE)
        v.setViewVisibility(SLOT_PLUS[i], View.GONE)
        val bmp = WPosters.load(ctx, slot.t.poster, 100f, 62f, 8f)
        if (bmp != null) v.setImageViewBitmap(SLOT_IMG[i], bmp) else v.setImageViewResource(SLOT_IMG[i], android.R.color.transparent)
        v.setInt(SLOT_IMG[i], "setImageAlpha", BaseWidget.FADED_IMAGE)
        v.setTextViewText(SLOT_NAME[i], slot.t.title)
        v.setTextColor(SLOT_NAME[i], BaseWidget.FADED_TEXT)
        v.setTextViewText(SLOT_SUB[i], slot.sub)
        v.setTextColor(SLOT_SUB[i], 0xFFFFD400.toInt())
        v.setOnClickPendingIntent(SLOT_ROOT[i], WLinks.open(ctx, slot.link, id * 100 + 10 + i))
      }
      is Slot.Start -> {
        v.setViewVisibility(SLOT_IMG[i], View.INVISIBLE)
        v.setViewVisibility(SLOT_PLUS[i], View.VISIBLE)
        v.setTextViewText(SLOT_NAME[i], slot.text)
        v.setTextColor(SLOT_NAME[i], BaseWidget.MUTED)
        v.setTextViewText(SLOT_SUB[i], "")
        v.setOnClickPendingIntent(SLOT_ROOT[i], WLinks.open(ctx, WLinks.discover(), id * 100 + 10 + i))
      }
    }
  }
}

/** المتوسط — `LoopzWidget` باسمه القديم (D-929) */
class LoopzWidget : BaseWidget() {
  override val layout = R.layout.loopz_w_continue_m
  override fun render(ctx: Context, id: Int, feed: WFeed): RemoteViews {
    val v = RemoteViews(ctx.packageName, layout)
    v.setViewVisibility(R.id.empty, View.GONE)
    v.setViewVisibility(R.id.body, View.VISIBLE)
    drawRow(ctx, v, id, feed, sourceOf(ctx, id, feed))
    return v
  }
}

private val UP_ROW = intArrayOf(R.id.up_1, R.id.up_2, R.id.up_3)
private val UP_IMG = intArrayOf(R.id.up_img_1, R.id.up_img_2, R.id.up_img_3)
private val UP_NAME = intArrayOf(R.id.up_name_1, R.id.up_name_2, R.id.up_name_3)
private val UP_SUB = intArrayOf(R.id.up_sub_1, R.id.up_sub_2, R.id.up_sub_3)
private val UP_CHIP = intArrayOf(R.id.up_chip_1, R.id.up_chip_2, R.id.up_chip_3)

/** الكبير: المتوسطُ ومعه «القادم» بأقرب ثلاثة مواعيد (W6 · W7) */
class ContinueLargeWidget : BaseWidget() {
  override val layout = R.layout.loopz_w_continue_l
  override fun render(ctx: Context, id: Int, feed: WFeed): RemoteViews {
    val v = RemoteViews(ctx.packageName, layout)
    v.setViewVisibility(R.id.empty, View.GONE)
    v.setViewVisibility(R.id.body, View.VISIBLE)
    drawRow(ctx, v, id, feed, sourceOf(ctx, id, feed))

    v.setTextViewText(R.id.up_title, feed.s("comingUpTitle"))
    v.setOnClickPendingIntent(R.id.up_title, WLinks.open(ctx, WLinks.calendar(), id * 100 + 3))
    val up = feed.upcomingNow()
    if (feed.upTotal > 3) {
      v.setViewVisibility(R.id.up_all, View.VISIBLE)
      v.setTextViewText(R.id.up_all, feed.s("all"))
      v.setOnClickPendingIntent(R.id.up_all, WLinks.open(ctx, WLinks.calendar(), id * 100 + 4))
    } else v.setViewVisibility(R.id.up_all, View.GONE)
    v.setViewVisibility(R.id.up_empty, if (up.isEmpty()) View.VISIBLE else View.GONE)
    v.setTextViewText(R.id.up_empty, feed.s("noUpcoming"))
    for (i in 0 until 3) {
      val u = up.getOrNull(i)
      if (u == null) {
        v.setViewVisibility(UP_ROW[i], View.GONE)
        continue
      }
      v.setViewVisibility(UP_ROW[i], View.VISIBLE)
      val bmp = WPosters.load(ctx, u.t.poster, 28f, 40f, 6f)
      if (bmp != null) v.setImageViewBitmap(UP_IMG[i], bmp) else v.setImageViewResource(UP_IMG[i], android.R.color.transparent)
      v.setTextViewText(UP_NAME[i], u.t.title)
      v.setTextViewText(UP_SUB[i], u.behind ?: u.label ?: "")
      if (u.date != null) {
        val today = (feed.daysFromToday(u.date) ?: 1) <= 0
        v.setViewVisibility(UP_CHIP[i], View.VISIBLE)
        v.setTextViewText(UP_CHIP[i], feed.dayLabel(u.date))
        v.setInt(UP_CHIP[i], "setBackgroundResource", if (today) R.drawable.widget_chip_accent else R.drawable.widget_chip)
        v.setTextColor(UP_CHIP[i], if (today) 0xFF050505.toInt() else MUTED)
      } else v.setViewVisibility(UP_CHIP[i], View.GONE)
      v.setOnClickPendingIntent(UP_ROW[i], WLinks.open(ctx, WLinks.title(u.t), id * 100 + 30 + i))
    }
    return v
  }
}

/* ============ الصغار: ملصقٌ كامل (W8 · W9 · W12) ============ */

abstract class FullWidget : BaseWidget() {
  override val layout = R.layout.loopz_w_small
  override fun hideBody(v: RemoteViews) {
    v.setViewVisibility(R.id.full_img, View.GONE)
    v.setViewVisibility(R.id.full_scrim, View.GONE)
    v.setViewVisibility(R.id.full_top, View.GONE)
    v.setViewVisibility(R.id.full_name, View.GONE)
    v.setViewVisibility(R.id.full_sub, View.GONE)
    v.setViewVisibility(R.id.full_action, View.GONE)
    v.setViewVisibility(R.id.full_plus, View.GONE)
  }

  fun base(ctx: Context): RemoteViews {
    val v = RemoteViews(ctx.packageName, layout)
    v.setViewVisibility(R.id.empty, View.GONE)
    v.setViewVisibility(R.id.full_plus, View.GONE)
    v.setViewVisibility(R.id.full_action, View.GONE)
    v.setInt(R.id.full_top, "setBackgroundResource", 0)
    v.setTextColor(R.id.full_top, 0xFFFFD400.toInt())
    return v
  }

  fun poster(ctx: Context, v: RemoteViews, t: WTitle, faded: Boolean) {
    v.setViewVisibility(R.id.full_img, View.VISIBLE)
    v.setViewVisibility(R.id.full_scrim, View.VISIBLE)
    val bmp = WPosters.load(ctx, t.poster, 160f, 160f, 16f)
    if (bmp != null) v.setImageViewBitmap(R.id.full_img, bmp) else v.setImageViewResource(R.id.full_img, android.R.color.transparent)
    v.setInt(R.id.full_img, "setImageAlpha", if (faded) FADED_IMAGE else 255)
    v.setTextViewText(R.id.full_name, t.title)
    v.setTextColor(R.id.full_name, if (faded) FADED_TEXT else TEXT)
  }

  fun emptyText(ctx: Context, v: RemoteViews, id: Int, text: String, link: String?) {
    hideBody(v)
    v.setViewVisibility(R.id.empty, View.VISIBLE)
    v.setTextViewText(R.id.empty, text)
    if (link != null) v.setOnClickPendingIntent(R.id.root, WLinks.open(ctx, link, id * 100 + 5))
  }
}

/** صغير «أكمل المشاهدة» = ص١: عملٌ واحدٌ ثابت، لا يتبدّل في أيّام النزول (قرارُ أحمد: «كذا تسير لخبطه») */
class ContinueSmallWidget : FullWidget() {
  override fun render(ctx: Context, id: Int, feed: WFeed): RemoteViews {
    val v = base(ctx)
    val s = sourceOf(ctx, id, feed, max = 1)
    when (val slot = s.slots.firstOrNull()) {
      is Slot.Item -> {
        poster(ctx, v, slot.t, false)
        v.setViewVisibility(R.id.full_top, View.VISIBLE)
        v.setViewVisibility(R.id.full_name, View.VISIBLE)
        v.setViewVisibility(R.id.full_sub, View.VISIBLE)
        v.setTextViewText(R.id.full_top, if (slot.checkable != null) feed.s("next") else s.title)
        v.setTextViewText(R.id.full_sub, slot.sub ?: "")
        v.setOnClickPendingIntent(R.id.root, WLinks.open(ctx, slot.link, id * 100 + 10))
        val c = slot.checkable
        if (feed.check && c?.season != null && c.episode != null) {
          v.setViewVisibility(R.id.full_action, View.VISIBLE)
          v.setImageViewResource(R.id.full_action, R.drawable.widget_ic_check)
          v.setOnClickPendingIntent(R.id.full_action, CheckReceiver.intent(ctx, id * 100 + 20, c))
          CheckReceiver.undoLabel(ctx, feed, id * 100 + 21)?.let { (label, intent) ->
            v.setTextViewText(R.id.full_top, label)
            v.setTextColor(R.id.full_top, 0xFF22C55E.toInt())
            v.setOnClickPendingIntent(R.id.full_top, intent)
          }
        }
      }
      is Slot.Faded -> {
        poster(ctx, v, slot.t, true)
        v.setViewVisibility(R.id.full_top, View.VISIBLE)
        v.setViewVisibility(R.id.full_name, View.VISIBLE)
        v.setViewVisibility(R.id.full_sub, View.VISIBLE)
        v.setTextViewText(R.id.full_top, feed.s("towatchTitle"))
        v.setTextColor(R.id.full_top, MUTED)
        v.setTextViewText(R.id.full_sub, feed.s("start") + " ›")
        v.setTextColor(R.id.full_sub, 0xFFFFD400.toInt())
        v.setOnClickPendingIntent(R.id.root, WLinks.open(ctx, slot.link, id * 100 + 10))
      }
      is Slot.Start, null -> {
        hideBody(v)
        v.setViewVisibility(R.id.full_plus, View.VISIBLE)
        v.setViewVisibility(R.id.full_name, View.VISIBLE)
        v.setTextViewText(R.id.full_name, feed.s("startSomething"))
        v.setTextColor(R.id.full_name, MUTED)
        v.setOnClickPendingIntent(R.id.root, WLinks.open(ctx, WLinks.discover(), id * 100 + 10))
      }
    }
    return v
  }
}

/** صغير «القادم»: أقربُ موعدٍ دائماً (W9) — «+١» حين ينزل اثنان في اليوم نفسِه */
class ComingUpWidget : FullWidget() {
  override fun render(ctx: Context, id: Int, feed: WFeed): RemoteViews {
    val v = base(ctx)
    val up = feed.upcomingNow()
    val u = up.firstOrNull()
    if (u == null) {
      emptyText(ctx, v, id, feed.s("noUpcoming"), WLinks.calendar())
      return v
    }
    poster(ctx, v, u.t, false)
    v.setViewVisibility(R.id.full_name, View.VISIBLE)
    v.setViewVisibility(R.id.full_sub, View.VISIBLE)
    v.setTextViewText(R.id.full_sub, u.behind ?: u.label ?: "")
    v.setTextColor(R.id.full_sub, 0xFFDDDDDD.toInt())
    v.setOnClickPendingIntent(R.id.root, WLinks.open(ctx, WLinks.title(u.t), id * 100 + 10))
    if (u.date != null) {
      val today = (feed.daysFromToday(u.date) ?: 1) <= 0
      val same = up.drop(1).count { it.date == u.date }
      v.setViewVisibility(R.id.full_top, View.VISIBLE)
      v.setTextViewText(R.id.full_top, feed.dayLabel(u.date) + if (same > 0) "  +$same" else "")
      v.setInt(R.id.full_top, "setBackgroundResource", if (today) R.drawable.widget_chip_accent else R.drawable.widget_chip_glass)
      v.setTextColor(R.id.full_top, if (today) 0xFF050505.toInt() else TEXT)
      val dp = ctx.resources.displayMetrics.density
      v.setViewPadding(R.id.full_top, (8 * dp).toInt(), (2 * dp).toInt(), (8 * dp).toInt(), (2 * dp).toInt())
      if (same > 0) v.setOnClickPendingIntent(R.id.full_top, WLinks.open(ctx, WLinks.calendar(), id * 100 + 11))
    } else v.setViewVisibility(R.id.full_top, View.GONE)
    return v
  }
}

/* ============ «فيلم الليلة» (W12): «فيلم آخر ↻» يقلّب محلّيّاً بلا شبكةٍ ولا رمز ============ */

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
    f.runtime(m.runtime)?.let { parts.add(it) }
    if (m.suggested && m.rating != null) parts.add("★ " + String.format(f.locale(), "%.1f", m.rating))
    return parts.joinToString(" · ")
  }
}

abstract class TonightBase : BaseWidget() {
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
}

class TonightSmallWidget : TonightBase() {
  override val layout = R.layout.loopz_w_small
  override fun hideBody(v: RemoteViews) {
    listOf(R.id.full_img, R.id.full_scrim, R.id.full_top, R.id.full_name, R.id.full_sub, R.id.full_action, R.id.full_plus)
      .forEach { v.setViewVisibility(it, View.GONE) }
  }

  override fun render(ctx: Context, id: Int, feed: WFeed): RemoteViews {
    val v = RemoteViews(ctx.packageName, layout)
    v.setViewVisibility(R.id.empty, View.GONE)
    v.setViewVisibility(R.id.full_plus, View.GONE)
    val m = Tonight.current(ctx, id, feed)
    if (m == null) {
      hideBody(v)
      v.setViewVisibility(R.id.empty, View.VISIBLE)
      v.setTextViewText(R.id.empty, feed.s("noTowatchMovies"))
      v.setOnClickPendingIntent(R.id.root, WLinks.open(ctx, WLinks.discover(), id * 100 + 10))
      return v
    }
    v.setViewVisibility(R.id.full_img, View.VISIBLE)
    v.setViewVisibility(R.id.full_scrim, View.VISIBLE)
    val bmp = WPosters.load(ctx, m.t.poster, 160f, 160f, 16f)
    if (bmp != null) v.setImageViewBitmap(R.id.full_img, bmp) else v.setImageViewResource(R.id.full_img, android.R.color.transparent)
    v.setViewVisibility(R.id.full_top, View.VISIBLE)
    v.setTextViewText(R.id.full_top, feed.s("tonightTitle"))
    v.setViewVisibility(R.id.full_name, View.VISIBLE)
    v.setTextViewText(R.id.full_name, m.t.title)
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

class TonightMediumWidget : TonightBase() {
  override val layout = R.layout.loopz_w_tonight_m
  override fun render(ctx: Context, id: Int, feed: WFeed): RemoteViews {
    val v = RemoteViews(ctx.packageName, layout)
    v.setViewVisibility(R.id.empty, View.GONE)
    v.setViewVisibility(R.id.body, View.VISIBLE)
    v.setTextViewText(R.id.hdr_title, feed.s("tonightTitle"))
    val m = Tonight.current(ctx, id, feed)
    if (m == null) {
      v.setViewVisibility(R.id.body, View.GONE)
      v.setViewVisibility(R.id.empty, View.VISIBLE)
      v.setTextViewText(R.id.empty, feed.s("noTowatchMovies"))
      v.setOnClickPendingIntent(R.id.root, WLinks.open(ctx, WLinks.discover(), id * 100 + 10))
      return v
    }
    val bmp = WPosters.load(ctx, m.t.poster, 82f, 123f, 8f)
    if (bmp != null) v.setImageViewBitmap(R.id.tm_img, bmp) else v.setImageViewResource(R.id.tm_img, android.R.color.transparent)
    v.setTextViewText(R.id.tm_name, m.t.title)
    v.setTextViewText(R.id.tm_sub, listOfNotNull(Tonight.subOf(feed, m).takeIf { it.isNotEmpty() }, if (!m.suggested) feed.s("fromTowatch") else null).joinToString(" · "))
    v.setViewVisibility(R.id.tm_note, if (m.suggested) View.VISIBLE else View.GONE)
    v.setTextViewText(R.id.tm_note, feed.s("suggested"))
    v.setOnClickPendingIntent(R.id.tm_img, WLinks.open(ctx, WLinks.title(m.t), id * 100 + 10))
    v.setOnClickPendingIntent(R.id.tm_name, WLinks.open(ctx, WLinks.title(m.t), id * 100 + 11))
    if (feed.tonight.size > 1) {
      v.setViewVisibility(R.id.tm_next, View.VISIBLE)
      v.setTextViewText(R.id.tm_next, feed.s("anotherMovie"))
      v.setOnClickPendingIntent(R.id.tm_next, Tonight.cycleIntent(ctx, TonightMediumWidget::class.java, id))
    } else v.setViewVisibility(R.id.tm_next, View.GONE)
    return v
  }
}
