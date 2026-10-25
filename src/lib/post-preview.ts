import type { PostRow } from "@/lib/posts-types";

export type PreviewPlatform = "instagram" | "linkedin";

export function previewPlatforms(post: PostRow): PreviewPlatform[] {
  return [
    ...(post.postar_instagram ? ["instagram" as const] : []),
    ...(post.postar_linkedin ? ["linkedin" as const] : []),
  ];
}

export function previewCaption(post: PostRow, platform: PreviewPlatform | null): string {
  if (platform === "instagram") return post.legenda_instagram ?? post.legenda ?? "";
  if (platform === "linkedin") return post.legenda_linkedin ?? post.legenda ?? "";
  return post.legenda ?? "";
}

export function savedSlideText(caption: string, index: number): string | null {
  const blocks = [
    ...caption.matchAll(
      /^\s*\**Slide\s*(\d+)\s*\**\s*[:\-–—.)]?\s*([\s\S]*?)(?=^\s*\**Slide\s*\d+\b|(?![\s\S]))/gim,
    ),
  ];
  return blocks.find((block) => Number(block[1]) === index + 1)?.[2]?.trim() || null;
}

export function canEditPreview(status: PostRow["status"]): boolean {
  return status === "PendenteAprovacao" || status === "Rascunho";
}
