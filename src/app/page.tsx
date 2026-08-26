"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";

type Tab = "dashboard" | "achievements" | "posts" | "settings";

type Achievement = {
  id: string;
  title: string;
  details: string;
  category: string;
  project: string;
  evidenceUrl: string | null;
  isPublic: boolean;
  achievedAt: string;
  createdAt: string;
};

type Post = {
  id: string;
  title: string;
  content: string;
  postType: string;
  status: string;
  createdAt: string;
};
type DraftPreview = {
  content: string;
  postType: "one_off" | "weekly" | "monthly";
  achievementIds: string[];
};

type PendingGuestImport = {
  achievements: Achievement[];
  previewDraft: DraftPreview | null;
};

type UserSettings = {
  weeklyReminderEnabled: boolean;
  postTone: "professional" | "friendly" | "concise";
  postLength: "short" | "normal";
};

const pendingGuestImportKey = "progressly.pending-guest-import";

function createGuestAchievement(form: Omit<Achievement, "id" | "achievedAt" | "createdAt">): Achievement {
  const now = new Date().toISOString();
  return {
    ...form,
    id: `guest-${crypto.randomUUID()}`,
    achievedAt: now,
    createdAt: now,
  };
}

const categories = [
  { value: "project", label: "Project", icon: "✦" },
  { value: "learning", label: "Learning", icon: "◈" },
  { value: "work", label: "Work", icon: "▣" },
  { value: "university", label: "University", icon: "◌" },
  { value: "other", label: "Other", icon: "•" },
];

function isInCurrentDay(date: string) {
  const value = new Date(date);
  const today = new Date();


  return (
    value.getFullYear() === today.getFullYear() &&
    value.getMonth() === today.getMonth() &&
    value.getDate() === today.getDate()
  );
}

function isInLastDays(date: string, days: number) {
  const value = new Date(date).getTime();
  const now = Date.now();
  return value >= now - days * 24 * 60 * 60 * 1000;
}

function Dashboard() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedAchievementIds, setSelectedAchievementIds] = useState<
  string[]
