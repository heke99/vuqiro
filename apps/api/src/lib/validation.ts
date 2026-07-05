import { z } from "zod";

/**
 * URL validation that rejects dangerous schemes. z.string().url() accepts
 * javascript:, data: and other non-web schemes — user-supplied links (profile
 * websites, ad CTAs, creatives) must be plain https (http allowed only for
 * local development hosts).
 */
export const safeHttpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => {
      let parsed: URL;
      try {
        parsed = new URL(value);
      } catch {
        return false;
      }
      if (parsed.protocol === "https:") return true;
      if (parsed.protocol === "http:") {
        return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      }
      return false;
    },
    { message: "URL must use https" }
  );
