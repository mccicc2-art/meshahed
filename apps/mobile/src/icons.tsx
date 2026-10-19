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
