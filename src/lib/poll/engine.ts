import { Poll, PollOption, PollResult } from "./types";

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
    aliases: [String(i + 1), String.fromCharCode(65 + i).toLowerCase(), label.toLowerCase().trim()],
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
    uniqueVotes,
  };
}

export function processVote(
  poll: Poll,
  userId: string,
  text: string
): { voted: boolean; optionId: string | null; updatedOptions: PollOption[] } {
  if (poll.status !== "active") return { voted: false, optionId: null, updatedOptions: poll.options };
  if (poll.uniqueVotes && poll.voters.has(userId)) return { voted: false, optionId: null, updatedOptions: poll.options };

  const normalized = text.toLowerCase().trim();

  const matchIndex = poll.options.findIndex((opt) =>
    opt.aliases.some((alias) => alias === normalized)
  );

  if (matchIndex === -1) return { voted: false, optionId: null, updatedOptions: poll.options };

  // immutable update — no direct mutation
  const updatedOptions = poll.options.map((opt, i) =>
    i === matchIndex ? { ...opt, votes: opt.votes + 1 } : opt
  );

  poll.voters.add(userId);
  return { voted: true, optionId: poll.options[matchIndex].id, updatedOptions };
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
