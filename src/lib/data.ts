import { DEMO_LEADERS } from "../data/demo";
import type { Category, Leader, Poll, PollComment, PublicProfile } from "../types";
import {
  addDemoComment,
  createDemoPoll,
  getDemoComments,
  getDemoPolls,
  saveDemoUser,
  voteInDemo,
} from "./demoStore";
import { supabase } from "./supabase";

const AUTH_REDIRECT_URL =
  import.meta.env.VITE_AUTH_REDIRECT_URL?.trim() ||
  "https://just-ulas.github.io/tartisiyoruz/";

const getVisitorId = () => {
  const key = "tartisiyoruz.visitorId.v1";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
};

export async function loadPolls(): Promise<Poll[]> {
  if (!supabase) return getDemoPolls();
  const { data, error } = await supabase
    .from("polls")
    .select(
      "id,question,description,category,created_at,created_by,poll_options(id,label,position),profiles:profiles!polls_created_by_fkey(username,display_name,bio,avatar_url,banner_url)",
    )
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  const [{ data: resultRows }, { data: authData }, { data: commentsData }] =
    await Promise.all([
      supabase.rpc("get_poll_results"),
      supabase.auth.getUser(),
      supabase
        .from("comments")
        .select("poll_id")
        .eq("moderation_status", "visible"),
    ]);
  const ownVotesResult = authData.user
    ? await supabase
        .from("votes")
        .select("poll_id,option_id")
        .eq("user_id", authData.user.id)
    : await supabase.rpc("get_guest_votes", { p_visitor_id: getVisitorId() });
  const resultCounts = new Map<string, number>();
  for (const row of (resultRows ?? []) as {
    option_id: string;
    vote_count: number;
  }[])
    resultCounts.set(row.option_id, Number(row.vote_count));
  const voted = new Map<string, string>(
    (ownVotesResult.data ?? [] as { poll_id: string; option_id: string }[]).map(
      (vote: { poll_id: string; option_id: string }) => [vote.poll_id, vote.option_id],
    ),
  );
  const commentCounts = new Map<string, number>();
  for (const row of (commentsData ?? []) as { poll_id: string }[])
    commentCounts.set(row.poll_id, (commentCounts.get(row.poll_id) ?? 0) + 1);
  return ((data ?? []) as any[]).map((row) => {
    const options = (row.poll_options ?? []) as {
      id: string;
      label: string;
      position: number;
    }[];
    const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      question: row.question,
      description: row.description ?? "",
      category: row.category,
      author: author?.display_name ?? "Topluluk",
      username: author?.username ?? "topluluk",
      createdAt: new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "medium",
      }).format(new Date(row.created_at)),
      comments: commentCounts.get(row.id) ?? 0,
      options: options
        .sort((a, b) => a.position - b.position)
        .map((option) => ({
          id: option.id,
          label: option.label,
          votes: resultCounts.get(option.id) ?? 0,
        })),
      myVote: voted.get(row.id),
    } satisfies Poll;
  });
}

export async function voteForPoll(
  pollId: string,
  optionId: string,
): Promise<Poll[]> {
  if (!supabase) return voteInDemo(pollId, optionId);
  const { data: userData } = await supabase.auth.getUser();
  const { error } = userData.user
    ? await supabase.from("votes").insert({
        poll_id: pollId,
        option_id: optionId,
        user_id: userData.user.id,
      })
    : await supabase.rpc("cast_guest_vote", {
        p_poll_id: pollId,
        p_option_id: optionId,
        p_visitor_id: getVisitorId(),
      });
  if (error?.code === "23505")
    throw new Error("Bu ankette zaten oy kullandın.");
  if (error) throw error;
  return loadPolls();
}

export async function loadComments(pollId: string): Promise<PollComment[]> {
  if (!supabase) return getDemoComments(pollId);
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id,poll_id,content,created_at,profiles:profiles!comments_user_id_fkey(username,display_name)",
    )
    .eq("poll_id", pollId)
    .eq("moderation_status", "visible")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => {
    const profile = Array.isArray(row.profiles)
      ? row.profiles[0]
      : row.profiles;
    return {
      id: row.id,
      pollId: row.poll_id,
      username: profile?.username ?? "kullanıcı",
      displayName: profile?.display_name ?? profile?.username ?? "Kullanıcı",
      text: row.content,
      createdAt: row.created_at,
    };
  });
}

