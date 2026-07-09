// Catálogo de logos disponíveis para overlay no post.
// Fonte única de verdade: usado tanto no dashboard (seleção) quanto no
// pipeline de geração (aplica overlay real via `overlayLogo`).
import logoNspAsset from "@/assets/logo-nsp.png.asset.json";
import logoAnhanguera from "@/assets/logo-anhanguera-sbo.png?url";
import logoDrFranciscoAsset from "@/assets/logo-dr-francisco.png.asset.json";
import logoLiga from "@/assets/logo-liga-ctbmf.png?url";
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

export type LogoSelection = LogoKey[];

export const LOGOS_DISPONIVEIS: LogoOption[] = [
  {
    key: "nsp",
    label: "NSP",
    description: "Núcleo de Segurança do Paciente — Anhanguera Santa Bárbara.",
    url: logoNspAsset.url,
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
    description: "Logo oficial Planner Chico — símbolo Σ branco e quadrado ciano.",
    url: logoDrFranciscoAsset.url,
  },
  {
    key: "liga-ctbmf",
    label: "Liga (LACTBMF)",
    description: "Selo oficial da Liga Acadêmica de CTBMF.",
    url: logoLiga,
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

export function getLogoOptions(keys?: LogoKey[] | null): LogoOption[] {
  if (!keys?.length) return [];
  const unique = Array.from(new Set(keys)).filter((key) => key !== "nenhuma");
  return unique
    .map((key) => getLogoOption(key))
    .filter((logo): logo is LogoOption => Boolean(logo?.url));
}
