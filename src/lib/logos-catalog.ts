// Catálogo de logos disponíveis para overlay no post.
// Fonte única de verdade: usado tanto no dashboard (seleção) quanto no
// pipeline de geração (aplica overlay real via `overlayLogo`).
import logoPlanner from "@/assets/logo-planner.png.asset.json";
import logoAluno1 from "@/assets/logo-aluno-1.png.asset.json";
import logoAluno2 from "@/assets/logo-aluno-2.png.asset.json";
import logoLiga from "@/assets/logo-liga-ctbmf.png.asset.json";

export type LogoKey = "planner" | "aluno-1" | "aluno-2" | "liga-ctbmf" | "nenhuma";

export interface LogoOption {
  key: LogoKey;
  label: string;
  description: string;
  url: string; // caminho relativo /__l5e/...
}

export const LOGOS_DISPONIVEIS: LogoOption[] = [
  {
    key: "planner",
    label: "Prof. Francisco Menezes",
    description: "Logo institucional oficial (padrão do Planner).",
    url: logoPlanner.url,
  },
  {
    key: "aluno-1",
    label: "Anhanguera / Santa Bárbara",
    description: "Logo do curso (Planner Aluno).",
    url: logoAluno1.url,
  },
  {
    key: "aluno-2",
    label: "NSP / Odontologia Hospitalar",
    description: "Logo institucional (Planner Aluno).",
    url: logoAluno2.url,
  },
  {
    key: "liga-ctbmf",
    label: "LACTBMF",
    description: "Selo oficial da Liga Acadêmica.",
    url: logoLiga.url,
  },
  {
    key: "nenhuma",
    label: "Sem logo",
    description: "Publica a arte pura, sem overlay.",
    url: "",
  },
];

export function getLogoOption(key?: LogoKey | null): LogoOption | undefined {
  if (!key) return undefined;
  return LOGOS_DISPONIVEIS.find((l) => l.key === key);
}
