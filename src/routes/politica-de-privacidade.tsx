import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Planner Chico" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        name: "description",
        content:
          "Política de Privacidade do Planner Chico, aplicativo de planejamento de conteúdo para redes sociais.",
      },
      { property: "og:title", content: "Política de Privacidade — Planner Chico" },
      {
        property: "og:description",
        content:
          "Como o Planner Chico coleta, usa e protege informações necessárias para planejamento e publicação de conteúdo.",
      },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <Link to="/" className="text-sm font-medium text-primary hover:underline">
          Voltar ao Planner Chico
        </Link>

        <header className="mt-8 border-b border-border pb-8">
          <p className="text-sm font-semibold text-primary">Planner Chico</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Política de Privacidade
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Última atualização: 12 de junho de 2026
          </p>
        </header>

        <div className="mt-8 space-y-8 text-sm leading-7 text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Quem somos</h2>
            <p>
              O Planner Chico é uma ferramenta de planejamento, criação e organização de conteúdos para redes sociais,
              voltada ao uso profissional do Dr. Francisco Menezes em comunicação médica e odontológica.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Informações que podemos coletar</h2>
            <p>
              Podemos armazenar dados fornecidos pelo usuário dentro do próprio aplicativo, como legendas, imagens,
              datas de agendamento, URLs de automação, preferências de perfil e informações necessárias para preparar
              publicações em redes sociais.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Uso das informações</h2>
            <p>
              As informações são usadas para criar, organizar, pré-visualizar, agendar e enviar conteúdos para fluxos de
              publicação autorizados pelo usuário. Não vendemos dados pessoais nem usamos essas informações para fins
              publicitários de terceiros.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Integrações com redes sociais</h2>
            <p>
              Quando o usuário conecta serviços externos, como Instagram, Facebook, LinkedIn ou ferramentas de automação,
              o aplicativo utiliza apenas as permissões necessárias para executar as ações autorizadas, como preparar ou
              enviar publicações. O acesso pode ser revogado pelo usuário nas configurações da respectiva plataforma.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Compartilhamento de dados</h2>
            <p>
              Dados podem ser enviados a serviços externos somente quando isso for necessário para executar uma ação
              solicitada pelo usuário, como disparar uma automação de publicação. Não compartilhamos dados com terceiros
              para venda, corretagem ou publicidade comportamental.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">6. Segurança e retenção</h2>
            <p>
              Adotamos medidas técnicas razoáveis para proteger as informações armazenadas. Os dados são mantidos pelo
              tempo necessário para operação do aplicativo ou até que o usuário solicite sua remoção, quando aplicável.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">7. Direitos do usuário</h2>
            <p>
              O usuário pode solicitar acesso, correção ou exclusão de informações relacionadas ao uso do Planner Chico,
              conforme a legislação aplicável.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">8. Contato</h2>
            <p>
              Para dúvidas sobre esta política ou solicitações relacionadas a privacidade, entre em contato pelo canal
              profissional usado para suporte do Planner Chico.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}