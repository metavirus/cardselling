// Order-independent full row-content comparison for restore and repeat-import checks.
export async function contentFingerprint(client) {
  const names = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r => r.tablename);
  const result = {};
  for (const name of names) {
    const quoted = '"' + name.replaceAll('"', '""') + '"';
    const data = await client.query(`SELECT count(*)::text AS rows,
      encode(sha256(convert_to(coalesce(string_agg(row_hash, '' ORDER BY row_hash), ''), 'UTF8')), 'hex') AS sha256
      FROM (SELECT encode(sha256(convert_to(row_to_json(record)::text, 'UTF8')), 'hex') AS row_hash FROM public.${quoted} record) hashes`);
    result[name] = data.rows[0];
  }
  return result;
}
