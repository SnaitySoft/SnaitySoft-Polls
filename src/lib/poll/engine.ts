import { Poll, PollOption, PollResult, VotePlatform } from "./types";

// Chat clients (notably Twitch's own web UI) silently append an invisible character when
// you resend an identical message, to dodge the platform's duplicate-message filter — e.g.
// "1" becomes "1 ͏". Left in, that breaks the exact-match against option aliases, so
// strip zero-width/format characters before comparing.
const INVISIBLE_CHARS = /[͏​-‍⁠﻿\u{E0000}-\u{E007F}]/gu;

export function createPoll(
  question: string,
  labels: string[],
  durationSec: number,
  uniqueVotes: boolean = true
): Poll {
  const now = Date.now();
  const options: PollOption[] = labels.map((label, i) => ({
    id: `opt-${i}`,
    label,
    votes: 0,
    votesByPlatform: { twitch: 0, youtube: 0, kick: 0 },
    aliases: [
      String(i + 1),
      String.fromCharCode(65 + i).toLowerCase(),
      label.replace(INVISIBLE_CHARS, "").toLowerCase().trim(),
    ],
  }));

  return {
    id: `poll-${now}`,
    question,
    options,
    durationSec,
    startedAt: now,
    endsAt: now + durationSec * 1000,
    status: "active",
    voters: new Set(),
    voteLog: [],
    uniqueVotes,
  };
}

export function processVote(
  poll: Poll,
  userId: string,
  username: string,
  text: string,
  platform: VotePlatform
): { voted: boolean; optionId: string | null; updatedOptions: PollOption[] } {
  if (poll.status !== "active") return { voted: false, optionId: null, updatedOptions: poll.options };
  if (poll.uniqueVotes && poll.voters.has(userId)) return { voted: false, optionId: null, updatedOptions: poll.options };

  const normalized = text.replace(INVISIBLE_CHARS, "").toLowerCase().trim();

  const matchIndex = poll.options.findIndex((opt) =>
    opt.aliases.some((alias) => alias === normalized)
  );

  if (matchIndex === -1) return { voted: false, optionId: null, updatedOptions: poll.options };

  // immutable update — no direct mutation
  const updatedOptions = poll.options.map((opt, i) =>
    i === matchIndex
      ? {
          ...opt,
          votes: opt.votes + 1,
          votesByPlatform: { ...opt.votesByPlatform, [platform]: opt.votesByPlatform[platform] + 1 },
        }
      : opt
  );

  const optionId = poll.options[matchIndex].id;
  poll.voters.add(userId);
  poll.voteLog.push({ userId, username, platform, optionId, timestamp: Date.now() });
  return { voted: true, optionId, updatedOptions };
}

export function endPoll(poll: Poll): PollResult {
  poll.status = "ended";
  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);

  const percentages: Record<string, number> = {};
  for (const opt of poll.options) {
    percentages[opt.id] = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
  }

  const sorted = [...poll.options].sort((a, b) => b.votes - a.votes);
  const winner = totalVotes > 0 ? sorted[0] : null;

  const { voters: _voters, ...pollData } = poll;
  void _voters;

  return { poll: pollData, winner, totalVotes, percentages };
}

export function serializePoll(poll: Poll): object {
  return {
    id: poll.id,
    question: poll.question,
    options: poll.options,
    durationSec: poll.durationSec,
    startedAt: poll.startedAt,
    endsAt: poll.endsAt,
    status: poll.status,
    totalVoters: poll.voters.size,
  };
}
