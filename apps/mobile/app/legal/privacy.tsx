import React from "react";
import { LegalPage } from "../../src/features/legal/LegalPage";

export default function PrivacyRoute() {
  return (
    <LegalPage
      title="Privacy Policy"
      sections={[
        {
          heading: "1. What we collect",
          body: "Account details (email, handle), content you create, engagement activity (likes, follows, watch events), purchase records and device diagnostics needed to run the service."
        },
        {
          heading: "2. How we use it",
          body: "To operate the feed and recommendations, process purchases and creator payouts, keep the platform safe, and comply with legal obligations."
        },
        {
          heading: "3. What we share",
          body: "Payment processors (Apple, Google, RevenueCat, Stripe), our video and hosting providers, and authorities when legally required. We do not sell personal data."
        },
        {
          heading: "4. Your rights",
          body: "You can access, correct and delete your data. Account deletion is available in Settings and removes your personal data within 30 days, except records we must keep by law."
        },
        {
          heading: "5. Data security",
          body: "Data is encrypted in transit, access is role-restricted, and payment credentials never touch Vuqiro servers."
        },
        {
          heading: "6. Contact",
          body: "Privacy questions: support@vuqiro.app — Diversa Solutions LLC."
        }
      ]}
    />
  );
}
