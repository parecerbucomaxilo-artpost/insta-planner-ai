import type { PostRow } from "./posts-types";

export type ReviewDecision = "aceitar" | "negar";

// Rascunho is the existing internally accepted state; only Agendado enters the publisher.
export function reviewStatus(decision: ReviewDecision): PostRow["status"] {
  return decision === "aceitar" ? "Rascunho" : "Arquivado";
}

export function canReview(status: PostRow["status"]): boolean {
  return status === "PendenteAprovacao";
}

export const POST_REVIEW_CHANGED = "planner-post-review-changed";