>([]);
const [generatingPost, setGeneratingPost] = useState(false);
const [previewDraft, setPreviewDraft] = useState<DraftPreview | null>(null);
const [revisionRequest, setRevisionRequest] = useState("");
const [savingDraft, setSavingDraft] = useState(false);
  const [postError, setPostError] = useState("");
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailMessage, setTestEmailMessage] = useState("");
  const [settings, setSettings] = useState<UserSettings>({
    weeklyReminderEnabled: true,
    postTone: "professional",
    postLength: "normal",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const hasHandledPendingImport = useRef(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAchievement, setEditingAchievement] =
  useState<Achievement | null>(null);
  const [achievementToDelete, setAchievementToDelete] =
  useState<Achievement | null>(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [form, setForm] = useState({
    title: "",
    details: "",
    category: "project",
    project: "General",
    evidenceUrl: "",
    isPublic: false,
  });

  async function refreshData() {
    const [achievementResult, postResult] = await Promise.all([
      fetch("/api/achievements"),
      fetch("/api/posts"),
    ]);

    const achievementData = await achievementResult.json();
    const postData = await postResult.json();

    setAchievements(achievementData.achievements ?? []);
    setPosts(postData.posts ?? []);
  }

  useEffect(() => {
    if (status === "authenticated") {
      const importPendingGuestData = async () => {
        if (hasHandledPendingImport.current) {
          await refreshData();
          return;
        }

        hasHandledPendingImport.current = true;
        const stored = window.sessionStorage.getItem(pendingGuestImportKey);

        if (!stored) {
          await refreshData();
          return;
        }

        try {
          const pending: PendingGuestImport = JSON.parse(stored);
          const achievementImports = Array.isArray(pending.achievements)
            ? pending.achievements.map((achievement) =>
                fetch("/api/achievements", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: achievement.title,
                    details: achievement.details,
                    category: achievement.category,
                    project: achievement.project,
                    evidenceUrl: achievement.evidenceUrl,
                    isPublic: achievement.isPublic,
                    achievedAt: achievement.achievedAt,
                  }),
                })
              )
            : [];
          const draftImport = pending.previewDraft?.content.trim()
            ? [
                fetch("/api/posts", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    content: pending.previewDraft.content,
                    postType: pending.previewDraft.postType,
                  }),
                }),
              ]
            : [];
          const results = await Promise.all([...achievementImports, ...draftImport]);

          if (results.every((result) => result.ok)) {
            window.sessionStorage.removeItem(pendingGuestImportKey);
            setPreviewDraft(null);
            setSelectedAchievementIds([]);
            setRevisionRequest("");
          } else {
            hasHandledPendingImport.current = false;
          }
        } catch {
          hasHandledPendingImport.current = false;
        }

        await refreshData();
      };

      void importPendingGuestData();
    } else if (status === "unauthenticated") {
      window.sessionStorage.removeItem(pendingGuestImportKey);
      setAchievements([]);
      setPosts([]);
      setPreviewDraft(null);
      setSelectedAchievementIds([]);
      setRevisionRequest("");
    }
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const loadSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load settings.");
        setSettings(data.settings);
      } catch (error) {
        setSettingsMessage(
          error instanceof Error ? error.message : "Could not load settings."
        );
      }
    };

    void loadSettings();
  }, [status]);

  const stats = useMemo(
    () => ({
      today: achievements.filter((item) =>
        isInCurrentDay(item.achievedAt)
      ).length,
      week: achievements.filter((item) =>
        isInLastDays(item.achievedAt, 7)
      ).length,
      month: achievements.filter((item) =>
        isInLastDays(item.achievedAt, 30)
      ).length,
    }),
    [achievements]
  );

  if (status === "loading") {
    return <main className="career-app light auth-screen">Loading...</main>;
  }

  const isSignedIn = Boolean(session?.user);
  const userName = session?.user?.name || session?.user?.email || "Guest";
  const userInitials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase();

  function clearPendingGuestImport() {
    window.sessionStorage.removeItem(pendingGuestImportKey);
  }

  async function startGoogleSignIn() {
    if (!isSignedIn) {
      const pending: PendingGuestImport = { achievements, previewDraft };
      window.sessionStorage.setItem(pendingGuestImportKey, JSON.stringify(pending));
    }

    try {
      const result = await signIn("google");
      if (result?.error) clearPendingGuestImport();
    } catch {
      clearPendingGuestImport();
    }
  }

  async function sendTestEmail() {
    if (!isSignedIn || sendingTestEmail) return;

    setSendingTestEmail(true);
    setTestEmailMessage("");

    try {
      const response = await fetch("/api/email/test", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not send the test email.");
      }

      setTestEmailMessage("Test email sent. Check your inbox.");
    } catch (error) {
      setTestEmailMessage(
        error instanceof Error ? error.message : "Could not send the test email."
      );
    } finally {
      setSendingTestEmail(false);
    }
  }

  async function saveSettings() {
    if (!isSignedIn || savingSettings) return;

    setSavingSettings(true);
    setSettingsMessage("");

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save settings.");

      setSettings(data.settings);
      setSettingsMessage("Settings saved.");
    } catch (error) {
      setSettingsMessage(
        error instanceof Error ? error.message : "Could not save settings."
      );
    } finally {
      setSavingSettings(false);
    }
  }

  function openNewAchievement() {
  setEditingAchievement(null);
  setForm({
    title: "",
    details: "",
    category: "project",
    project: "General",
    evidenceUrl: "",
    isPublic: false,
  });
  setIsFormOpen(true);
}

function openEditAchievement(item: Achievement) {
  setEditingAchievement(item);
  setForm({
    title: item.title,
    details: item.details,
    category: item.category,
    project: item.project,
    evidenceUrl: item.evidenceUrl ?? "",
    isPublic: item.isPublic,
  });
  setIsFormOpen(true);
}

function closeAchievementModal() {
  setIsFormOpen(false);
  setEditingAchievement(null);
}

function askToDelete(item: Achievement) {
  setAchievementToDelete(item);
}

