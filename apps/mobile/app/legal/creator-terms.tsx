import React from "react";
import { LegalPage } from "../../src/features/legal/LegalPage";

export default function CreatorTermsRoute() {
  return (
    <LegalPage
      title="Creator Terms"
      sections={[
        {
          heading: "1. Becoming a creator",
          body: "Creators complete onboarding, accept these terms and keep their account in good standing. Monetization features require identity and payout verification."
        },
        {
          heading: "2. Monetization",
          body: "Creators can offer subscription tiers, coin-unlockable content and receive tips. Prices for mobile purchases are set through official store products managed by Vuqiro."
        },
        {
          heading: "3. Revenue share",
          body: "Creator earnings are calculated after platform and store fees, tracked in a transparent revenue ledger visible in the creator studio."
        },
        {
          heading: "4. Content responsibilities",
          body: "Locked and premium content must follow the same community guidelines as public content. Misleading paywalls or scam content result in monetization removal."
        },
        {
          heading: "5. Moderation and payouts",
          body: "Serious moderation cases can pause payouts while under review. Fraudulent engagement or chargebacks may lead to ledger reversals."
        }
      ]}
    />
  );
}
