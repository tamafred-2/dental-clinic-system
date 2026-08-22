"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { ThemeToggle } from "./theme-toggle";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "RESCHEDULED"
  | "NO_SHOW";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type DashboardOverview = {
  generatedAt: string;
  timeZone: string;
  today: string;
  statistics: {
    todayAppointments: number;
    pendingRequests: number;
    confirmedAppointments: number;
    cancelledAppointments: number;
    noShowAppointments: number;
    upcomingAppointments: number;
    aiConversations: number;
    humanHandoffs: number;
  };
};

type AppointmentSummary = {
  id: string;
  status: AppointmentStatus;
  scheduledAt: string;
  endAt: string;
  createdAt: string;
  patient: { id: string; firstName: string; lastName: string };
  dentist: { id: string; name: string; title: string };
  service: { id: string; name: string; durationMinutes: number };
};

type AppointmentDetail = AppointmentSummary & {
  updatedAt: string;
  notes: string | null;
  cancellationReason: string | null;
  privacyConsentAt: string | null;
  patient: AppointmentSummary["patient"] & {
    email: string;
    phone: string;
  };
};

type AppointmentList = {
  items: AppointmentSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters: { from: string; to: string };
  timeZone: string;
};

type Dentist = { id: string; name: string; title: string };
type Availability = {
  date: string;
  timeZone: string;
  slots: Array<{ time: string; scheduledAt: string; endAt: string }>;
};

