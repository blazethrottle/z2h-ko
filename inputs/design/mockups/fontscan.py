import asyncio,pathlib,json
from playwright.async_api import async_playwright
SRC=pathlib.Path(__file__).parent/'src'
async def main():
  out={}
  async with async_playwright() as p:
    b=await p.chromium.launch()
    for w in (390,1280):
      pg=await b.new_page(viewport={'width':w,'height':900})
      for f in sorted(SRC.glob('s*.html')):
        await pg.goto(f.as_uri()); await pg.evaluate('document.fonts.ready')
        cdp=await pg.context.new_cdp_session(pg); await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
        doc=await cdp.send('DOM.getDocument',{'depth':-1})
        ids=(await cdp.send('DOM.querySelectorAll',{'nodeId':doc['root']['nodeId'],'selector':'body *'}))['nodeIds']
        fams={}
        for i in ids:
          try:
            for x in (await cdp.send('CSS.getPlatformFontsForNode',{'nodeId':i}))['fonts']:
              fams[x['familyName']]=fams.get(x['familyName'],0)+x['glyphCount']
          except Exception: pass
        out[f'{f.stem}@{w}']=fams
    await b.close()
  others={k:{f:c for f,c in v.items() if not f.startswith(('Pretendard','JetBrains'))} for k,v in out.items()}
  print(json.dumps(others,ensure_ascii=False))
  json.dump(out,open('font_scan.json','w'),ensure_ascii=False,indent=1)
asyncio.run(main())
