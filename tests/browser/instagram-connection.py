import asyncio
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  for width,height in [(1280,1800),(390,844)]:
   page=await browser.new_page(viewport={'width':width,'height':height})
   errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   await page.route('https://*.supabase.co/**',lambda r:r.abort())
   await page.route('**/api/**',lambda r:r.abort())
   await page.route('**/*_serverFn*',lambda r:r.abort())
   await page.goto('http://localhost:8080',wait_until='domcontentloaded')
   await page.evaluate('''async()=>{
    const React=await import('/node_modules/.vite/deps/react.js?v=830a2e5d');
    const DOM=await import('/node_modules/.vite/deps/react-dom_client.js?v=830a2e5d');
    const Q=await import('/node_modules/.vite/deps/@tanstack_react-query.js?v=830a2e5d');
    const {supabase}=await import('/src/integrations/supabase/client.ts');
    supabase.auth.getUser=async()=>({data:{user:{id:'fixture-user'}},error:null});
    supabase.auth.getSession=async()=>({data:{session:{user:{id:'fixture-user'}}},error:null});
    supabase.auth.onAuthStateChange=()=>({data:{subscription:{unsubscribe(){}}}});
    supabase.from=()=>({select:()=>({eq:()=>({order:()=>({limit:()=>({maybeSingle:async()=>({data:{id:'fixture-profile'},error:null})})})})})});
    const {SocialConnections}=await import('/src/components/SocialConnections.tsx');
    const {Button}=await import('/src/components/ui/button.tsx');
    const qc=new Q.QueryClient({defaultOptions:{queries:{retry:false}}});window.qc=qc;
    qc.setQueryData(['instagram-connections','fixture-user'],[{id:'fixture-profile',conta:'fixture_account',state:'connected',message:'Autorização Instagram válida.'}]);
    qc.setQueryData(['linkedin-optional-status'],{connected:false,message:'Opcional'});
    const host=document.createElement('main');host.className='p-4';document.body.replaceChildren(host);
    function Harness(){const [show,setShow]=React.default.useState(true);const [profile,setProfile]=React.default.useState('Chico');return React.default.createElement(React.default.Fragment,null,
     React.default.createElement(Button,{onClick:()=>setShow(!show)},show?'Outra tela':'Voltar às conexões'),
     React.default.createElement(Button,{onClick:()=>setProfile(profile==='Chico'?'Clínica Escola':'Chico')},'Trocar perfil'),
     React.default.createElement('p',null,profile),show&&React.default.createElement(SocialConnections));}
    DOM.default.createRoot(host).render(React.default.createElement(Q.QueryClientProvider,{client:qc},React.default.createElement(Harness)));
   }''')
   await page.get_by_text('Instagram conectado',exact=True).wait_for()
   await page.get_by_role('button',name='Trocar perfil',exact=True).click()
   await page.get_by_text('Instagram conectado',exact=True).wait_for()
   await page.get_by_role('button',name='Outra tela',exact=True).click()
   await page.get_by_role('button',name='Voltar às conexões',exact=True).click()
   await page.get_by_text('Instagram conectado',exact=True).wait_for()
   await page.screenshot(path=f'/tmp/browser/instagram/connected-{width}.png')
   await page.evaluate("window.qc.setQueryData(['instagram-connections','fixture-user'],[{id:'fixture-profile',conta:'fixture_account',state:'reconnect',message:'Autorização expirada ou revogada. Reconecte esta conta.'}])")
   await page.get_by_role('button',name='Reconectar @fixture_account',exact=True).wait_for()
   await page.screenshot(path=f'/tmp/browser/instagram/reconnect-{width}.png')
   print(width,'connection restored across mock navigation/profile; revoked authorization shows reconnect; errors:',errors)
   await page.close()
  await browser.close()
asyncio.run(main())
