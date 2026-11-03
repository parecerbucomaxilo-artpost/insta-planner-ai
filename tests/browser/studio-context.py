import asyncio
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  for width,height in [(1280,1800),(390,844)]:
   page=await browser.new_page(viewport={'width':width,'height':height})
   errors=[]
   page.on('pageerror', lambda e: errors.append(str(e)))
   await page.goto('http://localhost:8080',wait_until='networkidle')
   await page.evaluate('''async () => {
    const React=await import('/node_modules/.vite/deps/react.js');
    const DOM=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {RouterContextProvider}=await import('/@fs/persist/node_modules/@tanstack/react-router/dist/esm/index.dev.js');
    const {getRouter}=await import('/src/router.tsx');
    const {supabase}=await import('/src/integrations/supabase/client.ts');
    supabase.auth.getUser=async()=>({data:{user:{id:'context-fixture-user'}},error:null});
    supabase.auth.onAuthStateChange=()=>({data:{subscription:{unsubscribe(){}}}});
    supabase.from=()=>({select:()=>({eq:async()=>({data:[],error:null})})});
    const {EstudioGratuito}=await import('/src/components/free-studio/EstudioGratuito.tsx');
    const host=document.createElement('main');host.style.maxWidth='1100px';host.style.margin='20px auto';document.body.replaceChildren(host);
    DOM.default.createRoot(host).render(React.default.createElement(RouterContextProvider,{router:getRouter()},React.default.createElement(EstudioGratuito)));
   }''')
   await page.get_by_role('radio',name='Gratuito — sem créditos de IA').click()
   await page.get_by_label('Objetivo',exact=True).select_option('Orientar')
   await page.get_by_role('textbox',name='Tema',exact=True).fill('Biópsia bucal')
   await page.get_by_role('button',name='Usar este tema').click()
   await page.get_by_role('textbox',name='Texto da legenda').fill('Minha edição preservada')
   await page.get_by_role('tab',name='Imagem',exact=True).click()
   await page.get_by_role('textbox',name='Texto sobre a imagem').fill('Título manual')
   await page.get_by_role('tab',name='Texto',exact=True).click()
   assert await page.get_by_role('textbox',name='Texto da legenda').input_value()=='Minha edição preservada'
   await page.get_by_role('textbox',name='Tema',exact=True).fill('Dentes inclusos')
   await page.get_by_role('button',name='Usar este tema').click()
   await page.get_by_label('Objetivo',exact=True).select_option('Prevenir')
   assert await page.get_by_role('textbox',name='Texto da legenda').input_value()=='Minha edição preservada'
   await page.get_by_role('radio',name='Planner Liga',exact=True).click()
   assert await page.get_by_label('Objetivo',exact=True).input_value()==''
   await page.get_by_role('radio',name='Planner Chico',exact=True).click()
   assert await page.get_by_label('Objetivo',exact=True).input_value()=='Prevenir'
   assert await page.get_by_role('textbox',name='Texto da legenda').input_value()=='Minha edição preservada'
   await page.get_by_role('tab',name='Imagem',exact=True).click()
   assert await page.get_by_role('textbox',name='Texto sobre a imagem').input_value()=='Título manual'
   await page.get_by_label('Resumo do material').screenshot(path=f'/tmp/browser/studio-context/summary-{width}.png')
   await page.get_by_role('button',name='Novo material',exact=True).click()
   assert await page.get_by_label('Objetivo',exact=True).input_value()==''
   assert await page.get_by_role('textbox',name='Tema',exact=True).input_value()==''
   assert await page.get_by_role('textbox',name='Texto da legenda').input_value()==''
   print(width,'PASS: tema/objetivo únicos, abas, edição manual, troca de perfil, novo material; errors:',errors)
   await page.close()
  await browser.close()
asyncio.run(main())
