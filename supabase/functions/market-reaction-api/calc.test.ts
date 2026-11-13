import {calculate,parsePrices,HORIZONS,SYMBOLS,uuid} from "./calc.ts";
import {assert,assertEquals,assertThrows} from "jsr:@std/assert@1.0.14";
const T=Date.parse("2026-11-13T13:30:00Z");
const bar=(minute:number,close:number)=>({
 bar_open:new Date(T+minute*60000).toISOString(),
 open_price:close,high_price:close+0.00002,low_price:close-0.00002,close_price:close
});
Deno.test("STRICT: all four horizons use the exact closed M1 candles",()=>{
 const candles=[bar(-1,1.10000),bar(4,1.10100),bar(14,1.09900),bar(29,1.10300),bar(59,1.10050)];
 const out=calculate(T,"EURUSD",candles);
 assertEquals(out.missing,[]);
 assertEquals(out.hasBaseline,true);
 assertEquals(out.rows.map(x=>x.horizon_minutes),[5,15,30,60]);
 assertEquals(out.rows.map(x=>x.fx_pips),[10,-10,30,5]);
 assertEquals(out.rows[0].baseline_bar_open,new Date(T-60000).toISOString());
 assertEquals(out.rows[0].target_bar_open,new Date(T+4*60000).toISOString());
 assertEquals(out.rows[0].move_absolute,0.001);
 assertEquals(out.rows[0].move_percent,0.09090909);
});
Deno.test("CANNOT fill data gaps with estimated or interpolated reactions",()=>{
 const out=calculate(T,"EURUSD",[bar(-1,1.1),bar(4,1.1005),bar(59,1.102)]);
 assertEquals(out.rows.map(x=>x.horizon_minutes),[5,60]);
 assertEquals(out.missing,[15,30]);
 assertEquals(calculate(T,"EURUSD",[bar(4,1.1)]).rows,[]);
 assertEquals(calculate(T,"EURUSD",[bar(4,1.1)]).missing,[5,15,30,60]);
});
Deno.test("XAUUSD is quote-currency movement, NOT a guessed gold pip convention",()=>{
 const gold=[bar(-1,4000),bar(4,4005)];
 const o=calculate(T,"XAUUSD",gold);
 assertEquals(o.rows[0].fx_pips,null);
 assertEquals(o.rows[0].move_absolute,5);
 assertEquals(o.rows[0].move_percent,0.125);
});
Deno.test("JPY pair uses 0.01 pip and strict horizon exactness",()=>{
 const o=calculate(T,"USDJPY",[bar(-1,150),bar(4,150.15)]);
 assertEquals(o.rows[0].fx_pips,15);
 assertEquals(o.missing,[15,30,60]);
});
Deno.test("reject unaligned release timestamps",()=>{
 assertThrows(()=>calculate(T+15000,"EURUSD",[]),Error,"minute-precision");
});
Deno.test("parse provider payload UTC timestamps, dedup and reject invalid candles",()=>{
 const items=[
  {datetime:"2026-11-13 13:29:00",open:"1.1",high:"1.101",low:"1.099",close:"1.100"},
  {datetime:"2026-11-13 13:29:00",open:"1.1",high:"1.101",low:"1.099",close:"1.100"},
  {datetime:"2026-11-13 13:34:00",open:"1.1",high:"1.102",low:"1.098",close:"1.101"},
  {datetime:"2026-11-13 13:36:00",open:"1.1",high:"1.09",low:"1.10",close:"1.101"},
  {datetime:"2026-11-13 13:35:00",open:"0",high:"1",low:"0",close:"1"}
 ];
 const prices=parsePrices({status:"ok",meta:{timezone:"UTC",interval:"1min"},values:items},T-3*60000,T+61*60000);
 assertEquals(prices.length,2);
 assertEquals(prices.map(x=>x.bar_open),[new Date(T-60000).toISOString(),new Date(T+4*60000).toISOString()]);
 assertEquals(calculate(T,"EURUSD",prices).rows.length,1);
});
Deno.test("provider timezone mismatch and wrong interval rejected",()=>{
 assertThrows(()=>parsePrices({values:[],meta:{timezone:"America/New_York"}},T,T),Error,"UTC");
 assertThrows(()=>parsePrices({values:[],meta:{interval:"5min"}},T,T),Error,"interval");
 assertThrows(()=>parsePrices({meta:{}},T,T),Error,"No 1-minute candles");
});
Deno.test("API allows only recognized symbols / UUIDs",()=>{
 assertEquals(Object.keys(SYMBOLS),["XAUUSD","EURUSD","GBPUSD","USDJPY","BTCUSD"]);
 assertEquals(HORIZONS,[5,15,30,60]);
 assert(uuid.test("11111111-1111-4111-8111-111111111111"));
 assert(!uuid.test("../../admin-panel"));
});
