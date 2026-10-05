// Reproducible research/action snapshot; does not change owner choices or stock.
import {registerHooks} from 'node:module';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config({path:'.env.local',quiet:true});
const root=process.cwd();
registerHooks({resolve(spec,ctx,next){
 if(spec==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
 if(spec.startsWith('@/'))spec=pathToFileURL(path.join(root,'src',spec.slice(2))).href;
 if(spec.startsWith('file:')||spec.startsWith('.')){const u=new URL(spec,ctx.parentURL??pathToFileURL(root+'/').href);if(!path.extname(u.pathname)&&existsSync(fileURLToPath(u)+'.ts'))return next(u.href+'.ts',ctx);}
 return next(spec,ctx);
}});
const {getReviewData}=await import('../src/lib/review-data.ts');
const {analyzeCollection}=await import('../src/lib/card-insights.ts');
const {actionFor}=await import('../src/lib/action-queue.ts');
const {defaultSettings,estimate,shippingModelVersion}=await import('../src/lib/selling-economics.ts');
const data=await getReviewData(),insights=analyzeCollection(data.cards,defaultSettings,data.evidenceAsOf);
const rows=data.cards.map(c=>{
 const insight=insights.get(c.lotId),action=actionFor(c,insight,defaultSettings,data.evidenceAsOf);
 const price=c.analystReview?.priceScenario?.grossCents??c.medianCents;
 return {lotId:c.lotId,name:c.name,set:c.setCode,number:c.collectorNumber,finish:c.finish,language:c.printedLanguage,grade:c.grade,quantity:c.quantity,
  ...action,priority:insight.priority,strongBuylist:insight.findings.some(f=>['dealer-dominates','dealer-net-dominates','dealer-history-candidate'].includes(f.id)),
  ckCents:c.ckCents,ckWanted:c.ckCapacity,ckSource:c.ckSource,ckCapturedAt:c.ckSourceDate,
  comparisonGrossCents:price,comparisonNetCents:estimate({...c,medianCents:price},defaultSettings).net,comparisonBasis:c.analystReview?.priceScenario?.basis??'Captured median',
  analystReview:c.analystReview};
}).sort((a,b)=>Math.abs(b.dollars??0)-Math.abs(a.dollars??0)||b.priority-a.priority||a.name.localeCompare(b.name));
const counts=Object.fromEntries(['ck','quote','list','watch','verify'].map(k=>[k,rows.filter(r=>r.kind===k).length]));
const receipt=JSON.parse(readFileSync('.local/analysis/review-receipt.json'));
const snapshot={evidenceAsOf:data.evidenceAsOf,generatedAt:new Date().toISOString(),reviewRunId:receipt.run_id,shippingModelVersion,settings:defaultSettings,
  lots:data.inventoryLots,copies:data.inventoryCopies,currentIndividualReviews:rows.filter(r=>r.analystReview?.current).length,counts,rows};
mkdirSync('../outputs',{recursive:true});
writeFileSync('../outputs/action-queue.json',JSON.stringify(snapshot,null,2));
writeFileSync('.local/analysis/action-checkpoint.json',JSON.stringify(snapshot,null,2));
console.log(JSON.stringify({lots:snapshot.lots,copies:snapshot.copies,currentIndividualReviews:snapshot.currentIndividualReviews,counts,strongBuylist:rows.filter(r=>r.strongBuylist).length,alerts:rows.filter(r=>r.alerts.length).length}));
process.exit(0);
