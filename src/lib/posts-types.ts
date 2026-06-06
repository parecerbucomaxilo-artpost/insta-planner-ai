export type PostRow = {
  id: string;
  tipo_post: "Post Único" | "Carrossel";
  estilo_layout: "Padrão" | "Estilo X";
  legenda: string;
  url_imagem: string | null;
  imagens_carrossel: string[];
  data_agendamento: string | null;
  status: "Rascunho" | "Agendado" | "Publicado" | "Erro";
  prompt_ia: string | null;
  created_at: string;
  updated_at: string;
};
