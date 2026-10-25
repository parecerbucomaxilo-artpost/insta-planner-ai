import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { samePostMediaObject } from "./storage-url";

describe("Cache não reutiliza outro post ou slide", () => {
  const origin = "https://media.test/storage/v1/object/public/post-images/post-a/slide-1.jpg";
  it("aceita somente a assinatura do mesmo objeto original", () => {
    expect(
      samePostMediaObject(
        origin,
        "https://media.test/storage/v1/object/sign/post-images/post-a/slide-1.jpg?token=example",
      ),
    ).toBe(true);
    expect(
      samePostMediaObject(
        origin,
        "https://media.test/storage/v1/object/sign/post-images/post-b/slide-1.jpg?token=example",
      ),
    ).toBe(false);
    expect(
      samePostMediaObject(
        origin,
        "https://media.test/storage/v1/object/sign/post-images/post-a/slide-2.jpg?token=example",
      ),
    ).toBe(false);
  });
});
