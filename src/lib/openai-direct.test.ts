import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openaiDiretoTexto, openaiDiretoImagem, _limparCacheModelos, chaveOpenAIConfigurada, MSG_SEM_CHAVE } from "./openai-direct.server";
import { modelRoute, modelosDoProvedor, provedorDoModelo, validateModel } from "./ai-models";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const catalogo = ok({ data: [{ id: "gpt-6-luna" }, { id: "gpt-image-2.5-flare" }] });

describe("OpenAI com chave própria", () => {
  beforeEach(() => { _limparCacheModelos(); vi.stubEnv("OPENAI_API_KEY", "teste-mock"); });
  afterEach(() => vi.unstubAllEnvs());

  it("sem chave: mensagem clara e nenhuma chamada", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const f = vi.fn();
    expect(chaveOpenAIConfigurada()).toBe(false);
    await expect(openaiDiretoTexto({ model: "openai-direct/gpt-6-luna", prompt: "x" }, f)).rejects.toThrow(MSG_SEM_CHAVE);
    expect(f).not.toHaveBeenCalled();
  });

  it("texto usa o endpoint oficial com o nome oficial do modelo", async () => {
    const f = vi.fn().mockResolvedValueOnce(catalogo).mockResolvedValueOnce(ok({ choices: [{ message: { content: "Legenda" } }] }));
    expect(await openaiDiretoTexto({ model: "openai-direct/gpt-6-luna", prompt: "x" }, f)).toBe("Legenda");
    expect(f.mock.calls[1][0]).toBe("https://api.openai.com/v1/chat/completions");
    expect(JSON.parse(f.mock.calls[1][1].body).model).toBe("gpt-6-luna");
  });

  it("imagem usa /images/generations e devolve b64", async () => {
    const f = vi.fn().mockResolvedValueOnce(catalogo).mockResolvedValueOnce(ok({ data: [{ b64_json: "QUJD" }] }));
    expect(await openaiDiretoImagem({ model: "openai-direct/gpt-image-2.5-flare", prompt: "x", size: "1024x1536" }, f)).toBe("QUJD");
    expect(f.mock.calls[1][0]).toBe("https://api.openai.com/v1/images/generations");
  });

  it("modelo não liberado para a chave é bloqueado, sem trocar de modelo", async () => {
    const f = vi.fn().mockResolvedValueOnce(ok({ data: [{ id: "gpt-6-luna" }] }));
    await expect(openaiDiretoImagem({ model: "openai-direct/gpt-image-2.5-flare", prompt: "x", size: "1024x1024" }, f)).rejects.toThrow(/não está liberado/);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("resposta vazia vira erro, sem texto simulado", async () => {
    const f = vi.fn().mockResolvedValueOnce(catalogo).mockResolvedValueOnce(ok({ choices: [{ message: { content: "" } }] }));
    await expect(openaiDiretoTexto({ model: "openai-direct/gpt-6-luna", prompt: "x" }, f)).rejects.toThrow(/vazia/);
  });

  it("seletor tem três provedores e o roteamento separa chave própria do gateway", () => {
    expect(modelosDoProvedor("text", "openai-direto").map((m) => m.id)).toContain("openai-direct/gpt-6-luna");
    expect(modelRoute("openai-direct/gpt-6-luna", "text").provider).toBe("openai-direct");
    expect(modelRoute("openai/gpt-6-luna", "text").provider).toBe("openai");
    expect(provedorDoModelo("google/gemini-3.8-flash")).toBe("google");
    expect(() => validateModel("openai-direct/gpt-inventado", "text")).toThrow();
  });
});
