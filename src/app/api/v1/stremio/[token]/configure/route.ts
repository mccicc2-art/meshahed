import { NextResponse } from "next/server";
import { CONFIGURE_PAGE } from "../../addon";

/** `GET /api/v1/stremio/{token}/configure` — «Configure» في الإضافة المثبّتة ⇢ صفحةُ الربط (رابطٌ جديد أو إلغاء). الرمزُ لا يُنقل */
export function GET() {
  return NextResponse.redirect(CONFIGURE_PAGE, 302);
}
