import { Hono } from "hono";
import { mockPackages, mockPackageVersions, mockStoreProducts } from "@vuqiro/mock-data";
import { badRequest } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser } from "../middleware/auth";

export const monetizationRoutes = new Hono<AppEnv>();

monetizationRoutes.use("*", attachUser);

/**
 * Published package catalog with versions and store product mappings.
 * Reference prices only — buyers always see store-provided prices via
 * RevenueCat offerings.
 */
monetizationRoutes.get("/packages", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({
      packages: mockPackages.filter((pkg) => pkg.status === "published"),
      versions: mockPackageVersions.filter((version) => version.status === "published"),
      storeProducts: mockStoreProducts,
      source: "mock"
    });
  }

  const db = getServiceDb()!;
  const [{ data: packages, error: pkgError }, { data: versions }, { data: storeProducts }] = await Promise.all([
    db.from("monetization_packages").select("*").eq("status", "published"),
    db.from("monetization_package_versions").select("*").eq("status", "published"),
    db.from("store_products").select("*")
  ]);
  if (pkgError) throw badRequest(pkgError.message);

  return c.json({ packages: packages ?? [], versions: versions ?? [], storeProducts: storeProducts ?? [], source: "db" });
});