export async function postComment(
  pollId: string,
  content: string,
): Promise<PollComment[]> {
  const text = content.trim();
  if (!text || text.length > 1000)
    throw new Error("Yorum 1–1000 karakter arasında olmalı.");
  if (!supabase) return addDemoComment(pollId, text);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user)
    throw new Error("Yorum yazmak için önce e-posta ile giriş yap.");
  const { error } = await supabase
    .from("comments")
    .insert({ poll_id: pollId, user_id: userData.user.id, content: text });
  if (error) {
    if (error.code === "42501")
      throw new Error("Yorum göndermek için doğrulanmış bir profil gerekli.");
    if (error.code === "P0001" || error.code === "23514")
      throw new Error("Bu içerik topluluk kurallarına uymadığı için gönderilmedi.");
    if (error.code === "42P17")
      throw new Error("Yorum sistemi güncelleniyor. Lütfen sayfayı yenileyip tekrar dene.");
    throw error;
  }
  return loadComments(pollId);
}

export async function publishPoll(
  question: string,
  description: string,
  category: Category,
  options: string[],
): Promise<Poll[]> {
  const cleanQuestion = question.trim();
  const cleanOptions = options.map((option) => option.trim());
  if (cleanQuestion.length < 12 || cleanQuestion.length > 240)
    throw new Error("Soru 12–240 karakter arasında olmalı.");
  if (
    cleanOptions.length < 2 ||
    cleanOptions.length > 4 ||
    cleanOptions.some((option) => !option || option.length > 120)
  )
    throw new Error("Anket 2–4 dolu seçenek içermeli.");
  if (
    new Set(cleanOptions.map((option) => option.toLocaleLowerCase("tr-TR")))
      .size !== cleanOptions.length
  )
    throw new Error("Seçenekler birbirinden farklı olmalı.");
  if (!supabase)
    return createDemoPoll(cleanQuestion, description, category, cleanOptions);
  const { data: result, error } = await supabase.rpc("create_poll", {
    p_question: cleanQuestion,
    p_description: description.trim(),
    p_category: category,
    p_options: cleanOptions,
  });
  if (error) throw error;
  if (!result)
    throw new Error("Anket kaydedildi ancak veritabanı kimliği alınamadı.");
  return loadPolls();
}

function validateCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail))
    throw new Error("Geçerli bir e-posta adresi yaz.");
  if (password.length < 8)
    throw new Error("Şifre en az 8 karakter olmalı.");
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password))
    throw new Error("Şifre büyük/küçük harf, rakam ve özel karakter içermeli.");
  return normalizedEmail;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  acceptedTerms: boolean,
): Promise<"confirmed" | "verification_required"> {
  if (!supabase) throw new Error("E-posta girişi için Supabase yapılandırılmalı.");
  if (!acceptedTerms) throw new Error("Kullanım koşullarını kabul etmelisin.");
  const normalizedEmail = validateCredentials(email, password);
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: { terms_accepted_at: new Date().toISOString() },
      emailRedirectTo: AUTH_REDIRECT_URL,
    },
  });
  if (error) throw error;
  if (data.user && data.user.identities?.length === 0) {
    throw new Error("Bu e-posta zaten kayıtlı ve doğrulanmış. Giriş yapmayı dene.");
  }
  return data.session ? "confirmed" : "verification_required";
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error("E-posta girişi için Supabase yapılandırılmalı.");
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error("Geçerli bir e-posta adresi yaz.");
  if (!password) throw new Error("Şifreni yaz.");
  const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
}

export async function deleteMyAccount(): Promise<void> {
  if (!supabase) throw new Error("Hesap silme yalnızca bulut hesabında kullanılabilir.");
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;
  await supabase.auth.signOut();
}

export async function reportComment(commentId: string, reason: string): Promise<void> {
  if (!supabase) throw new Error("Yorum bildirme yalnızca bulut hesabında kullanılabilir.");
  const { error } = await supabase.rpc("report_comment", {
    p_comment_id: commentId,
    p_reason: reason,
  });
  if (error) throw error;
}

export type AdminReport = {
  commentId: string;
  content: string;
  userId: string;
  reason: string;
  reportedAt: string;
};

export async function isCurrentUserAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("is_current_user_admin");
  if (error) throw error;
  return Boolean(data);
}

export async function loadAdminReports(): Promise<AdminReport[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("admin_list_reports");
  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => ({
    commentId: row.comment_id,
    content: row.comment_content,
    userId: row.comment_user_id,
    reason: row.reason,
    reportedAt: row.reported_at,
  }));
}

