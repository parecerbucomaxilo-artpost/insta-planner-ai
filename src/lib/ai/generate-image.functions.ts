import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ===================== IDENTIDADE VISUAL FIXA — DR. FRANCISCO MENEZES / BUCOMAXILOFACIAL =====================
const STYLE_PREFIX =
  "Premium high-performance medical visual for a Brazilian oral and maxillofacial surgeon (cirurgia bucomaxilofacial). High clinical authority, editorial advertising aesthetic for social media. Themes ALWAYS connected to: facial pain, TMJ (ATM), trigeminal neuralgia, jaw, skull, face, temporomandibular joint, advanced diagnosis, maxillofacial surgery. Combine medical expertise, advanced technology and diagnostic precision. ";
const STYLE_SUFFIX =
  " VISUAL ELEMENTS (use when relevant): human face in pain/facial discomfort, lateral close-up of face/jaw/ear/TMJ/trigeminal region, realistic anatomical illustrations of skull/jaw/TMJ/nerves/facial muscles/X-rays, lightning bolts / red glow / neural lines / luminous markings to represent pain, magnifying glass / X-ray / medical holograms / digital panels / diagnostic lines / grids / blue particles, simple medical icons in educational lists. PALETTE: deep medical blue (#0B2545 / #08306B) DOMINANT, pristine white for clarity, ELECTRIC BLUE (#1E90FF / #00A6FF) for highlights, keywords, technical lines, tech icons. RED (#E63946) ONLY to indicate pain, inflammation, alert or sensitive area on the face. Black or deep navy for dramatic high-impact images. White or very light gray for educational posts and informative carousels. COMPOSITION: strong visual hierarchy — large title first, support info next, CTA/signature last. Bold condensed clean modern highly-readable typography. High contrast background/text. Editorial, advertising, medical feel — NEVER generic. Rich anatomy when the theme demands. SAFE ZONE: 200px top/bottom, 100px lateral margins, important text never in right-side strip (Reels/Stories interface icons). MOOD: specialist, precision, correct diagnosis, medical technology, trust, pain relief. Hyperrealistic 8k editorial medical photography blended with crisp typography, award-winning composition.";

const NEGATIVE =
  "amateur, generic stock photo, childish, overly decorative, cluttered background, cartoon style, low resolution, misspelled text, gibberish letters, anglicized portuguese, missing portuguese accents, repeated copy, duplicated headline, lorem ipsum, fake brand logos, female figure when male requested, multiple unrelated people, gore, scary hospital, warm orange/yellow color cast, cyan-only neon without medical depth, shallow generic 'stock image' look without medical authority";

