import {getWorkspaceState,writeWorkspaceState} from '@/lib/workspace-store';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json(await getWorkspaceState(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Database workspace unavailable'},{status:503});}}
export async function POST(request:Request){
 try{
  if(Number(request.headers.get('content-length')??0)>1000000)return Response.json({error:'Request too large'},{status:413});
  const text=await request.text();if(text.length>1000000)return Response.json({error:'Request too large'},{status:413});
  const result=await writeWorkspaceState(JSON.parse(text));
  if('conflict' in result)return Response.json({error:'Workspace changed in another tab. Changes retained in database for reconciliation.',state:result.state},{status:409});
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof Error&&/Invalid|Unknown|identity reused/.test(error.message)?error.message:'Workspace save failed'},{status:400});}
}