type Filters = {
  from: string;
  to: string;
  dentistId: string;
  status: string;
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
  if (response.status === 401 || response.status === 403) {
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

function localDate(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function statusLabel(status: AppointmentStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function AdminDashboard() {
  const router = useRouter();
  const defaultToday = useMemo(() => localDate(new Date(), "Asia/Manila"), []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [appointments, setAppointments] = useState<AppointmentList | null>(
    null,
  );
  const [dentists, setDentists] = useState<Dentist[]>([]);
  const [filters, setFilters] = useState<Filters>({
    from: defaultToday,
    to: addDays(defaultToday, 30),
    dentistId: "",
    status: "",
  });
  const [selected, setSelected] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState(defaultToday);
  const [availability, setAvailability] = useState<Availability | null>(null);

  const handleError = useCallback(
    (requestError: unknown) => {
      if (requestError instanceof SessionExpiredError) {
        router.replace("/admin/login");
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The dashboard could not be loaded.",
      );
    },
    [router],
  );

  const loadAppointments = useCallback(
    async (activeFilters: Filters, page = 1) => {
      const query = new URLSearchParams({
        from: activeFilters.from,
        to: activeFilters.to,
        page: String(page),
        limit: "25",
      });
      if (activeFilters.dentistId) {
        query.set("dentistId", activeFilters.dentistId);
      }
      if (activeFilters.status) query.set("status", activeFilters.status);
      const result = await apiRequest<AppointmentList>(
        `/appointments/admin?${query.toString()}`,
      );
      setAppointments(result);
      return result;
    },
    [],
  );

  const loadDashboard = useCallback(async () => {
    try {
      const auth = await apiRequest<{ user: AuthUser }>("/auth/me");
      if (auth.user.role !== "ADMIN" && auth.user.role !== "STAFF") {
        throw new SessionExpiredError("This account cannot use the dashboard.");
      }
      setUser(auth.user);
      const [summary, dentistList] = await Promise.all([
        apiRequest<DashboardOverview>("/appointments/admin/overview"),
        apiRequest<Dentist[]>("/dentists"),
      ]);
      const today = summary.today;
      const nextFilters = {
        ...filters,
        from: today,
        to: addDays(today, 30),
      };
      setOverview(summary);
      setDentists(dentistList);
      setFilters(nextFilters);
      setRescheduleDate(today);
      await loadAppointments(nextFilters);
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setLoading(false);
    }
    // Initial filters are intentionally captured once for the first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleError, loadAppointments]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadDashboard]);

  async function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSelected(null);
    try {
      await loadAppointments(filters);
    } catch (requestError) {
      handleError(requestError);
    }
  }

  async function openAppointment(id: string) {
    setError("");
    setNotice("");
    setAvailability(null);
    try {
      const detail = await apiRequest<AppointmentDetail>(
        `/appointments/admin/${id}`,
      );
      setSelected(detail);
      setCancelReason(detail.cancellationReason ?? "");
      setRescheduleDate(
        localDate(
          new Date(detail.scheduledAt),
          overview?.timeZone ?? "Asia/Manila",
        ),
      );
    } catch (requestError) {
      handleError(requestError);
    }
  }

  async function refreshAfterChange(id: string, message: string) {
    const [summary, detail] = await Promise.all([
      apiRequest<DashboardOverview>("/appointments/admin/overview"),
      apiRequest<AppointmentDetail>(`/appointments/admin/${id}`),
      loadAppointments(filters, appointments?.pagination.page ?? 1),
    ]);
    setOverview(summary);
    setSelected(detail);
    setNotice(message);
  }

  async function changeStatus(status: AppointmentStatus) {
    if (!selected) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/appointments/admin/${selected.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          ...(status === "CANCELLED"
            ? { cancellationReason: cancelReason }
            : {}),
        }),
      });
      await refreshAfterChange(
        selected.id,
        `Appointment marked ${statusLabel(status).toLowerCase()}.`,
      );
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setWorking(false);
    }
  }

  async function findRescheduleSlots() {
    if (!selected) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const query = new URLSearchParams({
        dentistId: selected.dentist.id,
        serviceId: selected.service.id,
        date: rescheduleDate,
      });
      const result = await apiRequest<Availability>(
        `/availability?${query.toString()}`,
      );
      setAvailability(result);
      if (!result.slots.length) {
        setNotice("No available times were found for that date.");
      }
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setWorking(false);
    }
  }

  async function reschedule(scheduledAt: string) {
    if (!selected) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/appointments/admin/${selected.id}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({ scheduledAt }),
      });
      setAvailability(null);
      await refreshAfterChange(selected.id, "Appointment rescheduled.");
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setWorking(false);
    }
  }

  async function logout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch {
      // Local state is cleared even if the API session has already expired.
    }
    router.replace("/admin/login");
    router.refresh();
  }

  const timeZone =
    overview?.timeZone ?? appointments?.timeZone ?? "Asia/Manila";
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-PH", {
        timeZone,
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [timeZone],
  );

  if (loading) {
    return (
      <main className="admin-loading" role="status">
        <span className="admin-spinner" aria-hidden="true" />
        Loading clinic dashboard…
      </main>
    );
  }

  return (
    <div className="admin-app">
      <AdminSidebar active="dashboard" />

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">Clinic operations</p>
            <h1>Good day, {user?.name?.split(" ")[0] ?? "staff"}.</h1>
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

        <section id="overview" aria-labelledby="overview-title">
          <div className="admin-section-heading">
            <div>
              <p className="eyebrow">{overview?.today}</p>
              <h2 id="overview-title">Today at a glance</h2>
            </div>
            <p>Times use {timeZone}.</p>
          </div>
          <div className="admin-stat-grid">
            {overview
              ? [
                  [
                    "Today's appointments",
                    overview.statistics.todayAppointments,
                  ],
                  ["Pending requests", overview.statistics.pendingRequests],
                  ["Upcoming", overview.statistics.upcomingAppointments],
                  ["Confirmed", overview.statistics.confirmedAppointments],
                  [
                    "Cancelled today",
                    overview.statistics.cancelledAppointments,
                  ],
                  ["No-shows today", overview.statistics.noShowAppointments],
                ].map(([label, value]) => (
                  <article className="admin-stat" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))
              : null}
          </div>
        </section>

        <section id="appointments" className="admin-appointments-section">
          <div className="admin-section-heading">
            <div>
              <p className="eyebrow">Appointment calendar</p>
              <h2>Schedule and requests</h2>
            </div>
            <p>{appointments?.pagination.total ?? 0} matching appointments</p>
          </div>

          <form className="admin-filters" onSubmit={applyFilters}>
            <label>
              From
              <input
                type="date"
                value={filters.from}
                onChange={(event) =>
                  setFilters({ ...filters, from: event.target.value })
                }
                required
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={filters.to}
                onChange={(event) =>
                  setFilters({ ...filters, to: event.target.value })
                }
                required
              />
            </label>
            <label>
              Dentist
              <select
                value={filters.dentistId}
                onChange={(event) =>
                  setFilters({ ...filters, dentistId: event.target.value })
                }
              >
                <option value="">All dentists</option>
                {dentists.map((dentist) => (
                  <option value={dentist.id} key={dentist.id}>
                    {dentist.name}
                  </option>
                ))}
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
                {[
                  "PENDING",
                  "CONFIRMED",
                  "RESCHEDULED",
                  "COMPLETED",
                  "CANCELLED",
                  "NO_SHOW",
                ].map((status) => (
                  <option value={status} key={status}>
                    {statusLabel(status as AppointmentStatus)}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-primary" type="submit">
              Apply filters
            </button>
          </form>

          <div id="calendar" className="admin-appointment-layout">
            <div className="admin-appointment-list">
              {appointments?.items.length ? (
                appointments.items.map((appointment) => (
                  <button
                    className={`admin-appointment-row${selected?.id === appointment.id ? " selected" : ""}`}
                    type="button"
                    key={appointment.id}
                    onClick={() => openAppointment(appointment.id)}
                  >
                    <time dateTime={appointment.scheduledAt}>
                      {dateTimeFormatter.format(
                        new Date(appointment.scheduledAt),
                      )}
                    </time>
                    <span className="admin-patient-name">
                      {appointment.patient.firstName}{" "}
                      {appointment.patient.lastName}
                    </span>
                    <span>{appointment.service.name}</span>
                    <span>{appointment.dentist.name}</span>
                    <span
                      className={`admin-status status-${appointment.status.toLowerCase()}`}
                    >
                      {statusLabel(appointment.status)}
                    </span>
                  </button>
                ))
              ) : (
                <div className="admin-empty">
                  <h3>No appointments in this range.</h3>
                  <p>
                    Adjust the filters or wait for a new appointment request.
                  </p>
                </div>
              )}

              {appointments && appointments.pagination.pages > 1 ? (
                <div className="admin-pagination">
                  <button
                    type="button"
                    disabled={appointments.pagination.page <= 1}
                    onClick={() =>
                      loadAppointments(
                        filters,
                        appointments.pagination.page - 1,
                      ).catch(handleError)
                    }
                  >
                    Previous
                  </button>
                  <span>
                    Page {appointments.pagination.page} of{" "}
                    {appointments.pagination.pages}
                  </span>
                  <button
                    type="button"
                    disabled={
                      appointments.pagination.page >=
                      appointments.pagination.pages
                    }
                    onClick={() =>
                      loadAppointments(
                        filters,
                        appointments.pagination.page + 1,
                      ).catch(handleError)
                    }
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>

            <aside className="admin-detail" aria-live="polite">
              {selected ? (
                <>
                  <div className="admin-detail-heading">
                    <div>
                      <p className="eyebrow">Appointment details</p>
                      <h3>
                        {selected.patient.firstName} {selected.patient.lastName}
                      </h3>
                    </div>
                    <button
                      type="button"
                      aria-label="Close appointment details"
                      onClick={() => setSelected(null)}
                    >
                      ×
                    </button>
                  </div>
                  <span
                    className={`admin-status status-${selected.status.toLowerCase()}`}
                  >
                    {statusLabel(selected.status)}
                  </span>
                  <dl className="admin-detail-list">
                    <div>
                      <dt>Date and time</dt>
                      <dd>
                        {dateTimeFormatter.format(
                          new Date(selected.scheduledAt),
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Service</dt>
                      <dd>{selected.service.name}</dd>
                    </div>
                    <div>
                      <dt>Dentist</dt>
                      <dd>{selected.dentist.name}</dd>
                    </div>
                    <div>
                      <dt>Phone</dt>
                      <dd>
                        <a href={`tel:${selected.patient.phone}`}>
                          {selected.patient.phone}
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>
                        <a href={`mailto:${selected.patient.email}`}>
                          {selected.patient.email}
                        </a>
                      </dd>
                    </div>
                  </dl>

                  {selected.status === "PENDING" ||
                  selected.status === "RESCHEDULED" ? (
                    <button
                      className="button button-primary admin-action-full"
                      type="button"
                      disabled={working}
                      onClick={() => changeStatus("CONFIRMED")}
                    >
                      Confirm appointment
                    </button>
                  ) : null}

                  {selected.status === "CONFIRMED" ? (
                    <div className="admin-action-row">
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => changeStatus("COMPLETED")}
                      >
                        Mark completed
                      </button>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => changeStatus("NO_SHOW")}
                      >
                        Mark no-show
                      </button>
                    </div>
                  ) : null}

                  {!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(
                    selected.status,
                  ) ? (
                    <details className="admin-detail-action">
                      <summary>Reschedule</summary>
                      <label>
                        Choose a date
                        <input
                          type="date"
                          min={overview?.today}
                          value={rescheduleDate}
                          onChange={(event) => {
                            setRescheduleDate(event.target.value);
                            setAvailability(null);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={working || !rescheduleDate}
                        onClick={findRescheduleSlots}
                      >
                        Find available times
                      </button>
                      {availability?.slots.length ? (
                        <div className="admin-slot-list">
                          {availability.slots.map((slot) => (
                            <button
                              type="button"
                              disabled={working}
                              key={slot.scheduledAt}
                              onClick={() => reschedule(slot.scheduledAt)}
                            >
                              {slot.time}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </details>
                  ) : null}

                  {!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(
                    selected.status,
                  ) ? (
                    <details className="admin-detail-action danger">
                      <summary>Cancel appointment</summary>
                      <label>
                        Cancellation reason
                        <textarea
                          maxLength={500}
                          rows={3}
                          value={cancelReason}
                          onChange={(event) =>
                            setCancelReason(event.target.value)
                          }
                        />
                      </label>
                      <button
                        type="button"
                        disabled={working || !cancelReason.trim()}
                        onClick={() => changeStatus("CANCELLED")}
                      >
                        Confirm cancellation
                      </button>
                    </details>
                  ) : null}

                  {selected.cancellationReason ? (
                    <div className="admin-cancellation-note">
                      <strong>Cancellation reason</strong>
                      <p>{selected.cancellationReason}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="admin-detail-placeholder">
                  <span aria-hidden="true">↗</span>
                  <h3>Select an appointment</h3>
                  <p>
                    Contact details appear only after an authorized staff member
                    opens one appointment.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
