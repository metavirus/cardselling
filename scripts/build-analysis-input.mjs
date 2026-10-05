import {registerHooks} from 'node:module';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config({path:'.env.local',quiet:true});
const root=process.cwd();
registerHooks({resolve(spec,ctx,next){
 if(spec==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
 if(spec.startsWith('@/'))spec=pathToFileURL(path.join(root,'src',spec.slice(2))).href;
 if(spec.startsWith('file:')||spec.startsWith('.')){
  const url=new URL(spec,ctx.parentURL??pathToFileURL(root+'/').href);
  if(!path.extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',ctx);
 }
 return next(spec,ctx);
}});
const {getReviewData}=await import('../src/lib/review-data.ts');
const {analyzeCollection,analysisDefaults}=await import('../src/lib/card-insights.ts');
const data=await getReviewData();
const analyses=analyzeCollection(data.cards,analysisDefaults,data.asOf);
mkdirSync('.local/analysis',{recursive:true});
writeFileSync('.local/analysis/full-input.json',JSON.stringify(data));
const compact=data.cards.map(c=>({lotId:c.lotId,name:c.name,set:c.setCode,number:c.collectorNumber,finish:c.finish,grade:c.grade,quantity:c.quantity,ck:c.ckCents,wanted:c.ckCapacity,scg:c.scgCents,ask:c.askCents,traits:c.semantic.traits,analysis:analyses.get(c.lotId)}));
writeFileSync('.local/analysis/detected.json',JSON.stringify({asOf:data.asOf,cards:compact},null,2));
for(let i=0;i<3;i++)writeFileSync('.local/analysis/review-'+i+'.json',JSON.stringify(compact.slice(i*Math.ceil(compact.length/3),(i+1)*Math.ceil(compact.length/3))));
console.log(JSON.stringify({lots:compact.length,counts:Object.fromEntries(['dealer','patient','specialist','review','compare'].map(k=>[k,compact.filter(c=>c.analysis.category===k).length]))}));
process.exit(0);
