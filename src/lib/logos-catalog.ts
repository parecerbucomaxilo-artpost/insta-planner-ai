// Catálogo de logos disponíveis para overlay no post.
// Fonte única de verdade: usado tanto no dashboard (seleção) quanto no
// pipeline de geração (aplica overlay real via `overlayLogo`).
import logoNsp from "@/assets/logo-nsp.png?url";
import logoAnhanguera from "@/assets/logo-anhanguera-sbo.png?url";
import logoDrFrancisco from "@/assets/logo-dr-francisco.png?url";
import logoLiga from "@/assets/logo-liga-ctbmf.png.asset.json";
import logoClinicaEscola from "@/assets/logo-clinica-escola.png?url";

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
    url: logoNsp,
  },
  {
    key: "anhanguera",
    label: "Anhanguera Santa Bárbara d'Oeste",
    description: "Logo do curso Anhanguera – Santa Bárbara d'Oeste.",
    url: logoAnhanguera,
  },
  {
    key: "planner",
    label: "Prof. Francisco Menezes",
    description: "Logo institucional oficial do Prof. Francisco Menezes.",
    url: logoDrFrancisco,
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
    url: logoClinicaEscola,
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
