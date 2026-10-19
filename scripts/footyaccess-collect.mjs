import { chromium } from 'playwright';
import fs from 'node:fs';
const out='footyaccess-output';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const result={generated:new Date().toISOString(),status:'read-only API verification',ages:{},warnings:[]};
try{
 const page=await browser.newPage();
 await page.goto('https://www.footyaccess.com/leagues/mls-next?ageGroups=U13',{waitUntil:'domcontentloaded',timeout:60000});
 for(const age of ['U13','U14']){
  const url='https://footy-access-dev.onrender.com/api/mls-next/stats/dashboard?season=2027&ageGroup='+age+'&metric=goals&page=1&q=';
  try{
   const response=await page.request.get(url,{timeout:60000});
   const raw=await response.text();
   fs.writeFileSync(out+'/'+age.toLowerCase()+'-api-page1.json',raw);
   const parsed=JSON.parse(raw);
   const keys=Object.keys(parsed);
   const preview=JSON.stringify(parsed).slice(0,1500);
   result.ages[age]={status:response.status(),url,topLevelKeys:keys,preview,bytes:raw.length};
   if(!response.ok())result.warnings.push(age+': API returned '+response.status());
   console.log(age+' API '+response.status()+' keys='+keys.join(',')+' bytes='+raw.length);
  }catch(e){result.ages[age]={error:String(e)};result.warnings.push(age+': '+String(e));}
 }
}finally{await browser.close();fs.writeFileSync(out+'/comparison.json',JSON.stringify(result,null,2));}
console.log('Read-only API shape verification complete; no publishing');
