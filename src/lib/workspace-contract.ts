import {defaultSettings,migrateShippingSettings,type Settings} from './selling-economics';
export const workspacePlans=['undecided','buylist','self','event','hold'] as const;
export type WorkspaceDraft={plan:typeof workspacePlans[number];note:string};
export type WorkspaceState={revision:number;drafts:Record<string,WorkspaceDraft>;settings:Settings;preferences:Record<string,unknown>;shippingModelVersion:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateWorkspaceRequest(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid workspace request');
 const x=input as Record<string,unknown>;
 if(!['patch','import'].includes(String(x.kind))||!uuid.test(String(x.requestId)))throw Error('Invalid request identity');
 if(x.kind==='patch'&&(!Number.isSafeInteger(x.baseRevision)||Number(x.baseRevision)<0))throw Error('Invalid base revision');
 const drafts:Record<string,WorkspaceDraft>={};
 if(x.drafts!==undefined){if(!x.drafts||typeof x.drafts!=='object'||Array.isArray(x.drafts)||Object.keys(x.drafts).length>5000)throw Error('Invalid choices');
 for(const [id,value] of Object.entries(x.drafts)){const d=value as WorkspaceDraft;if(!uuid.test(id)||!d||!workspacePlans.includes(d.plan)||typeof d.note!=='string'||d.note.length>20000)throw Error('Invalid choice');drafts[id]={plan:d.plan,note:d.note};}}
 const settings:Partial<Settings>={};
 if(x.settings!==undefined){if(!x.settings||typeof x.settings!=='object'||Array.isArray(x.settings))throw Error('Invalid settings');
 for(const [k,v] of Object.entries(x.settings)){if(['postage','tracked','materials','trackedMaterials','trackedConsumables','batch'].includes(k)){if(!Number.isSafeInteger(v)||Number(v)<0||Number(v)>100000)throw Error('Invalid cost');}else if(k==='basis'){if(!['ask','median'].includes(String(v)))throw Error('Invalid price basis');}else if(k==='shippingMode'){if(!['auto','tracked'].includes(String(v)))throw Error('Invalid shipping mode');}else throw Error('Unknown setting');Object.assign(settings,{[k]:v});}}
 const preferences=x.preferences??{};if(!preferences||typeof preferences!=='object'||Array.isArray(preferences)||JSON.stringify(preferences).length>200000)throw Error('Invalid preferences');
 const selected=(preferences as Record<string,unknown>).selected;
 if(selected!==undefined&&(!Array.isArray(selected)||selected.length>5000||selected.some(id=>typeof id!=='string'||!uuid.test(id))))throw Error('Invalid selection');
 const enums:Record<string,string[]>={view:['all','suggested',...workspacePlans],sort:['insight','name','value','bid','gap','ckgap'],signal:['all','buylist','sell','discrepancy','patient'],buylistMode:['competitive','beats'],action:['all','ck','quote','list','watch','verify']};
 for(const [k,values] of Object.entries(enums)){const v=(preferences as Record<string,unknown>)[k];if(v!==undefined&&(typeof v!=='string'||!values.includes(v)))throw Error(`Invalid ${k} preference`);}
 const bulkPlan=(preferences as Record<string,unknown>).bulkPlan;if(bulkPlan!==undefined&&!workspacePlans.includes(bulkPlan as WorkspaceDraft['plan']))throw Error('Invalid bulkPlan preference');
 for(const k of ['onlyNew','nearHighOnly']){const v=(preferences as Record<string,unknown>)[k];if(v!==undefined&&typeof v!=='boolean')throw Error(`Invalid ${k} preference`);}
 const search=(preferences as Record<string,unknown>).search;if(search!==undefined&&(typeof search!=='string'||search.length>2000))throw Error('Invalid search preference');
 return {kind:x.kind as 'patch'|'import',requestId:String(x.requestId),baseRevision:Number(x.baseRevision),drafts,settings,preferences:preferences as Record<string,unknown>,shippingModelVersion:typeof x.shippingModelVersion==='string'?x.shippingModelVersion:undefined};
}
export function importedSettings(settings:Partial<Settings>,version?:string){return migrateShippingSettings({...defaultSettings,basis:'ask',...settings},version);}