export async function adminDeletePoll(pollId: string): Promise<void> {
  if (!supabase) throw new Error("Yönetim işlemi yalnızca bulut hesabında kullanılabilir.");
  const { error } = await supabase.rpc("admin_delete_poll", { p_poll_id: pollId });
  if (error) throw error;
}

export async function adminDeleteComment(commentId: string): Promise<void> {
  if (!supabase) throw new Error("Yönetim işlemi yalnızca bulut hesabında kullanılabilir.");
  const { error } = await supabase.rpc("admin_delete_comment", { p_comment_id: commentId });
  if (error) throw error;
}

export async function adminBanUser(userId: string, durationMinutes: number | null, reason: string): Promise<void> {
  if (!supabase) throw new Error("Yönetim işlemi yalnızca bulut hesabında kullanılabilir.");
  const { error } = await supabase.rpc("admin_ban_user", {
    p_user_id: userId,
    p_duration_minutes: durationMinutes,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function adminUnbanUser(userId: string): Promise<void> {
  if (!supabase) throw new Error("Yönetim işlemi yalnızca bulut hesabında kullanılabilir.");
  const { error } = await supabase.rpc("admin_unban_user", { p_user_id: userId });
  if (error) throw error;
}

export async function updateProfile(
  username: string,
  displayName: string,
  bio = "",
  avatarUrl = "",
  bannerUrl = "",
): Promise<void> {
  if (!supabase) {
    saveDemoUser(username);
    localStorage.setItem(
      "tartisiyoruz.demo.displayName.v1",
      displayName.trim() || username.trim(),
    );
    localStorage.setItem("tartisiyoruz.demo.bio.v1", bio.trim());
    localStorage.setItem("tartisiyoruz.demo.avatar.v1", avatarUrl.trim());
    localStorage.setItem("tartisiyoruz.demo.banner.v1", bannerUrl.trim());
    return;
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Profilini güncellemek için giriş yap.");
  const cleanUsername = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername))
    throw new Error(
      "Kullanıcı adı 3–30 karakter olmalı; küçük harf, sayı ve alt çizgi kullan.",
    );
  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: userData.user.id,
      username: cleanUsername,
      display_name: displayName.trim() || cleanUsername,
      bio: bio.trim().slice(0, 280),
      avatar_url: avatarUrl.trim().slice(0, 500),
      banner_url: bannerUrl.trim().slice(0, 500),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function uploadProfileMedia(
  file: File,
  kind: "avatar" | "banner",
): Promise<string> {
  if (!supabase) return "";
  if (!file.type.startsWith("image/")) throw new Error("Profil görseli bir resim dosyası olmalı.");
  if (file.size > 3 * 1024 * 1024) throw new Error("Profil görseli en fazla 3 MB olabilir.");
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Görsel yüklemek için giriş yap.");
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userData.user.id}/${kind}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("profile-media").upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
}

export async function loadPublicProfile(username: string): Promise<PublicProfile | null> {
  if (!supabase) {
    return {
      username,
      displayName: localStorage.getItem("tartisiyoruz.demo.displayName.v1") || username,
      bio: localStorage.getItem("tartisiyoruz.demo.bio.v1") || "",
      avatarUrl: localStorage.getItem("tartisiyoruz.demo.avatar.v1") || "",
      bannerUrl: localStorage.getItem("tartisiyoruz.demo.banner.v1") || "",
      isAdmin: false,
      badgeLabel: "",
    };
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,username,display_name,bio,avatar_url,banner_url")
    .ilike("username", username)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: badge } = await supabase
    .from("admin_roles")
    .select("badge_label")
    .eq("user_id", data.user_id)
    .maybeSingle();
  return {
    username: data.username,
    displayName: data.display_name,
    bio: data.bio ?? "",
    avatarUrl: data.avatar_url ?? "",
    bannerUrl: data.banner_url ?? "",
    isAdmin: Boolean(badge),
    badgeLabel: badge?.badge_label ?? "",
  };
}

export async function loadLeaderboard(): Promise<Leader[]> {
  if (!supabase) return DEMO_LEADERS;
  const { data, error } = await supabase.rpc("get_leaderboard");
  if (error) throw error;
  return (
    (data ?? []) as { username: string; display_name: string; points: number }[]
  ).map((item) => ({
    username: item.username,
    displayName: item.display_name,
    points: Number(item.points),
    initials: item.display_name
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toLocaleUpperCase("tr-TR"),
  }));
}
