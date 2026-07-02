import React from "react";
import { LegalPage } from "../../src/features/legal/LegalPage";

export default function CommunityGuidelinesRoute() {
  return (
    <LegalPage
      title="Community Guidelines"
      sections={[
        {
          heading: "Safety first",
          body: "Content that endangers minors, promotes violence, or facilitates harassment is removed and may be reported to authorities. Minor safety reports are always escalated."
        },
        {
          heading: "Be authentic",
          body: "No impersonation, fake engagement, bots or spam. Repetitive or deceptive content is downranked or removed."
        },
        {
          heading: "Respect creators",
          body: "Only upload content you have rights to. Copyright owners can request takedowns; repeat infringers lose their accounts."
        },
        {
          heading: "Adult and sensitive content",
          body: "Sexually explicit content is not allowed. Some content may be age-restricted or limited in distribution."
        },
        {
          heading: "Reporting and blocking",
          body: "Every video, comment and profile can be reported. You can block any user; blocked users cannot interact with you and their content is hidden from your feeds."
        },
        {
          heading: "Enforcement",
          body: "Depending on severity we may limit distribution, remove content, suspend or permanently ban accounts, and hold creator payouts. You can appeal moderation decisions."
        }
      ]}
    />
  );
}
