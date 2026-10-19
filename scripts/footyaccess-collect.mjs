import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const out=path.resolve('footyaccess-output');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const clubs=['AB7 Future Academy','Cedar Stars Academy Bergen','Cedar Stars Academy Monmouth','Cedar Stars Academy Newark','Ironbound Soccer Club','Jersey Football Club','PDA Hibernian','PDA SC Vistula','Players Development Academy','Real Futbol Academy','TSF Academy','The Football Academy','Torpedoes SC','Trenton City Soccer Club','Union County Football Club'];
const report={generated:new Date().toISOString(),ages:{},status:'diagnostic-only',warnings:[]};
try{
for(const age of ['U13','U14']){
const page=await browser.newPage({viewport:{width:1440,height:900}});
const requests=[];page.on('response',r=>{const u=r.url();if(/api|graphql|stats|leader|player/i.test(u))requests.push({status:r.status(),url:u.slice(0,500)});});
const url='https://www.footyaccess.com/leagues/mls-next?ageGroups='+age;
try{
await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(5000);
const stats=page.getByRole('tab',{name:/stats/i}).first();const statsText=page.getByText(/^Stats$/i).first();
if(await stats.count())await stats.click({timeout:10000}).catch(()=>{});else if(await statsText.count())await statsText.click({timeout:10000}).catch(()=>{});
await page.waitForTimeout(6000);
const html=await page.content();fs.writeFileSync(path.join(out,age.toLowerCase()+'-stats.html'),html);
await page.screenshot({path:path.join(out,age.toLowerCase()+'-stats.png'),fullPage:true});
const tables=await page.locator('table').evaluateAll(nodes=>nodes.map(t=>({headers:[...t.querySelectorAll('th')].map(x=>x.innerText.trim()),rows:[...t.querySelectorAll('tr')].slice(0,10).map(x=>x.innerText.trim())})));
const text=(await page.locator('body').innerText()).slice(0,12000);
const matched=clubs.filter(c=>text.toLowerCase().includes(c.toLowerCase()));
report.ages[age]={url,finalUrl:page.url(),title:await page.title(),tables,matchedClubs:matched,network:requests.slice(-100),bodyPreview:text.slice(0,3500)};
if(matched.length<15)report.warnings.push(age+': fewer than 15 clubs visible; no complete export or publication');
}catch(e){report.ages[age]={url,error:String(e)};report.warnings.push(age+': collection failed');}
await page.close();
}
}finally{await browser.close();fs.writeFileSync(path.join(out,'diagnostic.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({status:report.status,warnings:report.warnings,ages:Object.fromEntries(Object.entries(report.ages).map(([a,v])=>[a,{error:v.error,matchedClubs:v.matchedClubs?.length,tables:v.tables?.length}]))},null,2));
