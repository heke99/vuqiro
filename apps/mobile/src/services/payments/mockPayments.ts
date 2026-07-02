import { mockPackageVersions } from "@vuqiro/mock-data";

export async function getOfferings() {
  return mockPackageVersions;
}

export async function purchasePackage(packageVersionId: string) {
  return {
    ok: true,
    mode: "mock",
    packageVersionId,
    message: "Mock purchase completed. Real RevenueCat integration is disabled in Batch 1."
  };
}

export async function restorePurchases() {
  return {
    ok: true,
    mode: "mock",
    entitlements: []
  };
}

export async function getCustomerEntitlements() {
  return {
    active: [],
    mode: "mock"
  };
}
