import 'server-only';
import {sql} from 'drizzle-orm';
import {database} from '@/db/client';
import {shippingModelVersion} from './selling-economics';
import {importedSettings,validateWorkspaceRequest,type WorkspaceState,type WorkspaceDraft} from './workspace-contract';
type Executor=Pick<ReturnType<typeof database>,'execute'>;
async function state(db:Executor):Promise<WorkspaceState>{
 const head=(await db.execute(sql`SELECT * FROM canonical_workspace_state WHERE singleton`)).rows[0];
 const rows=(await db.execute(sql`SELECT c.lot_id,c.choice,c.reason FROM canonical_owner_choices c WHERE NOT EXISTS(SELECT 1 FROM canonical_owner_choices n WHERE n.supersedes_id=c.id) ORDER BY c.recorded_at,c.id`)).rows;
 const drafts:Record<string,WorkspaceDraft>={};for(const r of rows)drafts[String(r.lot_id)]={plan:r.choice as WorkspaceDraft['plan'],note:String(r.reason)};
 return {revision:Number(head.revision),drafts,settings:importedSettings(head.settings as never,head.shipping_model_version as string),preferences:head.preferences as Record<string,unknown>,shippingModelVersion};
}
export async function getWorkspaceState(){return state(database());}
export async function writeWorkspaceState(input:unknown){
 const request=validateWorkspaceRequest(input);
 return database().transaction(async tx=>{
  await tx.execute(sql`SELECT singleton FROM canonical_workspace_state WHERE singleton FOR UPDATE`);
  const prior=(await tx.execute(sql`SELECT payload,result FROM canonical_workspace_requests WHERE request_id=${request.requestId}::uuid`)).rows[0];
  if(prior){if(JSON.stringify(prior.payload)!==JSON.stringify(JSON.parse(JSON.stringify(input)))){ // jsonb key ordering is not stable; compare in SQL below.
   const match=(await tx.execute(sql`SELECT payload=${JSON.stringify(input)}::jsonb AS matches FROM canonical_workspace_requests WHERE request_id=${request.requestId}::uuid`)).rows[0];if(!match.matches)throw Error('Request identity reused for different changes');}
   return prior.result as WorkspaceState&{imported?:boolean;conflicts?:string[]};}
  const current=await state(tx);
  if(request.kind==='patch'&&request.baseRevision!==current.revision){
   const conflict={conflict:true,state:current};
   await tx.execute(sql`INSERT INTO canonical_workspace_requests(request_id,kind,payload,result) VALUES(${request.requestId}::uuid,${request.kind},${JSON.stringify(input)}::jsonb,${JSON.stringify(conflict)}::jsonb)`);
   return conflict;
  }
  const conflicts:string[]=[];
  for(const [lotId,draft] of Object.entries(request.drafts)){
   const lot=(await tx.execute(sql`SELECT id FROM canonical_lots WHERE id=${lotId}::uuid`)).rows[0];if(!lot)throw Error('Unknown inventory lot');
   const existing=current.drafts[lotId];
   if(request.kind==='import'&&existing){if(existing.plan!==draft.plan||existing.note!==draft.note)conflicts.push(lotId);continue;}
   if(existing?.plan===draft.plan&&existing?.note===draft.note)continue;
   const last=(await tx.execute(sql`SELECT c.id FROM canonical_owner_choices c WHERE c.lot_id=${lotId}::uuid AND NOT EXISTS(SELECT 1 FROM canonical_owner_choices n WHERE n.supersedes_id=c.id) ORDER BY c.recorded_at DESC,c.id DESC LIMIT 1`)).rows[0];
   await tx.execute(sql`INSERT INTO canonical_owner_choices(lot_id,choice,reason,supersedes_id) VALUES(${lotId}::uuid,${draft.plan},${draft.note},${last?.id??null}::uuid)`);
  }
  const head=(await tx.execute(sql`SELECT settings FROM canonical_workspace_state WHERE singleton`)).rows[0];
  const settings=request.kind==='import'?(head.settings?current.settings:importedSettings(request.settings,request.shippingModelVersion)):{...current.settings,...request.settings};
  if(request.kind==='import'&&head.settings&&Object.keys(request.settings).length)conflicts.push('settings');
  const preferences=request.kind==='import'?{...request.preferences,...current.preferences}:{...current.preferences,...request.preferences};
  await tx.execute(sql`UPDATE canonical_workspace_state SET revision=revision+1,settings=${JSON.stringify(settings)}::jsonb,preferences=${JSON.stringify(preferences)}::jsonb,shipping_model_version=${shippingModelVersion},updated_at=now() WHERE singleton`);
  const result={...await state(tx),...(request.kind==='import'?{imported:true,conflicts}:{})};
  await tx.execute(sql`INSERT INTO canonical_workspace_requests(request_id,kind,payload,result) VALUES(${request.requestId}::uuid,${request.kind},${JSON.stringify(input)}::jsonb,${JSON.stringify(result)}::jsonb)`);
  return result;
 });
}
