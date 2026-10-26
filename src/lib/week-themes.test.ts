import { describe, it, expect } from "vitest";
import { buildScheduleSlots } from "./schedule-config";
import { distribuirTemas } from "./week-themes";
import { conflitosNoLote } from "./dedup";
import { quantidadeSlides } from "./carousel-slides";

const base = [
  "Siso incluso: quando extrair",
  "Bruxismo noturno e desgaste",
  "Fratura de mandíbula em acidentes",
  "Higiene oral no paciente internado",
  "Disfunção da ATM e estalos",
  "Cirurgia ortognática e respiração",
  "Lesões na boca que não cicatrizam",
  "Implante após perda dentária",
  "Cisto na mandíbula descoberto no raio-x",
  "Anestesia local: mitos e verdades",
  "Pacientes anticoagulados e extração",
  "Trauma dental em crianças",
];
const terca = new Date("2026-10-27T03:30:00Z");

describe("cronograma global: slots, formatos e unicidade", () => {
  const dia = distribuirTemas(buildScheduleSlots(terca, 1), base);
  it("8 publicações/dia: IG 4, Google 2, LinkedIn 2", () => {
    expect(dia).toHaveLength(8);
    expect(dia.filter((d) => d.rede === "instagram")).toHaveLength(4);
    expect(dia.filter((d) => d.rede === "google")).toHaveLength(2);
    expect(dia.filter((d) => d.rede === "linkedin")).toHaveLength(2);
  });
  it("formatos: stories 09h/18h; feed 14h/21h carrossel de 5 slides; Google/LinkedIn post único", () => {
    const ig = dia.filter((d) => d.rede === "instagram").map((d) => d.formato);
    expect(ig).toEqual(["Story", "Carrossel", "Story", "Carrossel"]);
    dia
      .filter((d) => d.formato === "Carrossel")
      .forEach((d) => expect(quantidadeSlides({ rede: d.rede, formato: d.formato })).toBe(5));
    expect(dia.filter((d) => d.rede !== "instagram").every((d) => d.formato === "Post Único")).toBe(
      true,
    );
  });
  it("todos os slots têm temas distintos, inclusive story x feed e entre redes", () => {
    const temas = dia.map((d) => d.tema);
    expect(temas.every(Boolean)).toBe(true);
    expect(new Set(temas).size).toBe(8);
    expect(conflitosNoLote(temas.map((tema) => ({ tema })))).toEqual([]);
  });
  it("sem temas inéditos suficientes, slots ficam vazios — nunca copia", () => {
    const poucos = distribuirTemas(buildScheduleSlots(terca, 1), base.slice(0, 3));
    expect(poucos.filter((d) => d.tema)).toHaveLength(3);
    expect(new Set(poucos.filter((d) => d.tema).map((d) => d.tema)).size).toBe(3);
  });
  it("tema do histórico não é reutilizado", () => {
    const r = distribuirTemas(buildScheduleSlots(terca, 1), base, ["Siso incluso: quando extrair"]);
    expect(r.some((d) => d.tema.startsWith("Siso incluso"))).toBe(false);
  });
});
