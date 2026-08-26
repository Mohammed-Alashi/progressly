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

function createGuestAchievement(
  form: Omit<Achievement, "id" | "achievedAt" | "createdAt">
): Achievement {
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
  const [selectedAchievementIds, setSelectedAchievementIds] = useState<string[]>([]);
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
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [achievementToDelete, setAchievementToDelete] = useState<Achievement | null>(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [hasChosenGuest, setHasChosenGuest] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [vaultSearch, setVaultSearch] = useState("");
  const [vaultCategory, setVaultCategory] = useState("all");
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);

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

  useEffect(() => {
    if (status === "unauthenticated") {
      setHasChosenGuest(
        window.sessionStorage.getItem("progressly.guest-mode") === "true"
      );
    }

    if (status !== "authenticated") return;

    const loadProfile = async () => {
      const response = await fetch("/api/profile");
      const data = await response.json();

      if (response.ok && data.user) {
        setProfileName(data.user.name ?? "");
        setProfileNameInput(data.user.name ?? "");
        setProfileEmail(data.user.email ?? "");
      }
    };

    void loadProfile();
  }, [status]);

  const stats = useMemo(
    () => ({
      today: achievements.filter((item) => isInCurrentDay(item.achievedAt)).length,
      week: achievements.filter((item) => isInLastDays(item.achievedAt, 7)).length,
      month: achievements.filter((item) => isInLastDays(item.achievedAt, 30)).length,
      total: achievements.length,
      publicCount: achievements.filter((item) => item.isPublic).length,
    }),
    [achievements]
  );

  // 7-day breakdown for momentum chart
  const weeklyChartData = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const count = achievements.filter((a) => {
        const aDate = new Date(a.achievedAt).toISOString().split("T")[0];
        return aDate === dateStr;
      }).length;
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      days.push({ dayName, dateStr, count });
    }
    const maxCount = Math.max(...days.map((d) => d.count), 1);
    return { days, maxCount };
  }, [achievements]);

  // Weekly cadence percentage (target 5 wins/week)
  const weeklyCadencePercent = useMemo(() => {
    const target = 5;
    return Math.min(100, Math.round((stats.week / target) * 100));
  }, [stats.week]);

  // Filtered vault items
  const filteredAchievements = useMemo(() => {
    return achievements.filter((item) => {
      const matchesCategory =
        vaultCategory === "all" || item.category === vaultCategory;
      const matchesSearch =
        vaultSearch.trim() === "" ||
        item.title.toLowerCase().includes(vaultSearch.toLowerCase()) ||
        item.details.toLowerCase().includes(vaultSearch.toLowerCase()) ||
        item.project.toLowerCase().includes(vaultSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [achievements, vaultCategory, vaultSearch]);

  if (status === "loading") {
    return <main className="auth-screen-loading">Initializing Progressly Workspace...</main>;
  }

  const isSignedIn = Boolean(session?.user);
  const userName =
    profileName || session?.user?.name || session?.user?.email || "Guest User";
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

      setTestEmailMessage("✓ Test email sent! Check your inbox.");
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
      setSettingsMessage("✓ Settings successfully saved.");
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
        const nextAchievements = achievements.filter(
          (item) => item.id !== achievementToDelete.id
        );
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
          ? achievements.map((item) =>
              item.id === editingAchievement.id ? nextAchievement : item
            )
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

  function selectAllWeekly() {
    const ids = achievements
      .filter((item) => isInLastDays(item.achievedAt, 7))
      .map((item) => item.id);
    setSelectedAchievementIds(ids);
  }

  function clearSelection() {
    setSelectedAchievementIds([]);
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
            ? {
                guestAchievements: achievements.filter((item) =>
                  achievementIds.includes(item.id)
                ),
              }
            : {}),
        }),
      });

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

  async function deleteSavedPost(id: string) {
    if (!isSignedIn) {
      setPosts((current) => current.filter((p) => p.id !== id));
      return;
    }

    try {
      const response = await fetch(`/api/posts?id=${id}`, { method: "DELETE" });
      if (response.ok) {
        setPosts((current) => current.filter((p) => p.id !== id));
      }
    } catch {
      // silent catch
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedDraftId(id);
    setTimeout(() => setCopiedDraftId(null), 2000);
  }

  function continueAsGuest() {
    window.sessionStorage.setItem("progressly.guest-mode", "true");
    setShowGuestModal(false);
    setHasChosenGuest(true);
  }

  async function saveProfileName() {
    if (!isSignedIn || savingProfile) return;

    setSavingProfile(true);
    setProfileMessage("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileNameInput }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not update your name.");
      }

      setProfileName(data.user.name);
      setProfileNameInput(data.user.name);
      setProfileMessage("✓ Name successfully updated.");
    } catch (error) {
      setProfileMessage(
        error instanceof Error ? error.message : "Could not update your name."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  const navItems: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: "dashboard", label: "Overview", icon: "◫" },
    { id: "achievements", label: "Achievement Vault", icon: "✦", badge: achievements.length },
    { id: "posts", label: "AI Post Studio", icon: "↗", badge: posts.length },
    { id: "settings", label: "Settings", icon: "⚙" },
  ];

  const showEntry = !isSignedIn && !hasChosenGuest;

  if (showEntry) {
    return (
      <main className={`career-app ${theme} entry-screen`}>
        <header className="entry-navbar">
          <div className="sidebar-brand">
            <div className="brand-icon-wrapper">✦</div>
            <div className="brand-text">
              <span className="brand-name">Progressly</span>
              <span className="brand-badge">Career AI</span>
            </div>
          </div>

          <div className="topbar-right">
            <button
              className="theme-toggle-btn"
              onClick={() => setTheme((c) => (c === "light" ? "dark" : "light"))}
              aria-label="Toggle theme"
            >
              {theme === "light" ? "☾ Dark" : "☀ Light"}
            </button>

            <button
              className="primary-button"
              onClick={() => void startGoogleSignIn()}
            >
              Sign in with Google
            </button>
          </div>
        </header>

        <section className="entry-hero-section">
          <div className="entry-hero-copy">
            <p className="section-label">EVIDENCE-BASED CAREER PROGRESSION</p>
            <h1>
              Your real achievements, <span>transformed into influence.</span>
            </h1>
            <p>
              Stop prompting AI with vague ideas. Progressly logs your verified work,
              milestones, and solved problems, then crafts high-impact LinkedIn post
              drafts that represent you accurately.
            </p>

            <div className="entry-hero-cta">
              <button
                className="primary-button"
                onClick={() => void startGoogleSignIn()}
              >
                Get Started Free with Google →
              </button>

              <button
                className="secondary-button"
                onClick={() => setShowGuestModal(true)}
              >
                Explore as Guest
              </button>
            </div>
          </div>

          <div className="entry-preview-card">
            <div className="kpi-top">
              <span className="section-label">LIVE PREVIEW</span>
              <span className="brand-badge">Evidence Studio</span>
            </div>
            <div className="activity-list" style={{ marginTop: 16 }}>
              <div className="activity-item">
                <div className="activity-left">
                  <div className="activity-cat-icon">✦</div>
                  <div className="activity-details">
                    <h4>Shipped serverless query optimization</h4>
                    <p>
                      <span className="project-pill">Production</span>
                      Reduced latency by 45% using Postgres indexing
                    </p>
                  </div>
                </div>
                <span className="activity-tag public">Verified</span>
              </div>

              <div className="activity-item">
                <div className="activity-left">
                  <div className="activity-cat-icon">◈</div>
                  <div className="activity-details">
                    <h4>Completed Advanced Distributed Systems</h4>
                    <p>
                      <span className="project-pill">Learning</span>
                      Consensus protocols & Raft implementation
                    </p>
                  </div>
                </div>
                <span className="activity-tag">Internal</span>
              </div>
            </div>

            <div className="kpi-card" style={{ marginTop: 20 }}>
              <div className="kpi-top">
                <span className="kpi-title">AI LinkedIn Composer</span>
                <span className="ai-engine-tag"><span>●</span> Ready to Publish</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "8px 0 0 0", lineHeight: 1.5 }}>
                “This week, I focused on database efficiency and lowered query latency by 45% in our serverless environment. Engineering progress is about continuous iteration...”
              </p>
            </div>
          </div>
        </section>

        <section className="entry-features-grid">
          <div className="entry-feature-card">
            <div className="entry-feature-icon">✦</div>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 700 }}>Evidence Vault</h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Capture real wins, code links, and learning milestones daily.</p>
            </div>
          </div>

          <div className="entry-feature-card">
            <div className="entry-feature-icon">◈</div>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 700 }}>Growth Momentum</h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Track your weekly velocity and career progress charts in real time.</p>
            </div>
          </div>

          <div className="entry-feature-card">
            <div className="entry-feature-icon">↗</div>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 700 }}>AI Post Composer</h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Turn verified achievements into concise, factual LinkedIn posts.</p>
            </div>
          </div>
        </section>

        {showGuestModal && (
          <div className="modal-backdrop" onClick={() => setShowGuestModal(false)}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Continue as Guest?</h2>
                <button
                  className="modal-close-btn"
                  onClick={() => setShowGuestModal(false)}
                >
                  ×
                </button>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px 0" }}>
                Guest mode saves your achievements to this browser session. You can sign in with Google at any time to permanently back up your progress to your private account.
              </p>
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => void startGoogleSignIn()}>
                  Sign in with Google
                </button>
                <button className="primary-button" onClick={continueAsGuest}>
                  Continue as Guest
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className={`career-app ${theme}`}>
      {/* SIDEBAR NAVIGATION */}
      <aside className={`app-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <button
            className="sidebar-brand"
            onClick={() => setActiveTab("dashboard")}
          >
            <div className="brand-icon-wrapper">✦</div>
            <div className="brand-text">
              <span className="brand-name">Progressly</span>
              <span className="brand-badge">Career Copilot</span>
            </div>
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Workspace</div>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`sidebar-nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => {
                setActiveTab(item.id);
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {typeof item.badge === "number" && item.badge > 0 && (
                <span className="nav-counter">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-mini-card">
            {isSignedIn && session?.user?.image ? (
              <div className="user-avatar-small">
                <img
                  className="user-avatar-image-small"
                  src={session.user.image}
                  alt={userName}
                />
              </div>
            ) : (
              <div className="user-avatar-small">{userInitials}</div>
            )}
            <div className="user-mini-info">
              <div className="user-mini-name">{userName}</div>
              <div className="user-mini-status">
                <span className={`status-dot ${isSignedIn ? "" : "guest"}`}></span>
                {isSignedIn ? "Connected" : "Guest Mode"}
              </div>
            </div>
          </div>

          <div className="sidebar-controls">
            <button
              className="theme-toggle-btn"
              onClick={() => setTheme((c) => (c === "light" ? "dark" : "light"))}
              aria-label="Toggle theme"
            >
              {theme === "light" ? "☾ Dark" : "☀ Light"}
            </button>

            {isSignedIn ? (
              <button
                className="sidebar-auth-btn"
                onClick={() => signOut()}
              >
                Sign out
              </button>
            ) : (
              <button
                className="sidebar-auth-btn sign-in"
                onClick={() => void startGoogleSignIn()}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen((c) => !c)}
              aria-label="Toggle Navigation"
            >
              ☰
            </button>
            <div className="topbar-breadcrumb">
              <span>Workspace</span>
              <span>/</span>
              <b>
                {activeTab === "dashboard" && "Overview"}
                {activeTab === "achievements" && "Achievement Vault"}
                {activeTab === "posts" && "AI Post Studio"}
                {activeTab === "settings" && "Account & Settings"}
              </b>
            </div>
          </div>

          <div className="topbar-right">
            <button className="quick-action-btn" onClick={openNewAchievement}>
              <span>+</span> Add Achievement
            </button>
          </div>
        </header>

        <div className="app-content-container">
          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === "dashboard" && (
            <div>
              <div className="overview-hero">
                <div className="overview-greeting">
                  <p className="section-label">CAREER COMMAND CENTER</p>
                  <h1>Welcome back, {userName.split(" ")[0]} 👋</h1>
                  <p>Here is your verified progress snapshot and achievement momentum.</p>
                </div>
                <div className="overview-period-badge">
                  <span>●</span> Last 30 Days Activity
                </div>
              </div>

              {/* 4 KPI CARDS */}
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-top">
                    <span className="kpi-title">Today’s Wins</span>
                    <div className="kpi-icon blue">✦</div>
                  </div>
                  <div className="kpi-value-row">
                    <span className="kpi-value">{stats.today}</span>
                  </div>
                  <div className="kpi-subtext">Recorded today</div>
                  <div className="kpi-glow-line"></div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <span className="kpi-title">Weekly Momentum</span>
                    <div className="kpi-icon cyan">◈</div>
                  </div>
                  <div className="kpi-value-row">
                    <span className="kpi-value">{stats.week}</span>
                  </div>
                  <div className="kpi-subtext">Past 7 days velocity</div>
                  <div className="kpi-glow-line"></div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <span className="kpi-title">Monthly Impact</span>
                    <div className="kpi-icon green">▣</div>
                  </div>
                  <div className="kpi-value-row">
                    <span className="kpi-value">{stats.month}</span>
                  </div>
                  <div className="kpi-subtext">Total growth entries</div>
                  <div className="kpi-glow-line"></div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <span className="kpi-title">Saved AI Posts</span>
                    <div className="kpi-icon purple">↗</div>
                  </div>
                  <div className="kpi-value-row">
                    <span className="kpi-value">{posts.length}</span>
                  </div>
                  <div className="kpi-subtext">Drafts ready for LinkedIn</div>
                  <div className="kpi-glow-line"></div>
                </div>
              </div>

              {/* VISUALS SPLIT ROW: 7-DAY MOMENTUM & CADENCE GAUGE */}
              <div className="visuals-split-grid">
                {/* 7-DAY MOMENTUM BAR CHART */}
                <div className="dashboard-card">
                  <div className="dashboard-card-header">
                    <div>
                      <h3 className="dashboard-card-title">7-Day Achievement Velocity</h3>
                      <p className="dashboard-card-subtitle">Daily milestones recorded across all projects</p>
                    </div>
                    <span className="ai-engine-tag">Real-time Data</span>
                  </div>

                  <div className="momentum-chart-container">
                    <div className="momentum-bars-row">
                      {weeklyChartData.days.map((item, idx) => {
                        const heightPct = Math.max(
                          8,
                          Math.round((item.count / weeklyChartData.maxCount) * 100)
                        );
                        return (
                          <div className="momentum-bar-col" key={idx}>
                            <span className="momentum-bar-count">
                              {item.count > 0 ? item.count : ""}
                            </span>
                            <div className="momentum-bar-track">
                              <div
                                className="momentum-bar-fill"
                                style={{ height: `${heightPct}%` }}
                              ></div>
                            </div>
                            <span className="momentum-bar-label">{item.dayName}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="chart-legend-row">
                      <div className="legend-item">
                        <span className="legend-dot"></span>
                        <span>Recorded Milestones</span>
                      </div>
                      <span>{stats.week} wins this week</span>
                    </div>
                  </div>
                </div>

                {/* CIRCULAR RADIAL CADENCE GAUGE */}
                <div className="dashboard-card">
                  <div className="dashboard-card-header">
                    <div>
                      <h3 className="dashboard-card-title">Weekly Cadence Goal</h3>
                      <p className="dashboard-card-subtitle">Consistency target (5 wins/week)</p>
                    </div>
                  </div>

                  <div className="gauge-wrapper">
                    <div className="radial-gauge-svg-container">
                      <svg width="170" height="170" viewBox="0 0 170 170">
                        <circle
                          cx="85"
                          cy="85"
                          r="68"
                          fill="none"
                          stroke="var(--surface-soft)"
                          strokeWidth="12"
                        />
                        <circle
                          cx="85"
                          cy="85"
                          r="68"
                          fill="none"
                          stroke="url(#blueCyanGradient)"
                          strokeWidth="12"
                          strokeDasharray="427.26"
                          strokeDashoffset={427.26 - (427.26 * weeklyCadencePercent) / 100}
                          strokeLinecap="round"
                          transform="rotate(-90 85 85)"
                          style={{ transition: "stroke-dashoffset 0.8s ease" }}
                        />
                        <defs>
                          <linearGradient id="blueCyanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#38bdf8" />
                            <stop offset="100%" stopColor="#3b82f6" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="radial-gauge-center">
                        <span className="gauge-big-num">{weeklyCadencePercent}%</span>
                        <span className="gauge-unit">{stats.week} / 5 Wins</span>
                      </div>
                    </div>

                    <div className="gauge-description">
                      {weeklyCadencePercent >= 100
                        ? "Weekly goal achieved! You have enough verified content for an impactful LinkedIn post."
                        : `${5 - stats.week > 0 ? 5 - stats.week : 0} more achievements to reach your weekly publishing goal.`}
                    </div>

                    <button
                      className="gauge-status-badge"
                      style={{ border: "none", cursor: "pointer" }}
                      onClick={() => setActiveTab("posts")}
                    >
                      ↗ Launch AI Post Studio
                    </button>
                  </div>
                </div>
              </div>

              {/* RECENT ACHIEVEMENTS FEED */}
              <div className="recent-activity-panel">
                <div className="dashboard-card-header">
                  <div>
                    <p className="section-label">RECENT EVIDENCE</p>
                    <h3 className="dashboard-card-title">Latest Recorded Milestones</h3>
                  </div>
                  <button
                    className="secondary-button"
                    style={{ padding: "6px 14px", fontSize: 12 }}
                    onClick={() => setActiveTab("achievements")}
                  >
                    View All Vault Items ({achievements.length}) →
                  </button>
                </div>

                {achievements.length === 0 ? (
                  <div className="empty-state">
                    <div style={{ margin: "0 auto 12px auto" }}>✦</div>
                    <h3>No achievements recorded yet</h3>
                    <p>Capture your first completed task, learning step, or solved problem.</p>
                    <button className="primary-button" onClick={openNewAchievement}>
                      + Record First Achievement
                    </button>
                  </div>
                ) : (
                  <div className="activity-list">
                    {achievements.slice(0, 5).map((item) => (
                      <div className="activity-item" key={item.id}>
                        <div className="activity-left">
                          <div className="activity-cat-icon">
                            {categories.find((c) => c.value === item.category)?.icon ?? "✦"}
                          </div>
                          <div className="activity-details">
                            <h4>{item.title}</h4>
                            <p>
                              <span className="project-pill">{item.project}</span>
                              <span>·</span>
                              <span>{formatDate(item.achievedAt)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="activity-actions">
                          <span className={`activity-tag ${item.isPublic ? "public" : ""}`}>
                            {item.isPublic ? "Public" : "Private"}
                          </span>
                          <button
                            className="card-action-btn"
                            onClick={() => {
                              setSelectedAchievementIds([item.id]);
                              setActiveTab("posts");
                            }}
                          >
                            Draft Post ↗
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ACHIEVEMENT VAULT */}
          {activeTab === "achievements" && (
            <div>
              <div className="vault-header-row">
                <div>
                  <p className="section-label">CAREER REPOSITORY</p>
                  <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, margin: 0 }}>
                    Achievement Vault
                  </h1>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div className="vault-search-box">
                    <span className="search-icon-inside">🔍</span>
                    <input
                      placeholder="Search title, details, project..."
                      value={vaultSearch}
                      onChange={(e) => setVaultSearch(e.target.value)}
                    />
                  </div>

                  <button className="primary-button" onClick={openNewAchievement}>
                    <span>+</span> Add Achievement
                  </button>
                </div>
              </div>

              {/* Category Filter Chips */}
              <div className="vault-filter-bar" style={{ marginBottom: 24 }}>
                <button
                  className={`filter-chip ${vaultCategory === "all" ? "active" : ""}`}
                  onClick={() => setVaultCategory("all")}
                >
                  All ({achievements.length})
                </button>
                {categories.map((c) => {
                  const count = achievements.filter((a) => a.category === c.value).length;
                  return (
                    <button
                      key={c.value}
                      className={`filter-chip ${vaultCategory === c.value ? "active" : ""}`}
                      onClick={() => setVaultCategory(c.value)}
                    >
                      {c.icon} {c.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Grid of Vault Cards */}
              {filteredAchievements.length === 0 ? (
                <div className="empty-state">
                  <div style={{ margin: "0 auto 12px auto" }}>✦</div>
                  <h3>No matching achievements found</h3>
                  <p>Try clearing your search query or add a new milestone to your vault.</p>
                  <button className="primary-button" onClick={openNewAchievement}>
                    + Add New Achievement
                  </button>
                </div>
              ) : (
                <div className="vault-cards-grid">
                  {filteredAchievements.map((item) => (
                    <div className="vault-card" key={item.id}>
                      <div>
                        <div className="vault-card-top">
                          <span className="vault-card-cat-badge">
                            {categories.find((c) => c.value === item.category)?.icon ?? "✦"}{" "}
                            {item.category}
                          </span>
                          <span className="vault-card-date">{formatDate(item.achievedAt)}</span>
                        </div>

                        <div className="vault-card-body">
                          <h3>{item.title}</h3>
                          <p>{item.details}</p>
                        </div>

                        <div className="vault-card-meta">
                          <span className="project-pill">{item.project}</span>
                          <span className={`activity-tag ${item.isPublic ? "public" : ""}`}>
                            {item.isPublic ? "Public" : "Private"}
                          </span>
                        </div>

                        {item.evidenceUrl && (
                          <div style={{ marginBottom: 12 }}>
                            <a
                              className="vault-evidence-link"
                              href={item.evidenceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              🔗 View Evidence Link ↗
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="vault-card-footer">
                        <button
                          className="card-action-btn"
                          onClick={() => {
                            setSelectedAchievementIds([item.id]);
                            setActiveTab("posts");
                          }}
                        >
                          Draft Post ↗
                        </button>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="card-action-btn"
                            onClick={() => openEditAchievement(item)}
                          >
                            Edit
                          </button>
                          <button
                            className="card-action-btn delete"
                            onClick={() => askToDelete(item)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AI POST STUDIO (TWO-PANEL WORKSPACE) */}
          {activeTab === "posts" && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <p className="section-label">AI CONTENT STUDIO</p>
                <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, margin: "0 0 6px 0" }}>
                  LinkedIn Post Studio
                </h1>
                <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>
                  Select verified evidence from your vault and generate publication-ready LinkedIn drafts backed by real facts.
                </p>
              </div>

              <div className="studio-grid-layout">
                {/* LEFT PANEL: YOUR PROGRESS / EVIDENCE SELECTOR */}
                <div className="studio-left-panel">
                  <div className="selector-controls-header">
                    <div>
                      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: "0 0 2px 0" }}>
                        Select Evidence
                      </h3>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                        Pick specific achievements to include
                      </p>
                    </div>
                    <span className="selector-count-badge">
                      {selectedAchievementIds.length} Selected
                    </span>
                  </div>

                  <div className="selector-bulk-actions">
                    <button className="bulk-btn" onClick={selectAllWeekly}>
                      Select All This Week
                    </button>
                    <button className="bulk-btn" onClick={clearSelection}>
                      Clear Selection
                    </button>
                  </div>

                  <div className="evidence-scroll-list">
                    {achievements.length === 0 ? (
                      <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
                        No achievements recorded yet. Add some in the Vault first.
                      </p>
                    ) : (
                      achievements.map((item) => {
                        const isSelected = selectedAchievementIds.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`evidence-select-card ${isSelected ? "selected" : ""}`}
                            onClick={() => toggleAchievementSelection(item.id)}
                          >
                            <div className="custom-checkbox">{isSelected ? "✓" : ""}</div>
                            <div className="evidence-card-info">
                              <h5>{item.title}</h5>
                              <p>
                                {item.project} · {formatDate(item.achievedAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="studio-gen-triggers">
                    <button
                      className="primary-button"
                      disabled={generatingPost}
                      onClick={() => generatePost("one_off")}
                    >
                      {generatingPost ? "Generating AI Draft..." : "⚡ Generate from Selected"}
                    </button>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <button
                        className="secondary-button"
                        disabled={generatingPost}
                        onClick={() => generatePost("weekly")}
                      >
                        📅 Weekly Digest
                      </button>
                      <button
                        className="secondary-button"
                        disabled={generatingPost}
                        onClick={() => generatePost("monthly")}
                      >
                        🗓️ Monthly Summary
                      </button>
                    </div>
                    {postError && <p className="post-error">{postError}</p>}
                  </div>
                </div>

                {/* RIGHT PANEL: AI COMPOSER & LIVE PREVIEW */}
                <div className="studio-right-panel">
                  <div className="composer-header-row">
                    <div>
                      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: "0 0 2px 0" }}>
                        AI Post Composer
                      </h3>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                        Review, edit, and approve before saving
                      </p>
                    </div>
                    <span className="ai-engine-tag">
                      <span>●</span> Groq Compound-Mini
                    </span>
                  </div>

                  {previewDraft ? (
                    <div>
                      {/* LINKEDIN MOCK POST CARD */}
                      <div className="linkedin-mock-card">
                        <div className="linkedin-author-row">
                          <div className="linkedin-avatar">{userInitials}</div>
                          <div className="linkedin-author-details">
                            <h4>{userName}</h4>
                            <p>Author · {previewDraft.postType.replace("_", " ")} draft</p>
                          </div>
                        </div>

                        <textarea
                          className="linkedin-post-textarea"
                          value={previewDraft.content}
                          onChange={(e) =>
                            setPreviewDraft({ ...previewDraft, content: e.target.value })
                          }
                          placeholder="Your generated LinkedIn post draft..."
                        />

                        <div className="post-stats-row">
                          <span>
                            Words: {previewDraft.content.trim() ? previewDraft.content.trim().split(/\s+/).length : 0}
                          </span>
                          <span>Characters: {previewDraft.content.length}</span>
                        </div>
                      </div>

                      {/* REVISION INSTRUCTION BAR */}
                      <div className="revision-prompt-section">
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                          Refine or adjust draft:
                        </label>
                        <div className="revision-input-wrapper">
                          <input
                            placeholder="e.g., Make it more concise, emphasize technical problem solving..."
                            value={revisionRequest}
                            onChange={(e) => setRevisionRequest(e.target.value)}
                          />
                          <button
                            className="primary-button"
                            style={{ padding: "8px 16px", fontSize: 13 }}
                            disabled={generatingPost || !revisionRequest.trim()}
                            onClick={() =>
                              generatePost(previewDraft.postType, {
                                achievementIds: previewDraft.achievementIds,
                                revisionRequest: revisionRequest.trim(),
                              })
                            }
                          >
                            {generatingPost ? "Applying..." : "Apply"}
                          </button>
                        </div>

                        <div className="suggested-chips">
                          <span
                            className="revision-chip"
                            onClick={() => setRevisionRequest("Make it shorter and more punchy")}
                          >
                            + Shorter & punchy
                          </span>
                          <span
                            className="revision-chip"
                            onClick={() => setRevisionRequest("Add more technical depth")}
                          >
                            + More technical
                          </span>
                          <span
                            className="revision-chip"
                            onClick={() => setRevisionRequest("Make the tone friendly and conversational")}
                          >
                            + Friendly tone
                          </span>
                          <span
                            className="revision-chip"
                            onClick={() => setRevisionRequest("Focus heavily on the lessons learned")}
                          >
                            + Focus on lessons
                          </span>
                        </div>
                      </div>

                      {/* ACTION BAR */}
                      <div className="composer-action-bar">
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="secondary-button"
                            disabled={generatingPost || savingDraft}
                            onClick={() =>
                              generatePost(previewDraft.postType, {
                                achievementIds: previewDraft.achievementIds,
                              })
                            }
                          >
                            ↺ Rewrite
                          </button>
                          <button
                            className="secondary-button"
                            onClick={closePreview}
                          >
                            Discard
                          </button>
                        </div>

                        <button
                          className="primary-button"
                          disabled={generatingPost || savingDraft || !previewDraft.content.trim()}
                          onClick={approveDraft}
                        >
                          {savingDraft ? "Saving to Drafts..." : "✓ Approve & Save Draft"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="composer-empty-state">
                      <div className="composer-empty-icon">↗</div>
                      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, margin: "0 0 6px 0" }}>
                        Ready to Compose
                      </h3>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 320, margin: "0 0 20px 0", lineHeight: 1.5 }}>
                        Select achievements on the left panel and click <b>Generate</b> to create an evidence-grounded LinkedIn post.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* SAVED DRAFTS VAULT LIST */}
              <div className="saved-drafts-section">
                <div className="dashboard-card-header">
                  <div>
                    <p className="section-label">SAVED POST VAULT</p>
                    <h3 className="dashboard-card-title">Approved LinkedIn Drafts ({posts.length})</h3>
                  </div>
                </div>

                {posts.length === 0 ? (
                  <div className="empty-state" style={{ minHeight: 180 }}>
                    <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      No saved drafts yet. Generate and approve your first post above.
                    </p>
                  </div>
                ) : (
                  <div className="saved-drafts-grid">
                    {posts.map((post) => (
                      <div className="saved-draft-card" key={post.id}>
                        <div>
                          <div className="saved-draft-meta">
                            <span className="draft-type-tag">
                              {post.postType.replace("_", " ")}
                            </span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                              {formatDate(post.createdAt)}
                            </span>
                          </div>
                          <p>{post.content}</p>
                        </div>

                        <div className="saved-draft-footer">
                          <button
                            className="secondary-button"
                            style={{ padding: "6px 12px", fontSize: 12 }}
                            onClick={() => copyToClipboard(post.content, post.id)}
                          >
                            {copiedDraftId === post.id ? "✓ Copied!" : "📋 Copy Post"}
                          </button>

                          <button
                            className="card-action-btn delete"
                            onClick={() => deleteSavedPost(post.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === "settings" && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <p className="section-label">PREFERENCES & CONFIGURATION</p>
                <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, margin: 0 }}>
                  Account & Settings
                </h1>
              </div>

              <div className="settings-cards-stack">
                {/* Profile Identity Card */}
                {isSignedIn && (
                  <div className="settings-card">
                    <div className="settings-card-header">
                      <h3>User Profile</h3>
                      <p>Manage the name and identity associated with your account.</p>
                    </div>

                    <div className="modal-form-group" style={{ marginBottom: 14 }}>
                      <label>Display Name</label>
                      <input
                        value={profileNameInput}
                        onChange={(e) => setProfileNameInput(e.target.value)}
                        placeholder="Your full name"
                      />
                    </div>

                    <div className="modal-form-group" style={{ marginBottom: 16 }}>
                      <label>Email Address</label>
                      <input value={profileEmail} readOnly style={{ opacity: 0.7 }} />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <button
                        className="primary-button"
                        disabled={savingProfile}
                        onClick={() => void saveProfileName()}
                      >
                        {savingProfile ? "Saving..." : "Save Name"}
                      </button>
                      {profileMessage && (
                        <span style={{ fontSize: 13, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                          {profileMessage}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Persona & Generation Style */}
                <div className="settings-card">
                  <div className="settings-card-header">
                    <h3>AI Post Generation Style</h3>
                    <p>Customize the tone and target word length for your generated LinkedIn posts.</p>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-info">
                      <h4>Post Tone</h4>
                      <p>Adjust the voice of your AI writer</p>
                    </div>
                    <select
                      className="settings-select"
                      value={settings.postTone}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          postTone: e.target.value as UserSettings["postTone"],
                        })
                      }
                    >
                      <option value="professional">Professional</option>
                      <option value="friendly">Friendly & Conversational</option>
                      <option value="concise">Concise & Direct</option>
                    </select>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-info">
                      <h4>Draft Length</h4>
                      <p>Target word count range for drafts</p>
                    </div>
                    <select
                      className="settings-select"
                      value={settings.postLength}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          postLength: e.target.value as UserSettings["postLength"],
                        })
                      }
                    >
                      <option value="short">Short (45 to 70 words)</option>
                      <option value="normal">Normal (70 to 110 words)</option>
                    </select>
                  </div>
                </div>

                {/* Automated Reminders & Email Delivery */}
                <div className="settings-card">
                  <div className="settings-card-header">
                    <h3>Weekly Automated Reminders</h3>
                    <p>Receive scheduled Sunday digests when your weekly draft is compiled.</p>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-info">
                      <h4>Weekly Email Notifications</h4>
                      <p>Automatic draft compilation every Sunday at 16:00 UTC</p>
                    </div>
                    <label className="switch-toggle">
                      <input
                        type="checkbox"
                        checked={settings.weeklyReminderEnabled}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            weeklyReminderEnabled: e.target.checked,
                          })
                        }
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-info">
                      <h4>Email Connection Test</h4>
                      <p>Send a test message to verify delivery</p>
                      {testEmailMessage && (
                        <p style={{ color: "var(--accent-cyan)", marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                          {testEmailMessage}
                        </p>
                      )}
                    </div>
                    <button
                      className="secondary-button"
                      disabled={sendingTestEmail || !isSignedIn}
                      onClick={() => void sendTestEmail()}
                    >
                      {sendingTestEmail ? "Sending..." : "Send Test Email"}
                    </button>
                  </div>

                  <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <button
                      className="primary-button"
                      disabled={savingSettings || !isSignedIn}
                      onClick={() => void saveSettings()}
                    >
                      {savingSettings ? "Saving..." : "Save Settings"}
                    </button>
                    {settingsMessage && (
                      <span style={{ fontSize: 13, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                        {settingsMessage}
                      </span>
                    )}
                  </div>
                </div>

                {/* Account Integrations */}
                <div className="settings-card">
                  <div className="settings-card-header">
                    <h3>Connected Accounts</h3>
                    <p>Manage authentication and social publishing integrations.</p>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-info">
                      <h4>Google Account</h4>
                      <p>{isSignedIn ? "Cloud synchronization active." : "Sign in to persist your progress across devices."}</p>
                    </div>
                    <span className={`activity-tag ${isSignedIn ? "public" : ""}`}>
                      {isSignedIn ? "Connected" : "Guest Mode"}
                    </span>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-info">
                      <h4>LinkedIn Publishing</h4>
                      <p>Manual review before publish is always preserved</p>
                    </div>
                    <span className="activity-tag">Ready</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: ADD / EDIT ACHIEVEMENT */}
      {isFormOpen && (
        <div className="modal-backdrop" onClick={closeAchievementModal}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingAchievement ? "Edit Achievement" : "Record New Achievement"}</h2>
              <button className="modal-close-btn" onClick={closeAchievementModal}>
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={addAchievement}>
              <div className="modal-form-group">
                <label>Achievement Title *</label>
                <input
                  autoFocus
                  required
                  placeholder="e.g., Shipped optimized serverless caching layer"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="modal-form-group">
                <label>Details & Context</label>
                <textarea
                  rows={3}
                  placeholder="Describe what was completed, the problem solved, metrics, or skills learned..."
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                />
              </div>

              <div className="modal-form-row">
                <div className="modal-form-group">
                  <label>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="modal-form-group">
                  <label>Project / Area</label>
                  <input
                    placeholder="General"
                    value={form.project}
                    onChange={(e) => setForm({ ...form, project: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-form-group">
                <label>Evidence Link (Optional)</label>
                <input
                  type="url"
                  placeholder="https://github.com/... or demo link"
                  value={form.evidenceUrl}
                  onChange={(e) => setForm({ ...form, evidenceUrl: e.target.value })}
                />
              </div>

              <label className="modal-checkbox-row">
                <input
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                />
                Mark as public milestone
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeAchievementModal}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={loading}>
                  {loading ? "Saving..." : editingAchievement ? "Save Changes" : "Record Achievement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {achievementToDelete && (
        <div className="modal-backdrop" onClick={() => setAchievementToDelete(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2>Delete Milestone?</h2>
              <button
                className="modal-close-btn"
                onClick={() => setAchievementToDelete(null)}
              >
                ×
              </button>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 20px 0", lineHeight: 1.5 }}>
              Are you sure you want to delete <b>“{achievementToDelete.title}”</b>? This action will permanently remove it from your vault.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setAchievementToDelete(null)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                onClick={confirmDelete}
                disabled={loading}
              >
                {loading ? "Deleting..." : "Delete Achievement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SIGN IN TO SAVE */}
      {showSignInModal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            clearPendingGuestImport();
            setShowSignInModal(false);
          }}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460 }}
          >
            <div className="modal-header">
              <h2>Save Your Progress</h2>
              <button
                className="modal-close-btn"
                onClick={() => {
                  clearPendingGuestImport();
                  setShowSignInModal(false);
                }}
              >
                ×
              </button>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 20px 0", lineHeight: 1.5 }}>
              Sign in with Google to permanently save this generated LinkedIn draft and access your achievements across all your devices.
            </p>
            <div className="modal-actions">
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
                Continue with Google →
              </button>
            </div>
          </div>
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
