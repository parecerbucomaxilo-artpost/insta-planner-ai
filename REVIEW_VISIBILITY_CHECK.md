# Approval visibility verification

- Shared control now says **Aprovar post**, with an icon, primary contrast and 44px minimum touch height; Visualizar and Negar remain beside it or wrap below.
- Moved controls ahead of lengthy generated slide/caption content in Chico, composer previews, treatment previews and the full post list. Posts 7 dias permits reviewing completed rows while other rows generate.
- Chico reloads saved posts immediately after generation, including Posts 7 dias. Its legacy weekly theme action now generates a pending post instead of invoking scheduling. Chico generation explicitly requests PendenteAprovacao.
- Added always-visible dashboard access to pending posts and all saved posts, plus a Chico shortcut to its saved list. Switching to the list/calendar refreshes the data.
- Current browser was signed out and read zero saved rows; existing permissions require authentication. Added a visible link to the existing sign-in page, without changing authentication or permissions.

## Actual checks

- Database read: 231 pending posts; the newest generated posts are PendenteAprovacao, not Agendado. No existing statuses or posts were rewritten.
- Playwright: 1280×1800 and 390×844. Inspected actual rendered controls in Chico saved list, all/pending list, Posts 7 dias and calendar. Visualizar opens the carousel dialog; Negar opens confirmation and Cancelar dismisses it. No page errors or horizontal page overflow.
- Visual inspection used two existing post rows through read-only intercepted responses. Weekly generated results and calendar dates used test responses, not real generation/scheduling. No successful writes were simulated or claimed. Captures are under /tmp/browser/review.
- Tests: 23 passed across post-review, week-plan, contextual-image, ai-gateway-image and storage-url. Review tests include generated pending status, approval to Rascunho only, rejection to Arquivado and the pending-only guard.
- ESLint passed for PostReviewActions.tsx, post-review.ts and post-review.test.ts. Expanded lint of legacy screen files did not pass: 818 findings, predominantly existing formatting plus existing typing findings; those files were not broadly reformatted.
- Harness compilation: latest entry build OK. No manual build/typecheck and no deployment.

## Still unverified

Authenticated approval/rejection and reading the saved status back through the UI remain blocked: the requesting account has no matching auth account for self-minting, and explicit account minting needs unavailable approval. The existing permissions were preserved. The user must sign in through the preview's existing sign-in page before that final check.