async function confirmDelete() {
  if (!achievementToDelete) return;

  setLoading(true);

  try {
    if (isSignedIn) {
      await fetch(`/api/achievements?id=${achievementToDelete.id}`, { method: "DELETE" });
    } else {
      const nextAchievements = achievements.filter((item) => item.id !== achievementToDelete.id);
      setAchievements(nextAchievements);
    }

    setAchievementToDelete(null);
    if (isSignedIn) await refreshData();
  } finally {
    setLoading(false);
  }
}

  async function addAchievement(event: FormEvent) {
    event.preventDefault();

    if (!form.title.trim() || loading) return;

    setLoading(true);

    try {
      if (!isSignedIn) {
        const nextAchievement = editingAchievement
          ? { ...editingAchievement, ...form }
          : createGuestAchievement(form);
        const nextAchievements = editingAchievement
          ? achievements.map((item) => item.id === editingAchievement.id ? nextAchievement : item)
          : [nextAchievement, ...achievements];

        setAchievements(nextAchievements);
        setIsFormOpen(false);
        setEditingAchievement(null);
        return;
      }

      const response = await fetch("/api/achievements", {
      method: editingAchievement ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
        editingAchievement
        ? { ...form, id: editingAchievement.id }
        : form
      ),
      });

      if (!response.ok) {
        throw new Error("Could not save achievement.");
      }

      setForm({
        title: "",
        details: "",
        category: "project",
        project: "General",
        evidenceUrl: "",
        isPublic: false,
      });

      setIsFormOpen(false);
      setEditingAchievement(null);
      await refreshData();
    } catch {
      setPostError("Could not save the achievement. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  }
function toggleAchievementSelection(id: string) {
  setSelectedAchievementIds((current) =>
    current.includes(id)
      ? current.filter((itemId) => itemId !== id)
      : [...current, id]
  );
}

async function generatePost(
  postType: "one_off" | "weekly" | "monthly",
  options: { achievementIds?: string[]; revisionRequest?: string } = {}
) {
  setPostError("");

  const automaticIds =
    postType === "weekly"
      ? achievements
          .filter((item) => isInLastDays(item.achievedAt, 7))
          .map((item) => item.id)
      : postType === "monthly"
        ? achievements
            .filter((item) => isInLastDays(item.achievedAt, 30))
            .map((item) => item.id)
        : [];

  const achievementIds =
    options.achievementIds ??
    (selectedAchievementIds.length > 0
      ? selectedAchievementIds
      : automaticIds);

  if (achievementIds.length === 0) {
    setPostError(
      "Select an achievement first, or add an achievement for this period."
    );
    return;
  }

  setGeneratingPost(true);

  try {
    const response = await fetch("/api/posts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
body: JSON.stringify({
  achievementIds,
  postType,
  revisionRequest: options.revisionRequest ?? "",
  ...(!isSignedIn
    ? { guestAchievements: achievements.filter((item) => achievementIds.includes(item.id)) }
    : {}),
}),    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Could not generate the post.");
    }
setPreviewDraft({
  content: data.content,
  postType: data.postType,
  achievementIds: data.achievementIds,
});
setRevisionRequest("");
  } catch (error) {
    setPostError(
      error instanceof Error ? error.message : "Could not generate post."
    );
  } finally {
    setGeneratingPost(false);
  }
}

async function approveDraft() {
  if (!previewDraft || !previewDraft.content.trim()) return;

  if (!isSignedIn) {
    setShowSignInModal(true);
    return;
  }

  setSavingDraft(true);

  try {
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: previewDraft.content,
        postType: previewDraft.postType,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Could not save the draft.");
    }

    setPosts((current) => [data.post, ...current]);
    setPreviewDraft(null);
    setRevisionRequest("");
    setSelectedAchievementIds([]);
  } catch (error) {
    setPostError(
      error instanceof Error ? error.message : "Could not save draft."
    );
  } finally {
    setSavingDraft(false);
  }
}

function closePreview() {
  setPreviewDraft(null);
  setRevisionRequest("");
  setPostError("");
}

  const navItems: { id: Tab; label: string; icon: string }[] = [
    { id: "dashboard", label: "Overview", icon: "◫" },
    { id: "achievements", label: "Achievements", icon: "✦" },
    { id: "posts", label: "Post studio", icon: "↗" },
    { id: "settings", label: "Settings", icon: "⚙" },
  ];

  return (
    <main className={`career-app ${theme}`}>
      <header className="career-topbar">
        <button
          className="career-logo"
          onClick={() => setActiveTab("dashboard")}
        >
          <span>✦</span>
          Progressly
        </button>

        <nav className="career-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={activeTab === item.id ? "active" : ""}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="career-user-actions">
          <button
            className="theme-toggle"
            onClick={() =>
              setTheme((current) =>
                current === "light" ? "dark" : "light"
              )
            }
            aria-label="Toggle theme"
          >
            {theme === "light" ? "☾" : "☀"}
          </button>

          {isSignedIn && session?.user?.image ? (
            <img
              className="user-avatar user-avatar-image"
              src={session.user.image}
              alt={`${userName}'s profile`}
            />
          ) : isSignedIn ? (
            <div className="user-avatar" aria-label={userName}>
              {userInitials}
            </div>
          ) : null}

          {isSignedIn ? (
            <button className="sign-out-button" onClick={() => signOut()}>
              Sign out
            </button>
          ) : (
            <button className="sign-in-button" onClick={() => void startGoogleSignIn()}>
              Sign in to save
            </button>
          )}
        </div>
      </header>

<section className="career-content" key={activeTab}>
          {activeTab === "dashboard" && (
          <>
          <div className="page-heading dashboard-hero">
            <div className="hero-copy">
              <p className="section-label">Your record</p>

              <h1>
                Every win,
                <span> logged.</span>
              </h1>

              <div className="hero-chips">
                <span>✦ Private</span>
                <span>↗ Share-ready</span>
              </div>
            </div>

            <div className="hero-side">
              <div className="hero-seal">
                <svg viewBox="0 0 200 200" aria-hidden="true">
                  <circle className="seal-track" cx="100" cy="100" r="86" />
                  <circle className="seal-ring" cx="100" cy="100" r="70" />
                  <path
                    id="sealTextPath"
                    d="M100,100 m-82,0 a82,82 0 1,1 164,0 a82,82 0 1,1 -164,0"
                    fill="none"
                  />
                  <text className="seal-text">
                    <textPath href="#sealTextPath" startOffset="0%">
                      PROGRESSLY · VERIFIED CAREER RECORD · PROGRESSLY · VERIFIED CAREER RECORD ·
                    </textPath>
                  </text>
                </svg>

                <div className="seal-center">
                  <strong>{achievements.length}</strong>
                  <small>entries logged</small>
                </div>
              </div>

              <button
                className="primary-button hero-add-button"
                onClick={openNewAchievement}
              >
                <span>+</span> Add achievement
              </button>
            </div>
          </div>


  <div className="hero-side">
    <div className="weekly-orbit">
      <svg viewBox="0 0 180 180" aria-hidden="true">
        <circle className="orbit-track" cx="90" cy="90" r="70" />
        <circle
          className="orbit-progress"
          cx="90"
          cy="90"
          r="70"
          pathLength="100"
          strokeDasharray="72 100"
        />
      </svg>

      <div className="orbit-copy">
        <small>This week</small>
        <strong>{stats.week}</strong>
        <span>wins captured</span>
      </div>
    </div>

    <button className="primary-button hero-add-button" onClick={openNewAchievement}>
      <span>+</span> Add achievement
    </button>
  </div>

            <div className="stat-grid">
              <article className="stat-card accent-purple">
                <span>Today</span>
                <b>{stats.today}</b>
                <p>achievements recorded</p>
              </article>

              <article className="stat-card accent-blue">
                <span>This week</span>
                <b>{stats.week}</b>
                <p>real wins to review Sunday</p>
              </article>

              <article className="stat-card accent-green">
                <span>This month</span>
                <b>{stats.month}</b>
                <p>steps in your growth story</p>
              </article>
            </div>

            <section className="dashboard-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-label">RECENT PROGRESS</p>
                  <h2>Your latest achievements</h2>
                </div>

                <button
                  className="text-button"
                  onClick={() => setActiveTab("achievements")}
                >
                  View all →
                </button>
              </div>

              {achievements.length === 0 ? (
                <div className="empty-state">
                  <div>✦</div>
                  <h3>Your progress starts here.</h3>
                  <p>
                    Add a completed task, solved problem, or skill you learned.
                  </p>
                  <button
                    className="secondary-button"
                    onClick={openNewAchievement}
                  >
                    Add your first achievement
                  </button>
                </div>
              ) : (
                <div className="recent-list">
                  {achievements.slice(0, 5).map((item) => (
                    <article className="progress-row" key={item.id}>
                      <div className="progress-icon">
                        {
                          categories.find(
                            (category) => category.value === item.category
                          )?.icon
                        }
                      </div>

                      <div className="progress-copy">
                        <h3>{item.title}</h3>
                        <p>
                          {item.project} · {formatDate(item.achievedAt)}
                        </p>
                      </div>

                      <span
                        className={
                          item.isPublic ? "visibility public" : "visibility"
                        }
                      >
                        {item.isPublic ? "Public" : "Private"}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === "achievements" && (
          <>
            <div className="page-heading compact">
              <div>
                <p className="section-label">ACHIEVEMENT VAULT</p>
                <h1>Every real win, in one place.</h1>
              </div>

              <button
                className="primary-button"
                onClick={openNewAchievement}
              >
                <span>+</span> Add achievement
              </button>
            </div>

            <div className="achievement-list">
              {achievements.length === 0 ? (
                <div className="empty-state">
                  <h3>No achievements yet.</h3>
                  <p>Add your first completed task to start your vault.</p>
                </div>
              ) : (
                achievements.map((item) => (
                  <article className="full-achievement-card" key={item.id}>
                    <div className="progress-icon">
                      {
                        categories.find(
                          (category) => category.value === item.category
                        )?.icon
                      }
                    </div>

                    <div>
                      <div className="card-title-line">
                        <h2>{item.title}</h2>
                        <span className="category-tag">{item.category}</span>
                      </div>

                      <p>{item.details}</p>

                      <small>
                        {item.project} · {formatDate(item.achievedAt)}
                      </small>
                      <div className="achievement-actions">
  <button onClick={() => openEditAchievement(item)}>
    Edit
  </button>

  <button
    className="delete-action"
    onClick={() => askToDelete(item)}  >
    Delete
  </button>
</div>

                      {item.evidenceUrl && (
                        <a
                          href={item.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View evidence ↗
                        </a>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </>
        )}

  {activeTab === "posts" && (
  <section className="dashboard-panel post-studio">
    <p className="section-label">AI POST STUDIO</p>
    <h1>Turn real progress into a LinkedIn story.</h1>

    <p className="post-studio-text">
      Select specific achievements, or let Progressly use your confirmed
      achievements from this week or month.
    </p>

    {!previewDraft && <div className="post-generator-layout">
      <div className="post-selector">
        <div className="selector-heading">
          <b>Select achievements</b>
          <span>{selectedAchievementIds.length} selected</span>
        </div>

        {achievements.length === 0 ? (
          <p className="selector-empty">
            Add achievements first, then create your first post.
          </p>
        ) : (
          <div className="selector-list">
            {achievements.map((item) => (
              <label className="selector-item" key={item.id}>
                <input
                  type="checkbox"
                  checked={selectedAchievementIds.includes(item.id)}
                  onChange={() => toggleAchievementSelection(item.id)}
                />

                <span className="selector-check">✓</span>

                <span>
                  <b>{item.title}</b>
                  <small>
                    {item.project} · {formatDate(item.achievedAt)}
                  </small>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="generation-actions">
        <p>Choose how you want to turn your progress into a post.</p>

        <button
          className="primary-button"
          disabled={generatingPost}
          onClick={() => generatePost("one_off")}
        >
          {generatingPost
            ? "Generating..."
            : "Generate from selected achievements"}
        </button>

        <button
          className="secondary-button"
          disabled={generatingPost}
          onClick={() => generatePost("weekly")}
        >
          Prepare weekly post
        </button>

        <button
          className="secondary-button"
          disabled={generatingPost}
          onClick={() => generatePost("monthly")}
        >
          Prepare monthly post
        </button>

        <small>
          Weekly and monthly posts use selected achievements first. If none
          are selected, they use confirmed achievements from that period.
        </small>

        {postError && <p className="post-error">{postError}</p>}
      </div>
    </div>}
{previewDraft && (
  <div className="modal-backdrop" onClick={closePreview}>
    <section
      className="post-review-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-review-title"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        className="close-button post-review-close"
        type="button"
        onClick={closePreview}
        aria-label="Close post preview without saving"
      >
        ×
      </button>
    <div className="preview-heading">
      <div>
        <p className="section-label">REVIEW BEFORE SAVING</p>
        <h2 id="post-review-title">Your LinkedIn post preview</h2>
      </div>

      <span>{previewDraft.postType.replace("_", " ")} post</span>
    </div>

    <textarea
      className="draft-editor"
      value={previewDraft.content}
      onChange={(event) => {
        const nextPreview = {
          ...previewDraft,
          content: event.target.value,
        };
        setPreviewDraft(nextPreview);
      }}
    />

    <label className="revision-label">
      Anything you want changed before approval?
      <input
        value={revisionRequest}
        onChange={(event) => setRevisionRequest(event.target.value)}
        placeholder="Example: Make it shorter and more technical."
      />
    </label>

    {postError && <p className="post-error">{postError}</p>}

    <div className="preview-actions">
      <button
        className="secondary-button"
        disabled={generatingPost || savingDraft}
        onClick={() =>
          generatePost(previewDraft.postType, {
            achievementIds: previewDraft.achievementIds,
          })
        }
      >
        {generatingPost ? "Rewriting..." : "Rewrite from scratch"}
      </button>

      <button
        className="primary-button"
        disabled={
          generatingPost || savingDraft || !revisionRequest.trim()
        }
        onClick={() =>
          generatePost(previewDraft.postType, {
            achievementIds: previewDraft.achievementIds,
            revisionRequest: revisionRequest.trim(),
          })
        }
      >
        {generatingPost ? "Applying..." : "Apply requested changes"}
      </button>

      <button
        className="primary-button"
        disabled={generatingPost || savingDraft || !previewDraft.content.trim()}
        onClick={approveDraft}
      >
        {savingDraft ? "Saving..." : "Approve & save draft"}
      </button>
    </div>
    </section>
  </div>
)}

    <div className="drafts-heading">
      <div>
        <p className="section-label">SAVED DRAFTS</p>
        <h2>Your generated LinkedIn posts</h2>
      </div>
    </div>

    {posts.length === 0 ? (
      <div className="empty-state post-empty">
        <div>↗</div>
        <h3>No LinkedIn drafts yet.</h3>
        <p>Your first draft will appear here after generation.</p>
      </div>
    ) : (
      <div className="draft-list">
        {posts.map((post) => (
          <article className="draft-card" key={post.id}>
            <div className="draft-meta">
              <span>{post.postType.replace("_", " ")} post</span>
              <small>{formatDate(post.createdAt)}</small>
            </div>

            <p>{post.content}</p>

            <span className="draft-status">
              {post.status.replace("_", " ")}
            </span>
          </article>
        ))}
      </div>
    )}
  </section>
)}

        {activeTab === "settings" && (
          <section className="dashboard-panel settings-panel">
            <p className="section-label">SETTINGS</p>
            <h1>Your account settings</h1>

            <div className="setting-line">
              <div>
                <b>Google account</b>
                <p>{isSignedIn ? "Your achievements are securely saved to your account." : "Sign in to save your progress across devices."}</p>
              </div>
              <span>{isSignedIn ? "Connected" : "Guest mode"}</span>
            </div>

            <div className="setting-line">
              <div>
                <b>LinkedIn connection</b>
                <p>You will always approve a post before publishing.</p>
              </div>
              <span>Not connected</span>
            </div>

            {isSignedIn && (
              <>
                <div className="setting-line">
                  <div>
                    <b>Weekly email reminders</b>
                    <p>Receive an email when your weekly draft is ready.</p>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={settings.weeklyReminderEnabled}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          weeklyReminderEnabled: event.target.checked,
                        })
                      }
                    />
                    <span>{settings.weeklyReminderEnabled ? "On" : "Off"}</span>
                  </label>
                </div>

                <div className="setting-line settings-style-line">
                  <div>
                    <b>Post style</b>
                    <p>Choose how your LinkedIn drafts should sound.</p>
                  </div>
                  <div className="settings-selectors">
                    <label>
                      Tone
                      <select
                        value={settings.postTone}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            postTone: event.target.value as UserSettings["postTone"],
                          })
                        }
                      >
                        <option value="professional">Professional</option>
                        <option value="friendly">Friendly</option>
                        <option value="concise">Concise</option>
                      </select>
                    </label>
                    <label>
                      Length
                      <select
                        value={settings.postLength}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            postLength: event.target.value as UserSettings["postLength"],
                          })
                        }
                      >
                        <option value="short">Short</option>
                        <option value="normal">Normal</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="setting-line">
                  <div>
                    <b>Email delivery</b>
                    <p>Send a test message to your signed-in email address.</p>
                    {testEmailMessage && (
                      <p className="test-email-message" role="status">
                        {testEmailMessage}
                      </p>
                    )}
                    {settingsMessage && (
                      <p className="test-email-message" role="status">
                        {settingsMessage}
                      </p>
                    )}
                  </div>
                  <div className="settings-actions">
                    <button
                      className="secondary-button settings-email-button"
                      disabled={sendingTestEmail}
                      onClick={() => void sendTestEmail()}
                    >
                      {sendingTestEmail ? "Sending..." : "Send test email"}
                    </button>
                    <button
                      className="primary-button settings-email-button"
                      disabled={savingSettings}
                      onClick={() => void saveSettings()}
                    >
                      {savingSettings ? "Saving..." : "Save settings"}
                    </button>
                  </div>
                </div>
              </>
            )}

          </section>
        )}
      </section>

      {isFormOpen && (
        <div className="modal-backdrop" onClick={() => setIsFormOpen(false)}>
          <section
            className="achievement-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="section-label">NEW ACHIEVEMENT</p>
<h2>
  {editingAchievement ? "Edit achievement" : "What did you accomplish today?"}
</h2>              </div>

              <button
                className="close-button"
                onClick={() => setIsFormOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={addAchievement}>
              <label>
                Achievement title *
                <input
                  autoFocus
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  placeholder="Completed a project milestone"
                />
              </label>

              <label>
                Describe the project, task, problem you solved, or skill you learned.
                <textarea
                  value={form.details}
                  onChange={(event) =>
                    setForm({ ...form, details: event.target.value })
                  }
                  placeholder="Explain what you did, the outcome, or what you learned."
                />
              </label>

              <div className="form-two-columns">
                <label>
                  Category
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm({ ...form, category: event.target.value })
                    }
                  >
                    {categories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Project / area
                  <input
                    value={form.project}
                    onChange={(event) =>
                      setForm({ ...form, project: event.target.value })
                    }
                    placeholder="General"
                  />
                </label>
              </div>

              <label>
                Evidence link <span>(optional)</span>
                <input
                  type="url"
                  value={form.evidenceUrl}
                  onChange={(event) =>
                    setForm({ ...form, evidenceUrl: event.target.value })
                  }
                  placeholder="GitHub, demo, certificate..."
                />
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={(event) =>
                    setForm({ ...form, isPublic: event.target.checked })
                  }
                />
                Make this achievement public on my future profile
              </label>

              <button className="primary-button submit-button" disabled={loading}>
                {loading
  ? "Saving..."
  : editingAchievement
    ? "Save changes"
    : "Save achievement"}
              </button>
            </form>
          </section>
        </div>
      )}
      {achievementToDelete && (
  <div
    className="modal-backdrop"
    onClick={() => setAchievementToDelete(null)}
  >
    <section
      className="delete-modal"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="delete-modal-icon">!</div>

      <h2>Delete achievement?</h2>

      <p>
        “{achievementToDelete.title}” will be removed permanently from
        your achievement vault.
      </p>

      <div className="delete-modal-actions">
        <button
          className="secondary-button"
          onClick={() => setAchievementToDelete(null)}
          disabled={loading}
        >
          Keep it
        </button>

        <button
          className="danger-button"
          onClick={confirmDelete}
          disabled={loading}
        >
          {loading ? "Deleting..." : "Delete achievement"}
        </button>
      </div>
    </section>
  </div>
)}
      {showSignInModal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            clearPendingGuestImport();
            setShowSignInModal(false);
          }}
        >
          <section
            className="sign-in-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sign-in-save-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="section-label">SAVE YOUR PROGRESS</p>
            <h2 id="sign-in-save-title">Keep this draft with you.</h2>
            <p>Sign in with Google to save this draft and access it from any device.</p>
            <div className="sign-in-modal-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  clearPendingGuestImport();
                  setShowSignInModal(false);
                }}
              >
                Cancel
              </button>
              <button className="primary-button" onClick={() => void startGoogleSignIn()}>
                Continue with Google
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <Dashboard />
    </SessionProvider>
  );
}
