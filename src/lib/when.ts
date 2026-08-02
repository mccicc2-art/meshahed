import type { Dict } from "@/lib/i18n";

/** يحوّل تاريخاً إلى «غداً / بعد ٥ أيام / بعد ٣ أسابيع» بدل التاريخ الخام */
export function whenLabel(date: string, t: Dict): string {
  if (!date) return "";
  const today = new Date().toISOString().slice(0, 10);
  if (date === today) return t.whenToday;
  if (date < today) return t.whenAiring;

  const days = Math.ceil((new Date(date).getTime() - new Date(today).getTime()) / 86400000);
  if (days <= 1) return t.whenTomorrow;
  if (days <= 7) return t.whenInDays(days);
  if (days <= 60) return t.whenInWeeks(Math.round(days / 7));
  return t.whenOn(date);
}
