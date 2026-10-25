import { createFileRoute } from "@tanstack/react-router";
import { HeroParecer } from "@/components/HeroParecer";

export const Route = createFileRoute("/parecer")({
  head: () => ({
    meta: [
      { title: "Parecer Cirúrgico · Prof. Francisco Menezes CTBMF" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        name: "description",
        content:
          "Planejamento digital que antecede a segurança hospitalar. Consulta presencial com Prof. Francisco Menezes — 33 anos em Cirurgia e Traumatologia Bucomaxilofacial.",
      },
      { property: "og:title", content: "Parecer Cirúrgico · Prof. Francisco Menezes CTBMF" },
      {
        property: "og:description",
        content:
          "O planejamento digital que antecede a segurança hospitalar. CROSP 53318.",
      },
    ],
  }),
  component: () => <HeroParecer />,
});
