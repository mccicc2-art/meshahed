import React from "react";
import { Platform } from "react-native";
import { Image, type ImageRef } from "expo-image";
import { imageCacheReady } from "./imageCacheGuard";

/**
 * ====== مجموعةُ الأيقونات الواحدة — مساراتُ `Icon.tsx` (الويب) مرسومةً مرّةً ======
 *
 * 🔑 **لا مجموعةَ أيقوناتٍ ثانية** (القاعدة ٣): كلُّ ملفٍّ هنا هو مسارُ SVG
 * الويب نفسُه (`viewBox 0 0 24 24 · stroke 1.7 · round`) مرسومٌ أبيضَ ٧٢px
 * ويُلوَّن بـ`tintColor` وقتَ الرسم — فاللونُ من الرموز لا من الصورة. ولا
 * حزمةَ SVG في التطبيق: اثنا عشرَ ملفّاً صغيراً أرخصُ من محرّكٍ كامل.
 * **رمزٌ جديد = يُرسم من `Icon.tsx` بالطريقة نفسِها لا يُرسم بيد.**
 */
const ICONS = {
  /* Phase 11-H — رموزُ الرئيسية: من `Icon.tsx` بالطريقة نفسِها (cairosvg · ٧٢px · أبيض) */
  mail: require("../assets/icons/mail.png"),
  bell: require("../assets/icons/bell.png"),
  settings: require("../assets/icons/settings.png"),
  calendar: require("../assets/icons/calendar.png"),
  hourglass: require("../assets/icons/hourglass.png"),
  book: require("../assets/icons/book.png"),
  trending: require("../assets/icons/trending.png"),
  check: require("../assets/icons/check.png"),
  play: require("../assets/icons/play.png"),
  info: require("../assets/icons/info.png"),
  repeat: require("../assets/icons/repeat.png"),
  "check-line": require("../assets/icons/check-line.png"),
  star: require("../assets/icons/star.png"),
  card: require("../assets/icons/card.png"),
  chart: require("../assets/icons/chart.png"),
  clock: require("../assets/icons/clock.png"),
  heart: require("../assets/icons/heart.png"),
  "heart-filled": require("../assets/icons/heart-filled.png"),
  sliders: require("../assets/icons/sliders.png"),
  search: require("../assets/icons/search.png"),
  close: require("../assets/icons/close.png"),
  /* 🆕 D-947 — رموزُ التبويبَين الرابع والخامس وبطاقةِ القائمة، من `Icon.tsx` بالطريقة نفسِها */
  people: require("../assets/icons/people.png"),
  list: require("../assets/icons/list.png"),
  share: require("../assets/icons/share.png"),
  comment: require("../assets/icons/comment.png"),
  "sparkle-star": require("../assets/icons/sparkle-star.png"),
  /* Phase 11-G — بديلا الملصق في صفّ نتيجة البحث (`film` · `tv`) وبابُ «ابحث بالوصف» (`sparkles`)،
     مساراتُ `Icon.tsx` نفسُها مرسومةً ٧٢px بالطريقة نفسِها */
  film: require("../assets/icons/film.png"),
  tv: require("../assets/icons/tv.png"),
  sparkles: require("../assets/icons/sparkles.png"),
  plus: require("../assets/icons/plus.png"),
  /* 🆕 D-1438 — زرُّ الرجوع إلى الكتابة حين تكون لوحةُ «+» مكانَ لوحة المفاتيح — مرسومٌ بالطريقة نفسِها (cairosvg · ٧٢px · أبيض · خطّ ١٫٧) */
  keyboard: require("../assets/icons/keyboard.png"),
  minus: require("../assets/icons/minus.png"),
  "red-card": require("../assets/icons/red-card.png"),
  bookmark: require("../assets/icons/bookmark.png"),
  "chevron-down": require("../assets/icons/chevron-down.png"),
  /* D-948 — مقبضُ الترتيب، وعينُ الحرق، والنجمةُ الممتلئة (`fill-current` في الويب) */
  grip: require("../assets/icons/grip.png"),
  eye: require("../assets/icons/eye.png"),
  "eye-off": require("../assets/icons/eye-off.png"),
  "star-filled": require("../assets/icons/star-filled.png"),
  /* 🆕 D-959 — رموزُ المشغّل الأصليّ، من `Icon.tsx` بالطريقة نفسِها: دائرةُ
     الإيقاف، ومخروطُ الصوت الواحد بموجتِه أو بشطبِه (**عائلةٌ واحدةٌ للرمز**
     — التبديلُ يُقرأ حالةً لا أيقونتين غريبتين). */
  pause: require("../assets/icons/pause.png"),
  volume: require("../assets/icons/volume.png"),
  "volume-off": require("../assets/icons/volume-off.png"),
  /* 🆕 D-961 — رموزُ الشريط السفليّ، وجهان لكلِّ خانة: مفرَّغٌ للخامل وممتلئٌ
     للنشط (`Icon.tsx` نفسُها — والممتلئُ `fill="currentColor" stroke="none"`
     فيُرسم أبيضَ ويُلوَّن بـ`tintColor` كسائره). `people` و`search` المفرَّغتان
     موجودتان أصلاً فلم تُرسما ثانيةً. */
  home: require("../assets/icons/home.png"),
  "home-filled": require("../assets/icons/home-filled.png"),
  library: require("../assets/icons/library.png"),
  "library-filled": require("../assets/icons/library-filled.png"),
  compass: require("../assets/icons/compass.png"),
  "compass-filled": require("../assets/icons/compass-filled.png"),
  "people-filled": require("../assets/icons/people-filled.png"),
  "search-filled": require("../assets/icons/search-filled.png"),
  /* 🆕 D-1020 — رموزُ قائمة «المزيد» في صفحة العمل، من `Icon.tsx` بالطريقة نفسِها (cairosvg
     ٧٢×٧٢ أبيض على شفّاف، يُلوَّن بـ`tintColor`) */
  dots: require("../assets/icons/dots.png"),
  send: require("../assets/icons/send.png"),
  palette: require("../assets/icons/palette.png"),
  link: require("../assets/icons/link.png"),
  /* Phase 11-I — رموزُ فهرس الإعدادات، من `Icon.tsx` بالطريقة نفسِها (cairosvg · ٧٢px · أبيض) */
  edit: require("../assets/icons/edit.png"),
  "person-check": require("../assets/icons/person-check.png"),
  /* 🆕 D-1380 — دائرتا الملفّ (قبل المتابعة) وقفلُ الرسائل، من `Icon.tsx` بالطريقة نفسِها (٧٢px · ١٫٧ · أبيض) */
  "person-plus": require("../assets/icons/person-plus.png"),
  lock: require("../assets/icons/lock.png"),
  shield: require("../assets/icons/shield.png"),
  download: require("../assets/icons/download.png"),
  /* D-1106 — تعديلُ الملفّ أصليّاً: الصورةُ وحذفُها، من `Icon.tsx` بالطريقة نفسِها (cairosvg · ٧٢px · أبيض) */
  image: require("../assets/icons/image.png"),
  trash: require("../assets/icons/trash.png"),
  /* 🆕 D-1360 — «نسخ» (رابطُ الدعوة): مسارُ الويب نفسُه (`Icon.tsx` → `copy`) مرسوماً ٧٢px بسماكة ١٫٧ كأخواته */
  copy: require("../assets/icons/copy.png"),
  /* 🆕 D-1401/D-1403 — ✓✓ «قرأها» و«رد»: مسارا `Icon.tsx` نفسُهما، cairosvg · ٧٢px · أبيض */
  "check-double": require("../assets/icons/check-double.png"),
  reply: require("../assets/icons/reply.png"),
  /* 🆕 D-1134 — مبدّلُ العرض في الرئيسيّة كالويب (`HomeViewSwitch`: `grid` ⇄ `list`)، cairosvg · ٧٢px · أبيض،
     خطٌّ ٢ كما يمرّره الويب */
  grid: require("../assets/icons/grid.png"),
  /* 🆕 D-1321 — «مزدوج» من `Icon.tsx` بالطريقة نفسِها */
  "view-mixed": require("../assets/icons/view-mixed.png"),
  /* 🆕 11-M · M2 — دبّوسُ غرفة «الأعمال» (`RoomPinButton`: خطٌّ ٢٫٢ كما يمرّره الويب)، cairosvg · ٧٢px · أبيض.
     ⚠️ **صورةُ بياناتٍ لا ملفّ** — والحجّةُ سببُ الطريق لا الذوق: الدفعُ عبر `push_files` نصٌّ وحده، فملفٌّ ثنائيٌّ
     لا يعبر؛ و`expo-image` يقرأ `data:` ويلوّنها بـ`tintColor` كأخواتها — الرسمُ نفسُه والحجمُ ١٫٥KB. */
  pin: { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAYAAABV7bNHAAAABmJLR0QA/wD/AP+gvaeTAAAEJElEQVR4nO2bzW8XRRjHv9OXQAkJvlVjCCeDUsQTEY0iJ0MIkT8DCheNiUYlBTSe/BOsLzFeTdTEGPViAgWMBw8SUgxXS9NElMaLFmg/HnZJyg92Zp7dnd8uMp9bM7PP851vd3af2ZmflMk0waUICoxJ2inpMUkPpMixjmVJS5IuOeduJs7VDGAK+ARYZvgsl7l3dO3DHQAjwCngRgfGDHIdOAEkmR1mKMz5vFtP7spn9MEkijunr8w0HV8jh4EpSRckjTUVkogbknY55y7XDTDSUMAb6q85kjQu6c0mAWrfQRSv8quStlR0OSPpY0n/1s0RyYSkw5L2VrRfkzTpnFtNrON2gGc8c/90aeCwtIwBZz16nq4bu8kU2+ppmx1m0Vbm+tDTxafVS9NnUJ9I8kpvYtAVT9vRIU+xcUnTni4+rV5SPqTPSZpVIe6yc+73urkq8m+TNCXpcUlHJL1Q0bWbh7QkUax9YjkHvNRCzn3AT4a8s22Mta7YHRRrn1huAocb5JsuY8SyAmxvc8x1RJ8wCL5lUlXN4suzD1g15jqeYsxW4SMUC0MLZ2vkOW/M8Sl9WKxKEuCAGWzTLbo2AbYZ4q4Ax3tjznqAJ4GPgGsRA3nZEHd/RLy/gFm6fubEAIwCOynuqioOGeId8sSZKXONphhLkmKurDnmgSdSxB/gV+fcfKrg/6elRhKyQQGyQQGyQQGyQQGyQQGyQQGyQQGyQQFSG7TB02b5wrfmaRs3xDGT2qBXPG1/GOJc9bQdNMTpB8Am4H1grWKBuQJsMsTbTPWnlDXgPUu8zgAmgNeBJc/qG+CbGrG/D8RcKnNPpBhbI4CNwGvAYmAQt4j+FrQux4HI2IvAq8DGFGO1ih4FjgFXIsUDfNEg31eGPAvAURJ9J4oR+yj+/fC7cQGo2keLyfkgcNGY8zQw2ebYY4Q+BMwbhf4IPNJC7sly0BYuAqkPk94m8muDuAXgCNBaSUGxkzKNbWp/2Vb+kLiDkYKSPyyxvxz2p9KyXtQPARFDf90SX158m1pIqGA7SYcFG0WB+i4tFah1BDzv+e90d0hgAIpd1SqetcSyPjgf9rR9Z4yVEt9UMr3yrQb5+vfpdxLXPW2mwrHNjcMX6UN5X7C7rUBWg1Y8bW81ETJE/rF0tk6xS8b+fQNJpm1qk0HlOcPzlmt6xpxzbtFyQZ3y/23ZPpf2hVVJ71gvMhvknJuTdEz3lkmrkqadc8O7+4G9wJynIOsLZ4CqI8JBGh9TozhK95T8RaSP3ap+A34g6Zeacf+U9Jv1mdM78J8eiz6Floq8cRggGxQgGxQgGxQgGxQgGxQgGxQgGxQgGxQgGxSgDwb9XbPt/gDYQLE9PcgC4DvCd/8A7BkwaQHY07UuKdGP8etQ3i3PlX/+7JzzbRBkMvcI/wHymLK0u0/rsgAAAABJRU5ErkJggg==" },
  "pin-filled": { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAYAAABV7bNHAAAABmJLR0QA/wD/AP+gvaeTAAADVUlEQVR4nO2cPYtdRRiAnzcf5gNBo0SLlKJmYzohgqYXgun8D5rGICh+sCIhlX9BMQRrtbOxzIpgYaFgErR0syyoyWKhZOPmsThXCDeJszOz52M383SXe96Z9zz73jkzc4aFRqOG6KNRdQ9wDHgSeLSPPu5gDVgFrkTEPz33VYe6oH6qrjk8a7O+j47t4S7UXeqH6q0RxMyzrn6g9vLryMZOzmfjOrknF52CJLvKmSqLtfdXZVhdAH4E9tQm0hO3gOMR8XNpA7sqE3iL6coB2Au8XdNAcQXZPcp/Bx6pSWAAbgCHI2KjJLimghaYvhyAQ0Dxo79G0JGK2KEpzrV2DNrx1Ai6tmVZ9E9xrm2QTlBcQbOF4Rel8QPyeakcqJ8oHqWbKO6taadH1ukmir+UNlA1SEfEVeB8TRs9c65GzpZgt1i9OOaC6z5ccAqLVQA11EW7rYaxuam+71Tk3In6jPqJemMEMdfVj9Wnx/aQRN2tHrOrqr5ZnPW1u4976WUlPnusXlaf6qP9OX6IiMt9Nd6WGgmaoARNUIImKEETlKAJStAEJWiCEjRBCfoWtK/n9qHnvai+Bb3Sc/sApwboY2tRD6rn1dsDLFZvq+fUg2PfdxL1gPqmujqAmHlWZ30fGNvDXaj71bPqyghi5llR31D3j+3lv32fM+q1UZXcm2X1dSv3iWreiz0BfAm8VJPAAFwCXo2I30qCiwSpjwHf0B1g2A78BJyMiLXcwNLH/AW2jxyA5+hyzia7gtRTwFclnU2AlyPi65yAkgo6WxAzFbJzz6og9WHgOtN91ZxiHTgUEX9tNiC3go6zfeUAPEQ3Hm2aXEGPZ14/RQ7nXJwraCdsj2RNHHfCDfdKrqCbvWQxLH/nXJwr6Erm9VNDIOs1dZagiPgV+DYnZmIsRcRKTkDJGPQuUHzmb0Q2gPdyg7IFRcQScIbtJWkDeC0ihqt+9aS6NN52z6a5pL5Yep/Vx9TUI8CzlE8inwfeuc93HwHfF7b7B3A1d8yZHOrp//nrnx47vzZRTNAEJWiCEjRBCZqgBE1QgiYoQROUoAlK0AQlmIKgPwu/ezBQ99mdxJhnWR3iCN/0UU/MSVpWT4ydF/T0L7pKmFXLC7OP30XETnhB0Hjg+ReEqRZjOWrlKQAAAABJRU5ErkJggg==" },

  /* 🆕 «لا ويب في التطبيق» ٢ + تصاميمُ الإعدادات الثلاثة (أحمد، ١٩ أكتوبر): ما لا نظيرَ له في `Icon.tsx` الويب — خطٌّ ١٫٧
     كأخواتها، cairosvg · ٧٢px · أبيض، صورةُ بياناتٍ (حجّةُ `pin`: الدفعُ نصٌّ). `x-logo` شكلُ X المصمت (ربطُ الحساب) */
  person: { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAQAAAD/5HvMAAACHElEQVR42u2Z7XGDMAyGlVwX8ApewSu4I7ACK3iFdgQyQjoCjAAjwAgwgvqjKZiPuLJlCHe1+BHfRVYebJ31WrkgnMuukIASUAJKQAno3EBvzPkKNGiQIABggA4qqKBhRcTwR2GNW1aiCo8ajlOgy4pjgcSTtZmvkzgOqESK1UcBFYufNahQoECFBlvuxoWk8mQ9mtX3BnvLQ+0PVFs4etNDW0jl3kD2+pinXiZ8jXyBDDFlWwL25uNbOvQ4+nL63TZm7FLL5DiqnH7VxoxdgMQ46px+3caM/yE/BuJWyI0ZuwB1xGTVxK1lA03Jmjv9cmLys/XQ6Q5Gu9KfonScsLgu5Uf7avlxQoEGKAhIh0rY04n83/Qu41+DLsweY/SL4iU1PRPQC7sfGhQokI+Uhkdad9BA413jmd0PjfdZxVpbj/cnpTf6OZQv6pXLWsz3BdIeMBOU3gvoA0OtiH9SCyhBrQR/BQ000I1CXoIABRrU6vLTwDtR7hOre7uqV5lzRraqczWt+vt2PH5CK2Lxrf31ka/Q6D2bB3NBW8QAymY4OuDMspEyPlDLwlkitVyg3Hq7PFh2GXoUejqXyFGXNTW13WEk54a12LbJZHgHLbMONt4/GLawzcL1kCI28PzaFCoGUBMRSIYDURt4fp2lKEADG2igdR2vpCBDFKCB8nJuoM/FJ89I0f7SQxoUS7J7R0s31wSUgBJQAlrYN8D4H98wZtNNAAAAAElFTkSuQmCC" },
  gift: { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAQAAAD/5HvMAAAB+0lEQVR42u2a4ZWCMAzH/95zgayAI+AIzOAIrMCNgCPoCDgCjIAj4Ah0hNwHBRHa0krx7r1L+oXHS83vJW2TFDeMvyVfECABEiABEiABEqBfBiLQKrpvAKWo0T5GiQyRUTNChrLXrZF6WGG3QVzzWFo+cTTRjLjgdqJbM7lZcgWa4nRQ6YteqoHpkAICZWyTotcrrHpZOKDmxSdTH5QMBpca/7W+PnJbP09JGAyOOR9hFSPvtJxzzGBwMnhLYYCigRkaYBaWIA71nujRvLUN28+RuzT9k0KFK25QUFBIkWlmHXEGgUCIkCAezN31T0bRAxFyxIj8jzVHUbihwlELpnFbYty6YaV5rLKZkNEgQGvLDfuxl6apI/8Yzj3FzOay+KPJPRm/2GqoO9nZdsOLT7vkeca3YxXQTKwZgWgQYdc983xSnjNIKkYBCi1bzYKjfgco798jTy01n8vqj55EV+znQlZ9NELXeQ8Raks/ETrr7+ZzmcLB+UhcinPQrFJD0Zq/1NFrlB4nfUFrLibzfnLOZB3vaRrsbj1zTzhNOakFSIAESIAESIAESIAc+zJdF+XzdWNp12YsYdNVa+rUZNccsmp5OWopdCv/NXTDZTWgi6XRsl5jl6uEq1xyk59yHfCSuOXavHpcbvL97jSCNEkb+UOTAAnQfwP6AT1aQVL+ilUYAAAAAElFTkSuQmCC" },
  logout: { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAQAAAD/5HvMAAABfUlEQVR42u2a23XCMAyG5R4WYAV3BFagI8AI6QhkBJiFEcoIZoQwQjKC+gCHq53YxlLURn9eOIHAdyzrhmwQZOkDFEiBFIhWs6hPzT33OiIi7LssbrHBkBxahNJX35sVttgvxwlUYYzYgOzg6hCtUMjLKu9GftQR1uX3tAkk1wbs5dUeaq9HEXlZCOh2+xNOnHFoGMho6lAgBTrLggMEdw0fbybX95ODuzzfpKVgOre/fcMJvuJjGZ3JjnfG+0kwHJnJ7EMlFW04OqBnpBYXYwNlIdECZSBRAyUj0QMlInEAJSHxACUgcQFFI+WmjiUsItqA5/53dfdMB2s4lIrUGyyh1he981aoTV4dv/avjdQ/KdB2RX67g7pcGyRsUxO6/UQDo7DUISy5Cis/hBVowkpYYUW+uDbI5eBMspVOwqFtpV3O+EH/9FSgCQJZXqDh4csBvjmHL6F4sI2aljGOOEcb4P2ZEafAIfBIY3ITdX6I8SCB0QNNCqRAUwP6BRlRo9PJ7FrBAAAAAElFTkSuQmCC" },
  camera: { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAQAAAD/5HvMAAACd0lEQVR42u2a4ZWrIBCFb/ZsA7TgluCWQAumBFOClGBK2JSgLViClpCUEErg/Xj7FBNABiG77xwmf3JOEL/A5c44yUHhd8UbMlAGykAZKANlIFK8B13FUYJtjJGYMATMreivWvlGTZ+djlOouzfQXRXpgUZFiTE1UKuo0dLucFA0MXezmG/oHSMrFLO4jxRxu4FK8NVp8r+NHV1iwBRyyri67tqI1qksTtVQ7TxL4275322WYFude4TDXGzMwv2BrpHsrqZbgknUJcb5/aP9UxPCc5LhKOf3nwZ5GyibcFsjaqt5/tSUXJdvtL0WDBwVCjAAEjf0GCA3rhnmNWKxsv2/6VpUq0lLVJAYcNqESlAPVbiiNnxHhgpXVK8GajUnNq1dh/aVQA2aKGMiVYx8dSuJHj3k92bpmmqCakZnFmo3U0Kn2OozprrNFOOc/y1AzIuxXXB8OE8SR1xWpy65hmrNxU/GESfNf+vUQExbH2EdJbQ1SgxUzKKVDsEubs2oSHSgZcNcMRmuSLRli3zdj4mw56uYQL438gXfDXTzlGtpuCIRkNQKD7uXM62gS7xlk5Zg7anXv6LabYy6D38ZR3xpG9anB+pXPvxYhDB0Ky8nA4Vke6FhVODWbC8tqSU60ICzphKG2pKxBFXQ4QXaGWePMZdXlrDiqfB4LELEq4v8Hh+4GKAkenzQxRzjMUjiBAGOCgzFt2n6PJclA1oq6tw4/2EgqSXJFMFdpcm70fj0xswQHad0pV5z03OkF+cBMeHTV0Ni39H1PJ+C0oWtCT8ghASx6fm38Tkmw3G0hWmN8zhb5WycH/J/PzJQBspAGSgD/edAfwDJLDjhwSu3gQAAAABJRU5ErkJggg==" },
  at: { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAQAAAD/5HvMAAADFklEQVR42u2a7ZGkIBCG37m6BEiBFEjBC8ELYVIwBTeE2RC8EDAEDEFD0BD6fmyNgwoNKOvuVsn+mVpGfOhu6K+5Eb7X+IUL6AK6gH4GkIDIs9DvA88WUFCQkDPMhAEDOnRod69Ke/5K0jQSN0bSVO5ZO/UBSXUAZYlVk/w8IEGPBBgbSnwGULkD5jn6ePXdKO4MPVBu/juhRYcOA6b5exIKCoXjzP3D31xGLcls1NBQwT5TULORqImxpzCOWi0cbxNicwB6UkeB1jg68dRI0qvtqCNAcoEz0n3XrXVfrNLzW+JFbtLEzci5X9jSTqAmfl8RqrORmj1AZUacLVKZCiQsvY8HlOU7IL3vpPoerq3d3LPgfJj3a9QpQLZ8dGDXFWnqaaSRetJUzdL8uE7Xl6G25C7igWrrMcnAGKfn0qQI85zxXiR1PNAYEiyBHqw7tWd9z42xQGVIrKsbKjT85uA4a66Y+j5/amc/vhwN1O4QdbLC2zLO2792UEQoy1BFigQJUlQt7hq3hEAFpzSkfZ1AauHdqs18tQk7krYMx4L8BW8snMITC40BoJdTqsI29LKOzqFhZc2/eZKdFm8BO+ocb/PakGEtqIrz2Qtb4szChCUk50+DMzl8xcjceGdnB8fbvKm0sA4oGFw+N20DR39Xbj858w9OflGvXMyKH139EOzeZCCTywY0sYsODvMGa/yHgQZWBq3D44H1hxmBFAskUXlXrQIKTUqlQ65DJ7sO6Qj4vf7yDOdapdz3x8OPPhh+rMNgNozlE0RfQqeT60PKk8WqXCFsGEmvvqOppnoV+jZnBvkg4VQg8cnisTRIM2mQq5gTUZj5vETRV30LVNPOSKXXZ693XATBoqeAmW/bCX+c4WzKUFAQACZ0gbVOK8dkqFM3X4HET+cq6SG+lp9S9TpW9DRxUGeWhZs8vQ61OrQjPSIVIFfNGpOr+ZKrtVDna74ATVTzRUKc0Xx53kv9Ge2ptKNbf6cG3h6oRJg9QE/1NcEmcLOvCXw78HOdZ5tczG54wHS0TX67fj90AV1AF9AXj/9FBjHG8TXIfAAAAABJRU5ErkJggg==" },
  "x-logo": { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAQAAAD/5HvMAAACwElEQVR42u1a0XGDMAwVvS7ACqyQjOAVWIGOQEdIR6AjkBHICO4IyQjJCO5XeraxZEk2vV4P81OI4z7I0/OTROPgb40X2AHtgP4ZoNefvwzzG1/wUP+3Fg6raze4BefueUyONxYHyqN1drXa1bXhLP/EMiGdlICW1Up318Wz/JPO3VmA7s4o4Ey8dcLTnvmMEneWOU6JNfrUzPx9pIcVwRkSK4zpuc1qL7NBJFzg7MVh733yAe/M2DIwQxtd+4Q3ZHYiFq7Bgz2gtO9ZT+eQYCYRqamLJljCD8yQ9hwmhbfH+Lk5FFxQ2tsaysMBFGvGiNJ+KlceHqCYSUbBpEmjYFwyypnEVh4uIHBjAZMEysMHBG5G9zCaSSYR6hNPRGVB27OYJFQeCaB4cZ8vGJPEyiMDFLPBZpikUB4pIIovYSTNOuWRA6L4skRPqdg78abhypNijFB5NIAo5TGEzxzlzlJrQWdSk0XKowUUM2kgN1F1diJLYzDrtmaS1SZLsum4dYuZ1P0OIMq6jSjHNgVEWbelNMJ0gHDrRqUHGwKirBv+yaaAKOs2loa+tpKBW7e5jEn60sod2XALmaQFNBAmo4hJOjipDdXWYVJ5lKU3UzWTSnXIMZlktgLUkoW/CkyqUSfEmDRomFSiPs8f44Ruq7O8WFpWJ3zatAW1bmIm1akT4mIYJ5ptLUC5bB23bkIm6ZVnYVu3ScIkrfJYkXULpcKUAeJn67gYCoqllToUWTEcuDmJTnk01o3JJK3yaKwbq1haqUPBqrqxmKRXHk3VjVF2r9ShYFfdsmX3Sh0KQdUtw6TGpVq1y6pZe4OjsPkbtrnO3up+u/kBR6wJXNShyFbd2K3AcuXhVt3wMVGAlB0KgY45WtsqdSgEG0/Gi1fqUKhylCST/Cg7rFq1AJfilzk66CSvcDT7G1Y7oB3QxuMb87PEqP9Y+RwAAAAASUVORK5CYII=" },
  /* 🆕 D-1505 — رموزُ القائمة الجانبيّة: الكرةُ مسارُ `Icon.tsx` الويب (`globe`)، والبقيّةُ مساراتُ تصميمها (بلا نظيرٍ في الويب) —
     خطٌّ ١٫٧ · cairosvg · ٧٢px · أبيض، صورُ بياناتٍ (حجّةُ `pin`: الدفعُ نصٌّ). `history` سهمُ رجوعٍ حول الساعة: «سجلّ المشاهدة» */
  globe: { uri: "data:image/png;base64,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" },
  help: { uri: "data:image/png;base64,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" },
  sun: { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAYAAABV7bNHAAAABmJLR0QA/wD/AP+gvaeTAAAEVUlEQVR4nO2cv28URxTHv2ODZAkoEgPG1yUNdEgpTIgUFIk/IOmIyI8GCYjSQFKE2jV/RfIHQCKaJJhEGChIY3pMl7Mtm6RIsFJAPilmTj7fzf6e2b0j85Fc3OzOe2/ezb19+/atpUQiERHTtQEDgJ6kz9zH74wx/S7tmSiAHrDJHpvOYZ0z07UBjs8lLQx9XnBjnTMpDjpacqx1JsVBE0tyUAHJQQUkBxWQHFRAZQcBB4FlYA24DZwMYMdOybFKACedjWvO5oNNZZZRusx+doDTDWUGTxSB0862YZabyCyreI1xQjnpG/cXwzkAa03kllV+y6M4iJMC2ZflHIBbbRhwKseATp1U4Jwd4NQkGLIJtH6bABxlfxzr9osrcNKlVo2x9lyK4ZzaeZAx5omk85Keew7/XVduA3w6n0s672ztBreThrf2b8BcB3bMOd3DP/XGP6sgFUUXcz6S9Jek740x/1SYuyBpSVJP0qIb3pDUl/TYGLNVQdacpA8lHZF02xjTONnsBOAw8DXwEHiVETtwxx4CXwGHu7Y7OtjblC/JvtrksQl8ARzoeh1RAOaBlRqOGWUVON71eoKCTS6fBXDOgHVaSvqiP/bBBvDHkt7KOW3LnbPhPi9KOiMpb6c8k7RkjPGlGdMBNub8mrMTfgLeB8byMWAGOAfczZl/j2mOSdiA7OMF8HEFOReB3QxZV2OuIRrAEfxXqxfAuzXknc1w0gbTmAJg8xwfpXeOR+YnGTKvh7S9FYBHnoX8GEDuzx65qyFsbg3gBP4M+VwA2R945L4iUm40dgVgr8vijYw5f6q4+2JJ45WCLUkP6hg5wqqkbUnHhsZmnM47WZOCrIvx4nkWuUV14Ipnzg/Za64GcMcj/3KMdY1+y6NdFlkUdV/4nBey3+f3kjoH1F5XrAeHeMZCZu0+WT6djRl10LeysaKILXduFhuesUXPWF18u8Wnc0Dtde0L0saYPvCOmgdp37EzwIwx5t8ShmYCzMoG5DI6JQVdVxiABdq9zL9k2kog2ErgKL8EkOu7eb0fwuZWwZZJfVxsIPPTDJnXQtreCti6sy/32AXO1pD3Hv6b1T5wKMYaooOtIfvYrbKT3M7JKndcibmGqAAHsEWtLO5ig+6sZ+6sO1Y0P2rBrI2S67xsOfXtnNO23Tl92YSvJ1tyPZYzZ1225PpHIFO7A9vptZ6zE6rylDCdbZMD8Cb59eWy3Gfacp6yYGPSVWyZtCp94DLTXKQvCzYFuA48IP/R80vsg8JrdHQpn4TmhePaa17oyQbpvvaaF7YryJq85gVe8/aXpkZldZld6MCWCx47Grfe1S6YOcUrkuY9h7t4TuXTOS9ppfWdlLNzBlv7/9vESWoDLjQiNZIXGJBeRShQnl5mKVAc/HUo4Ibn274RQG77r0PFALjpcdDNru2S0huHhSQHFZAcVEByUAHJQQVMioOivPX82hAjUQxF+gdLiUSiS/4DN5oQGbfjVM8AAAAASUVORK5CYII=" },
  moon: { uri: "data:image/png;base64,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" },
  history: { uri: "data:image/png;base64,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" },
} as const;

export type IconName = keyof typeof ICONS;

/**
 * 🆕 علامةُ Google بألوانها — **صورةٌ لا أيقونة**: الأيقوناتُ تُلوَّن بلونٍ واحد (`tintColor`)، والعلامةُ تفقد معناها إن لُوِّنت.
 * تُرسم في صفِّ «طرق تسجيل الدخول» وحدَه (تصميمُ أحمد، ١٩ أكتوبر).
 */
export const GOOGLE_MARK = { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAMAAABiM0N1AAAAYFBMVEU0p1NBhfP6uwXrRTQzp1LpQzVChfTqSDMzqFLqQzU0p1NChfT5tgdBhPX9rQH7uwX0SkpAt0j7NTU5nIyXsiw3kfU/jdAA//9Jq0uAgP88krVorj6IqjP/zAAAAADpQzRCcjRWAAAAIHRSTlP9/vwfYGCO0iGcoWOuHBVlBAUIuMcJ2wHNAszEDwUA/kholfEAAAIySURBVHja3djXeqMwEAbQQRKohACxU7fA+79laIpVRtXrm/0vE75jjUADEszhXGgrJV/2cClbSiMXQ+gfK7J4WbEyaGr5EggPWIAOZolG0iwoxWxpL2koXJRVIE1AVC6ZkZcYRPmSHWdQFtQuRaEhqNBZ+IBDxU5gRPc5N4je5/xA9zoamkL3nct2j5R5DyT+HEpzKUxGO/CdE6J5a1M/94hzQNgDzdFusV/Jg6sfufPthPevSQZ+AvDC2nBPjTS2kURXUV5WaCCE8NzxxKCROFKNs0FkT3+77XMdNJAzd0zQDo0aOsurKmyD+h/oKG+qhAZipnpALkQ4rYVGG+rnWqi3oRG7qEnGh4Y66HkG8iBoroOeHgb1/y/07yZ7qIb6B0Fj9QOZs2izIKeNgECgzo+/aP+azCsAy+saPmS22t+w5iXHebadzm7+n5uTN6Qn96aZryM4I9LOmzfX2wuy19NzRhUPqDFe2Z9wCyucoa0y/REBVhLSV+dXdnzWvIKT+DR1fus/oD/gJTKmj65BKjs+/RgihR6ntw5ZHxoSgAQvj10bdEDn5zEqKZ8Sav07OiD9wa4ApZhpCT0D78iANPQCoSi2R5k/dbWXmbWpEVAUtzBjm1UovTuOsfFjZdIvc4LsrWihdDUmyNkcF0rQdB+B7XqhpL6CBwhFM85iRxpCZTsicciSWZ63fvxjH8HKhxM4iEpSLPtoLEYpUXZYJ5hK9oMsaGsJwlj0am0DsVb+DUKngC68q+OlAAAAAElFTkSuQmCC" } as const;
/** 🆕 D-1112 — أسماءُ الأيقونات في سجلّات النواة (`homePrefs`/`profilePrefs`) أسماءُ الويب؛ ما لا نظيرَ له
    هنا (`grid`) يسقط إلى بديلٍ لا إلى صورةٍ فارغة */
export function iconOr(name: string, fallback: IconName): IconName {
  return name in ICONS ? (name as IconName) : fallback;
}

/**
 * 🆕 D-1276 — **رموزُ الشريط السفليّ تُحمَّل إلى الذاكرة عند الإقلاع** (بلاغُ أحمد بتسجيل، ٤ أكتوبر ٢٠٢٦: «ليش
 * تسير خضخضة ورمشة على الدوك إذا كنت تو داخل التطبيق»).
 *
 * **المقيسُ من التسجيل إطاراً بإطار**: أوّلُ دخولٍ لتبويبٍ في الجلسة تختفي فيه الرموزُ الخمسةُ وتبقى الكلمات — ٩٣ms
 * عند «المجتمع» و٢٣٥ms عند «اكتشف»؛ والرجوعُ إلى تبويبٍ سبق فتحُه بلا اختفاء. **السبب**: كلُّ جذرٍ يرسم شريطَه
 * (`BottomNav`)، فأوّلُ دخولٍ يركّب شريطاً جديداً بخمس صورٍ جديدة، و`expo-image` يحمّل الصورةَ بعد التركيب لا معه —
 * والخيطُ مشغولٌ بتركيب الشاشة نفسِها، فتتأخّر الصورُ بقدر ثقلها. الكلماتُ نصٌّ فتُرسم فوراً.
 *
 * **العلاج**: الوجوهُ العشرةُ تُحمَّل مرّةً (`Image.loadAsync`) وتبقى مراجعُها حيّة؛ و`Icon` يعطي الصورةَ المرجعَ
 * المحمَّل بدل رقم الملفّ، فالشريطُ الجديدُ يرسم من صورةٍ مفكوكةٍ في الذاكرة لا من ملفٍّ يُقرأ. عشرُ صورٍ ٧٢px —
 * لا ثمنَ يُذكر. وما لم يُحمَّل بعد (أو سقط تحميلُه) يُرسم بالطريق القديم حرفاً.
 * ⚠️ **لم يُجرَّب على جهاز قبل الرفع** — الحَكَمُ تسجيلٌ بعده؛ وإن بقي أثرٌ فالعلاجُ الأكبر شريطٌ واحدٌ فوق
 * التبويبات لا يُعاد تركيبُه.
 */
const NAV_ICONS: IconName[] = [
  "home", "home-filled", "library", "library-filled", "compass", "compass-filled",
  "people", "people-filled", "search", "search-filled",
];
/* 🆕 D-1325 — ورموزُ رأس الملفّ معها (بطاقةُ الأرقام وسطرُ العدّادات): كانت تظهر بعد وصول الملفّ بنحو ١٧٠ms في تسجيل
   أحمد ٨ أكتوبر — السببُ نفسُه (صورةٌ تُحمَّل بعد التركيب). سبعُ صورٍ ٧٢px. */
const PROFILE_ICONS: IconName[] = ["tv", "film", "sparkles", "chart", "calendar", "star", "heart"];
const warm = new Map<IconName, ImageRef>();
/* 🔴 بعد مسح ذاكرة الصور لا قبله (`imageCacheGuard.ts`): التحميلُ المسبقُ قبل المسح يقرأ الصورةَ القديمةَ لرقمٍ تغيّر */
void imageCacheReady.then(() => {
  for (const name of Platform.OS === "ios" ? [] : [...NAV_ICONS, ...PROFILE_ICONS]) {
    try {
      void Image.loadAsync(ICONS[name] as number)
        .then((ref) => {
          warm.set(name, ref);
        })
        .catch(() => {});
    } catch {
      /* وحدةٌ أصليّةٌ غائبة (اختبار، ويب): الطريقُ القديم */
    }
  }
});

/**
 * 🔴 D-1333 — **في iOS الأيقونةُ من ملفّها، وتُركَّب من جديد إذا تغيّر لونها** (أوّلُ نسخة iOS، تسجيلُ أحمد ٨ أكتوبر:
 * «الدوك فيه خلل فالاضاءه» — الكلمةُ تتلوّن صحيحاً والأيقونةُ تبقى بلونها السابق أو بيضاء، والأبيضُ لونُ الصورة قبل
 * التلوين). `expo-image` في iOS لا يطبّق `tintColor` بثباتٍ على المرجع المحمَّل مسبقاً (D-1276)، ولا يعيده حين يتغيّر
 * اللونُ وحدَه والمصدرُ ثابت. **أندرويد كما هو** — المرجعُ المحمَّل يمنع رمشةَ أوّل دخول (D-1276) ولا عيبَ فيه هناك.
 * ⚠️ مستنتَجٌ من التسجيل والكود لا من جهاز — الحَكَمُ تسجيلٌ بعد التحديث.
 */
const IOS = Platform.OS === "ios";

export function Icon({ name, size = 18, color }: { name: IconName; size?: number; color: string }) {
  if (IOS) {
    return <Image key={`${name}|${color}`} source={ICONS[name]} style={{ width: size, height: size }} tintColor={color} contentFit="contain" />;
  }
  return <Image source={warm.get(name) ?? ICONS[name]} style={{ width: size, height: size }} tintColor={color} contentFit="contain" />;
}
