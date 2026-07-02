import React from "react";
import { LegalPage } from "../../src/features/legal/LegalPage";

export default function TermsRoute() {
  return (
    <LegalPage
      title="Terms of Service"
      sections={[
        {
          heading: "1. The service",
          body: "Vuqiro is a short-video creator platform operated by Diversa Solutions LLC. These terms govern your use of the app, including watching, uploading, commenting, purchasing coins and subscribing to creators."
        },
        {
          heading: "2. Your account",
          body: "You must provide accurate information, keep your credentials secure and be at least the minimum age required in your country. You are responsible for activity on your account."
        },
        {
          heading: "3. Your content",
          body: "You keep ownership of content you upload. You grant Vuqiro a license to host, distribute and display it within the platform. You must have the rights to everything you upload, including music."
        },
        {
          heading: "4. Purchases",
          body: "Coins and creator subscriptions are purchased through the App Store or Google Play. Prices are shown in the store checkout. Coins have no cash value and are not redeemable outside Vuqiro."
        },
        {
          heading: "5. Prohibited conduct",
          body: "No harassment, hate, violence, sexual exploitation, spam, scams, copyright infringement or any content that endangers minors. Violations lead to content removal, suspension or permanent bans."
        },
        {
          heading: "6. Termination",
          body: "You may delete your account at any time from Settings. We may suspend or terminate accounts that violate these terms or applicable law."
        }
      ]}
    />
  );
}
