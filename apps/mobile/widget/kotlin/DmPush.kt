package com.loopztv.app.widget

import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.RemoteInput
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.BaseBundle
import android.os.Build
import android.os.PersistableBundle
import com.google.firebase.messaging.RemoteMessage
import com.loopztv.app.R
import expo.modules.notifications.service.ExpoFirebaseMessagingService
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * ====== 🆕 إشعارُ الرسالة بزرّيه والتطبيقُ في الخلفية أو مقفول (1.12.7 — بعد D-1406 وD-1408) ======
 *
 * 🔴 **لماذا كودٌ أصليّ**: إشعارُ Expo العاديُّ يرسمه أندرويد بنفسه والتطبيقُ في الخلفية فيسقط «رد» و«تمييز كمقروءة» (D-1406)،
 * ورسمُه من الجافاسكربت (D-1408) لم يجرِ أصلاً — أندرويد لا يشغّل مهمّةَ الجافاسكربت في الخلفية لإشعار البيانات.
 * أمّا خدمةُ الرسائل الأصليّة فيوقظها النظامُ لكلِّ رسالة «بيانات» عالية الأولويّة، والتطبيقُ مقفول.
 *
 * 🔑 **خدمةٌ واحدةٌ تستلم كلَّ شيء** (`LoopzMessagingService`): أندرويد يسلّم رسائلَ Firebase لخدمةٍ واحدة، فهذه
 * **ترث خدمةَ Expo** وتحلّ محلَّها في البيان (`withLoopzWidget.js` يزيل مدخلَ Expo): رسالةٌ `kind: "dm"` تُرسم هنا،
 * وكلُّ ما سواها — وتجديدُ الرمز (`onNewToken`) — يمرّ إلى Expo كما كان حرفاً.
 *
 * 🔑 **الردُّ برمز الودجت** (`files/widget/token`، `CheckReceiver.token`) لا بالجلسة: نسخةُ الجلسة لا تخرج من التطبيق
 * (D-929). والنداءُ مهمّةٌ مستعجلة (`WidgetJobService`) — درسُ الودجت: مستقبِلٌ في الخلفية لا شبكةَ له.
 *
 * 🔑 **الخادمُ يرسل كلَّ ما يُرسم** (`dmNativeOf` في `src/core/push.ts`): العنوانُ والسطرُ والوجهةُ ونصوصُ الزرّين بلغة
 * الجهاز المسجَّلة — والموارد (`dm_*`) احتياطٌ إن غاب نصّ.
 */
class LoopzMessagingService : ExpoFirebaseMessagingService() {
  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val dm = DmPush.parse(remoteMessage.data)
    if (dm == null) {
      super.onMessageReceived(remoteMessage)
      return
    }
    try {
      DmPush.show(applicationContext, dm, null, true)
    } catch (e: Exception) {
      CheckReceiver.diag(applicationContext, "dm", "draw_error", "${e.javaClass.simpleName}: ${e.message?.take(120)}")
    }
  }
}

/** زرّا الإشعار: «رد» (بخانة الكتابة) و«تمييز كمقروءة» — غيرُ مُصدَّر، لا تصله إلّا نيّةٌ معلّقةٌ صنعها التطبيق */
class DmActionReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val action = intent.action ?: return
    if (action != DmPush.ACTION_REPLY && action != DmPush.ACTION_READ) return
    val raw = intent.getStringExtra(DmPush.EXTRA_DM) ?: return
    val dm = DmPush.fromJson(raw) ?: return
    var text = ""
    if (action == DmPush.ACTION_READ) {
      /* «قرأت» يُرى فوراً: الإشعارُ يُزال الآن، والختمُ على الخادم في المهمّة */
      DmPush.cancel(ctx, dm.tag)
    } else {
      text = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(DmPush.KEY_TEXT)?.toString()?.trim()?.take(1000) ?: ""
      if (text.isEmpty()) {
        /* خانةٌ فارغة: الإشعارُ يُعاد كما كان (أندرويد يُبقي دائرةَ الانتظار حتى يُحدَّث) */
        DmPush.show(ctx, dm, null, false)
        return
      }
    }
    val args = PersistableBundle().apply {
      putString("action", action)
      putString(DmPush.EXTRA_DM, raw)
      putString("text", text)
    }
    if (WidgetJobService.enqueue(ctx, args)) return
    /* النظامُ رفض المهمّة (نادر): النداءُ هنا كما في ✓ الودجت */
    val pending = goAsync()
    Thread {
      try {
        DmPush.perform(ctx, args)
      } finally {
        pending.finish()
      }
    }.start()
  }
}

