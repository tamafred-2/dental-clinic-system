"use client";

import { useRouter } from "next/navigation";
import {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AdminSidebar } from "./admin-sidebar";
import { ThemeToggle } from "./theme-toggle";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF" | "DENTIST";
};

type ConversationChannel = "WEBSITE" | "FACEBOOK_MESSENGER";
type ConversationStatus =
  "AI_ACTIVE" | "HUMAN_REQUIRED" | "HUMAN_ACTIVE" | "CLOSED";
type SenderType = "PATIENT" | "AI" | "STAFF" | "SYSTEM";

type ConversationSummary = {
  id: string;
  channel: ConversationChannel;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  patient: { id: string; firstName: string; lastName: string };
  assignedStaff: { id: string; name: string } | null;
  _count: { messages: number };
};

type ConversationDetail = Omit<ConversationSummary, "patient"> & {
  patient: ConversationSummary["patient"] & {
    email: string;
    phone: string;
  };
  assignedStaff: { id: string; name: string; email: string } | null;
};

type ConversationList = {
  items: ConversationSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

type Message = {
  id: string;
  senderType: SenderType;
  content: string;
  createdAt: string;
  senderUser: { id: string; name: string } | null;
};

type MessageList = {
  items: Message[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

type Filters = {
  channel: string;
  status: string;
  assignment: "ALL" | "MINE" | "UNASSIGNED";
};

class SessionExpiredError extends Error {}

async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiUrl}/api${path}`, {
    ...options,
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401) {
    throw new SessionExpiredError("Your dashboard session has ended.");
  }
  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "The request could not be completed.",
    );
  }
  return body as T;
}

function label(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function renderInlineMarkdown(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

function renderAiMessage(value: string) {
  return value.split("\n").map((line, index) => {
    const heading = /^(?:#{1,3}\s+)?(.+)$/.exec(line);
    const bullet = /^[-*]\s+(.+)$/.exec(line);

    if (!line.trim()) {
      return <div className="ai-message-gap" key={index} />;
    }
    if (line.startsWith("#") && heading) {
      return (
        <p className="ai-message-heading" key={index}>
          {renderInlineMarkdown(heading[1])}
        </p>
      );
    }
    if (bullet) {
      return (
        <p className="ai-message-bullet" key={index}>
          <span aria-hidden="true">•</span>
          {renderInlineMarkdown(bullet[1])}
        </p>
      );
    }
    return <p key={index}>{renderInlineMarkdown(line)}</p>;
  });
}

function ChannelIcon({ channel }: { channel: ConversationChannel }) {
  if (channel === "FACEBOOK_MESSENGER") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.14 2 11.25c0 2.91 1.46 5.51 3.74 7.2V22l3.42-1.88c.9.25 1.86.38 2.84.38 5.52 0 10-4.14 10-9.25S17.52 2 12 2Zm1.06 12.45-2.55-2.72-4.98 2.72 5.48-5.82 2.61 2.72 4.92-2.72-5.48 5.82Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9h17M3.5 15h17M12 3c2.2 2.4 3.3 5.4 3.3 9S14.2 18.6 12 21M12 3C9.8 5.4 8.7 8.4 8.7 12s1.1 6.6 3.3 9" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 4 17 8-17 8 3-8-3-8Z" />
      <path d="M7 12h14" />
    </svg>
  );
}

export function AdminConversations() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [conversations, setConversations] = useState<ConversationList | null>(
    null,
  );
  const [selected, setSelected] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageList | null>(null);
  const [filters, setFilters] = useState<Filters>({
    channel: "",
    status: "",
    assignment: "ALL",
  });
  const [reply, setReply] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const handleError = useCallback(
    (requestError: unknown) => {
      if (requestError instanceof SessionExpiredError) {
        router.replace("/admin/login");
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The conversation inbox could not be loaded.",
      );
    },
    [router],
  );

  const loadConversations = useCallback(
    async (activeFilters: Filters, page = 1) => {
      const query = new URLSearchParams({
        assignment: activeFilters.assignment,
        page: String(page),
        limit: "25",
      });
      if (activeFilters.channel) query.set("channel", activeFilters.channel);
      if (activeFilters.status) query.set("status", activeFilters.status);
      const result = await apiRequest<ConversationList>(
        `/conversations/admin?${query.toString()}`,
      );
      setConversations(result);
      return result;
    },
    [],
  );

  const loadInitial = useCallback(async () => {
    try {
      const auth = await apiRequest<{ user: AuthUser }>("/auth/me");
      if (auth.user.role !== "ADMIN" && auth.user.role !== "STAFF") {
        throw new SessionExpiredError("This account cannot use the inbox.");
      }
      setUser(auth.user);
      await loadConversations(filters);
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setLoading(false);
    }
    // Initial filters are intentionally captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleError, loadConversations]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadInitial();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadInitial]);

  async function loadMessages(conversationId: string, page = 1) {
    const result = await apiRequest<MessageList>(
      `/conversations/admin/${conversationId}/messages?page=${page}&limit=50`,
    );
    setMessages(result);
    return result;
  }

  async function openConversation(id: string) {
    setError("");
    setNotice("");
    setReply("");
    try {
      const [detail] = await Promise.all([
        apiRequest<ConversationDetail>(`/conversations/admin/${id}`),
        loadMessages(id),
      ]);
      setSelected(detail);
    } catch (requestError) {
      handleError(requestError);
    }
  }

  function closeConversationView() {
    setSelected(null);
    setMessages(null);
  }

  async function refreshSelected(id: string, message: string) {
    const [detail] = await Promise.all([
      apiRequest<ConversationDetail>(`/conversations/admin/${id}`),
      loadMessages(id, 1),
      loadConversations(filters, conversations?.pagination.page ?? 1),
    ]);
    setSelected(detail);
    setNotice(message);
  }

  async function runAction(action: "claim" | "release" | "close") {
    if (!selected) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/conversations/admin/${selected.id}/${action}`, {
        method: "POST",
      });
      await refreshSelected(
        selected.id,
        action === "claim"
          ? "Conversation claimed."
          : action === "release"
            ? "Conversation returned to the staff queue."
            : "Conversation closed.",
      );
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setWorking(false);
    }
  }

  async function generateAiResponse() {
    if (!selected) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{
        outcome: "RESPONDED" | "ESCALATED";
      }>(`/conversations/admin/${selected.id}/ai-response`, {
        method: "POST",
      });
      await refreshSelected(
        selected.id,
        result.outcome === "ESCALATED"
          ? "The AI safely handed this conversation to the staff queue."
          : "AI response stored in the conversation history.",
      );
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setWorking(false);
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/conversations/admin/${selected.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: reply }),
      });
      setReply("");
      await refreshSelected(
        selected.id,
        "Staff response stored in the conversation history.",
      );
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setWorking(false);
    }
  }

  async function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelected(null);
    setMessages(null);
    setError("");
    try {
      await loadConversations(filters);
    } catch (requestError) {
      handleError(requestError);
    }
  }

  async function logout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch {
      // The browser still returns to login when the server session has expired.
    }
    router.replace("/admin/login");
    router.refresh();
  }

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [],
  );
  const listDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
      }),
    [],
  );
  const visibleConversations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return conversations?.items ?? [];
    return (conversations?.items ?? []).filter((conversation) =>
      `${conversation.patient.firstName} ${conversation.patient.lastName}`
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [conversations, search]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, selected?.id]);

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }
  const assignedToCurrentUser = selected?.assignedStaff?.id === user?.id;
  const canRelease =
    Boolean(selected?.assignedStaff) &&
    (assignedToCurrentUser || user?.role === "ADMIN");
  const canClose =
    selected?.status !== "CLOSED" &&
    (!selected?.assignedStaff ||
      assignedToCurrentUser ||
      user?.role === "ADMIN");
  const latestMessage = messages?.items.at(-1);
  const canGenerateAiResponse =
    selected?.status === "AI_ACTIVE" && latestMessage?.senderType === "PATIENT";

  if (loading) {
    return (
      <main className="admin-loading" role="status">
        <span className="admin-spinner" aria-hidden="true" />
        Loading conversation inbox…
      </main>
    );
  }

  return (
    <div className="admin-app" id="conversation-inbox">
      <AdminSidebar active="conversations" />
      <main className="admin-main conversation-main">
        <header className="admin-topbar conversation-page-header">
          <div>
            <p className="eyebrow">Shared inbox</p>
            <h1>Conversations</h1>
            <p>Help patients from one calm, organized workspace.</p>
          </div>
          <div className="admin-account">
            <ThemeToggle />
            <span>
              <strong>{user?.name}</strong>
              <small>{user?.role.toLowerCase()}</small>
            </span>
            <button type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>

        {error ? (
          <div className="admin-alert error" role="alert">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="admin-alert success" role="status">
            {notice}
          </div>
        ) : null}

        <section
          className={`conversation-workspace${selected ? " has-selection" : ""}`}
        >
          <div className="conversation-list" aria-label="Conversation list">
            <header className="conversation-list-header">
              <div>
                <strong>Messages</strong>
                <span>{conversations?.pagination.total ?? 0}</span>
              </div>
              <details className="conversation-filter-menu">
                <summary aria-label="Filter conversations" title="Filters">
                  <FilterIcon />
                </summary>
                <form onSubmit={applyFilters}>
                  <strong>Filter inbox</strong>
                  <label>
                    Channel
                    <select
                      value={filters.channel}
                      onChange={(event) =>
                        setFilters({ ...filters, channel: event.target.value })
                      }
                    >
                      <option value="">All channels</option>
                      <option value="WEBSITE">Website</option>
                      <option value="FACEBOOK_MESSENGER">
                        Facebook Messenger
                      </option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={filters.status}
                      onChange={(event) =>
                        setFilters({ ...filters, status: event.target.value })
                      }
                    >
                      <option value="">All statuses</option>
                      <option value="AI_ACTIVE">AI active</option>
                      <option value="HUMAN_REQUIRED">Needs staff</option>
                      <option value="HUMAN_ACTIVE">Staff active</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </label>
                  <label>
                    Assignment
                    <select
                      value={filters.assignment}
                      onChange={(event) =>
                        setFilters({
                          ...filters,
                          assignment: event.target
                            .value as Filters["assignment"],
                        })
                      }
                    >
                      <option value="ALL">All assignments</option>
                      <option value="MINE">Assigned to me</option>
                      <option value="UNASSIGNED">Unassigned</option>
                    </select>
                  </label>
                  <button className="button button-primary" type="submit">
                    Apply filters
                  </button>
                </form>
              </details>
            </header>

            <label className="conversation-search">
              <span className="sr-only">Search conversations by patient</span>
              <SearchIcon />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search patients"
              />
            </label>

            <div className="conversation-list-scroll">
              {visibleConversations.length ? (
                visibleConversations.map((conversation) => (
                  <button
                    className={`conversation-list-item${selected?.id === conversation.id ? " selected" : ""}`}
                    type="button"
                    key={conversation.id}
                    onClick={() => openConversation(conversation.id)}
                  >
                    <span className="conversation-avatar" aria-hidden="true">
                      {initials(
                        conversation.patient.firstName,
                        conversation.patient.lastName,
                      )}
                      <i
                        className={`channel-dot channel-${conversation.channel.toLowerCase()}`}
                      >
                        <ChannelIcon channel={conversation.channel} />
                      </i>
                    </span>
                    <span className="conversation-list-copy">
                      <span className="conversation-list-heading">
                        <strong>
                          {conversation.patient.firstName}{" "}
                          {conversation.patient.lastName}
                        </strong>
                        <time dateTime={conversation.updatedAt}>
                          {listDateFormatter.format(
                            new Date(conversation.updatedAt),
                          )}
                        </time>
                      </span>
                      <span className="conversation-list-preview">
                        {conversation.assignedStaff
                          ? `With ${conversation.assignedStaff.name}`
                          : label(conversation.status)}{" "}
                        · {conversation._count.messages} messages
                      </span>
                    </span>
                    <span
                      className={`conversation-status conversation-status-${conversation.status.toLowerCase()}`}
                      title={label(conversation.status)}
                    >
                      <span className="sr-only">
                        {label(conversation.status)}
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="admin-empty conversation-empty-list">
                  <h3>No conversations found</h3>
                  <p>Try another search or adjust your inbox filters.</p>
                </div>
              )}
            </div>

            {conversations && conversations.pagination.pages > 1 ? (
              <div className="admin-pagination">
                <button
                  type="button"
                  disabled={conversations.pagination.page <= 1}
                  onClick={() =>
                    loadConversations(
                      filters,
                      conversations.pagination.page - 1,
                    ).catch(handleError)
                  }
                >
                  Previous
                </button>
                <span>
                  Page {conversations.pagination.page} of{" "}
                  {conversations.pagination.pages}
                </span>
                <button
                  type="button"
                  disabled={
                    conversations.pagination.page >=
                    conversations.pagination.pages
                  }
                  onClick={() =>
                    loadConversations(
                      filters,
                      conversations.pagination.page + 1,
                    ).catch(handleError)
                  }
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>

          <article className="conversation-thread" aria-live="polite">
            {selected ? (
              <>
                <header className="conversation-thread-header">
                  <button
                    className="conversation-mobile-back"
                    type="button"
                    aria-label="Back to conversations"
                    onClick={closeConversationView}
                  >
                    <BackIcon />
                  </button>
                  <span className="conversation-avatar" aria-hidden="true">
                    {initials(
                      selected.patient.firstName,
                      selected.patient.lastName,
                    )}
                  </span>
                  <div>
                    <h2>
                      {selected.patient.firstName} {selected.patient.lastName}
                    </h2>
                    <p className="conversation-channel-label">
                      <span>
                        <ChannelIcon channel={selected.channel} />
                      </span>
                      {label(selected.channel)} ·{" "}
                      {selected.assignedStaff?.name ?? "Unassigned"}
                    </p>
                  </div>
                  <div className="conversation-header-actions">
                    {canGenerateAiResponse ? (
                      <button
                        type="button"
                        disabled={working}
                        onClick={generateAiResponse}
                      >
                        AI reply
                      </button>
                    ) : null}
                    {!selected.assignedStaff && selected.status !== "CLOSED" ? (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => runAction("claim")}
                      >
                        Claim
                      </button>
                    ) : null}
                    {canRelease ? (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => runAction("release")}
                      >
                        Release
                      </button>
                    ) : null}
                    {canClose ? (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => runAction("close")}
                      >
                        Close
                      </button>
                    ) : null}
                  </div>
                </header>

                <div className="conversation-context-bar">
                  <span
                    className={`conversation-status conversation-status-${selected.status.toLowerCase()}`}
                  >
                    {label(selected.status)}
                  </span>
                  <span>
                    {selected.status === "AI_ACTIVE"
                      ? canGenerateAiResponse
                        ? "A patient message is ready for a reviewed AI response."
                        : "AI is waiting for the next patient message."
                      : "Replies are stored internally until channel delivery is connected."}
                  </span>
                </div>

                <div className="conversation-messages">
                  {messages?.items.map((message) => (
                    <section
                      className={`conversation-message-row sender-${message.senderType.toLowerCase()}`}
                      key={message.id}
                    >
                      {message.senderType === "PATIENT" ? (
                        <span
                          className="conversation-message-avatar"
                          aria-hidden="true"
                        >
                          {initials(
                            selected.patient.firstName,
                            selected.patient.lastName,
                          )}
                        </span>
                      ) : null}
                      <div className="conversation-message-wrap">
                        <span className="conversation-message-sender">
                          {message.senderUser?.name ??
                            label(message.senderType)}
                        </span>
                        <div className="conversation-message">
                          {message.senderType === "AI" ? (
                            renderAiMessage(message.content)
                          ) : (
                            <p>{message.content}</p>
                          )}
                        </div>
                        <time dateTime={message.createdAt}>
                          {dateTimeFormatter.format(
                            new Date(message.createdAt),
                          )}
                        </time>
                      </div>
                    </section>
                  ))}
                  {!messages?.items.length ? (
                    <p className="conversation-no-messages">
                      No messages have been stored yet.
                    </p>
                  ) : null}
                  <div ref={messageEndRef} />
                </div>

                {messages && messages.pagination.pages > 1 ? (
                  <div className="admin-pagination conversation-history-pages">
                    <button
                      type="button"
                      disabled={messages.pagination.page <= 1}
                      onClick={() =>
                        loadMessages(
                          selected.id,
                          messages.pagination.page - 1,
                        ).catch(handleError)
                      }
                    >
                      Newer
                    </button>
                    <span>
                      Page {messages.pagination.page} of{" "}
                      {messages.pagination.pages}
                    </span>
                    <button
                      type="button"
                      disabled={
                        messages.pagination.page >= messages.pagination.pages
                      }
                      onClick={() =>
                        loadMessages(
                          selected.id,
                          messages.pagination.page + 1,
                        ).catch(handleError)
                      }
                    >
                      Older
                    </button>
                  </div>
                ) : null}

                {selected.status === "HUMAN_ACTIVE" && assignedToCurrentUser ? (
                  <form className="conversation-reply" onSubmit={sendReply}>
                    <label className="sr-only" htmlFor="staff-reply">
                      Staff response
                    </label>
                    <textarea
                      id="staff-reply"
                      rows={1}
                      maxLength={4000}
                      required
                      value={reply}
                      placeholder="Write a reply…"
                      onChange={(event) => setReply(event.target.value)}
                      onKeyDown={handleComposerKeyDown}
                    />
                    <span className="conversation-reply-count">
                      {reply.length}/4000
                    </span>
                    <button
                      className="conversation-send-button"
                      type="submit"
                      disabled={working || !reply.trim()}
                      aria-label="Save reply to conversation history"
                      title="Save reply"
                    >
                      <SendIcon />
                    </button>
                  </form>
                ) : selected.status !== "CLOSED" ? (
                  <p className="conversation-reply-locked">
                    Claim this conversation to write a response.
                  </p>
                ) : (
                  <p className="conversation-reply-locked">
                    This conversation is closed.
                  </p>
                )}
              </>
            ) : (
              <div className="admin-detail-placeholder">
                <span
                  className="conversation-placeholder-icon"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M20 11.5a7.8 7.8 0 0 1-8 7.5 8.7 8.7 0 0 1-2.3-.3L5 21l1.1-4A7.2 7.2 0 0 1 4 11.8 7.8 7.8 0 0 1 12 4a7.8 7.8 0 0 1 8 7.5Z" />
                    <path d="M8.5 12h7M12 8.5v7" />
                  </svg>
                </span>
                <h3>Your patient conversations</h3>
                <p>
                  Choose a patient from the inbox to read their message history
                  and continue the conversation.
                </p>
              </div>
            )}
          </article>

          <aside className="conversation-details" aria-label="Patient details">
            {selected ? (
              <>
                <div className="conversation-profile">
                  <span
                    className="conversation-avatar large"
                    aria-hidden="true"
                  >
                    {initials(
                      selected.patient.firstName,
                      selected.patient.lastName,
                    )}
                  </span>
                  <h2>
                    {selected.patient.firstName} {selected.patient.lastName}
                  </h2>
                  <p>Patient contact</p>
                </div>
                <section className="conversation-detail-section">
                  <h3>Contact information</h3>
                  <a href={`mailto:${selected.patient.email}`}>
                    <span>Email</span>
                    {selected.patient.email}
                  </a>
                  <a href={`tel:${selected.patient.phone}`}>
                    <span>Phone</span>
                    {selected.patient.phone}
                  </a>
                </section>
                <section className="conversation-detail-section">
                  <h3>Conversation</h3>
                  <dl>
                    <div>
                      <dt>Channel</dt>
                      <dd>{label(selected.channel)}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{label(selected.status)}</dd>
                    </div>
                    <div>
                      <dt>Assigned to</dt>
                      <dd>{selected.assignedStaff?.name ?? "Unassigned"}</dd>
                    </div>
                    <div>
                      <dt>Messages</dt>
                      <dd>{selected._count.messages}</dd>
                    </div>
                    <div>
                      <dt>Started</dt>
                      <dd>
                        {dateTimeFormatter.format(new Date(selected.createdAt))}
                      </dd>
                    </div>
                  </dl>
                </section>
                <div className="conversation-boundary-note">
                  <strong>Development mode</strong>
                  Responses are saved securely to this conversation but are not
                  sent to Messenger or website chat yet.
                </div>
              </>
            ) : null}
          </aside>
        </section>
      </main>
    </div>
  );
}
