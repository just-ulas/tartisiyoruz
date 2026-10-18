export type Category =
  | "technology"
  | "gaming"
  | "science"
  | "current-affairs"
  | "society"
  | "education"
  | "sports"
  | "entertainment"
  | "philosophy"
  | "everyday-life";

export type PollOption = {
  id: string;
  label: string;
  votes: number;
};

export type PollComment = {
  id: string;
  pollId: string;
  username: string;
  displayName: string;
  text: string;
  createdAt: string;
};

export type Poll = {
  id: string;
  question: string;
  description: string;
  category: Category;
  author: string;
  username: string;
  createdAt: string;
  options: PollOption[];
  comments: number;
  featured?: boolean;
  myVote?: string;
};

export type PublicProfile = {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  isAdmin: boolean;
  badgeLabel: string;
};

export type Leader = {
  username: string;
  displayName: string;
  points: number;
  initials: string;
};

export type DataMode = "demo" | "cloud";
