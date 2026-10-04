import { sql } from "drizzle-orm";
import { database } from "@/db/client";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const result = await database().execute(sql`select application from application_info`);
    if (result.rows.length !== 1 || result.rows[0].application !== "cardselling") throw new Error("Wrong application identity");
    return Response.json({ application: "cardselling", database: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ application: "cardselling", database: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
