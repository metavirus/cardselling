import type {ReviewCard} from '@/lib/review-data';

const day=(s:string)=>new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
export function SalesActivityChart({card}:{card:ReviewCard}){
 const activity=card.salesActivity;
 if(!activity?.lastChecked)return null;
 const max=Math.max(1,...activity.bins.map(b=>b.observedUnits));
 return <section aria-label="Mana Pool observed sales activity" style={{padding:'18px 0',borderTop:'1px solid #e2e8e2'}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'baseline',flexWrap:'wrap'}}>
   <h3 style={{margin:0}}>Sales activity</h3>
   <span><strong>{activity.observedUnits}{activity.capped?'+':''}</strong> observed units · 90d · Mana Pool</span>
  </div>
  <div role="img" aria-label={`Weekly captured sales: ${activity.observedUnits} observed units in 90 days. Sample counts are a lower bound.`} style={{display:'flex',gap:5,alignItems:'end',height:85,marginTop:15}}>
   {activity.bins.map(bin=><div key={bin.start} title={`${day(bin.start)}–${day(bin.end)}: ${bin.observedUnits} observed units (${bin.observedRecords} records)`} style={{flex:1,height:'100%',display:'flex',alignItems:'end'}}>
    <div style={{width:'100%',height:`${Math.max(2,bin.observedUnits/max*100)}%`,background:bin.observedUnits?'#d48a24':'#e8ece8',borderRadius:'3px 3px 0 0'}} />
   </div>)}
  </div>
  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#738078',marginTop:6}}><span>{day(activity.bins[0].start)}</span><span>{day(activity.bins.at(-1)!.end)}</span></div>
  <details style={{fontSize:12,color:'#738078',marginTop:8}}><summary>Sample coverage · checked {day(activity.lastChecked)}</summary>
   <p>Weekly bars count captured copies sold in this exact finish, language and grade. Repeated samples are deduplicated. Mana Pool returns up to 20 records per capture; uncaptured sales can make actual volume higher. Empty bars mean no captured records. These samples do not establish acceleration or your time to sell.</p>
  </details>
 </section>;
}
