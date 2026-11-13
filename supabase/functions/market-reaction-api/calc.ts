export const SYMBOLS:Record<string,{provider:string,pip:number|null,unit:string}>={
 XAUUSD:{provider:"XAU/USD",pip:null,unit:"USD per oz"},
 EURUSD:{provider:"EUR/USD",pip:0.0001,unit:"USD"},
 GBPUSD:{provider:"GBP/USD",pip:0.0001,unit:"USD"},
 USDJPY:{provider:"USD/JPY",pip:0.01,unit:"JPY"},
 BTCUSD:{provider:"BTC/USD",pip:null,unit:"USD"}
};
export const HORIZONS=[5,15,30,60] as const;
export const DOCS_URL="https://twelvedata.com/docs";
export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rounded=(v:number,places:number)=>Number(v.toFixed(places));
const isoMinute=(ms:number)=>new Date(Math.floor(ms/60000)*60000).toISOString();
export type PriceCandle={bar_open:string,open_price:number,high_price:number,low_price:number,close_price:number};
const safeNumber=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:null};
export function parsePrices(payload:any,from:number,to:number):PriceCandle[]{
 if(!payload||!Array.isArray(payload.values))throw new Error("No 1-minute candles returned by provider");
 const timezone=String(payload.meta?.timezone||"UTC");
 if(!["UTC","Etc/UTC","GMT"].includes(timezone))throw new Error("Provider did not confirm UTC timestamps");
 if(payload.meta?.interval&&payload.meta.interval!=="1min")throw new Error("Provider returned the wrong interval");
 const candles:PriceCandle[]=[],seen=new Set<number>();
 for(const row of payload.values.slice(0,120)){
  const raw=String(row.datetime||"");
  // The provider's requested timezone is UTC; parse a timezone-naive timestamp as UTC.
  if(!/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d)?$/.test(raw))continue;
  const ts=Date.parse(raw.replace(" ","T")+"Z");
  if(!Number.isFinite(ts)||ts%60000!==0||ts<from||ts>to||seen.has(ts))continue;
  const open=safeNumber(row.open),high=safeNumber(row.high),
   low=safeNumber(row.low),close=safeNumber(row.close);
  if(open===null||high===null||low===null||close===null)continue;
  if(high<Math.max(open,low,close)||low>Math.min(open,high,close))continue;
  seen.add(ts);candles.push({
   bar_open:new Date(ts).toISOString(),open_price:open,high_price:high,
   low_price:low,close_price:close
  });
 }
 return candles.sort((a,b)=>Date.parse(a.bar_open)-Date.parse(b.bar_open));
}
export function calculate(eventTime:number,symbol:string,items:PriceCandle[]){
 if(eventTime%60000!==0)throw new Error("Event does not have minute-precision UTC time");
 const byTime=new Map(items.map(x=>[Date.parse(x.bar_open),x]));
 // Baseline: last FULLY CLOSED one-minute candle before event.
 const baselineAt=eventTime-60000,baseline=byTime.get(baselineAt);
 const rows:Record<string,unknown>[]=[];
 const missing:number[]=[];
 for(const horizon of HORIZONS){
  // At +H minutes, use the one-minute candle that closes exactly at T+H.
  const targetAt=eventTime+(horizon-1)*60000,target=byTime.get(targetAt);
  if(!baseline||!target){missing.push(horizon);continue}
  const delta=target.close_price-baseline.close_price;
  const pips=SYMBOLS[symbol].pip===null?null:rounded(delta/SYMBOLS[symbol].pip!,4);
  rows.push({
   symbol,provider:"twelve_data",horizon_minutes:horizon,
   baseline_bar_open:isoMinute(baselineAt),target_bar_open:isoMinute(targetAt),
   baseline_close:baseline.close_price,target_close:target.close_price,
   move_absolute:rounded(delta,10),move_percent:rounded(delta/baseline.close_price*100,8),
   fx_pips:pips,provider_source_url:DOCS_URL
  });
 }
 return {rows,missing,hasBaseline:!!baseline};
}
