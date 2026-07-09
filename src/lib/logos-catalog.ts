// Catálogo de logos disponíveis para overlay no post.
// Fonte única de verdade: usado tanto no dashboard (seleção) quanto no
// pipeline de geração (aplica overlay real via `overlayLogo`).
import logoPlanner from "@/assets/logo-planner.png.asset.json";
import logoAluno1 from "@/assets/logo-aluno-1.png.asset.json";
import logoAluno2 from "@/assets/logo-aluno-2.png.asset.json";
import logoLiga from "@/assets/logo-liga-ctbmf.png.asset.json";
import logoClinica from "@/assets/logo-clinica.png?url";

export type LogoKey =
  | "nsp"
  | "anhanguera"
  | "planner"
  | "liga-ctbmf"
  | "clinica-escola"
  | "nenhuma";

export interface LogoOption {
  key: LogoKey;
  label: string;
  description: string;
  url: string;
}

export const LOGOS_DISPONIVEIS: LogoOption[] = [
  {
    key: "nsp",
    label: "NSP",
    description: "Núcleo de Saúde e Pesquisa (Odontologia Hospitalar).",
    url: logoAluno2.url,
  },
  {
    key: "anhanguera",
    label: "Anhanguera Santa Bárbara d'Oeste",
    description: "Logo do curso Anhanguera – Santa Bárbara d'Oeste.",
    url: logoAluno1.url,
  },
  {
    key: "planner",
    label: "Prof. Francisco Menezes",
    description: "Logo institucional oficial do Prof. Francisco Menezes.",
    url: logoPlanner.url,
  },
  {
    key: "liga-ctbmf",
    label: "Liga (LACTBMF)",
    description: "Selo oficial da Liga Acadêmica de CTBMF.",
    url: logoLiga.url,
  },
  {
    key: "clinica-escola",
    label: "Clínica Escola",
    description: "Logo institucional da Clínica Escola.",
    url: logoClinica,
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
