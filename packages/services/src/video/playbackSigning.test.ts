import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signMuxPlaybackToken, signPlaybackUrl, signThumbnailUrl } from "./playbackSigning";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
const config = { keyId: "test-key", privateKeyBase64: Buffer.from(privateKeyPem).toString("base64") };

describe("mux playback signing", () => {
  it("produces a verifiable RS256 JWT with the playback id", () => {
    const token = signMuxPlaybackToken("abc123XYZ", config);
    const [headerPart, payloadPart, signaturePart] = token.split(".");
    const header = JSON.parse(Buffer.from(headerPart, "base64url").toString());
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString());
    expect(header).toMatchObject({ alg: "RS256", kid: "test-key" });
    expect(payload.sub).toBe("abc123XYZ");
    expect(payload.aud).toBe("v");
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const verifier = createVerify("RSA-SHA256").update(`${headerPart}.${payloadPart}`);
    expect(verifier.verify(publicKey, Buffer.from(signaturePart, "base64url"))).toBe(true);
  });

  it("signs mux stream URLs and passes other URLs through", () => {
    const signed = signPlaybackUrl("https://stream.mux.com/abc123.m3u8", config);
    expect(signed).toMatch(/^https:\/\/stream\.mux\.com\/abc123\.m3u8\?token=/);
    const other = signPlaybackUrl("https://cdn.example.com/video.mp4", config);
    expect(other).toBe("https://cdn.example.com/video.mp4");
  });

  it("signs mux thumbnail URLs with aud t and moves params into claims", () => {
    const signed = signThumbnailUrl("https://image.mux.com/abc123/thumbnail.jpg?time=1", config);
    expect(signed).toMatch(/^https:\/\/image\.mux\.com\/abc123\/thumbnail\.jpg\?token=/);
    expect(signed).not.toContain("time=1");
    const token = new URL(signed).searchParams.get("token")!;
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    expect(payload.aud).toBe("t");
    expect(payload.sub).toBe("abc123");
    expect(payload.time).toBe("1");
  });

  it("passes non-mux thumbnail URLs through", () => {
    const other = signThumbnailUrl("https://cdn.example.com/poster.jpg", config);
    expect(other).toBe("https://cdn.example.com/poster.jpg");
  });

  it("supports short token lifetimes for tighter expiry", () => {
    const token = signMuxPlaybackToken("abc123", { ...config, ttlSeconds: 60 });
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    expect(payload.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 61);
  });
});
