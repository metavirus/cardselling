import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import pg from 'pg';
import dotenv from 'dotenv';
import {drizzle} from 'drizzle-orm/node-postgres';
test('isolated SQL workspace preserves superseded choices, conflicts and retry identity',{skip:process.env.WORKSPACE_DB_TEST!=='1'},async()=>{
 const schema=`workspace_test_${randomUUID().replaceAll('-','')}`;
 const url=dotenv.parse(readFileSync(new URL('../.env.local',import.meta.url))).DATABASE_URL;
 const admin=new pg.Client({connectionString:url});await admin.connect();
 let pool;
 try{
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.query(`CREATE TABLE ${schema}.canonical_lots(id uuid PRIMARY KEY); CREATE TABLE ${schema}.canonical_owner_choices(LIKE public.canonical_owner_choices INCLUDING ALL); CREATE TABLE ${schema}.canonical_workspace_state(LIKE public.canonical_workspace_state INCLUDING ALL); CREATE TABLE ${schema}.canonical_workspace_requests(LIKE public.canonical_workspace_requests INCLUDING ALL); INSERT INTO ${schema}.canonical_workspace_state(singleton) VALUES(true)`);
  pool=new pg.Pool({connectionString:url,options:`-c search_path=${schema},public`});
  globalThis.workspaceTestDatabase=drizzle(pool);
  registerHooks({resolve(s,c,n){if(s==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};if(s==='@/db/client')return {url:'data:text/javascript,export function database(){return globalThis.workspaceTestDatabase}',shortCircuit:true};if(s==='./selling-economics'||s==='./workspace-contract')return n(s+'.ts',c);return n(s,c);}});
  const {writeWorkspaceState,getWorkspaceState}=await import('../src/lib/workspace-store.ts');
  const lot=randomUUID();await pool.query('INSERT INTO canonical_lots VALUES($1)',[lot]);
  const imported={kind:'import',requestId:randomUUID(),drafts:{[lot]:{plan:'buylist',note:'Original'}},settings:{postage:111}};
  const first=await writeWorkspaceState(imported);assert.equal(first.drafts[lot].plan,'buylist');assert.equal(first.settings.postage,111);
  assert.deepEqual(await writeWorkspaceState(imported),JSON.parse(JSON.stringify(first)));
  const second=await writeWorkspaceState({kind:'patch',requestId:randomUUID(),baseRevision:first.revision,drafts:{[lot]:{plan:'hold',note:'Wait'}}});
  assert.equal(second.drafts[lot].plan,'hold');assert.equal((await pool.query('SELECT count(*)::int AS n FROM canonical_owner_choices')).rows[0].n,2);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM canonical_owner_choices WHERE supersedes_id IS NOT NULL')).rows[0].n,1);
  const oldImport=await writeWorkspaceState({...imported,requestId:randomUUID()});assert.ok(oldImport.conflicts.includes(lot));assert.equal(oldImport.drafts[lot].plan,'hold');assert.equal(oldImport.settings.postage,111);
  const stale={kind:'patch',requestId:randomUUID(),baseRevision:0,drafts:{[lot]:{plan:'self',note:'Stale'}}};
  const conflict=await writeWorkspaceState(stale);assert.equal(conflict.conflict,true);assert.equal((await getWorkspaceState()).drafts[lot].plan,'hold');assert.equal((await pool.query('SELECT payload->\'drafts\'->$1->>\'note\' AS note FROM canonical_workspace_requests WHERE request_id=$2',[lot,stale.requestId])).rows[0].note,'Stale');
  assert.deepEqual(await writeWorkspaceState(stale),JSON.parse(JSON.stringify(conflict)));
  await assert.rejects(writeWorkspaceState({...stale,drafts:{[lot]:{plan:'event',note:''}}}),/identity reused/);
 }finally{if(pool)await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();delete globalThis.workspaceTestDatabase;}
});