object DmPush {
  const val ACTION_REPLY = "com.loopztv.app.dm.REPLY"
  const val ACTION_READ = "com.loopztv.app.dm.READ"
  const val ACTION_PREFIX = "com.loopztv.app.dm."
  const val EXTRA_DM = "dm"
  const val KEY_TEXT = "loopz_dm_text"
  /** قناةُ الإشعارات نفسُها التي ينشئها التطبيق (`PUSH_CHANNEL` في `push.ts`) ويرسل عليها الخادم — الصوتُ والأولويّةُ منها */
  private const val CHANNEL = "default"
  /** معرّفٌ واحدٌ والوسمُ هو الخيط: رسالةٌ جديدةٌ من الشخص نفسِه تحلّ محلَّ سابقتها */
  private const val ID = 4_406
  /** المحادثةُ المفتوحةُ الآن — يكتبها الجسرُ (`setDmOpen` في `LoopzWidgetModule.kt`) والقائمتان يجب أن تتطابقا */
  private const val OPEN_PREFS = "loopz_dm"
  private const val OPEN_KEY = "open"

  private val UUID = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
  private val PEER_URL = Regex("^/messages\\?with=([0-9a-fA-F-]{36})$")
  private val GROUP_URL = Regex("^/messages\\?group=([0-9a-fA-F-]{36})$")

  class Dm(
    val title: String,
    val body: String,
    val url: String,
    val to: String?,
    val group: String?,
    val labels: JSONObject,
    val json: String,
  ) {
    /** الخيط: معرّفُ الشخص، أو `g:` ومعرّفُ القروب — الشكلُ نفسُه الذي تعلنه شاشةُ المحادثة (`push.setOpenPeer`) */
    val tag: String get() = to ?: "g:$group"
  }

  /**
   * رسالةُ Firebase ⇐ رسالةٌ نرسمها، أو `null` لكلِّ ما سواها. **خدمةُ Expo تضع `data` المرسَلة نصّاً في المفتاح `body`**
   * (`NotificationData.body` في expo-notifications)؛ والمفاتيحُ مباشرةً احتياطٌ لو أُرسلت من Firebase نفسِه.
   */
  fun parse(data: Map<String, String>): Dm? = try {
    val nested = data["body"]?.let { runCatching { JSONObject(it) }.getOrNull() }
    val o = if (nested != null && nested.optString("kind") == "dm") nested else if (data["kind"] == "dm") JSONObject(data.toMap()) else null
    o?.let { fromJson(it.toString()) }
  } catch (e: Exception) {
    null
  }

  fun fromJson(raw: String): Dm? = try {
    val o = JSONObject(raw)
    if (o.optString("kind") != "dm") null
    else {
      val url = o.optString("url")
      /* الوجهةُ من الرابط نفسِه قبل الحقلين: الضغطُ يفتح ما يُردّ عليه، لا غيرَه */
      val peer = PEER_URL.find(url)?.groupValues?.get(1)?.lowercase()
      val group = if (peer == null) GROUP_URL.find(url)?.groupValues?.get(1)?.lowercase() else null
      if ((peer == null && group == null) || (peer != null && !UUID.matches(peer)) || (group != null && !UUID.matches(group))) null
      else Dm(
        title = o.optString("title").take(120),
        body = o.optString("body").take(400),
        url = url,
        to = peer,
        group = group,
        labels = o.optJSONObject("l") ?: JSONObject(),
        json = raw,
      )
    }
  } catch (e: Exception) {
    null
  }

  private fun label(ctx: Context, dm: Dm, key: String, fallback: Int): String =
    dm.labels.optString(key).takeIf { it.isNotBlank() } ?: ctx.getString(fallback)

  /** التطبيقُ أمام صاحبه الآن؟ — من النظام نفسِه (لا مكتبةَ دورة حياة: ليست في مسار بناء التطبيق) */
  private fun foreground(): Boolean = try {
    val info = ActivityManager.RunningAppProcessInfo()
    ActivityManager.getMyMemoryState(info)
    info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
  } catch (e: Exception) {
    false
  }

