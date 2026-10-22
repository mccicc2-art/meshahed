import { NextResponse } from "next/server";
import { CONFIGURE_PAGE } from "../addon";

/** `GET /api/v1/stremio/configure` — زرُّ «Configure» في البيان العامّ ⇢ صفحةُ الربط */
export function GET() {
  return NextResponse.redirect(CONFIGURE_PAGE, 302);
}
