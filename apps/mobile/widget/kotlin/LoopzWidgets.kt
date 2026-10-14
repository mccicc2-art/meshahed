package com.loopztv.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import com.loopztv.app.R
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * ====== 🆕 ودجتُ لوبز الواحد في أندرويد (خطّةُ الودجتات v2، W28–W43) ======
 *
 * 🔑 **مزوّدٌ واحدٌ بكلِّ الأحجام** (W28: صغير ٢×٢ · متوسط ٤×٢ · كبير ٤×٤ · كبير جداً ٤×٦): المقاسُ الحقيقيُّ
 * (`OPTION_APPWIDGET_*`) يختار الحجم، و**الصفوفُ محسومةٌ في التطبيق** (`resolveWidget` في `src/core/widgetLayout.ts`،
 * مكتوبةً في `w2.android`) — فالمعاينةُ في «ودجت لوبز» والودجتُ هنا يرسمان الشيءَ نفسَه (§11.2). هنا رسمٌ فقط.
 *
 * ⚖️ **`LoopzWidget` اسمُ المتوسط القديم** (D-929): من وضعه يجده الودجتَ الجديدَ في مكانه؛ وبقيّةُ الودجتات القديمة
 * تختفي ويُعاد وضعُها باليد (قرارُ أحمد «٢ ب»).
 *
 * RemoteViews لا تبني شجرةً حرّة: كلُّ صفٍّ واجهةٌ معرّفةٌ (`w2_*.xml`) تُضاف إلى `rows` بالترتيب (`addView`).
 * ✓ والأزرارُ الأخرى (W37) في الدفعة الثانية: «شاهدته» تفتح العملَ الآن، و«ابدأ» تبدأ المسلسلَ كما في البطاقة الباهتة.
 */
class LoopzWidget : AppWidgetProvider() {
  override fun onUpdate(ctx: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { id -> manager.updateAppWidget(id, W2Render.build(ctx, id)) }
  }

  /** مقاسٌ جديد ⇒ حجمٌ قد يتبدّل، والصورُ تُرسم بمقاسها الجديد (W18) */
  override fun onAppWidgetOptionsChanged(ctx: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    manager.updateAppWidget(id, W2Render.build(ctx, id))
  }

  override fun onDeleted(ctx: Context, ids: IntArray) {
    val e = prefs(ctx).edit()
    ids.forEach { id -> e.remove("tn_$id") }
    e.apply()
  }

  override fun onReceive(ctx: Context, intent: Intent) {
    if (intent.action == ACTION_CYCLE) {
      val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1)
      if (id >= 0) {
        val p = prefs(ctx)
        p.edit().putInt("tn_$id", p.getInt("tn_$id", 0) + 1).apply()
        AppWidgetManager.getInstance(ctx).updateAppWidget(id, W2Render.build(ctx, id))
      }
      return
    }
    super.onReceive(ctx, intent)
  }

  companion object {
    const val PREFS = "loopz_widget_cfg"
    const val ACTION_CYCLE = "com.loopztv.app.widget.TONIGHT_CYCLE"
    fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** يعيد رسمَ كلِّ ودجتات لوبز — بعد ✓ */
    fun redrawAll(ctx: Context) {
      val m = AppWidgetManager.getInstance(ctx)
      val ids = m.getAppWidgetIds(ComponentName(ctx, LoopzWidget::class.java))
      if (ids.isEmpty()) return
      ctx.sendBroadcast(Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).setComponent(ComponentName(ctx, LoopzWidget::class.java)).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids))
    }

    fun cycleIntent(ctx: Context, id: Int, code: Int): PendingIntent {
      val i = Intent(ctx, LoopzWidget::class.java).setAction(ACTION_CYCLE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
      return PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
  }
}

/** صفٌّ محسوم كما كتبه المحرّك — `WidgetRow` في `widgetLayout.ts` */
private class Row(val o: JSONObject) {
  val type: String = o.optString("type")
  val key: String = o.optString("key")
  val view: String = o.optString("view")
  val count: Int = o.optInt("count", 2)
  val full: Boolean = o.optBoolean("full")
  val trend: String = o.optString("trend", "list")
  val upLine: Boolean = o.optBoolean("upLine")
  val keys: List<String> = o.optJSONArray("keys")?.let { a -> (0 until a.length()).map { a.optString(it) } } ?: emptyList()
}

/** سطرٌ في قسم — صورةٌ واسمٌ وسطرٌ ثانٍ ووجهةُ اللمسة */
private data class Line(val t: WTitle?, val name: String, val sub: String?, val link: String)

/** ما يحتاجه الرسمُ في كلِّ صفّ: الخلاصةُ والقسمُ والمقاسُ وعدّادُ رموز النيّات (كلُّ لمسةٍ برمزها — درسُ D-929) */
private class Draw(val ctx: Context, val id: Int, val f: WFeed, val v2: JSONObject, val opts: JSONObject, val wDp: Float) {
  private var code = 0
  fun next(): Int = id * 1000 + (code++ % 1000)
  fun open(path: String): PendingIntent = WLinks.open(ctx, path, next())
  fun s2(k: String): String = v2.optJSONObject("strings")?.optString(k, "") ?: ""
  fun arr(k: String): List<JSONObject> = list(v2.optJSONArray(k))
  fun list(a: JSONArray?): List<JSONObject> = if (a == null) emptyList() else (0 until a.length()).mapNotNull { a.optJSONObject(it) }
  fun opt(key: String): JSONObject = opts.optJSONObject(key) ?: JSONObject()
}

object W2Render {
  private const val SETTINGS = "w/settings"
  private const val SEARCH = "w/search"