// ===================== DIRETRIZES DE TIPOGRAFIA OBRIGATÓRIAS =====================
function buildTypographyDirective(opts: {
  slideRole: "single" | "carousel-hook" | "carousel-middle" | "carousel-cta" | "conceptual";
  title?: string;
  subtitle?: string;
  bullets?: string[];
  cta?: string;
  doctorName?: string;
  cro?: string;
  slideIndex?: number;
  totalSlides?: number;
}): string {
  const {
    slideRole,
    title = "",
    subtitle = "",
    bullets = [],
    cta = "",
    doctorName = "",
    cro = "",
    slideIndex,
    totalSlides,
  } = opts;

  // Modo conceitual (X / Twitter): SEM texto, só imagem limpa.
  if (slideRole === "conceptual") {
    return " PURELY CONCEPTUAL clean composition: no human faces, no people, NO TEXT, no typography, no HUD letters — a single isolated subject (translucent metallic blue glass anatomical skull OR digital facial planning wireframe mesh) floating on dark medical abstract background.";
  }

  const safeTitle = title.trim().slice(0, 90);
  const safeSubtitle = subtitle.trim().slice(0, 140);
  const safeCta = cta.trim().slice(0, 90);
  const safeDoctor = doctorName.trim().slice(0, 60);
  const safeCro = cro.trim().slice(0, 30);
  const cleanBullets = bullets
    .map((b) => b.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 3);

  const fontDirective =
    "TYPOGRAPHY: clean modern editorial sans-serif (Montserrat / Inter / Helvetica Neue style), perfectly legible, no script fonts, no serifs, no decorative fonts. Render text crisply embedded as part of the design — NOT as a flat overlay. Use generous letter-spacing on headings.";

  const colorRule =
    "TEXT COLOR RULE: main title in deep medical blue (#0B2545) over white/light-gray background OR pristine white over deep navy block — choose whichever yields strongest contrast. 1-3 KEY WORDS may be highlighted in ELECTRIC BLUE (#1E90FF). Secondary text in graphite gray (#475569). CTA rendered as a deep navy button with white text. RED (#E63946) ONLY on anatomical pain/inflammation markers, never on copy. ALL TEXT IN BRAZILIAN PORTUGUESE with correct accents — never anglicize, never omit accents, never repeat copy, never translate, never rewrite.";

  const layoutHook =
    "LAYOUT: large impactful HEADLINE positioned in the upper-left or upper-center, occupying ~30% of the canvas height. Strong negative space around it. The 3D skull / wireframe mesh sits in the right or lower portion of the frame as a background element, never overlapping the headline area.";

  const layoutBullets =
    "LAYOUT: a short section title at the top-left, then 1 to 3 clean bullet points listed vertically with thin cyan separators between them. Each bullet starts with a small glowing cyan dot. The 3D element is small, pushed to a corner or used as faint background texture, keeping ~60% of the frame as clean dark canvas for the bullets.";

  const layoutCta =
    "LAYOUT: bold CTA sentence centered, very large, with a thin cyan underline. Below the CTA: the doctor signature line in smaller refined type. The 3D element is reduced to a faint silhouette/glow behind, never competing with the CTA text.";

  const layoutSingle =
    "LAYOUT (single-slide editorial poster): strong HEADLINE (the hook) in the upper third, an explanatory SUBTITLE one line below in smaller weight, and at the BOTTOM a thin navy bar containing the doctor name (left) and CRO registration (right). The 3D translucent skull or wireframe mesh sits in the mid/right area as a background element, leaving a dark clean zone on the left for the text block.";

  const slideCounter =
    typeof slideIndex === "number" && typeof totalSlides === "number" && totalSlides > 1
      ? ` A small slide counter "${slideIndex + 1}/${totalSlides}" appears discreetly in the top-right corner in faint cyan.`
      : "";

  const signature =
    safeDoctor || safeCro
      ? ` BOTTOM SIGNATURE BAR (mandatory, small but readable): "${
          safeDoctor ? (safeDoctor.startsWith("Dr") ? safeDoctor : `Dr(a). ${safeDoctor}`) : ""
        }${safeDoctor && safeCro ? "  ·  " : ""}${safeCro ? `CRO ${safeCro}` : ""}" rendered in clean uppercase sans-serif tracking, white over a thin navy strip.`
      : "";

  if (slideRole === "single") {
    return ` MANDATORY INTEGRATED TEXT (render EXACTLY as written, no typos, no extra words):
- HEADLINE (large, impactful, top): "${safeTitle || "TÍTULO PRINCIPAL"}"
- SUBTITLE (smaller, explanatory, just below the headline): "${safeSubtitle || ""}"
${signature}
${fontDirective} ${colorRule} ${layoutSingle}${slideCounter}`;
  }

  if (slideRole === "carousel-hook") {
    return ` MANDATORY INTEGRATED TEXT — CAROUSEL SLIDE 1 OF ${totalSlides ?? "?"} (THE HOOK). Render EXACTLY (no typos, no extra words):
- BIG HEADLINE: "${safeTitle || "TÍTULO PRINCIPAL"}"
- SUPPORT LINE: "${safeSubtitle || ""}"
- A small instruction "→ Arraste" or "→ Deslize" appears bottom-right in faint cyan.
${signature}
${fontDirective} ${colorRule} ${layoutHook}${slideCounter}`;
  }

  if (slideRole === "carousel-middle") {
    const bulletText =
      cleanBullets.length > 0
        ? cleanBullets.map((b, i) => `  ${i + 1}. "${b}"`).join("\n")
        : '  1. "Ponto-chave 1"\n  2. "Ponto-chave 2"';
    return ` MANDATORY INTEGRATED TEXT — CAROUSEL MIDDLE SLIDE. Render EXACTLY (no typos):
- SECTION TITLE (top-left): "${safeTitle || "PONTOS-CHAVE"}"
- BULLETS (1 to 3 short items, each on its own line with a small cyan dot):
${bulletText}
${signature}
${fontDirective} ${colorRule} ${layoutBullets}${slideCounter}`;
  }

  // carousel-cta
  return ` MANDATORY INTEGRATED TEXT — CAROUSEL FINAL SLIDE (CTA). Render EXACTLY (no typos):
- BIG CTA: "${safeCta || safeTitle || "Agende sua consulta"}"
- SUPPORT LINE (smaller, just below): "${safeSubtitle || "Ficou com alguma dúvida? Comente abaixo."}"
${signature || ' BOTTOM SIGNATURE BAR (mandatory): the doctor name and CRO registration rendered in clean uppercase sans-serif, white over a thin navy strip.'}
${fontDirective} ${colorRule} ${layoutCta}${slideCounter}`;
}

// ===================== SERVER FN =====================
export const generateImage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      prompt: z.string().min(2).max(2000),
      aspect: z.enum(["1:1", "16:9"]).optional().default("1:1"),
      conceptual: z.boolean().optional().default(false),
      slideRole: z
        .enum(["single", "carousel-hook", "carousel-middle", "carousel-cta", "conceptual"])
        .optional(),
      title: z.string().max(200).optional(),
      subtitle: z.string().max(300).optional(),
      bullets: z.array(z.string().max(120)).max(3).optional(),
      cta: z.string().max(200).optional(),
      doctorName: z.string().max(120).optional(),
      cro: z.string().max(40).optional(),
      slideIndex: z.number().int().min(0).max(20).optional(),
      totalSlides: z.number().int().min(1).max(20).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const aspectClause =
      data.aspect === "16:9"
        ? " Strictly horizontal ultra-wide 16:9 aspect ratio composition."
        : " Square 1:1 composition.";

    // Resolve papel do slide (conceptual flag tem prioridade p/ retrocompat)
    const slideRole =
      data.conceptual === true ? "conceptual" : data.slideRole ?? "single";

    const typographyClause = buildTypographyDirective({
      slideRole,
      title: data.title,
      subtitle: data.subtitle,
      bullets: data.bullets,
      cta: data.cta,
      doctorName: data.doctorName,
      cro: data.cro,
      slideIndex: data.slideIndex,
      totalSlides: data.totalSlides,
    });

    const finalPrompt = `${STYLE_PREFIX}${data.prompt}${STYLE_SUFFIX}${aspectClause}${typographyClause} Negative: ${NEGATIVE}.`;

    const size = data.aspect === "16:9" ? "1536x1024" : "1024x1024";
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-image-2",
        prompt: finalPrompt,
        size,
        quality: "high",
        n: 1,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Falha ao gerar imagem (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("Resposta sem imagem");
    return { dataUrl: `data:image/png;base64,${b64}` };
  });
