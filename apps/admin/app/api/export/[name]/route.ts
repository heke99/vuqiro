import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "../../../../lib/supabaseServer";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

/** Fixed allowlist — this is not an open proxy. */
const EXPORTS: Record<string, string> = {
  "ads-reporting": "/admin/ads/reporting?format=csv",
  "platform-revenue": "/admin/revenue/platform-ledger?format=csv",
  "creator-revenue": "/admin/revenue/creator-ledger?format=csv"
};

/**
 * Streams a CSV export from the API using the admin's session token.
 * Authorization is enforced by the API (RBAC per endpoint); this handler
 * only attaches credentials the browser cannot send itself.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const target = EXPORTS[name];
  if (!target) {
    return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }

  const headers: Record<string, string> = {};
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    headers.authorization = `Bearer ${session.access_token}`;
  } else {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not configured" }, { status: 503 });
    }
    headers.authorization = "Bearer mock-admin";
    headers["x-mock-admin"] = "1";
  }

  const response = await fetch(`${apiBaseUrl}${target}`, { headers, cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json({ error: `Export failed (${response.status})` }, { status: response.status });
  }
  const body = await response.text();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": response.headers.get("content-disposition") ?? `attachment; filename="${name}.csv"`
    }
  });
}