  /**
   * 🔴 **تسجيلُ أحمد (١٤ أكتوبر، بناء 73)**: «أكمل المشاهدة» مكرّرٌ أربعَ مرّاتٍ والبحثُ بينها، والحفظُ لا يغيّر شيئاً.
   * السبب: حين يبقى الجذرُ نفسُه يُعيد المُشغِّلُ تطبيقَ الأوامر على الودجت القائم (`reapply`) لا يرسمه من الصفر —
   * و`addView` **يُلحق** تحت ما كان، فتتراكم صفوفُ كلِّ رسمةٍ سابقة (أوّلُها بالمقاس المتوسط قبل التمديد). وكذلك
   * الظهورُ والإخفاء: ما لم يُكتب صراحةً يبقى على حال الرسمة السابقة. فكلُّ واجهةٍ هنا **تبدأ نظيفة**: الحاوياتُ
   * تُفرَّغ قبل أوّل إضافة، وعناصرُ الجذر تُكتب حالتُها كلُّها في كلِّ رسمة.
   */
  private fun fresh(ctx: Context, layout: Int): RemoteViews {
    val v = RemoteViews(ctx.packageName, layout)
    when (layout) {
      R.layout.w2_root -> {
        v.removeAllViews(R.id.rows)
        v.setViewVisibility(R.id.rows, View.VISIBLE)
        v.setViewVisibility(R.id.lock, View.GONE)
        v.setViewVisibility(R.id.empty, View.GONE)
      }
      R.layout.w2_list, R.layout.w2_half_list -> v.removeAllViews(R.id.items)
      R.layout.w2_pair -> {
        v.removeAllViews(R.id.half_a)
        v.removeAllViews(R.id.half_b)
      }
      R.layout.loopz_w_small -> {
        v.setViewVisibility(R.id.full_img, View.VISIBLE)
        v.setImageViewResource(R.id.full_img, android.R.color.transparent)
        listOf(R.id.full_scrim, R.id.full_top, R.id.full_name, R.id.full_sub, R.id.full_action, R.id.full_plus, R.id.full_check, R.id.empty)
          .forEach { v.setViewVisibility(it, View.GONE) }
      }
    }
    return v
  }

  fun build(ctx: Context, id: Int): RemoteViews {
    val f = WFeed.load(ctx)
    if (f == WFeed.SIGNED_OUT) return empty(ctx, id, ctx.getString(R.string.w_signed_out))
    if (f !is WFeed) return empty(ctx, id, ctx.getString(R.string.w_open_app))
    val w2 = f.raw.optJSONObject("w2")?.optJSONObject("android")
    val v2 = f.raw.optJSONObject("v2")
    /* خلاصةٌ من تطبيقٍ أقدم (بلا `w2`) ⇒ «افتح لوبز» حتى يكتبها التطبيقُ الجديد */
    if (w2 == null || v2 == null) return empty(ctx, id, ctx.getString(R.string.w_open_app))
    val (w, h) = sizeDp(ctx, id)
    val size = sizeOf(w, h)
    val v = try {
      val d = Draw(ctx, id, f, v2, w2.optJSONObject("opts") ?: JSONObject(), w)
      /* 🆕 الصفوفُ المحسومةُ لارتفاع الودجت الحقيقيّ (أكبرُ مفتاحٍ لا يزيد عليه) — تسجيلُ أحمد ١٤ أكتوبر */
      val fit = byHeight(w2.optJSONObject("heights"), h)
      val fitSize = fit?.optString("size") ?: size
      when {
        size == "small" -> small(d, w2.optJSONObject("small") ?: JSONObject(), w, h)
        w2.optJSONObject("locked")?.optBoolean(fitSize) == true -> locked(d)
        fit != null -> rows(d, fit.optJSONArray("rows"))
        else -> rows(d, w2.optJSONObject("rows")?.optJSONArray(size))
      }
    } catch (e: Exception) {
      return empty(ctx, id, ctx.getString(R.string.w_open_app))
    }
    v.setInt(R.id.root, "setLayoutDirection", if (f.rtl) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR)
    return v
  }

  /** أكبرُ ارتفاعٍ محسومٍ لا يزيد على ارتفاع الودجت — وإن قصر عن كلِّها فأصغرُها */
  private fun byHeight(all: JSONObject?, h: Float): JSONObject? {
    if (all == null) return null
    val keys = all.keys().asSequence().mapNotNull { it.toIntOrNull() }.sorted().toList()
    if (keys.isEmpty()) return null
    val k = keys.lastOrNull { it <= h } ?: keys.first()
    return all.optJSONObject(k.toString())
  }

