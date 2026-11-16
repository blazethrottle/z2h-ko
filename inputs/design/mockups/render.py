import asyncio, json, pathlib
from playwright.async_api import async_playwright
SRC=pathlib.Path(__file__).parent/'src'; PNG=pathlib.Path(__file__).parent/'png'
SCREENS=['s1_home','s2_lecture','s3_segment','s4_practice','s5_quiz','s6_hints','s7_review','s8_basics','s9_states','s10_l08']
CHECK_JS="""async()=>{await document.fonts.ready;
const faces=[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status}));
const vw=document.documentElement.clientWidth, sw=document.documentElement.scrollWidth;
const small=[...document.querySelectorAll('a.btn,button,.chip,[role=button],.tabbar a,.ch,.mod,.lec,.mini a,.opt')].filter(e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&cs.display!=='none'&&cs.visibility!=='hidden'&&(r.height<44||r.width<44)&&!e.closest('.line.blank')}).map(e=>e.className+':'+e.textContent.trim().slice(0,20)+':'+Math.round(e.getBoundingClientRect().height));
const em=document.body.innerText.includes('\\u2014');
return {faces,overflow:sw>vw,vw,sw,small,em,checkUI:document.fonts.check('600 16px "Z2H Pretendard"'),checkCode:document.fonts.check('400 14px "Z2H JetBrains Mono"')}}"""
async def platform_fonts(page, cdp, selector):
    doc=await cdp.send('DOM.getDocument',{'depth':-1})
    q=await cdp.send('DOM.querySelector',{'nodeId':doc['root']['nodeId'],'selector':selector})
    if not q['nodeId']: return None
    r=await cdp.send('CSS.getPlatformFontsForNode',{'nodeId':q['nodeId']})
    return [(f['familyName'],f.get('postScriptName',''),f['glyphCount']) for f in r['fonts']]
async def main():
    report={}
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for w,h,tag in [(390,844,'m390'),(1280,800,'d1280')]:
            ctx=await b.new_context(viewport={'width':w,'height':h},device_scale_factor=2)
            for s in SCREENS:
                pg=await ctx.new_page(); await pg.goto((SRC/f'{s}.html').as_uri()); 
                res=await pg.evaluate(CHECK_JS)
                cdp=await ctx.new_cdp_session(pg); await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
                pf={}
                for sel in ['h1','.big','.code .cd span:nth-child(2), .line .cd span:nth-child(2), pre.out','.result .sym, .badge.ok, .tag','.next b','.chip','.opt span:nth-child(2)','.tabbar a']:
                    try: pf[sel]=await platform_fonts(pg,cdp,sel)
                    except Exception as e: pf[sel]=str(e)
                res['platformFonts']=pf
                hh=await pg.evaluate('document.documentElement.scrollHeight'); await pg.set_viewport_size({'width':w,'height':max(h,hh)}); await pg.screenshot(path=str(PNG/f'{s}_{tag}.png'),full_page=True)
                report[f'{s}_{tag}']=res; await pg.close()
            await ctx.close()
        await b.close()
    (pathlib.Path(__file__).parent/'font_check.json').write_text(json.dumps(report,ensure_ascii=False,indent=1))
    for k,v in report.items():
        bad=[f for f in v['faces'] if f['status']!='loaded']
        print(k,'overflow' if v['overflow'] else 'ok', 'unloaded:',len(bad),'small:',v['small'][:6],'em:',v['em'],v['checkUI'],v['checkCode'])
asyncio.run(main())
