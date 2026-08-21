export type PollStatus = "idle" | "active" | "ended";

export interface PollOption {
  id: string;
  label: string;
  votes: number;
  aliases: string[]; // e.g. ["1", "a"] — derived from index
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
  uniqueVotes: boolean; // if false, a user can vote more than once
}

export interface PollResult {
  poll: Omit<Poll, "voters">;
  winner: PollOption | null;
  totalVotes: number;
  percentages: Record<string, number>; // optionId → percent
}

export interface ChatMessage {
  platform: "twitch" | "youtube";
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}