  /** مقاسُ الودجت بالـdp — عرضُ الوضع العمودي (`MIN_WIDTH`) وارتفاعُه (`MAX_HEIGHT`) */
  private fun sizeDp(ctx: Context, id: Int): Pair<Float, Float> {
    val o = AppWidgetManager.getInstance(ctx).getAppWidgetOptions(id)
    val w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
    val h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)
    return if (w > 0 && h > 0) w.toFloat() to h.toFloat() else 320f to 180f
  }

  /** W28 — العرضُ يفصل الصغيرَ (عمودان)، والارتفاعُ يفصل المتوسطَ والكبيرَ والكبيرَ جداً */
  private fun sizeOf(w: Float, h: Float): String = when {
    w < 230f -> "small"
    h < 260f -> "medium"
    h < 600f -> "large"
    else -> "xl"
  }

  private fun empty(ctx: Context, id: Int, text: String): RemoteViews {
    val v = fresh(ctx, R.layout.w2_root)
    v.setViewVisibility(R.id.rows, View.GONE)
    v.setViewVisibility(R.id.empty, View.VISIBLE)
    v.setTextViewText(R.id.empty, text)
    WLinks.launch(ctx, id * 1000 + 999)?.let { v.setOnClickPendingIntent(R.id.root, it) }
    return v
  }

  /* ───────── W41 — القفل ───────── */

  private fun locked(d: Draw): RemoteViews {
    val v = fresh(d.ctx, R.layout.w2_root)
    val lapsed = d.v2.optBoolean("lapsed")
    v.setViewVisibility(R.id.rows, View.GONE)
    v.setViewVisibility(R.id.lock, View.VISIBLE)
    v.setTextViewText(R.id.lock_title, d.s2(if (lapsed) "plusLapsedTitle" else "plusLockedTitle"))
    v.setTextViewText(R.id.lock_sub, d.s2(if (lapsed) "plusLapsedSub" else "plusLockedSub"))
    v.setTextViewText(R.id.lock_btn_text, d.s2(if (lapsed) "renew" else "subscribe"))
    v.setOnClickPendingIntent(R.id.root, d.open(SETTINGS))
    return v
  }

  /* ───────── الصفوف ───────── */

  private fun rows(d: Draw, list: JSONArray?): RemoteViews {
    val v = fresh(d.ctx, R.layout.w2_root)
    val rows = d.list(list).map { Row(it) }
    if (rows.isEmpty()) {
      v.setViewVisibility(R.id.rows, View.GONE)
      v.setViewVisibility(R.id.empty, View.VISIBLE)
      v.setTextViewText(R.id.empty, d.ctx.getString(R.string.w_open_app))
      v.setOnClickPendingIntent(R.id.root, d.open(SETTINGS))
      return v
    }
    rows.forEachIndexed { i, r ->
      /* ما يزيد من الارتفاع يتوزّع على الفواصل (قبل الخطّ وبعده) — لا كتلةَ سوداءَ تحت آخر قسم */
      if (i > 0) {
        v.addView(R.id.rows, RemoteViews(d.ctx.packageName, R.layout.w2_flex))
        v.addView(R.id.rows, RemoteViews(d.ctx.packageName, R.layout.w2_divider))
        v.addView(R.id.rows, RemoteViews(d.ctx.packageName, R.layout.w2_flex))
      }
      val child = when (r.type) {
        "search" -> search(d, r)
        "cont" -> cont(d, r)
        "list" -> section(d, r)
        "tonight" -> tonight(d, r)
        "pair" -> pair(d, r)
        "line" -> line(d, r.key)
        else -> null
      }
      if (child != null) v.addView(R.id.rows, child)
    }
    return v
  }

  /** عرضُ المحتوى داخل الحشوة (١٢ جانباً) */
  private fun inner(d: Draw) = (d.wDp - 24f).coerceAtLeast(60f)

  /* W31 — البحث */
  private fun search(d: Draw, r: Row): RemoteViews {
    val v = RemoteViews(d.ctx.packageName, R.layout.w2_search)
    v.setTextViewText(R.id.bar_text, d.s2("searchPlaceholder"))
    v.setOnClickPendingIntent(R.id.bar, d.open(SEARCH))
    if (!r.full) return v
    val trending = d.arr("trending").mapNotNull { d.f.titleFrom(it) }
    v.setViewVisibility(R.id.trend_title, View.VISIBLE)
    v.setTextViewText(R.id.trend_title, d.s2("trendingToday"))
    if (r.trend == "posters") {
      v.setViewVisibility(R.id.trend_posters, View.VISIBLE)
      val slots = intArrayOf(R.id.tp_1, R.id.tp_2, R.id.tp_3)
      val imgs = intArrayOf(R.id.tp_img_1, R.id.tp_img_2, R.id.tp_img_3)
      val ranks = intArrayOf(R.id.tp_rank_1, R.id.tp_rank_2, R.id.tp_rank_3)
      for (n in 0 until 3) {
        val t = trending.getOrNull(n)
        if (t == null) { v.setViewVisibility(slots[n], View.INVISIBLE); continue }
        poster(d, v, imgs[n], t.poster, 87f, 130f, 8f)
        v.setTextViewText(ranks[n], "${n + 1}")
        v.setOnClickPendingIntent(slots[n], d.open(WLinks.title(t)))
      }
    } else {
      v.setViewVisibility(R.id.trend_list, View.VISIBLE)
      val slots = intArrayOf(R.id.tl_1, R.id.tl_2)
      val imgs = intArrayOf(R.id.tl_img_1, R.id.tl_img_2)
      val ranks = intArrayOf(R.id.tl_rank_1, R.id.tl_rank_2)
      val names = intArrayOf(R.id.tl_name_1, R.id.tl_name_2)
      for (n in 0 until 2) {
        val t = trending.getOrNull(n)
        if (t == null) { v.setViewVisibility(slots[n], View.INVISIBLE); continue }
        poster(d, v, imgs[n], t.poster, 28f, 40f, 4f)
        v.setTextViewText(ranks[n], "${n + 1}")
        v.setTextViewText(names[n], t.title)
        v.setOnClickPendingIntent(slots[n], d.open(WLinks.title(t)))
      }
    }
    return v
  }

  /* W33 — أكمل المشاهدة: بطاقتان، وسطرُ «القادم» حين يقوله المحرّك */
  private fun cont(d: Draw, r: Row): RemoteViews {
    val v = RemoteViews(d.ctx.packageName, R.layout.w2_cont)
    val f = d.f
    v.setTextViewText(R.id.hdr_title, f.s("continueTitle"))
    v.setOnClickPendingIntent(R.id.hdr_title, d.open(WLinks.all("continue")))
    if (f.contTotal > 2) {
      v.setViewVisibility(R.id.hdr_all, View.VISIBLE)
      v.setTextViewText(R.id.hdr_all, f.s("allCount").replace("%d", f.contTotal.toString()))
      v.setOnClickPendingIntent(R.id.hdr_all, d.open(WLinks.all("continue")))
    }
    val cardW = ((inner(d) - 9f) / 2f).coerceAtLeast(40f)
    drawCard(d, v, 0, cardW, 93f)
    drawCard(d, v, 1, cardW, 93f)
    if (r.upLine) {
      v.setViewVisibility(R.id.up_block, View.VISIBLE)
      v.setOnClickPendingIntent(R.id.up_line, d.open(WLinks.calendar()))
      val u = upcoming(d).firstOrNull()
      if (u == null) {
        v.setViewVisibility(R.id.up_day, View.GONE)
        v.setViewVisibility(R.id.up_name, View.GONE)
        v.setTextViewText(R.id.up_label, d.s2("noUpcoming"))
      } else {
        val date = u.optString("date").takeIf { it.isNotEmpty() && !u.isNull("date") }
        if (date != null) v.setTextViewText(R.id.up_day, d.s2("upLinePrefix").let { p -> if (p.isEmpty()) f.dayLabel(date) else "$p · ${f.dayLabel(date)}" })
        else v.setTextViewText(R.id.up_day, d.s2("upLinePrefix"))
        v.setTextViewText(R.id.up_name, u.optString("title"))
        v.setTextViewText(R.id.up_label, if (u.isNull("label")) "" else u.optString("label"))
      }
    }
    return v
  }

  private val CARD = intArrayOf(R.id.card_1, R.id.card_2)
  private val CARD_IMG = intArrayOf(R.id.card_img_1, R.id.card_img_2)
  private val CARD_PLUS = intArrayOf(R.id.card_plus_1, R.id.card_plus_2)
  private val CARD_CHECK = intArrayOf(R.id.card_check_1, R.id.card_check_2)
  private val CARD_TEXT = intArrayOf(R.id.card_text_1, R.id.card_text_2)
  private val CARD_NAME = intArrayOf(R.id.card_name_1, R.id.card_name_2)
  private val CARD_SUB = intArrayOf(R.id.card_sub_1, R.id.card_sub_2)
  private val CARD_PCT = intArrayOf(R.id.card_pct_1, R.id.card_pct_2)

  /** بطاقةُ الرئيسيّة نفسُها (W17): عملٌ بنسبته و✓، أو باهتةٌ من «للمشاهدة»، أو «ابدأ عملاً» */
  private fun drawCard(d: Draw, v: RemoteViews, i: Int, wDp: Float, hDp: Float) {
    val f = d.f
    val c = f.cont.getOrNull(i)
    val faded = if (c == null) f.towatch.filter { w -> f.cont.none { it.t.id == w.t.id } }.getOrNull(i - f.cont.size) else null
    v.setViewVisibility(CARD_CHECK[i], View.GONE)
    when {
      c != null -> {
        val bmp = WArt.card(d.ctx, c.backdrop, c.t.poster, wDp, hDp, f.rtl, c.pct)
        if (bmp != null) v.setImageViewBitmap(CARD_IMG[i], bmp)
        v.setTextViewText(CARD_NAME[i], c.t.title)
        v.setTextViewText(CARD_SUB[i], c.sub ?: c.label ?: "")
        v.setViewVisibility(CARD_PCT[i], View.VISIBLE)
        v.setTextViewText(CARD_PCT[i], "${c.pct}%")
        v.setOnClickPendingIntent(CARD[i], d.open(WLinks.title(c.t)))
        if (f.check && c.season != null && c.episode != null) {
          v.setViewVisibility(CARD_CHECK[i], View.VISIBLE)
          v.setOnClickPendingIntent(CARD_CHECK[i], CheckReceiver.intent(d.ctx, d.next(), c))
        }
      }
      faded != null -> {
        val bmp = WArt.card(d.ctx, null, faded.t.poster, wDp, hDp, f.rtl, null, 140)
        if (bmp != null) v.setImageViewBitmap(CARD_IMG[i], bmp)
        v.setTextViewText(CARD_NAME[i], faded.t.title)
        v.setTextColor(CARD_NAME[i], 0x8CF7F7F7.toInt())
        v.setTextViewText(CARD_SUB[i], f.s("towatchStart"))
        v.setTextColor(CARD_SUB[i], 0xFFFFD400.toInt())
        v.setViewVisibility(CARD_PCT[i], View.GONE)
        v.setOnClickPendingIntent(CARD[i], d.open(WLinks.start(faded.t, faded.action)))
      }
      else -> {
        v.setViewVisibility(CARD_IMG[i], View.GONE)
        v.setViewVisibility(CARD_TEXT[i], View.GONE)
        v.setViewVisibility(CARD_PLUS[i], View.VISIBLE)
        v.setTextViewText(CARD_PLUS[i], "+  " + f.s("startSomething"))
        v.setOnClickPendingIntent(CARD[i], d.open(WLinks.discover()))
      }
    }
  }

  /** «القادم» ما لم يمضِ (المسلسلاتُ والأفلام، W32) */
  private fun upcoming(d: Draw): List<JSONObject> =
    d.list(d.v2.optJSONObject("upcoming")?.optJSONArray("items")).filter { u ->
      u.isNull("date") || (d.f.daysFromToday(u.optString("date")) ?: 0) >= 0
    }

  /** عنوانُ القسم بلغة القارئ */
  private fun titleOf(d: Draw, key: String): String = when (key) {
    "cont" -> d.f.s("continueTitle")
    "up" -> d.f.s("comingUpTitle")
    "tonight" -> d.f.s("tonightTitle")
    "tw" -> d.f.s("towatchTitle")
    "friends" -> d.s2("friendsTitle")
    "act" -> d.s2("activityTitle")
    else -> d.s2("searchPlaceholder")
  }

  private fun headerLink(key: String): String? = when (key) {
    "cont" -> WLinks.all("continue")
    "up" -> WLinks.calendar()
    "tw" -> WLinks.all("towatch")
    else -> null
  }

  /** أسطرُ القسم — كلُّ قسمٍ يقول ما عنده بالشكل نفسِه */
  private fun lines(d: Draw, key: String): List<Line> {
    val f = d.f
    return when (key) {
      "up" -> upcoming(d).mapNotNull { u ->
        val t = f.titleFrom(u) ?: return@mapNotNull null
        val date = if (u.isNull("date")) null else u.optString("date").takeIf { it.isNotEmpty() }
        val label = if (u.isNull("label")) null else u.optString("label")
        Line(t, t.title, listOfNotNull(date?.let { f.dayLabel(it) }, label).joinToString(" · "), WLinks.title(t))
      }
      "friends" -> d.arr("friends").mapNotNull { x ->
        val t = f.titleFrom(x.optJSONObject("title")) ?: return@mapNotNull null
        Line(t, "${x.optString("name")} ${x.optString("action")} ${t.title}", ago(x.optString("at"), f.locale()), WLinks.title(t))
      }
      "tw" -> d.arr("towatch").mapNotNull { x ->
        val t = f.titleFrom(x) ?: return@mapNotNull null
        val rating = if (x.isNull("rating")) null else "★ " + String.format(f.locale(), "%.1f", x.optDouble("rating"))
        Line(t, t.title, listOfNotNull(x.optString("type_label").takeIf { it.isNotEmpty() }, rating).joinToString(" · "), WLinks.title(t))
      }
      "act" -> d.arr("activity").mapNotNull { x ->
        val t = f.titleFrom(x.optJSONObject("title")) ?: return@mapNotNull null
        Line(t, x.optString("line"), if (x.isNull("sub")) null else x.optString("sub"), WLinks.title(t))
      }
      "cont" -> f.cont.map { c -> Line(c.t, c.t.title, c.sub ?: c.label, WLinks.title(c.t)) }
      "tonight" -> listOfNotNull(tonightNow(d)?.let { m -> Line(m.t, m.t.title, Tonight.subOf(f, m), WLinks.title(m.t)) })
      else -> emptyList()
    }
  }

  /**
   * «قبل ساعة» بساعة الجهاز وقتَ الرسم — **وبلغة الودجت لا لغة الجهاز** (تسجيلُ أحمد: «أول أمس» في ودجتٍ إنجليزيّ):
   * `DateUtils` يكتب بلغة النظام، و`RelativeDateTimeFormatter` من ICU يقبل لغةً صريحة.
   */
  private fun ago(iso: String, locale: Locale): String? = try {
    val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    val t = fmt.parse(iso.take(19))?.time ?: 0L
    if (t <= 0L) null else {
      val r = android.icu.text.RelativeDateTimeFormatter.getInstance(android.icu.util.ULocale.forLocale(locale))
      val mins = ((System.currentTimeMillis() - t) / 60_000L).coerceAtLeast(1L)
      val last = android.icu.text.RelativeDateTimeFormatter.Direction.LAST
      when {
        mins < 60 -> r.format(mins.toDouble(), last, android.icu.text.RelativeDateTimeFormatter.RelativeUnit.MINUTES)
        mins < 24 * 60 -> r.format((mins / 60).toDouble(), last, android.icu.text.RelativeDateTimeFormatter.RelativeUnit.HOURS)
        else -> r.format((mins / (24 * 60)).toDouble(), last, android.icu.text.RelativeDateTimeFormatter.RelativeUnit.DAYS)
      }
    }
  } catch (e: Exception) {
    null
  }

  /* W32 · W35 — قسمُ قائمة كامل */
  private fun section(d: Draw, r: Row): RemoteViews {
    val v = fresh(d.ctx, R.layout.w2_list)
    v.setTextViewText(R.id.hdr_title, titleOf(d, r.key))
    headerLink(r.key)?.let { v.setOnClickPendingIntent(R.id.hdr_title, d.open(it)) }
    val items = lines(d, r.key)
    if (r.view == "posters") {
      v.setViewVisibility(R.id.items, View.GONE)
      v.setViewVisibility(R.id.posters, View.VISIBLE)
      val slots = intArrayOf(R.id.lp_1, R.id.lp_2, R.id.lp_3)
      val imgs = intArrayOf(R.id.lp_img_1, R.id.lp_img_2, R.id.lp_img_3)
      for (n in 0 until 3) {
        val it = items.getOrNull(n)
        if (it == null) { v.setViewVisibility(slots[n], View.INVISIBLE); continue }
        poster(d, v, imgs[n], it.t?.poster, 87f, 130f, 8f)
        v.setOnClickPendingIntent(slots[n], d.open(it.link))
      }
      return v
    }
    val towatch = if (r.key == "tw") d.arr("towatch") else emptyList()
    for (n in 0 until r.count) {
      val it = items.getOrNull(n) ?: break
      if (n > 0) v.addView(R.id.items, RemoteViews(d.ctx.packageName, R.layout.w2_space))
      val friend = r.key == "friends"
      val row = RemoteViews(d.ctx.packageName, if (friend) R.layout.w2_item_friend else R.layout.w2_item)
      if (friend) poster(d, row, R.id.it_img, it.t?.poster, 20f, 30f, 3f) else poster(d, row, R.id.it_img, it.t?.poster, 28f, 42f, 4f)
      row.setTextViewText(R.id.it_name, it.name)
      row.setTextViewText(R.id.it_sub, it.sub ?: "")
      row.setOnClickPendingIntent(R.id.item, d.open(it.link))
      /* W35 — «▶ ابدأ» للمسلسل والأنمي و«✓ شاهدته» للفيلم بالرقاقة الرماديّة */
      val x = towatch.getOrNull(n)
      if (x != null && it.t != null) {
        row.setViewVisibility(R.id.it_chip, View.VISIBLE)
        if (x.optString("action") == "watched") {
          row.setImageViewResource(R.id.it_chip_icon, R.drawable.widget_ic_check)
          row.setTextViewText(R.id.it_chip_text, d.s2("watched"))
          row.setOnClickPendingIntent(R.id.it_chip, d.open(WLinks.title(it.t)))
        } else {
          row.setImageViewResource(R.id.it_chip_icon, R.drawable.widget_ic_play)
          row.setTextViewText(R.id.it_chip_text, d.f.s("start"))
          row.setOnClickPendingIntent(R.id.it_chip, d.open(WLinks.start(it.t, "start")))
        }
      }
      v.addView(R.id.items, row)
    }
    return v
  }

  /* W34 · W42 — فيلم الليلة: يتبدّل كلَّ يوم، و«فيلم آخر» يقلّب محلّيّاً */
  private fun tonightNow(d: Draw): WMovie? {
    val all = d.f.tonight
    if (all.isEmpty()) return null
    val day = (System.currentTimeMillis() + TimeZone.getDefault().getOffset(System.currentTimeMillis())) / 86_400_000L
    val n = (day + LoopzWidget.prefs(d.ctx).getInt("tn_${d.id}", 0)).toInt()
    return all[((n % all.size) + all.size) % all.size]
  }

  private fun tonight(d: Draw, r: Row): RemoteViews {
    val wide = r.view != "poster"
    val v = RemoteViews(d.ctx.packageName, if (wide) R.layout.w2_tonight_wide else R.layout.w2_tonight_poster)
    val m = tonightNow(d)
    v.setTextViewText(R.id.tn_label, d.f.s("tonightTitle"))
    if (m == null) {
      v.setTextViewText(R.id.tn_name, d.f.s("noTowatchMovies"))
      v.setViewVisibility(R.id.tn_check, View.GONE)
      v.setViewVisibility(R.id.tn_another, View.GONE)
      v.setOnClickPendingIntent(R.id.tn_root, d.open(WLinks.discover()))
      return v
    }
    if (wide) {
      val bmp = WArt.card(d.ctx, m.backdrop, m.t.poster, inner(d), 188f, d.f.rtl, null)
      if (bmp != null) v.setImageViewBitmap(R.id.tn_img, bmp)
    } else poster(d, v, R.id.tn_img, m.t.poster, 100f, 150f, 10f)
    v.setTextViewText(R.id.tn_name, m.t.title)
    v.setTextViewText(R.id.tn_sub, Tonight.subOf(d.f, m))
    v.setOnClickPendingIntent(R.id.tn_root, d.open(WLinks.title(m.t)))
    v.setTextViewText(R.id.tn_check_text, d.s2("watched"))
    v.setOnClickPendingIntent(R.id.tn_check, d.open(WLinks.title(m.t)))
    if (d.f.tonight.size > 1) {
      v.setTextViewText(R.id.tn_another_text, d.s2("another"))
      v.setOnClickPendingIntent(R.id.tn_another, LoopzWidget.cycleIntent(d.ctx, d.id, d.next()))
    } else v.setViewVisibility(R.id.tn_another, View.GONE)
    return v
  }

  /* W30 — قسمان صغيران */
  private fun pair(d: Draw, r: Row): RemoteViews {
    val v = fresh(d.ctx, R.layout.w2_pair)
    val half = ((inner(d) - 17f) / 2f).coerceAtLeast(60f)
    r.keys.getOrNull(0)?.let { v.addView(R.id.half_a, half(d, it, half, 148f)) }
    r.keys.getOrNull(1)?.let { v.addView(R.id.half_b, half(d, it, half, 148f)) }
    return v
  }

  /** نصفٌ: فيلم الليلة بوسترٌ وعمود (W34) ما لم يختر القائمة، والبقيّةُ ثلاثةُ أسطرٍ أو بوستران (W30) */
  private fun half(d: Draw, key: String, wDp: Float, bodyDp: Float): RemoteViews {
    /* فيلم الليلة في النصف: البوسترُ بطول الخانة والتفاصيلُ بجانبه — وشكلُ «القائمة» الشكلُ نفسُه بلا أزرار (بدل سطرٍ صغيرٍ تحته فراغ) */
    if (key == "tonight") return posterColumn(d, key, bodyDp, buttons = d.opt("tonight").optString("small", "poster") != "list")
    val v = fresh(d.ctx, R.layout.w2_half_list)
    v.setTextViewText(R.id.hdr_title, titleOf(d, key))
    headerLink(key)?.let { v.setOnClickPendingIntent(R.id.hdr_title, d.open(it)) }
    val items = lines(d, key)
    if (d.opt(key).optString("view") == "posters" && key != "tonight") {
      v.setViewVisibility(R.id.items, View.GONE)
      v.setViewVisibility(R.id.posters, View.VISIBLE)
      val imgs = intArrayOf(R.id.hp_img_1, R.id.hp_img_2)
      val pw = (wDp - 8f) / 2f
      for (n in 0 until 2) {
        val it = items.getOrNull(n)
        if (it == null) { v.setViewVisibility(imgs[n], View.INVISIBLE); continue }
        poster(d, v, imgs[n], it.t?.poster, pw, pw * 1.5f, 6f)
        v.setOnClickPendingIntent(imgs[n], d.open(it.link))
      }
      return v
    }
    /* W34 — فيلم الليلة قائمةً: فيلمٌ واحدٌ بلا اقتراحٍ ثانٍ تحته */
    val max = if (key == "tonight") 1 else 3
    for (n in 0 until max) {
      val it = items.getOrNull(n) ?: break
      /* الأسطرُ تتقاسم ارتفاعَ الخانة (وزنٌ في الواجهة) — لا مسافاتٍ ثابتة */
      val row = RemoteViews(d.ctx.packageName, R.layout.w2_item_small)
      poster(d, row, R.id.it_img, it.t?.poster, 28f, 42f, 4f)
      row.setTextViewText(R.id.it_name, it.name)
      row.setTextViewText(R.id.it_sub, it.sub ?: "")
      row.setOnClickPendingIntent(R.id.item, d.open(it.link))
      v.addView(R.id.items, row)
    }
    return v
  }

  /** W34 · W35 — بوسترٌ ٢:٣ كاملٌ بطول الخانة وعمودٌ بجانبه: 🔁 فوق (فيلم الليلة)، والتقييمُ والمدّة، و✓ تحت */
  private fun posterColumn(d: Draw, key: String, bodyDp: Float, buttons: Boolean = true): RemoteViews {
    val v = RemoteViews(d.ctx.packageName, R.layout.w2_half_poster)
    v.setTextViewText(R.id.hdr_title, titleOf(d, key))
    headerLink(key)?.let { v.setOnClickPendingIntent(R.id.hdr_title, d.open(it)) }
    val pw = bodyDp * 2f / 3f
    if (key == "tonight") {
      val m = tonightNow(d)
      if (m == null) {
        v.setTextViewText(R.id.pc_meta, d.f.s("noTowatchMovies"))
        return v
      }
      poster(d, v, R.id.pc_img, m.t.poster, pw, bodyDp, 8f)
      v.setOnClickPendingIntent(R.id.pc_img, d.open(WLinks.title(m.t)))
      v.setTextViewText(R.id.pc_name, m.t.title)
      v.setOnClickPendingIntent(R.id.pc_name, d.open(WLinks.title(m.t)))
      v.setTextViewText(R.id.pc_meta, Tonight.subOf(d.f, m))
      if (!buttons) return v
      v.setViewVisibility(R.id.pc_check, View.VISIBLE)
      v.setOnClickPendingIntent(R.id.pc_check, d.open(WLinks.title(m.t)))
      if (d.f.tonight.size > 1) {
        v.setViewVisibility(R.id.pc_another, View.VISIBLE)
        v.setOnClickPendingIntent(R.id.pc_another, LoopzWidget.cycleIntent(d.ctx, d.id, d.next()))
      }
      return v
    }
    /* «للمشاهدة» الصغير (W35): أحدثُ ما أُضيف، والعددُ الباقي في الرأس */
    val all = d.arr("towatch")
    val x = all.firstOrNull()
    val t = d.f.titleFrom(x)
    if (x == null || t == null) {
      v.setTextViewText(R.id.pc_meta, "—")
      return v
    }
    if (all.size > 1) v.setTextViewText(R.id.hdr_title, "${titleOf(d, key)} · ${all.size}")
    poster(d, v, R.id.pc_img, t.poster, pw, bodyDp, 8f)
    v.setOnClickPendingIntent(R.id.pc_img, d.open(WLinks.title(t)))
    val rating = if (x.isNull("rating")) null else "★ " + String.format(d.f.locale(), "%.1f", x.optDouble("rating"))
    v.setTextViewText(R.id.pc_name, t.title)
    v.setOnClickPendingIntent(R.id.pc_name, d.open(WLinks.title(t)))
    v.setTextViewText(R.id.pc_meta, listOfNotNull(x.optString("type_label").takeIf { it.isNotEmpty() }, rating).joinToString(" · "))
    v.setViewVisibility(R.id.pc_check, View.VISIBLE)
    if (x.optString("action") == "watched") {
      v.setOnClickPendingIntent(R.id.pc_check, d.open(WLinks.title(t)))
    } else {
      v.setImageViewResource(R.id.pc_check, R.drawable.widget_ic_play)
      v.setOnClickPendingIntent(R.id.pc_check, d.open(WLinks.start(t, "start")))
    }
    return v
  }

  /* W39 — السطرُ المختصر */
  private fun line(d: Draw, key: String): RemoteViews {
    val v = RemoteViews(d.ctx.packageName, R.layout.w2_line)
    v.setTextViewText(R.id.ln_label, titleOf(d, key))
    val it = lines(d, key).firstOrNull()
    if (it == null) {
      v.setViewVisibility(R.id.ln_img, View.GONE)
      v.setTextViewText(R.id.ln_name, "—")
      headerLink(key)?.let { link -> v.setOnClickPendingIntent(R.id.item, d.open(link)) }
      return v
    }
    poster(d, v, R.id.ln_img, it.t?.poster, 28f, 42f, 4f)
    v.setTextViewText(R.id.ln_name, listOfNotNull(it.name, it.sub?.takeIf { s -> s.isNotEmpty() }).joinToString(" · "))
    v.setOnClickPendingIntent(R.id.item, d.open(it.link))
    return v
  }

  /* ───────── الحجمُ الصغير (W33 · W34 · W35 · W43) ───────── */

  private fun small(d: Draw, s: JSONObject, w: Float, h: Float): RemoteViews {
    val key = s.optString("key", "cont")
    /* الطوليُّ (أغلبُ الجوّالات، S24 ≈ 0.70) أو المربّع — والمحرّكُ حسم الشكلَ لكلٍّ منهما */
    val form = if (h / w > 1.2f) s.optString("tall", "list") else s.optString("square", "list")
    return when (form) {
      "posterFull" -> posterFull(d, key, w, h)
      "headerFade" -> headerFade(d, w, h)
      "posterColumn" -> fresh(d.ctx, R.layout.w2_root).also { v ->
        v.addView(R.id.rows, posterColumn(d, key, (h - 24f - 28f).coerceAtLeast(60f)))
      }
      else -> fresh(d.ctx, R.layout.w2_root).also { v ->
        v.addView(R.id.rows, half(d, key, w - 24f, h - 24f - 28f))
      }
    }
  }

  /** الطوليّ: الملصقُ كلُّه بمقاس الودجت بالشكل المشحون (الشارةُ فوق، والاسمُ تحت) و✓ في الطرف السفليّ */
  private fun posterFull(d: Draw, key: String, w: Float, h: Float): RemoteViews {
    val f = d.f
    val v = fresh(d.ctx, R.layout.loopz_w_small)
    v.setViewVisibility(R.id.full_scrim, View.GONE)
    v.setInt(R.id.full_top, "setBackgroundResource", 0)
    v.setViewVisibility(R.id.full_top, View.VISIBLE)
    v.setViewVisibility(R.id.full_name, View.VISIBLE)
    v.setViewVisibility(R.id.full_sub, View.VISIBLE)
    fun draw(t: WTitle, top: String, sub: String?, link: String) {
      val bmp = WArt.posterFull(d.ctx, t.poster, w, h)
      if (bmp != null) v.setImageViewBitmap(R.id.full_img, bmp)
      v.setTextViewText(R.id.full_top, top)
      v.setTextViewText(R.id.full_name, t.title)
      v.setTextViewText(R.id.full_sub, sub ?: "")
      v.setOnClickPendingIntent(R.id.root, d.open(link))
    }
    when (key) {
      "tonight" -> {
        val m = tonightNow(d)
        if (m == null) return emptyText(d, v, f.s("noTowatchMovies"), WLinks.discover())
        draw(m.t, f.s("tonightTitle"), Tonight.subOf(f, m), WLinks.title(m.t))
        if (f.tonight.size > 1) {
          v.setViewVisibility(R.id.full_action, View.VISIBLE)
          v.setImageViewResource(R.id.full_action, R.drawable.widget_ic_repeat)
          v.setOnClickPendingIntent(R.id.full_action, LoopzWidget.cycleIntent(d.ctx, d.id, d.next()))
        }
        v.setViewVisibility(R.id.full_check, View.VISIBLE)
        v.setOnClickPendingIntent(R.id.full_check, d.open(WLinks.title(m.t)))
      }
      "tw" -> {
        val all = d.arr("towatch")
        val x = all.firstOrNull()
        val t = d.f.titleFrom(x) ?: return emptyText(d, v, f.s("towatchTitle"), WLinks.discover())
        draw(t, if (all.size > 1) "${f.s("towatchTitle")} · ${all.size}" else f.s("towatchTitle"), x?.optString("type_label"), WLinks.title(t))
      }
      else -> {
        val c = f.cont.firstOrNull()
        if (c == null) return emptyText(d, v, f.s("startSomething"), WLinks.discover())
        val top = if (f.contTotal > 1) "${f.s("continueTitle")} · ${f.contTotal}" else f.s("continueTitle")
        draw(c.t, top, c.sub ?: c.label, WLinks.title(c.t))
        if (f.check && c.season != null && c.episode != null) {
          v.setViewVisibility(R.id.full_check, View.VISIBLE)
          v.setOnClickPendingIntent(R.id.full_check, CheckReceiver.intent(d.ctx, d.next(), c))
        }
      }
    }
    return v
  }

  /** المربّع لـ«أكمل المشاهدة»: الهيدرُ كلُّه بالعرض يذوب في الأسود والكلامُ تحته (W33) */
  private fun headerFade(d: Draw, w: Float, h: Float): RemoteViews {
    val f = d.f
    val v = fresh(d.ctx, R.layout.loopz_w_small)
    v.setViewVisibility(R.id.full_scrim, View.GONE)
    v.setInt(R.id.full_top, "setBackgroundResource", 0)
    val c = f.cont.firstOrNull() ?: return emptyText(d, v, f.s("startSomething"), WLinks.discover())
    val bmp = WArt.headerFade(d.ctx, c.backdrop ?: c.t.poster, w, h)
    if (bmp != null) v.setImageViewBitmap(R.id.full_img, bmp)
    v.setViewVisibility(R.id.full_top, View.VISIBLE)
    v.setTextViewText(R.id.full_top, if (f.contTotal > 1) "${f.s("continueTitle")} · ${f.contTotal}" else f.s("continueTitle"))
    v.setViewVisibility(R.id.full_name, View.VISIBLE)
    v.setTextViewText(R.id.full_name, c.t.title)
    v.setViewVisibility(R.id.full_sub, View.VISIBLE)
    v.setTextViewText(R.id.full_sub, c.sub ?: c.label ?: "")
    v.setOnClickPendingIntent(R.id.root, d.open(WLinks.title(c.t)))
    if (f.check && c.season != null && c.episode != null) {
      v.setViewVisibility(R.id.full_check, View.VISIBLE)
      v.setOnClickPendingIntent(R.id.full_check, CheckReceiver.intent(d.ctx, d.next(), c))
    }
    return v
  }

  private fun emptyText(d: Draw, v: RemoteViews, text: String, link: String): RemoteViews {
    listOf(R.id.full_img, R.id.full_scrim, R.id.full_top, R.id.full_name, R.id.full_sub, R.id.full_action, R.id.full_plus, R.id.full_check)
      .forEach { v.setViewVisibility(it, View.GONE) }
    v.setViewVisibility(R.id.empty, View.VISIBLE)
    v.setTextViewText(R.id.empty, text)
    v.setOnClickPendingIntent(R.id.root, d.open(link))
    return v
  }

  /** بوسترٌ بمقاس خانته (٢:٣ في ٢:٣ — لا زوم، W38)؛ ملصقٌ لم يصل يبقى خانةً فارغة */
  private fun poster(d: Draw, v: RemoteViews, viewId: Int, name: String?, wDp: Float, hDp: Float, r: Float) {
    val bmp = WPosters.load(d.ctx, name, wDp, hDp, r)
    if (bmp != null) v.setImageViewBitmap(viewId, bmp) else v.setImageViewResource(viewId, R.drawable.widget_poster_ph)
  }
}

/* ============ «فيلم الليلة» — سطرُه الثاني ============ */

object Tonight {
  fun subOf(f: WFeed, m: WMovie): String {
    val parts = mutableListOf<String>()
    if (m.rating != null) parts.add("★ " + String.format(f.locale(), "%.1f", m.rating))
    f.runtime(m.runtime)?.let { parts.add(it) }
    return parts.joinToString(" · ")
  }
}
