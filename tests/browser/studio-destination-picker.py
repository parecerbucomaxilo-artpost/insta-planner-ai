import asyncio
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  for width,height in [(1280,1800),(390,844)]:
   page=await browser.new_page(viewport={'width':width,'height':height})
   errors=[]
   page.on('pageerror',lambda e: errors.append(str(e)))
   await page.goto('http://localhost:8080',wait_until='networkidle')
   await page.evaluate('''async () => {
    const React=await import('/node_modules/.vite/deps/react.js');
    const DOM=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {RouterContextProvider}=await import('/@fs/persist/node_modules/@tanstack/react-router/dist/esm/index.dev.js');
    const {getRouter}=await import('/src/router.tsx');
    const {supabase}=await import('/src/integrations/supabase/client.ts');
    supabase.auth.getUser=async()=>({data:{user:{id:'fixture-user'}},error:null});
    window.testMode='connected'; window.sent=0;
    supabase.from=()=>({select:()=>({eq:async()=> window.testMode==='error' ? {error:{message:'fixture loading error'}} : {data:window.testMode==='empty'?[]:[{instagram_arroba:'fixture_account',arroba_usuario:'fixture_account'}],error:null}})});
    window.fetchOriginal=window.fetch;
    const {StudioDestinationPicker}=await import('/src/components/free-studio/StudioDestinationPicker.tsx'); const {Dialog,DialogContent,DialogTitle,DialogDescription}=await import('/src/components/ui/dialog.tsx'); const {Button}=await import('/src/components/ui/button.tsx');
    localStorage.setItem('estudio-modo','gratuito');localStorage.setItem('estudio-perfil','clinica-escola');
    const host=document.createElement('main');host.style.maxWidth='1100px';host.style.margin='20px auto';document.body.replaceChildren(host);
    function Harness(){ const [open,setOpen]=React.default.useState(false); const [d,setD]=React.default.useState({canal:'instagram',conta:'',conectado:false}); return React.default.createElement(React.default.Fragment,null,React.default.createElement(Button,{onClick:()=>setOpen(true)},'Publicar agora'),React.default.createElement(Dialog,{open,onOpenChange:setOpen},React.default.createElement(DialogContent,null,React.default.createElement(DialogTitle,null,'Publicar — confirmar envio'),React.default.createElement(DialogDescription,null,'Teste sem envio'),React.default.createElement(StudioDestinationPicker,{destino:d,onChange:setD,onReady:()=>{},onConectar:()=>window.connectedClicked=true,carregar:async()=>{await new Promise(r=>setTimeout(r,100)); if(window.testMode==='error')throw new Error('Falha de carregamento');return {contas:window.testMode==='empty'?[]:[{id:'instagram:fixture_account',nome:'@fixture_account',canal:'instagram',conta:'fixture_account',conectado:true}],avisos:[]};}}))));} DOM.default.createRoot(host).render(React.default.createElement(Harness));
   }''')
   await page.get_by_role('button',name='Publicar agora',exact=True).first.click()
   await page.get_by_role('combobox',name='Conta social de destino').click()
   print('opened picker',width)
   await page.screenshot(path=f'/tmp/browser/studio-destino/initial-{width}.png')
   print('options',await page.get_by_role('option').all_text_contents())
   await page.get_by_role('option',name='@fixture_account · autorizado').click()
   await page.get_by_text('Conta selecionada: @fixture_account · instagram',exact=True).wait_for()
   await page.screenshot(path=f'/tmp/browser/studio-destino/selected-{width}.png')
   await page.evaluate("window.testMode='empty'")
   await page.get_by_role('button',name='Carregar novamente').click()
   await page.get_by_text('Nenhuma conta autorizada disponível para instagram.',exact=False).wait_for()
   await page.get_by_role('combobox',name='Conta social de destino').click()
   await page.get_by_role('option',name='Nenhuma conta autorizada neste canal').wait_for()
   await page.keyboard.press('Escape')
   await page.evaluate("window.testMode='error'")
   await page.get_by_role('button',name='Carregar novamente').click()
   await page.get_by_role('alert').filter(has_text='Falha de carregamento').wait_for()
   await page.evaluate("window.testMode='connected'")
   await page.get_by_role('button',name='Carregar novamente').click()
   await page.get_by_role('combobox',name='Conta social de destino').click()
   await page.get_by_role('option',name='@fixture_account · autorizado').click()
   await page.get_by_role('button',name='Conectar redes sociais').click()
   assert await page.evaluate('window.connectedClicked===true && window.sent===0')
   print('Selected account, empty, loading error, retry, connect callback; no send:',width)
   print('errors',errors)
   await page.close()
  await browser.close()
asyncio.run(main())
