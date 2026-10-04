export type PollStatus = "idle" | "active" | "ended";

export type VotePlatform = "twitch" | "youtube" | "kick";

export interface PollOption {
  id: string;
  label: string;
  votes: number;
  votesByPlatform: Record<VotePlatform, number>;
  aliases: string[]; // e.g. ["1", "a"] — derived from index
}

export interface VoteRecord {
  userId: string;
  username: string;
  platform: VotePlatform;
  optionId: string;
  timestamp: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  durationSec: number;
  startedAt: number; // Date.now()
  endsAt: number;
  status: PollStatus;
  voters: Set<string>; // userId → deduplicate
  voteLog: VoteRecord[]; // every accepted vote, in order — audit trail
  uniqueVotes: boolean; // if false, a user can vote more than once
}

export interface PollResult {
  poll: Omit<Poll, "voters">;
  winner: PollOption | null;
  totalVotes: number;
  percentages: Record<string, number>; // optionId → percent
}

export interface PollTemplate {
  id: string;
  question: string;
  options: string[];
  durationSec: number;
  uniqueVotes: boolean;
  createdAt: number;
}

export interface ChatMessage {
  platform: VotePlatform;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}