  private fun openThread(ctx: Context): String? =
    ctx.getSharedPreferences(OPEN_PREFS, Context.MODE_PRIVATE).getString(OPEN_KEY, null)?.lowercase()

  private fun manager(ctx: Context) = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  fun cancel(ctx: Context, tag: String) {
    try {
      manager(ctx).cancel(tag, ID)
    } catch (e: Exception) {
      /* لا شيء */
    }
  }

  /** القناةُ يُنشئها التطبيقُ عند أوّل إذن؛ وإن غابت (مُسحت البيانات) تُنشأ بالإعداد نفسِه — لا تُمسّ إن وُجدت */
  private fun ensureChannel(ctx: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val nm = manager(ctx)
    if (nm.getNotificationChannel(CHANNEL) != null) return
    val ch = NotificationChannel(CHANNEL, "Loopz", NotificationManager.IMPORTANCE_HIGH)
    ch.enableLights(true)
    ch.lightColor = ACCENT
    nm.createNotificationChannel(ch)
  }

  private const val ACCENT = 0xFFFFD400.toInt()

  /**
   * يرسم الإشعار أو يحدّثه في مكانه. `line`: سطرٌ تحت الرسالة («أنت: …» أو «تعذّر») بعد الردّ؛ `alert`: صوتٌ واهتزاز —
   * للرسالة الواردة وحدَها، لا لتحديثٍ بعد ردّك أنت.
   * 🆕 D-1307 باقية: رسالةٌ من المحادثة المفتوحة والتطبيقُ أمامك لا تُرسم.
   */
  /* `Action.Builder(int, …)` مهمَلٌ منذ ٢٣ لكنّه يعمل في كلِّ إصدارٍ ولا يحتاج أيقونةً لزرٍّ نصّيّ */
  @Suppress("DEPRECATION")
  fun show(ctx: Context, dm: Dm, line: String?, alert: Boolean) {
    if (alert && foreground() && openThread(ctx) == dm.tag.lowercase()) return
    ensureChannel(ctx)
    val pkg = ctx.packageName
    val icon = ctx.resources.getIdentifier("notification_icon", "drawable", pkg).takeIf { it != 0 } ?: ctx.applicationInfo.icon
    val colorId = ctx.resources.getIdentifier("notification_icon_color", "color", pkg)
    val color = if (colorId != 0 && Build.VERSION.SDK_INT >= 23) ctx.getColor(colorId) else ACCENT
    val text = if (line == null) dm.body else if (dm.body.isEmpty()) line else "${dm.body}\n$line"
    val code = dm.tag.hashCode()

    /* اللمسةُ تفتح المحادثةَ برابط الودجت (`w/msg`) — `WidgetGate` يدفع الخيطَ بعد أن يُدفع الجذر، كما يفعل `PushGate` */
    val path = if (dm.to != null) "w/msg?with=${dm.to}" else "w/msg?group=${dm.group}"
    val open = Intent(Intent.ACTION_VIEW, Uri.parse("${WFeed.SCHEME}://$path")).setPackage(pkg)
    val openPi = PendingIntent.getActivity(ctx, code, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    /* ⚠️ نيّةٌ لكلِّ خيطٍ ولكلِّ زرّ (البياناتُ تميّزها، لا رمزُ الطلب وحدَه — درسُ D-929)؛ وخانةُ الكتابة تتطلّب نيّةً قابلةً
       للتعديل في أندرويد 12+ (النظامُ يضع النصَّ فيها) */
    fun actionIntent(action: String): Intent = Intent(ctx, DmActionReceiver::class.java)
      .setAction(action)
      .setData(Uri.parse("loopz-dm://${Uri.encode(dm.tag)}/${action.substringAfterLast('.')}"))
      .putExtra(EXTRA_DM, dm.json)
    val mutable = if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
    val replyPi = PendingIntent.getBroadcast(ctx, code + 1, actionIntent(ACTION_REPLY), PendingIntent.FLAG_UPDATE_CURRENT or mutable)
    val readPi = PendingIntent.getBroadcast(ctx, code + 2, actionIntent(ACTION_READ), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    val input = RemoteInput.Builder(KEY_TEXT).setLabel(label(ctx, dm, "hint", R.string.dm_reply_hint)).build()
    val reply = Notification.Action.Builder(0, label(ctx, dm, "reply", R.string.dm_reply), replyPi).addRemoteInput(input)
    if (Build.VERSION.SDK_INT >= 24) reply.setAllowGeneratedReplies(false)
    if (Build.VERSION.SDK_INT >= 28) reply.setSemanticAction(Notification.Action.SEMANTIC_ACTION_REPLY)
    val read = Notification.Action.Builder(0, label(ctx, dm, "read", R.string.dm_mark_read), readPi)
    if (Build.VERSION.SDK_INT >= 28) read.setSemanticAction(Notification.Action.SEMANTIC_ACTION_MARK_AS_READ)

    @Suppress("DEPRECATION")
    val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CHANNEL) else Notification.Builder(ctx)
    b.setSmallIcon(icon)
      .setColor(color)
      .setContentTitle(dm.title)
      .setContentText(text)
      .setStyle(Notification.BigTextStyle().bigText(text))
      .setContentIntent(openPi)
      .setAutoCancel(true)
      .setCategory(Notification.CATEGORY_MESSAGE)
      .setShowWhen(true)
      .setOnlyAlertOnce(!alert)
      .addAction(reply.build())
      .addAction(read.build())
    if (Build.VERSION.SDK_INT < 26) {
      @Suppress("DEPRECATION")
      b.setPriority(if (alert) Notification.PRIORITY_HIGH else Notification.PRIORITY_LOW)
      @Suppress("DEPRECATION")
      if (alert) b.setDefaults(Notification.DEFAULT_ALL)
    }
    manager(ctx).notify(dm.tag, ID, b.build())
  }

  /** ينفّذ الزرَّ على الخادم — من المهمّة المستعجلة (`WidgetJobService`) أو من المستقبِل إن رُفضت */
  fun perform(ctx: Context, args: BaseBundle) {
    val action = args.getString("action") ?: return
    val dm = args.getString(EXTRA_DM)?.let { fromJson(it) } ?: return
    val text = args.getString("text") ?: ""
    val target = if (dm.to != null) JSONObject().put("to", dm.to) else JSONObject().put("group", dm.group)
    val token = CheckReceiver.token(ctx)
    if (token == null) CheckReceiver.diag(ctx, "dm", "no_token", action.substringAfterLast('.'))
    if (action == ACTION_READ) {
      if (token != null) post(ctx, "/api/v1/widget/dm-read", token, target)
      return
    }
    if (action != ACTION_REPLY || text.isEmpty()) return
    val ok = token != null && post(ctx, "/api/v1/widget/dm-reply", token, target.put("body", text))
    /* الإشعارُ نفسُه يقول ما جرى: «أنت: …» — أو «تعذّر» ويبقى بزرّيه فيُعاد */
    val line = if (ok) "${label(ctx, dm, "you", R.string.dm_you)}: $text" else "⚠️ ${label(ctx, dm, "failed", R.string.dm_failed)}"
    try {
      show(ctx, dm, line, false)
    } catch (e: Exception) {
      CheckReceiver.diag(ctx, "dm", "draw_error", "${e.javaClass.simpleName}: ${e.message?.take(120)}")
    }
  }

  /** نداءٌ برمز الودجت — `true` لردٍّ ناجح؛ والفشلُ يُكتب في سجلّ لمسات الودجت (يرسله التطبيقُ عند فتحه) */
  private fun post(ctx: Context, path: String, token: String, body: JSONObject): Boolean {
    return try {
      val conn = (URL(CheckReceiver.BASE + path).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 10_000
        readTimeout = 10_000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Authorization", "Bearer $token")
      }
      try {
        conn.outputStream.use { it.write(body.toString().toByteArray()) }
        val code = conn.responseCode
        if (code !in 200..299) CheckReceiver.diag(ctx, "dm", "http", "${path.substringAfterLast('/')} $code")
        code in 200..299
      } finally {
        conn.disconnect()
      }
    } catch (e: Exception) {
      CheckReceiver.diag(ctx, "dm", "error", "${path.substringAfterLast('/')} ${e.javaClass.simpleName}: ${e.message?.take(100)}")
      false
    }
  }
}
