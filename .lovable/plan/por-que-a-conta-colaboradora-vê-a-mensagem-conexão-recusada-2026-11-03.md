# Por que a conta colaboradora vê a mensagem "conexão recusada" no preview

Neste diagnóstico nada foi alterado: código, permissões, visibilidade e publicação continuam iguais.

## O que foi verificado
- O endereço do preview (`221123ce-...lovableproject.com`) está funcionando. O servidor responde, mas exige login do Lovable (resposta 401) para mostrar a página. É o comportamento esperado para um preview privado.
- O app não tem nenhuma regra que impeça o preview de aparecer dentro do editor.
- Na sua conta, o preview abre normalmente. Portanto, o projeto não está com defeito.

## Causa provável
A mensagem "conexão recusada" é o Chrome bloqueando a área do preview para essa conta específica. Isso não é um erro do app. Pela ordem de probabilidade:
1. **Cookies de terceiros bloqueados.** O preview fica em outro domínio (lovableproject.com), dentro do editor (lovable.dev). Se o Chrome dessa conta bloqueia cookies de terceiros, inclusive no modo anônimo ou em um perfil do Chrome que não é o do Gmail certo, o preview não recebe o login e é recusado.
2. **Perfil ou sessão diferente.** O Chrome pode estar logado no Lovable com outra conta, ou com o convite ainda não aceito. Nesse caso o preview recusa a sessão.
3. **Extensão ou rede bloqueando o domínio.** Bloqueadores de anúncios e privacidade, antivírus, firewall corporativo ou da clínica, ou DNS filtrado podem bloquear `*.lovableproject.com`.
4. **Página antiga em cache**, de antes do acesso ser liberado.

## Passos para a colaboradora (parecerbucomaxilo@gmail.com)
1. Sair do Lovable, fechar todas as abas e entrar de novo com exatamente esse e-mail. Confirmar que o convite foi aceito.
2. No Chrome, abrir Configurações → Privacidade e segurança → Cookies de terceiros. Escolher "Permitir" ou adicionar exceções para `[*.]lovable.dev` e `[*.]lovableproject.com`. Não usar o modo anônimo.
3. Desativar extensões de bloqueio (uBlock, AdBlock, Privacy Badger, antivírus) para esses dois domínios, ou testar em uma janela sem extensões.
4. Recarregar com Ctrl+Shift+R. Se continuar, testar em outra rede, como os dados do celular. Se funcionar lá, a rede ou o firewall está bloqueando `lovableproject.com`, e é preciso liberar esse domínio.
5. Como alternativa imediata, você pode criar um link de prévia compartilhado em **Share → Create shared preview link**. Ele abre sem depender do login no preview, mas só para visualizar, não para editar.

## O que você (dono do projeto) não precisa mudar
Não é preciso mexer em permissões, visibilidade, publicação ou integrações. O acesso "Pode editar" já está correto.
