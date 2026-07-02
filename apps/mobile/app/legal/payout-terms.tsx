import React from "react";
import { LegalPage } from "../../src/features/legal/LegalPage";

export default function PayoutTermsRoute() {
  return (
    <LegalPage
      title="Payout Terms"
      sections={[
        {
          heading: "1. Payout provider",
          body: "Creator payouts are processed through Stripe Connect. You must complete Stripe onboarding and identity verification before receiving payouts."
        },
        {
          heading: "2. Earning calculation",
          body: "Earnings accrue in your revenue ledger from subscriptions, coin tips and unlocks, minus platform fees and applicable store fees."
        },
        {
          heading: "3. Payout schedule",
          body: "Payable balances are batched on a regular schedule once they pass the minimum payout threshold. Failed payouts are retried and shown in your dashboard."
        },
        {
          heading: "4. Holds",
          body: "Payouts can be held for moderation cases, fraud review, refund risk, missing verification or legal review. Holds are visible in your payout dashboard with a reason."
        },
        {
          heading: "5. Taxes",
          body: "Creators are responsible for their own taxes. Diversa Solutions LLC provides transaction records but not tax advice."
        }
      ]}
    />
  );
}
