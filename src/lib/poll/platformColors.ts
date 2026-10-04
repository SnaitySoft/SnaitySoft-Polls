import { VotePlatform } from "./types";

export const VOTE_PLATFORMS: VotePlatform[] = ["twitch", "youtube", "kick"];

export const PLATFORM_BAR_COLOR: Record<VotePlatform, string> = {
  twitch: "bg-purple-500",
  youtube: "bg-red-500",
  kick: "bg-green-500",
};

export const PLATFORM_LABEL: Record<VotePlatform, string> = {
  twitch: "Twitch",
  youtube: "YouTube",
  kick: "Kick",
};
