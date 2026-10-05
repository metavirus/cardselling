import { connection } from "next/server";
import { getReviewData } from "@/lib/review-data";
import CollectionWorkspace from "./collection-workspace";

export default async function Home() {
  await connection();
  try { return <CollectionWorkspace data={await getReviewData()} />; }
  catch { return <main className="unavailable"><span className="eyebrow">CARD SELLING</span><h1>Collection unavailable</h1><p>The local inventory could not be loaded. Saved data has not changed.</p><a href="/">Try again</a></main>; }
}
