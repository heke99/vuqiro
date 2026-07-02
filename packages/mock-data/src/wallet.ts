import type { Wallet, WalletTransaction } from "@vuqiro/types";

export const mockWallet: Wallet = {
  id: "wallet_me",
  userId: "user_me",
  coinBalance: 1250,
  lockedBalance: 0,
  updatedAt: "2026-07-02T12:00:00Z"
};

export const mockWalletTransactions: WalletTransaction[] = [
  { id: "txn_001", type: "purchase", amount: 500, label: "500 coins pack", createdAt: "2026-07-02T09:00:00Z" },
  { id: "txn_002", type: "tip", amount: -100, label: "Supported Maya North", relatedUserId: "creator_001", createdAt: "2026-07-02T10:00:00Z" },
  { id: "txn_003", type: "unlock", amount: -50, label: "Unlocked premium video", relatedVideoId: "video_009", createdAt: "2026-07-01T18:00:00Z" },
  { id: "txn_004", type: "purchase", amount: 1200, label: "1,200 coins pack (+100 bonus)", createdAt: "2026-06-30T14:00:00Z" },
  { id: "txn_005", type: "tip", amount: -250, label: "Supported Sola Cooks", relatedUserId: "creator_004", createdAt: "2026-06-30T15:30:00Z" },
  { id: "txn_006", type: "unlock", amount: -100, label: "Unlocked \u201cCity lights\u201d", relatedVideoId: "video_002", createdAt: "2026-06-29T20:00:00Z" },
  { id: "txn_007", type: "boost", amount: -250, label: "Boosted your video", relatedVideoId: "video_010", createdAt: "2026-06-28T11:00:00Z" },
  { id: "txn_008", type: "tip", amount: -50, label: "Supported Vera Codes", relatedUserId: "creator_007", createdAt: "2026-06-27T16:20:00Z" },
  { id: "txn_009", type: "purchase", amount: 100, label: "100 coins pack", createdAt: "2026-06-26T08:15:00Z" },
  { id: "txn_010", type: "refund", amount: 100, label: "Refund: duplicate purchase", createdAt: "2026-06-25T10:00:00Z" },
  { id: "txn_011", type: "tip", amount: -75, label: "Supported Kai Moves", relatedUserId: "creator_005", createdAt: "2026-06-24T19:45:00Z" },
  { id: "txn_012", type: "unlock", amount: -150, label: "Unlocked \u201cHow I mix vocals\u201d", relatedVideoId: "video_019", createdAt: "2026-06-23T21:10:00Z" },
  { id: "txn_013", type: "purchase", amount: 500, label: "500 coins pack", createdAt: "2026-06-21T13:00:00Z" },
  { id: "txn_014", type: "tip", amount: -100, label: "Supported Dune Style", relatedUserId: "creator_008", createdAt: "2026-06-20T17:30:00Z" },
  { id: "txn_015", type: "admin_adjustment", amount: 50, label: "Support credit", createdAt: "2026-06-18T09:00:00Z" },
  { id: "txn_016", type: "tip", amount: -25, label: "Supported Lumen Art", relatedUserId: "creator_006", createdAt: "2026-06-17T15:00:00Z" },
  { id: "txn_017", type: "unlock", amount: -50, label: "Unlocked brush settings", relatedVideoId: "video_009", createdAt: "2026-06-16T12:40:00Z" },
  { id: "txn_018", type: "purchase", amount: 100, label: "100 coins pack", createdAt: "2026-06-14T10:20:00Z" },
  { id: "txn_019", type: "tip", amount: -60, label: "Supported Orbit Plays", relatedUserId: "creator_009", createdAt: "2026-06-12T22:00:00Z" },
  { id: "txn_020", type: "reversal", amount: -100, label: "Reversal: refunded purchase", createdAt: "2026-06-10T08:00:00Z" }
];
