import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  HashRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useSearchParams,
  useParams,
} from "react-router-dom";
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Flame,
  Heart,
  Lightbulb,
  LogIn,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Send,
  Share2,
  Sparkles,
  Sun,
  ThumbsUp,
  TrendingUp,
  Trophy,
  UserRound,
  UsersRound,
  X,
  ShieldCheck,
} from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ORDER, DEMO_LEADERS } from "./data/demo";
import {
  loadComments,
  loadLeaderboard,
  loadPolls,
  postComment,
  publishPoll,
  reportComment,
  deleteMyAccount,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  updateProfile,
  voteForPoll,
} from "./lib/data";
import { getDemoUser } from "./lib/demoStore";
import { dataMode, supabase } from "./lib/supabase";
import type { Category, Leader, Poll, PollComment } from "./types";
import "./styles.css";

const initialTheme = (): "light" | "dark" =>
  localStorage.getItem("tartisiyoruz.theme") === "dark" ? "dark" : "light";
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("tr-TR");
const totalVotes = (poll: Poll) =>
  poll.options.reduce((sum, option) => sum + option.votes, 0);
const isCategory = (value: string | null): value is Category =>
  Boolean(value && Object.hasOwn(CATEGORY_LABELS, value));
const relativeTime = (value: string) => {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return value;
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  return hours < 24
    ? `${hours} sa önce`
    : new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(
        new Date(value),
      );
};

