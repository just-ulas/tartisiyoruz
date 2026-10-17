import { DEMO_POLLS } from "../data/demo";
import type { Category, Poll, PollComment } from "../types";

const POLLS_KEY = "tartisiyoruz.demo.polls.v1";
const USER_KEY = "tartisiyoruz.demo.user.v1";
const VOTES_KEY = "tartisiyoruz.demo.votes.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getDemoUser(): string {
  return read(USER_KEY, "");
}

export function saveDemoUser(username: string): void {
  localStorage.setItem(USER_KEY, username.trim());
}

export function getDemoPolls(): Poll[] {
  const polls = read<Poll[]>(POLLS_KEY, DEMO_POLLS);
  if (!localStorage.getItem(POLLS_KEY))
    localStorage.setItem(POLLS_KEY, JSON.stringify(polls));
  const votes = read<Record<string, Record<string, string>>>(VOTES_KEY, {});
  const username = getDemoUser().toLowerCase();
  return polls.map((poll) => ({
    ...poll,
    myVote: username ? votes[username]?.[poll.id] : undefined,
  }));
}

export function voteInDemo(pollId: string, optionId: string): Poll[] {
  const username = getDemoUser().trim().toLowerCase();
  if (!username) throw new Error("Önce bir kullanıcı adı seç.");
  const polls = read<Poll[]>(POLLS_KEY, DEMO_POLLS);
  const votes = read<Record<string, Record<string, string>>>(VOTES_KEY, {});
  if (votes[username]?.[pollId])
    throw new Error("Bu ankette zaten oy kullandın.");
  const poll = polls.find((item) => item.id === pollId);
  if (!poll?.options.some((option) => option.id === optionId))
    throw new Error("Seçenek bulunamadı.");
  poll.options = poll.options.map((option) =>
    option.id === optionId ? { ...option, votes: option.votes + 1 } : option,
  );
  votes[username] = { ...(votes[username] ?? {}), [pollId]: optionId };
  localStorage.setItem(POLLS_KEY, JSON.stringify(polls));
  localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
  return getDemoPolls();
}

export function createDemoPoll(
  question: string,
  description: string,
  category: Category,
  labels: string[],
): Poll[] {
  const username = getDemoUser().trim();
  if (!username) throw new Error("Anket açmak için önce kullanıcı adı seç.");
  const polls = read<Poll[]>(POLLS_KEY, DEMO_POLLS);
  const poll: Poll = {
    id: crypto.randomUUID(),
    question: question.trim(),
    description: description.trim(),
    category,
    author: username,
    username: username.toLowerCase(),
    createdAt: "Şimdi",
    comments: 0,
    options: labels.map((label) => ({
      id: crypto.randomUUID(),
      label: label.trim(),
      votes: 0,
    })),
  };
  localStorage.setItem(POLLS_KEY, JSON.stringify([poll, ...polls]));
  return getDemoPolls();
}

export function getDemoComments(pollId: string): PollComment[] {
  return (
    read<Record<string, PollComment[]>>("tartisiyoruz.demo.comments.v1", {})[
      pollId
    ] ?? []
  );
}

export function addDemoComment(pollId: string, text: string): PollComment[] {
  const username = getDemoUser().trim();
  if (!username) throw new Error("Yorum yazmak için önce kullanıcı adı seç.");
  const all = read<Record<string, PollComment[]>>(
    "tartisiyoruz.demo.comments.v1",
    {},
  );
  const comment: PollComment = {
    id: crypto.randomUUID(),
    pollId,
    username,
    displayName: username,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  all[pollId] = [comment, ...(all[pollId] ?? [])];
  localStorage.setItem("tartisiyoruz.demo.comments.v1", JSON.stringify(all));
  const polls = read<Poll[]>(POLLS_KEY, DEMO_POLLS);
  const poll = polls.find((item) => item.id === pollId);
  if (poll) poll.comments += 1;
  localStorage.setItem(POLLS_KEY, JSON.stringify(polls));
  return all[pollId];
}
