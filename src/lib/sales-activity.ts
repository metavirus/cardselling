// Activity is a lower bound from retained exact-product samples, not market volume.
export type ActivitySale = { capturedAt: string; soldAt: string; cents: number; quantity: number };
export type ActivityCapture = { capturedAt: string; records: number; limit: number };
export function sampledSalesActivity(sales: ActivitySale[], captures: ActivityCapture[], asOf: string, days = 90) {
  const end = Date.parse(asOf);
  if (!Number.isFinite(end) || !Number.isInteger(days) || days < 1) throw new Error('Invalid activity window');
  // Sale IDs are absent. Preserve identical rows within one capture while taking
  // maximum multiplicity across captures, never summing repeated downloads.
  const perCapture = new Map<string, Map<string, { sale: ActivitySale; count: number }>>();
  for (const sale of sales) {
    if (!Number.isSafeInteger(sale.cents) || sale.cents < 0 || !Number.isSafeInteger(sale.quantity) || sale.quantity < 1 ||
      !Number.isFinite(Date.parse(sale.soldAt)) || !Number.isFinite(Date.parse(sale.capturedAt)) || Date.parse(sale.soldAt) > Date.parse(sale.capturedAt)) throw new Error('Invalid activity sale');
    if (Date.parse(sale.capturedAt) > end) continue;
    const rows = perCapture.get(sale.capturedAt) ?? new Map();
    const key = JSON.stringify([new Date(sale.soldAt).toISOString(), sale.cents, sale.quantity]);
    const old = rows.get(key);
    rows.set(key, { sale, count: (old?.count ?? 0) + 1 });
    perCapture.set(sale.capturedAt, rows);
  }
  const retained = new Map<string, { sale: ActivitySale; count: number }>();
  for (const rows of perCapture.values()) for (const [key, row] of rows) {
    if (row.count > (retained.get(key)?.count ?? 0)) retained.set(key, row);
  }
  const start = end - days * 86400000;
  const bins = Array.from({ length: Math.ceil(days / 7) }, (_, i) => ({
    start: new Date(start + i * 7 * 86400000).toISOString(),
    end: new Date(Math.min(end, start + (i + 1) * 7 * 86400000)).toISOString(),
    observedRecords: 0, observedUnits: 0,
  }));
  let latestSale: string | null = null;
  for (const { sale, count } of retained.values()) {
    const time = Date.parse(sale.soldAt);
    if (time < start || time > end) continue;
    const bin = bins[Math.min(bins.length - 1, Math.floor((time - start) / (7 * 86400000)))];
    bin.observedRecords += count;
    bin.observedUnits += sale.quantity * count;
    if (latestSale == null || time > Date.parse(latestSale)) latestSale = new Date(time).toISOString();
  }
  const eligibleCaptures = captures.filter(c => Date.parse(c.capturedAt) <= end).sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
  const latestCapture = eligibleCaptures.at(-1);
  return {
    bins, observedRecords: bins.reduce((s, b) => s + b.observedRecords, 0),
    observedUnits: bins.reduce((s, b) => s + b.observedUnits, 0), latestSale,
    lastChecked: latestCapture?.capturedAt ?? null,
    capped: eligibleCaptures.some(c => c.records >= c.limit),
    completeness: 'sample_lower_bound' as const,
    // Sparse/capped observations cannot support a measured acceleration claim.
    trend: 'unmeasured' as const,
  };
}