type ToastState = { text: string; kind?: "error" | "success" } | null;

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>(
    dataMode === "demo" ? DEMO_LEADERS : [],
  );
  const [username, setUsername] = useState(getDemoUser());
  const [displayName, setDisplayName] = useState(
    localStorage.getItem("tartisiyoruz.demo.displayName.v1") || getDemoUser(),
  );
  const [cloudUser, setCloudUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try {
      const [nextPolls, nextLeaders] = await Promise.all([
        loadPolls(),
        loadLeaderboard(),
      ]);
      setPolls(nextPolls);
      setLeaders(nextLeaders);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Veriler yüklenemedi. Supabase migration ve RLS ayarlarını kontrol et.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("tartisiyoruz.theme", theme);
  }, [theme]);

  useEffect(() => {
    void refresh();
    const client = supabase;
    if (!client) return;
    void client.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      const { data: profile } = await client
        .from("profiles")
        .select("username,display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      setCloudUser({
        id: user.id,
        name: profile?.display_name || user.email?.split("@")[0] || "Üye",
        email: user.email ?? "",
      });
      if (profile?.username) setUsername(profile.username);
      if (profile?.display_name) setDisplayName(profile.display_name);
    });
    const { data: subscription } = client.auth.onAuthStateChange(
      (_event, session) => {
        const user = session?.user;
        setCloudUser(
          user
            ? {
                id: user.id,
                name:
                  user.user_metadata?.full_name ||
                  user.email?.split("@")[0] ||
                  "Üye",
                email: user.email ?? "",
              }
            : null,
        );
        window.setTimeout(() => void refresh(), 0);
      },
    );
    const resultChannel = client
      .channel("public-poll-results")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_results" },
        () => window.setTimeout(() => void refresh(), 0),
      )
      .subscribe();
    return () => {
      subscription.subscription.unsubscribe();
      void client.removeChannel(resultChannel);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const viewerName =
    dataMode === "cloud" ? (cloudUser?.name ?? "") : displayName || username;
  const requireIdentity = async (): Promise<boolean> => {
    if (dataMode === "demo") {
      if (username) return true;
      setShowProfile(true);
      return false;
    }
    if (cloudUser) return true;
    setShowProfile(true);
    return false;
  };

  const onVote = async (pollId: string, optionId: string) => {
    if (!(await requireIdentity())) return;
    try {
      setSaving(true);
      setPolls(await voteForPoll(pollId, optionId));
      setToast({
        text: "Oyun kaydedildi. Katkın için teşekkürler.",
        kind: "success",
      });
      void loadLeaderboard().then(setLeaders);
    } catch (cause) {
      setToast({
        text: cause instanceof Error ? cause.message : "Oy kaydedilemedi.",
        kind: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const onCreatePoll = async (
    question: string,
    description: string,
    category: Category,
    options: string[],
  ) => {
    if (!(await requireIdentity())) return;
    try {
      setSaving(true);
      setPolls(await publishPoll(question, description, category, options));
      setShowComposer(false);
      setToast({ text: "Anketin yayınlandı.", kind: "success" });
      void loadLeaderboard().then(setLeaders);
    } catch (cause) {
      setToast({
        text: cause instanceof Error ? cause.message : "Anket yayınlanamadı.",
        kind: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const onSaveProfile = async (newUsername: string, newDisplayName: string) => {
    try {
      setSaving(true);
      await updateProfile(newUsername, newDisplayName);
      setUsername(newUsername.trim().toLowerCase());
      setDisplayName(newDisplayName.trim() || newUsername.trim());
      setShowProfile(false);
      setToast({ text: "Profilin hazır.", kind: "success" });
      if (dataMode === "cloud" && cloudUser) {
        await supabase
          ?.from("profiles")
          .update({ display_name: newDisplayName.trim() || newUsername.trim() })
          .eq("user_id", cloudUser.id);
      }
      void refresh();
    } catch (cause) {
      setToast({
        text: cause instanceof Error ? cause.message : "Profil kaydedilemedi.",
        kind: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const onAuth = async (
    mode: "signin" | "signup",
    email: string,
    password: string,
    acceptedTerms: boolean,
  ) => {
    try {
      setSaving(true);
      if (mode === "signup") {
        const result = await signUpWithEmail(email, password, acceptedTerms);
        setToast({
          text:
            result === "verification_required"
              ? "Doğrulama e-postası gönderildi. E-postandaki bağlantıya tıklayıp sonra giriş yap."
              : "Hesabın oluşturuldu.",
          kind: "success",
        });
      } else {
        await signInWithEmail(email, password);
        setShowProfile(false);
        setToast({ text: "Giriş yapıldı.", kind: "success" });
      }
    } catch (cause) {
      setToast({
        text:
          cause instanceof Error
            ? cause.message
            : "E-posta bağlantısı gönderilemedi.",
        kind: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <HashRouter>
      <div className={`app-shell theme-${theme}`}>
        <div className="desktop-layout">
          <Sidebar
            theme={theme}
            onTheme={() => setTheme(theme === "light" ? "dark" : "light")}
            viewerName={viewerName}
            username={username}
            onProfile={() =>
              dataMode === "demo" || cloudUser
                ? setShowProfile(true)
                : setShowProfile(true)
            }
            onCreate={() => setShowComposer(true)}
          />
          <main className="main-column">
            <Topbar
              onCreate={() => setShowComposer(true)}
              onSignIn={() =>
                dataMode === "demo"
                  ? setShowProfile(true)
                  : setShowProfile(true)
              }
              viewerName={viewerName}
              onProfile={() =>
                dataMode === "demo" || cloudUser
                  ? setShowProfile(true)
                  : setShowProfile(true)
              }
            />
            {dataMode === "demo" && <DemoBanner />}
            {error && (
              <div className="error-banner" role="status">
                <CircleHelp size={17} />
                <span>
                  <strong>Veri bağlantısı kurulamadı.</strong> {error}
                </span>
                <Link to="/" className="text-link">
                  Kurulum notları
                </Link>
              </div>
            )}
            <Routes>
              <Route
                path="/"
                element={
                  <Feed
                    polls={polls}
                    leaders={leaders}
                    loading={loading}
                    saving={saving}
                    onVote={onVote}
                    onCreate={() => setShowComposer(true)}
                  />
                }
              />
              <Route
                path="/trending"
                element={
                  <Feed
                    polls={polls}
                    leaders={leaders}
                    loading={loading}
                    saving={saving}
                    onVote={onVote}
                    onCreate={() => setShowComposer(true)}
                    trending
                  />
                }
              />
              <Route
                path="/poll/:pollId"
                element={
                  <PollPage
                    polls={polls}
                    onVote={onVote}
                    saving={saving}
                    onToast={setToast}
                  />
                }
              />
              <Route
                path="/leaderboard"
                element={<LeaderboardPage leaders={leaders} />}
              />
              <Route path="/kullanim-kosullari" element={<TermsPage />} />
              <Route path="/gizlilik" element={<PrivacyPage />} />
              <Route
                path="/profile/:profileName"
                element={
                  <ProfilePage
                    polls={polls}
                    leaders={leaders}
                    onVote={onVote}
                    saving={saving}
                  />
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <footer className="site-footer">
              <span>Merakla sor. Saygıyla tartış.</span>
              <span>© 2026 Tartışıyoruz</span>
              <Link to="/" className="footer-mode">
                {dataMode === "demo" ? "Cihaz içi demo" : "Supabase bulutu"}
              </Link>
            </footer>
          </main>
          <RightRail
            polls={polls}
            leaders={leaders}
            onCreate={() => setShowComposer(true)}
          />
        </div>
        <MobileNav
          onCreate={() => setShowComposer(true)}
          onProfile={() =>
            dataMode === "demo" || cloudUser
              ? setShowProfile(true)
              : setShowProfile(true)
          }
        />
        {showProfile && (
          <ProfileModal
            username={username}
            displayName={displayName}
            saving={saving}
            isCloud={dataMode === "cloud"}
            isSignedIn={Boolean(cloudUser)}
            onClose={() => setShowProfile(false)}
            onSave={onSaveProfile}
            onAuth={onAuth}
            onSignOut={async () => {
              try {
                await signOut();
                setShowProfile(false);
                setToast({ text: "Oturum kapatıldı.", kind: "success" });
              } catch (cause) {
                setToast({ text: cause instanceof Error ? cause.message : "Oturum kapatılamadı.", kind: "error" });
              }
            }}
            onDeleteAccount={async () => {
              if (!window.confirm("Hesabın, oyların, yorumların ve oluşturduğun anketler silinecek. Devam edilsin mi?")) return;
              try {
                setSaving(true);
                await deleteMyAccount();
                setCloudUser(null);
                setShowProfile(false);
                setToast({ text: "Hesabın ve ilişkili verilerin silindi.", kind: "success" });
                void refresh();
              } catch (cause) {
                setToast({ text: cause instanceof Error ? cause.message : "Hesap silinemedi.", kind: "error" });
              } finally {
                setSaving(false);
              }
            }}
          />
        )}
        {showComposer && (
          <PollComposer
            saving={saving}
            onClose={() => setShowComposer(false)}
            onSubmit={onCreatePoll}
          />
        )}
        {toast && (
          <div
            className={`toast ${toast.kind === "error" ? "toast-error" : ""}`}
            role="status"
          >
            <span>{toast.text}</span>
            <button
              className="icon-button toast-close"
              onClick={() => setToast(null)}
              aria-label="Bildirimi kapat"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </HashRouter>
  );
}

function DemoBanner() {
  return (
    <div className="demo-banner">
      <span className="demo-dot" />
      <div>
        <strong>Demo alanındasın.</strong> Oylar ve yorumlar yalnızca bu cihazda
        saklanır.
      </div>
      <a
        href="https://github.com/just-ulas/tartisiyoruz#supabase-setup"
        target="_blank"
        rel="noreferrer"
      >
        Bulutu kur <ArrowUpRight size={13} />
      </a>
    </div>
  );
}

function Topbar({
  onCreate,
  onSignIn,
  viewerName,
  onProfile,
}: {
  onCreate: () => void;
  onSignIn: () => void;
  viewerName: string;
  onProfile: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-context">
        <span className="overline">HER FİKİR BİR YERDEN BAŞLAR</span>
        <span className="topbar-location">/ Keşfet</span>
      </div>
      <div className="topbar-actions">
        {viewerName ? (
          <button className="account-chip" onClick={onProfile}>
            <span className="avatar avatar-small">{initials(viewerName)}</span>
            <span>{viewerName}</span>
            <ChevronDown size={13} />
          </button>
        ) : (
          <button className="button button-quiet top-signin" onClick={onSignIn}>
            <LogIn size={15} /> Giriş yap
          </button>
        )}
        <button className="button button-primary top-create" onClick={onCreate}>
          <Plus size={17} /> Anket aç
        </button>
      </div>
    </header>
  );
}

function Brand() {
  return (
    <Link to="/" className="brand-lockup" aria-label="Tartışıyoruz ana sayfa">
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-name">
        tartışıyoruz<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}

function Sidebar({
  theme,
  onTheme,
  viewerName,
  username,
  onProfile,
  onCreate,
}: {
  theme: string;
  onTheme: () => void;
  viewerName: string;
  username: string;
  onProfile: () => void;
  onCreate: () => void;
}) {
  return (
    <aside className="left-sidebar">
      <Brand />
      <div className="sidebar-label">ALANIN</div>
      <nav className="side-nav" aria-label="Ana gezinme">
        <NavLink
          end
          to="/"
          className={({ isActive }) =>
            `side-link ${isActive ? "side-link-active" : ""}`
          }
        >
          <Lightbulb size={18} />
          <span>Keşfet</span>
          <span className="side-link-badge">•</span>
        </NavLink>
        <NavLink
          to="/trending"
          className={({ isActive }) =>
            `side-link ${isActive ? "side-link-active" : ""}`
          }
        >
          <Flame size={18} />
          <span>Gündem</span>
        </NavLink>
        <NavLink
          to="/leaderboard"
          className={({ isActive }) =>
            `side-link ${isActive ? "side-link-active" : ""}`
          }
        >
          <Trophy size={18} />
          <span>Liderlik</span>
        </NavLink>
        {username && (
          <NavLink
            to={`/profile/${username}`}
            className={({ isActive }) =>
              `side-link ${isActive ? "side-link-active" : ""}`
            }
          >
            <UserRound size={18} />
            <span>Profilim</span>
          </NavLink>
        )}
      </nav>
      <div className="sidebar-label category-label">KATEGORİLER</div>
      <nav className="side-categories" aria-label="Kategoriler">
        {CATEGORY_ORDER.slice(0, 6).map((category, index) => (
          <Link
            key={category}
            to={`/?category=${category}`}
            className="side-category"
          >
            <span className={`category-dot category-dot-${index}`} />
            {CATEGORY_LABELS[category]}
            <ChevronRight size={13} />
          </Link>
        ))}
        <Link to="/" className="side-all">
          Tüm kategoriler <ArrowUpRight size={13} />
        </Link>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-create-card">
          <div className="create-card-icon">
            <Sparkles size={16} />
          </div>
          <strong>Bir soru aklında mı?</strong>
          <span>Topluluğun fikrini merak et.</span>
          <button className="button button-light" onClick={onCreate}>
            <Plus size={15} /> Anket oluştur
          </button>
        </div>
        <button
          className="theme-toggle"
          onClick={onTheme}
          aria-label="Temayı değiştir"
        >
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          <span>{theme === "light" ? "Koyu görünüm" : "Açık görünüm"}</span>
        </button>
        {viewerName && (
          <button className="sidebar-profile" onClick={onProfile}>
            <span className="avatar">{initials(viewerName)}</span>
            <span className="profile-summary">
              <strong>{viewerName}</strong>
              <small>@{username || "misafir"}</small>
            </span>
            <ChevronDown size={14} />
          </button>
        )}
      </div>
    </aside>
  );
}

function Feed({
  polls,
  leaders,
  loading,
  saving,
  onVote,
  onCreate,
  trending = false,
}: {
  polls: Poll[];
  leaders: Leader[];
  loading: boolean;
  saving: boolean;
  onVote: (pollId: string, optionId: string) => void;
  onCreate: () => void;
  trending?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get("category");
  const [category, setCategory] = useState<Category | "all">(
    isCategory(selectedCategory) ? selectedCategory : "all",
  );
  const [sort, setSort] = useState<"popular" | "newest">("popular");
  useEffect(() => {
    const onSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".search-box input")?.focus();
      }
    };
    window.addEventListener("keydown", onSearchShortcut);
    return () => window.removeEventListener("keydown", onSearchShortcut);
  }, []);
  useEffect(
    () => setCategory(isCategory(selectedCategory) ? selectedCategory : "all"),
    [selectedCategory],
  );
  const changeCategory = (value: Category | "all") => {
    setCategory(value);
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("category");
    else next.set("category", value);
    setSearchParams(next, { replace: true });
  };
  const sorted = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    const matches = polls.filter(
      (poll) =>
        (category === "all" || poll.category === category) &&
        (!query ||
          `${poll.question} ${poll.description} ${CATEGORY_LABELS[poll.category]}`
            .toLocaleLowerCase("tr-TR")
            .includes(query)),
    );
    return sort === "popular"
      ? matches.sort((a, b) => totalVotes(b) - totalVotes(a))
      : matches;
  }, [polls, category, search, sort]);
  const communityVotes = polls.reduce((sum, poll) => sum + totalVotes(poll), 0);
  return (
    <section className="feed-page">
      <div className="hero-block">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" /> FİKİRLERİN BULUŞMA NOKTASI
          </div>
          <h1>
            Bir fikrin
            <br />
            <em>var mı?</em>
          </h1>
          <p>
            Merak ettiğin soruyu sor. Farklı sesleri dinle.
            <br className="desktop-break" /> Sonuçları birlikte görelim.
          </p>
          <button className="button button-primary hero-cta" onClick={onCreate}>
            Topluluğa sor <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-ring art-ring-one" />
          <div className="art-ring art-ring-two" />
          <div className="art-speech">
            <span />
            <span />
            <span />
          </div>
          <span className="art-asterisk">✳</span>
          <span className="art-caption">
            FİKİR
            <br />
            FARKI
          </span>
          <span className="art-orbit-label">BİRLİKTE DÜŞÜN</span>
        </div>
        <div className="hero-index">
          01<span> / 03</span>
        </div>
      </div>
      <div className="feed-heading-row">
        <div>
          <div className="section-kicker">
            {trending ? "TOPLULUĞUN GÜNDEMİ" : "TOPLULUKTAN"}
          </div>
          <h2>
            {trending ? "Gündemdeki tartışmalar" : "Şimdi konuşulanlar"}{" "}
            <span className="live-indicator">
              <i /> canlı
            </span>
          </h2>
          <p className="section-subtitle">
            Bugünün sorularına göz at, kendi fikrini ekle.
          </p>
        </div>
        <button
          className="sort-button"
          onClick={() => setSort(sort === "popular" ? "newest" : "popular")}
        >
          <ArrowDownWideNarrow size={16} />{" "}
          {sort === "popular" ? "Öne çıkanlar" : "En yeni"}
          <ChevronDown size={14} />
        </button>
      </div>
      <div className="search-row">
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="Anket ara"
            placeholder="Bir konu, soru ya da fikir ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <kbd>⌘ K</kbd>
        </label>
        <button
          className="filter-button"
          aria-label="Kategorilere git"
          onClick={() =>
            document
              .getElementById("poll-categories")
              ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
          }
        >
          <ArrowDownWideNarrow size={17} />
          <span>Kategoriler</span>
        </button>
      </div>
      <div
        id="poll-categories"
        className="category-scroller"
        aria-label="Anket kategorileri"
      >
        <button
          className={`topic-chip ${category === "all" ? "topic-chip-active" : ""}`}
          onClick={() => changeCategory("all")}
        >
          Tümü <span>{polls.length}</span>
        </button>
        {CATEGORY_ORDER.map((item, index) => (
          <button
            key={item}
            className={`topic-chip ${category === item ? "topic-chip-active" : ""}`}
            onClick={() => changeCategory(item)}
          >
            <i className={`category-dot category-dot-${index % 6}`} />
            {CATEGORY_LABELS[item]}
          </button>
        ))}
      </div>
      <div className="poll-list" aria-live="polite">
        {loading ? (
          <LoadingState />
        ) : sorted.length ? (
          sorted.map((poll, index) => (
            <PollCard
              key={poll.id}
              poll={poll}
              onVote={onVote}
              saving={saving}
              featured={index === 0 && !search && category === "all"}
            />
          ))
        ) : (
          <EmptyState search={search} onCreate={onCreate} />
        )}
      </div>
      <div className="feed-endnote">
        <span className="endnote-line" />
        <span>
          {polls.length
            ? `${polls.length} başlık · ${new Intl.NumberFormat("tr-TR").format(communityVotes)} toplam görüş`
            : "Yeni fikirler için alan hazır"}
        </span>
        <span className="endnote-line" />
      </div>
    </section>
  );
}

function PollCard({
  poll,
  onVote,
  saving,
  featured = false,
}: {
  poll: Poll;
  onVote: (pollId: string, optionId: string) => void;
  saving: boolean;
  featured?: boolean;
}) {
  const total = totalVotes(poll);
  const voted = Boolean(poll.myVote);
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/poll/${poll.id}`;
    try {
      if (navigator.share) await navigator.share({ title: poll.question, url });
      else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* A cancelled share is not an error. */
    }
  };
  return (
    <article className={`poll-card ${featured ? "poll-card-featured" : ""}`}>
      {featured && (
        <div className="featured-ribbon">
          <Sparkles size={13} /> ÖNE ÇIKAN SORU
        </div>
      )}
      <div className="poll-card-top">
        <Link to={`/profile/${poll.username}`} className="poll-author">
          <span className={`avatar avatar-${poll.id.length % 5}`}>
            {initials(poll.author)}
          </span>
          <span className="author-text">
            <strong>
              {poll.author}
              <BadgeCheck size={13} />
            </strong>
            <small>
              @{poll.username} <span>·</span> {poll.createdAt}
            </small>
          </span>
        </Link>
        <span className="category-pill">
          <i
            className={`category-dot category-dot-${CATEGORY_ORDER.indexOf(poll.category) % 6}`}
          />
          {CATEGORY_LABELS[poll.category]}
        </span>
      </div>
      <Link to={`/poll/${poll.id}`} className="poll-question-link">
        <h3>{poll.question}</h3>
      </Link>
      {poll.description && (
        <p className="poll-description">{poll.description}</p>
      )}
      <div
        className={`poll-options ${voted ? "poll-options-voted" : ""}`}
        aria-label="Anket seçenekleri"
      >
        {poll.options.map((option) => {
          const percent = total ? Math.round((option.votes / total) * 100) : 0;
          return voted ? (
            <div
              className={`result-option ${poll.myVote === option.id ? "result-option-selected" : ""}`}
              key={option.id}
            >
              <div className="result-bar" style={{ width: `${percent}%` }} />
              <span className="result-label">
                {option.label}
                {poll.myVote === option.id && <Check size={14} />}
              </span>
              <span className="result-percent">{percent}%</span>
            </div>
          ) : (
            <button
              key={option.id}
              className="vote-option"
              onClick={() => onVote(poll.id, option.id)}
              disabled={saving}
            >
              <span className="option-radio" />
              {option.label}
              <ChevronRight size={15} className="option-arrow" />
            </button>
          );
        })}
      </div>
      <div className="poll-card-footer">
        <div className="poll-total">
          <UsersRound size={15} />
          <span>{new Intl.NumberFormat("tr-TR").format(total)} oy</span>
          {voted && (
            <span className="your-vote">
              <Check size={12} /> oyun kaydedildi
            </span>
          )}
        </div>
        <div className="poll-actions">
          <Link to={`/poll/${poll.id}`} className="poll-action">
            <MessageCircle size={16} />
            <span>{poll.comments}</span>
          </Link>
          <button
            className="poll-action"
            onClick={share}
            aria-label="Anketi paylaş"
          >
            <Share2 size={15} />
            <span>Paylaş</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function RightRail({
  polls,
  leaders,
  onCreate,
}: {
  polls: Poll[];
  leaders: Leader[];
  onCreate: () => void;
}) {
  const trending = [...polls]
    .sort((a, b) => totalVotes(b) - totalVotes(a))
    .slice(0, 4);
  const votesAcrossPolls = polls.reduce(
    (sum, poll) => sum + totalVotes(poll),
    0,
  );
  return (
    <aside className="right-rail">
      <div className="rail-topline">
        <span>TOPLULUK NOTLARI</span>
        <span className="rail-edition">NO. 01</span>
      </div>
      <section className="rail-stat">
        <div className="stat-label">
          <span className="stat-dot" /> TOPLAM OY
        </div>
        <div className="stat-number">
          {new Intl.NumberFormat("tr-TR").format(votesAcrossPolls)}
        </div>
        <div className="stat-caption">
          görüş kaydedildi <TrendingUp size={14} />
        </div>
      </section>
      <section className="rail-section">
        <div className="rail-section-heading">
          <div>
            <span className="rail-eyebrow">ÖNE ÇIKANLAR</span>
            <h3>Gündemdekiler</h3>
          </div>
          <Flame size={17} />
        </div>
        <div className="trending-list">
          {trending.map((poll, index) => (
            <Link
              to={`/poll/${poll.id}`}
              className="trending-item"
              key={poll.id}
            >
              <span className="trend-number">0{index + 1}</span>
              <span className="trend-copy">
                <strong>{poll.question}</strong>
                <small>
                  {CATEGORY_LABELS[poll.category]} <span>·</span>{" "}
                  {new Intl.NumberFormat("tr-TR").format(totalVotes(poll))} oy
                </small>
              </span>
              <ArrowUpRight size={14} />
            </Link>
          ))}
        </div>
      </section>
      <section className="rail-section leaderboard-preview">
        <div className="rail-section-heading">
          <div>
            <span className="rail-eyebrow">KATKI VERENLER</span>
            <h3>Topluluğun sesleri</h3>
          </div>
          <Trophy size={17} />
        </div>
        {leaders.slice(0, 3).map((leader, index) => (
          <Link
            to={`/profile/${leader.username}`}
            className="mini-leader"
            key={leader.username}
          >
            <span className={`leader-rank rank-${index + 1}`}>{index + 1}</span>
            <span className="avatar avatar-small">{leader.initials}</span>
            <span className="leader-name">
              <strong>{leader.displayName}</strong>
              <small>@{leader.username}</small>
            </span>
            <span className="leader-score">{leader.points}</span>
          </Link>
        ))}
        <Link to="/leaderboard" className="rail-view-all">
          Tüm sıralama <ArrowUpRight size={14} />
        </Link>
      </section>
      <section className="rail-prompt">
        <div className="prompt-icon">
          <CircleHelp size={18} />
        </div>
        <span className="rail-eyebrow">AKLINDA BİR ŞEY Mİ VAR?</span>
        <h3>
          İyi bir soru,
          <br />
          iyi bir sohbet başlatır.
        </h3>
        <button className="text-button" onClick={onCreate}>
          Sen de sor <ArrowUpRight size={15} />
        </button>
      </section>
      <div className="rail-disclosure">
        <ShieldCheck size={15} />
        <span>
          Bu alan fikir paylaşımı içindir. Her görüşe saygıyla yaklaş.
        </span>
      </div>
    </aside>
  );
}

function PollPage({
  polls,
  onVote,
  saving,
  onToast,
}: {
  polls: Poll[];
  onVote: (pollId: string, optionId: string) => void;
  saving: boolean;
  onToast: (toast: ToastState) => void;
}) {
  const { pollId = "" } = useParams();
  const poll = polls.find((item) => item.id === pollId);
  const [comments, setComments] = useState<PollComment[]>([]);
  const [comment, setComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    let live = true;
    setLoadingComments(true);
    void loadComments(pollId)
      .then((items) => {
        if (live) setComments(items);
      })
      .catch((cause) => {
        if (live)
          onToast({
            text:
              cause instanceof Error ? cause.message : "Yorumlar yüklenemedi.",
            kind: "error",
          });
      })
      .finally(() => {
        if (live) setLoadingComments(false);
      });
    return () => {
      live = false;
    };
  }, [pollId]);
  if (!poll)
    return (
      <div className="page-state">
        <CircleHelp size={27} />
        <h2>Anket bulunamadı</h2>
        <p>Bağlantı geçersiz olabilir ya da anket henüz yüklenmemiştir.</p>
        <Link className="button button-primary" to="/">
          Keşfete dön
        </Link>
      </div>
    );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!comment.trim()) return;
    try {
      setSubmitting(true);
      setComments(await postComment(poll.id, comment));
      setComment("");
      onToast({ text: "Yorumun sohbete eklendi.", kind: "success" });
    } catch (cause) {
      onToast({
        text: cause instanceof Error ? cause.message : "Yorum gönderilemedi.",
        kind: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <section className="detail-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} /> Keşfete dön
      </Link>
      <div className="detail-kicker">
        {CATEGORY_LABELS[poll.category]} <span>·</span> {poll.createdAt}
      </div>
      <h1 className="detail-title">{poll.question}</h1>
      {poll.description && (
        <p className="detail-description">{poll.description}</p>
      )}
      <div className="detail-author">
        <span className="avatar">{initials(poll.author)}</span>
        <span>
          <strong>{poll.author}</strong>
          <small>@{poll.username} tarafından soruldu</small>
        </span>
      </div>
      <PollCard poll={poll} onVote={onVote} saving={saving} />
      <section className="discussion-section">
        <div className="discussion-heading">
          <div>
            <span className="section-kicker">SÖZ SİZDE</span>
            <h2>
              Fikir alışverişi <span>{comments.length}</span>
            </h2>
          </div>
          <span className="civil-note">
            <Heart size={14} /> Saygı çerçevesinde
          </span>
        </div>
        <form className="comment-composer" onSubmit={submit}>
          <div className="comment-composer-avatar avatar">
            {initials(dataMode === "demo" ? getDemoUser() || "Misafir" : "Üye")}
          </div>
          <textarea
            maxLength={1000}
            placeholder="Fikrini, deneyimini ya da farklı bakış açını paylaş..."
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            aria-label="Yorum yaz"
          />
          <div className="comment-compose-bottom">
            <small>
              {comment.length}/1000 · Yorumlar herkesin görebileceği şekilde
              yayımlanır.
            </small>
            <button
              className="button button-primary"
              disabled={submitting || !comment.trim()}
            >
              <Send size={14} /> Gönder
            </button>
          </div>
        </form>
        <div className="comment-list">
          {loadingComments ? (
            <div className="inline-loading">
              <span className="spinner" /> Yorumlar yükleniyor…
            </div>
          ) : comments.length ? (
            comments.map((item) => (
              <CommentItem key={item.id} comment={item} onToast={onToast} />
            ))
          ) : (
            <div className="empty-comments">
              <MessageCircle size={22} />
              <strong>İlk sözü sen söyle.</strong>
              <span>Fikrini paylaşarak sohbeti başlat.</span>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function CommentItem({
  comment,
  onToast,
}: {
  comment: PollComment;
  onToast: (toast: ToastState) => void;
}) {
  const report = async () => {
    const reason = window.prompt(
      "Bildirme nedeni: harassment, hate, spam, privacy veya other",
      "harassment",
    );
    if (!reason) return;
    try {
      await reportComment(comment.id, reason.trim().toLowerCase());
      onToast({ text: "Bildirimin alındı. Teşekkürler.", kind: "success" });
    } catch (cause) {
      onToast({
        text: cause instanceof Error ? cause.message : "Yorum bildirilemedi.",
        kind: "error",
      });
    }
  };
  return (
    <article className="comment-item">
      <span className="avatar avatar-small">
        {initials(comment.displayName)}
      </span>
      <div className="comment-body">
        <div className="comment-meta">
          <Link to={`/profile/${comment.username}`}>
            <strong>{comment.displayName}</strong>
          </Link>
          <span>@{comment.username}</span>
          <span>·</span>
          <time>{relativeTime(comment.createdAt)}</time>
        </div>
        <p>{comment.text}</p>
        <button className="comment-report" type="button" onClick={report}>
          Bildir
        </button>
      </div>
    </article>
  );
}

function LeaderboardPage({ leaders }: { leaders: Leader[] }) {
  return (
    <section className="subpage">
      <div className="subpage-overline">
        <Trophy size={16} /> TOPLULUĞA KATKI
      </div>
      <h1>
        Topluluğun
        <br />
        <em>sesleri.</em>
      </h1>
      <p className="subpage-intro">
        Soru soran, oy veren ve sohbeti zenginleştiren topluluk üyeleri.
      </p>
      <div className="leaderboard-card">
        {leaders.length ? (
          leaders.map((leader, index) => (
            <Link
              to={`/profile/${leader.username}`}
              key={leader.username}
              className={`leader-row ${index === 0 ? "leader-row-first" : ""}`}
            >
              <span className="leader-rank-large">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={`avatar ${index < 3 ? `avatar-${index + 1}` : ""}`}
              >
                {leader.initials}
              </span>
              <span className="leader-row-person">
                <strong>{leader.displayName}</strong>
                <small>@{leader.username}</small>
              </span>
              {index === 0 && (
                <span className="leader-crown">EN ÇOK KATKI</span>
              )}
              <span className="leader-points">
                <strong>{leader.points}</strong>
                <small>katkı</small>
              </span>
            </Link>
          ))
        ) : (
          <div className="empty-comments">
            <UsersRound size={24} />
            <strong>Henüz sıralama verisi yok.</strong>
            <span>Topluluk etkileşime geçtiğinde liste oluşacak.</span>
          </div>
        )}
      </div>
      <p className="data-hint">
        <ShieldCheck size={15} />{" "}
        {dataMode === "demo"
          ? "Örnek liderlik verisi · Supabase kurulumundan sonra gerçek etkinlik kullanılır."
          : "Sıralama Supabase etkinlik kayıtlarından hesaplanır."}
      </p>
    </section>
  );
}

function ProfilePage({
  polls,
  leaders,
  onVote,
  saving,
}: {
  polls: Poll[];
  leaders: Leader[];
  onVote: (pollId: string, optionId: string) => void;
  saving: boolean;
}) {
  const { profileName = "" } = useParams();
  const leader = leaders.find(
    (item) => item.username.toLowerCase() === profileName.toLowerCase(),
  );
  const authored = polls.filter(
    (poll) => poll.username.toLowerCase() === profileName.toLowerCase(),
  );
  const name = leader?.displayName ?? authored[0]?.author ?? profileName;
  const points = leader?.points ?? 0;
  return (
    <section className="subpage profile-page">
      <div className="profile-banner">
        <div className="profile-banner-grid" />
        <div className="profile-avatar-large">{initials(name)}</div>
        <span className="profile-badge">
          <BadgeCheck size={14} /> Tartışıyoruz üyesi
        </span>
      </div>
      <div className="profile-main">
        <div className="profile-title-row">
          <div>
            <h1>{name}</h1>
            <span className="profile-handle">@{profileName}</span>
          </div>
          <button
            className="button button-quiet"
            onClick={async () => {
              const url = `${window.location.origin}${window.location.pathname}#/profile/${encodeURIComponent(profileName)}`;
              try {
                if (navigator.share)
                  await navigator.share({
                    title: `${name} | Tartışıyoruz`,
                    url,
                  });
                else await navigator.clipboard.writeText(url);
              } catch {
                /* A cancelled share is not an error. */
              }
            }}
          >
            <Share2 size={15} /> Profili paylaş
          </button>
        </div>
        <p className="profile-bio">
          Farklı fikirleri dinlemeyi ve iyi soruların peşinden gitmeyi seviyor.
        </p>
        <div className="profile-stats">
          <div>
            <strong>{authored.length}</strong>
            <span>sorduğu soru</span>
          </div>
          <div>
            <strong>{points}</strong>
            <span>topluluk katkısı</span>
          </div>
          <div>
            <strong>
              {authored.reduce((sum, poll) => sum + totalVotes(poll), 0)}
            </strong>
            <span>aldığı oy</span>
          </div>
        </div>
        <div className="profile-polls-heading">
          <span className="section-kicker">MERAK ETTİKLERİ</span>
          <h2>Sorduğu sorular</h2>
        </div>
        {authored.length ? (
          <div className="poll-list">
            {authored.map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                onVote={onVote}
                saving={saving}
              />
            ))}
          </div>
        ) : (
          <div className="empty-comments">
            <Lightbulb size={23} />
            <strong>Henüz soru paylaşılmamış.</strong>
            <span>Bu profilin yeni soruları burada görünecek.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function PollComposer({
  saving,
  onClose,
  onSubmit,
}: {
  saving: boolean;
  onClose: () => void;
  onSubmit: (
    question: string,
    description: string,
    category: Category,
    options: string[],
  ) => void;
}) {
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("society");
  const [options, setOptions] = useState(["", ""]);
  const updateOption = (index: number, value: string) =>
    setOptions((current) =>
      current.map((option, idx) => (idx === index ? value : option)),
    );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(question, description, category, options);
  };
  return (
    <Modal title="Topluluğa sor" eyebrow="YENİ TARTIŞMA" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label className="field-label">
          Sorun ne?
          <textarea
            autoFocus
            maxLength={240}
            required
            minLength={12}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Örn. Şehirde ulaşımın geleceği nasıl olmalı?"
          />
          <small>{question.length}/240</small>
        </label>
        <label className="field-label">
          Kısa açıklama <span>isteğe bağlı</span>
          <textarea
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Sorunun bağlamını birkaç cümleyle paylaş..."
          />
        </label>
        <label className="field-label">
          Kategori
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as Category)}
          >
            {CATEGORY_ORDER.map((item) => (
              <option value={item} key={item}>
                {CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <div className="field-label">
          Yanıt seçenekleri <span>2–4 seçenek</span>
          <div className="composer-options">
            {options.map((option, index) => (
              <div className="composer-option" key={index}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <input
                  required
                  maxLength={120}
                  value={option}
                  onChange={(event) => updateOption(index, event.target.value)}
                  placeholder={`Seçenek ${index + 1}`}
                />
                <button
                  type="button"
                  className="icon-button"
                  disabled={options.length <= 2}
                  aria-label="Seçeneği kaldır"
                  onClick={() =>
                    setOptions((current) =>
                      current.filter((_, idx) => idx !== index),
                    )
                  }
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
          {options.length < 4 && (
            <button
              type="button"
              className="add-option"
              onClick={() => setOptions((current) => [...current, ""])}
            >
              <Plus size={14} /> Seçenek ekle
            </button>
          )}
        </div>
        <p className="form-disclaimer">
          <ShieldCheck size={15} /> Soru ve seçenekleri açık, dengeli ve saygılı
          tut.
        </p>
        <p className="form-disclaimer">
          <Sparkles size={15} /> Ücretsiz model kotası ve güvenilir sunucu
          zamanlayıcısı bağlı olmadığı için AI soru üretimi ve beş dakikalık
          otomatik üretim şu an kapalı; sorunu kendin yazabilirsin.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={onClose}
          >
            Vazgeç
          </button>
          <button
            className="button button-primary"
            disabled={saving || options.some((option) => !option.trim())}
          >
            {saving ? (
              <span className="spinner spinner-white" />
            ) : (
              <Send size={15} />
            )}{" "}
            Yayınla
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ProfileModal({
  username,
  displayName,
  saving,
  isCloud,
  isSignedIn,
  onClose,
  onSave,
  onAuth,
  onSignOut,
  onDeleteAccount,
}: {
  username: string;
  displayName: string;
  saving: boolean;
  isCloud: boolean;
  isSignedIn: boolean;
  onClose: () => void;
  onSave: (username: string, displayName: string) => void;
  onAuth: (mode: "signin" | "signup", email: string, password: string, acceptedTerms: boolean) => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}) {
  const [name, setName] = useState(username);
  const [label, setLabel] = useState(displayName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  return (
    <Modal
      title={
        isCloud
          ? "Profilini tamamla"
          : username
            ? "Profilini düzenle"
            : "Kullanıcı adını seç"
      }
      eyebrow="TOPLULUKTA SEN"
      onClose={onClose}
    >
      {isCloud && !isSignedIn ? (
        <div className="signin-panel">
          <div className="signin-icon">
            <UserRound size={24} />
          </div>
          <h3>{authMode === "signup" ? "Hesabını oluştur." : "Tekrar hoş geldin."}</h3>
          <p>
            E-posta adresinle {authMode === "signup" ? "kayıt ol" : "giriş yap"}. Kayıt sonrası Gmail hesabına doğrulama bağlantısı gönderilir.
          </p>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              onAuth(authMode, email, password, acceptedTerms);
            }}
          >
            <label className="field-label">
              E-posta adresi
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="sen@ornek.com"
                autoComplete="email"
              />
            </label>
            <label className="field-label">
              Şifre
              <input
                required
                minLength={8}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="En az 8 karakter"
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              />
              {authMode === "signup" && <small>Büyük/küçük harf, rakam ve özel karakter içermeli.</small>}
            </label>
            {authMode === "signup" && (
              <label className="consent-row">
                <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
                <span>
                  Kullanım Koşullarını (<Link to="/kullanim-kosullari">incele</Link>) kabul ediyorum. E-posta adresimin hesap doğrulama ve oturum açma amacıyla işlenmesine ilişkin <Link to="/gizlilik">Gizlilik ve KVKK Aydınlatma Metni</Link>ni okudum.
                </span>
              </label>
            )}
            <button className="button button-primary" disabled={saving}>
              {saving ? <span className="spinner spinner-white" /> : <LogIn size={16} />} {authMode === "signup" ? "Kayıt ol" : "Giriş yap"}
            </button>
          </form>
          <button type="button" className="text-button auth-switch" onClick={() => setAuthMode(authMode === "signup" ? "signin" : "signup")}>
            {authMode === "signup" ? "Zaten hesabın var mı? Giriş yap" : "Hesabın yok mu? Kayıt ol"}
          </button>
        </div>
      ) : (
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(name, label);
          }}
        >
          <label className="field-label">
            Kullanıcı adı
            <input
              required
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_]+"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="ornek_kullanici"
            />
            <small>3–30 karakter · küçük harf, sayı, alt çizgi</small>
          </label>
          <label className="field-label">
            Görünen ad
            <input
              maxLength={60}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Adın ya da takma adın"
            />
          </label>
          {!isCloud && (
            <p className="form-disclaimer">
              <CircleHelp size={15} /> Demo kullanıcı adın gerçek kimlik
              doğrulaması değildir. Veriler bu cihazda kalır.
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="button button-quiet"
              onClick={onClose}
            >
              Vazgeç
            </button>
            <button className="button button-primary" disabled={saving}>
              {saving ? (
                <span className="spinner spinner-white" />
              ) : (
                <Check size={15} />
              )}{" "}
              Kaydet
            </button>
          </div>
          {isCloud && isSignedIn && (
            <div className="account-danger-zone">
              <button type="button" className="text-button" onClick={onSignOut}>Oturumu kapat</button>
              <button type="button" className="danger-link" onClick={onDeleteAccount}>Hesabımı ve verilerimi sil</button>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}

function Modal({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <div>
            <span className="section-kicker">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button modal-close"
            onClick={onClose}
            aria-label="Kapat"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function MobileNav({
  onCreate,
  onProfile,
}: {
  onCreate: () => void;
  onProfile: () => void;
}) {
  return (
    <nav className="mobile-nav" aria-label="Mobil gezinme">
      <NavLink
        end
        to="/"
        className={({ isActive }) => (isActive ? "mobile-nav-active" : "")}
      >
        <Lightbulb size={20} />
        <span>Keşfet</span>
      </NavLink>
      <NavLink
        to="/trending"
        className={({ isActive }) => (isActive ? "mobile-nav-active" : "")}
      >
        <Flame size={20} />
        <span>Gündem</span>
      </NavLink>
      <button
        className="mobile-create"
        onClick={onCreate}
        aria-label="Anket aç"
      >
        <Plus size={22} />
      </button>
      <NavLink
        to="/leaderboard"
        className={({ isActive }) => (isActive ? "mobile-nav-active" : "")}
      >
        <TrendingUp size={20} />
        <span>Liderlik</span>
      </NavLink>
      <button onClick={onProfile} className="mobile-profile">
        <UserRound size={20} />
        <span>Profil</span>
      </button>
    </nav>
  );
}

function EmptyState({
  search,
  onCreate,
}: {
  search: string;
  onCreate: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">
        <Search size={24} />
      </div>
      <h3>
        {search
          ? "Bu aramada bir şey bulamadık."
          : "Bu başlıkta ilk sözü sen söyle."}
      </h3>
      <p>
        {search
          ? "Başka bir kelime ya da kategori deneyebilirsin."
          : "Yeni bir soru aç ve topluluğun fikrini al."}
      </p>
      {!search && (
        <button className="button button-primary" onClick={onCreate}>
          <Plus size={15} /> Anket oluştur
        </button>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="loading-state">
      <span className="spinner" />
      <span>Anketler yükleniyor…</span>
    </div>
  );
}

function NotFound() {
  return (
    <div className="page-state">
      <CircleHelp size={26} />
      <h2>Bu sayfayı bulamadık.</h2>
      <p>Adres değişmiş ya da kaldırılmış olabilir.</p>
      <Link to="/" className="button button-primary">
        Keşfete dön
      </Link>
    </div>
  );
}

function TermsPage() {
  return (
    <section className="subpage legal-page">
      <Link to="/" className="back-link"><ArrowLeft size={16} /> Keşfete dön</Link>
      <div className="subpage-overline"><ShieldCheck size={16} /> KULLANIM KOŞULLARI</div>
      <h1>Saygılı bir tartışma alanı.</h1>
      <p className="subpage-intro">Bu platforma giriş yaparak başkalarının görüşlerine saygı göstermeyi ve yalnızca yasal, kişisel veri içermeyen içerik paylaşmayı kabul edersin.</p>
      <div className="legal-copy">
        <h2>İçerik kuralları</h2>
        <p>Tehdit, nefret söylemi, ağır hakaret, taciz, kişisel veri ifşası, spam ve hukuka aykırı içerik paylaşma. İçerik kurallara aykırıysa kaldırılabilir ve hesabın kısıtlanabilir.</p>
        <h2>Hesap sorumluluğu</h2>
        <p>E-posta hesabınla yapılan işlemlerden sen sorumlusun. Şüpheli bir içeriği yorumdaki Bildir bağlantısından bildirebilirsin.</p>
        <h2>Hesap silme</h2>
        <p>Profil bölümündeki “Hesabımı ve verilerimi sil” işlemiyle hesabını ve sana bağlı verileri silebilirsin.</p>
      </div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <section className="subpage legal-page">
      <Link to="/" className="back-link"><ArrowLeft size={16} /> Keşfete dön</Link>
      <div className="subpage-overline"><ShieldCheck size={16} /> KVKK AYDINLATMA METNİ</div>
      <h1>Verin üzerinde söz sahibi ol.</h1>
      <p className="subpage-intro">E-posta adresin yalnızca hesap oluşturmak, e-posta doğrulaması yapmak ve oturum açmanı sağlamak amacıyla işlenir.</p>
      <div className="legal-copy">
        <h2>İşlenen veriler</h2>
        <p>E-posta adresi, seçtiğin kullanıcı adı, görünen ad, oyların, yorumların ve oluşturduğun anketler işlenebilir. Gereksiz kimlik, konum veya cihaz takibi yapılmaz.</p>
        <h2>Hakların</h2>
        <p>Hesabını ve ilişkili verilerini profil bölümünden silebilirsin. Verilerinin işlenmesiyle ilgili taleplerin için uygulama yöneticisine ulaşabilirsin.</p>
        <h2>Saklama ve güvenlik</h2>
        <p>Veriler yalnızca platformun çalışması, güvenlik ve moderasyon amacıyla gerekli olduğu ölçüde tutulur. Güvenlik kayıtları da amaçla sınırlı ve ölçülü şekilde saklanır.</p>
      </div>
    </section>
  );
}
