export type Network = "instagram" | "linkedin";
export type FormatoMidia = "Imagem" | "Vídeo/Reels" | "Stories";

export type PostRow = {
  id: string;
  tipo_post: "Post Único" | "Carrossel";
  estilo_layout: "Padrão";
  legenda: string;
  legenda_instagram: string | null;
  legenda_linkedin: string | null;
  postar_instagram: boolean;
  postar_linkedin: boolean;
  url_imagem: string | null;
  url_da_imagem?: string | null;
  imagens_carrossel: string[];
  instagram_conta?: string | null;
  data_agendamento: string | null;
  status: "Rascunho" | "Agendado" | "Publicado" | "EnviadoMake" | "Erro" | "PendenteAprovacao" | "Arquivado";
  prompt_ia: string | null;
  created_at: string;
  updated_at: string;
  // Insights & Reels
  visualizacoes: number;
  aviso_500_atingido: boolean;
  formato_midia: FormatoMidia;
};
