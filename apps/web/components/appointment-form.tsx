"use client";

import { FormEvent, useRef, useState } from "react";
import type { DentalService, Dentist } from "../lib/api";

type AvailabilitySlot = {
  time: string;
  scheduledAt: string;
  endAt: string;
};

type AvailabilityResponse = {
  date: string;
  timeZone: string;
  slots: AvailabilitySlot[];
};

type AppointmentConfirmation = {
  id: string;
  status: "PENDING";
  scheduledAt: string;
  endAt: string;
  dentist: { name: string; title: string };
  service: { name: string; durationMinutes: number };
};

type Selection = {
  serviceId: string;
  dentistId: string;
  date: string;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function readableError(status: number, code?: string) {
  if (status === 429) {
    return "Too many requests were sent. Please wait a minute and try again.";
  }
  if (code === "APPOINTMENT_SLOT_UNAVAILABLE") {
    return "That time was just taken or is no longer available. Please choose another slot.";
  }
  if (code === "APPOINTMENT_CONTACT_VERIFICATION_REQUIRED") {
    return "These contact details could not be verified. Please call the clinic for assistance.";
  }
  if (code === "APPOINTMENT_PENDING_LIMIT_REACHED") {
    return "You already have several pending requests. Please contact the clinic to review them.";
  }
  if (status === 400) {
    return "Please review the form and make sure every field is valid.";
  }
  if (status === 404) {
    return "The selected dentist or service is no longer available. Please refresh the page.";
  }
  if (status >= 500) {
    return "The booking service is temporarily unavailable. Please try again later or call the clinic.";
  }
  return "We could not complete the request. Please try again.";
}

export function AppointmentForm({
  services,
  dentists,
  timeZone,
  minimumDate,
  maximumDate,
}: {
  services: DentalService[];
  dentists: Dentist[];
  timeZone: string;
  minimumDate: string;
  maximumDate: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const availabilityRequest = useRef<AbortController | null>(null);
  const [selection, setSelection] = useState<Selection>({
    serviceId: "",
    dentistId: "",
    date: "",
  });
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [availabilityState, setAvailabilityState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] =
    useState<AppointmentConfirmation | null>(null);

  async function loadAvailability(next: Selection) {
    availabilityRequest.current?.abort();
    setSlots([]);
    setSelectedSlot("");
    setError("");

    if (!next.serviceId || !next.dentistId || !next.date) {
      setAvailabilityState("idle");
      return;
    }

    const controller = new AbortController();
    availabilityRequest.current = controller;
    setAvailabilityState("loading");

    try {
      const query = new URLSearchParams(next);
      const response = await fetch(`${apiUrl}/api/availability?${query}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(String(response.status));
      }

      const result = (await response.json()) as AvailabilityResponse;
      setSlots(result.slots);
      setAvailabilityState("ready");
    } catch (requestError) {
      if (
        requestError instanceof DOMException &&
        requestError.name === "AbortError"
      ) {
        return;
      }
      setAvailabilityState("error");
    }
  }

  function updateSelection(field: keyof Selection, value: string) {
    const next = { ...selection, [field]: value };
    setSelection(next);
    void loadAvailability(next);
  }

  async function submitAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedSlot) {
      setError("Choose an available appointment time before submitting.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const request = {
      website: String(form.get("website") ?? ""),
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      serviceId: selection.serviceId,
      dentistId: selection.dentistId,
      scheduledAt: selectedSlot,
      privacyConsent: form.get("privacyConsent") === "on",
    };

    setSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/api/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const result = (await response.json()) as AppointmentConfirmation & {
        code?: string;
      };

      if (!response.ok) {
        setError(readableError(response.status, result.code));
        if (result.code === "APPOINTMENT_SLOT_UNAVAILABLE") {
          void loadAvailability(selection);
        }
        return;
      }

      setConfirmation(result);
      formRef.current?.reset();
    } catch {
      setError(
        "The clinic API could not be reached. Check your connection or call the clinic.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startAnotherRequest() {
    setConfirmation(null);
    setSelection({ serviceId: "", dentistId: "", date: "" });
    setSlots([]);
    setSelectedSlot("");
    setAvailabilityState("idle");
    setError("");
  }

  if (confirmation) {
    const appointmentTime = new Intl.DateTimeFormat("en-PH", {
      timeZone,
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(confirmation.scheduledAt));

    return (
      <section className="booking-success" aria-live="polite">
        <span className="success-mark" aria-hidden="true">
          ✓
        </span>
        <p className="eyebrow">Request received</p>
        <h2>Your appointment request is pending.</h2>
        <p>
          The clinic still needs to confirm this request. Please do not consider
          it a confirmed appointment yet.
        </p>
        <dl>
          <div>
            <dt>Reference</dt>
            <dd>{confirmation.id.slice(-8).toUpperCase()}</dd>
          </div>
          <div>
            <dt>Service</dt>
            <dd>{confirmation.service.name}</dd>
          </div>
          <div>
            <dt>Dentist</dt>
            <dd>{confirmation.dentist.name}</dd>
          </div>
          <div>
            <dt>Requested time</dt>
            <dd>{appointmentTime}</dd>
          </div>
        </dl>
        <button
          className="button button-secondary"
          type="button"
          onClick={startAnotherRequest}
        >
          Make another request
        </button>
      </section>
    );
  }

  return (
    <form
      className="appointment-form"
      ref={formRef}
      onSubmit={submitAppointment}
    >
      <div className="form-trap" aria-hidden="true">
        <label htmlFor="appointment-website">Leave this field empty</label>
        <input
          id="appointment-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <fieldset>
        <legend>
          <span>01</span>Your contact details
        </legend>
        <p className="field-help">
          We use these details only to manage and confirm your request.
        </p>
        <div className="form-grid form-grid-two">
          <label>
            First name
            <input
              name="firstName"
              autoComplete="given-name"
              required
              maxLength={80}
            />
          </label>
          <label>
            Last name
            <input
              name="lastName"
              autoComplete="family-name"
              required
              maxLength={80}
            />
          </label>
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          <label>
            Contact number
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              maxLength={25}
              pattern="[+0-9][0-9 ()-]{6,24}"
              placeholder="+63 917 123 4567"
            />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>
          <span>02</span>Choose your visit
        </legend>
        <p className="field-help">
          Select a service, dentist, and date to see live availability.
        </p>
        <div className="form-grid form-grid-three">
          <label>
            Service
            <select
              required
              value={selection.serviceId}
              onChange={(event) =>
                updateSelection("serviceId", event.target.value)
              }
            >
              <option value="">Select a service</option>
              {services.map((service) => (
                <option value={service.id} key={service.id}>
                  {service.name} ({service.durationMinutes} min)
                </option>
              ))}
            </select>
          </label>
          <label>
            Preferred dentist
            <select
              required
              value={selection.dentistId}
              onChange={(event) =>
                updateSelection("dentistId", event.target.value)
              }
            >
              <option value="">Select a dentist</option>
              {dentists.map((dentist) => (
                <option value={dentist.id} key={dentist.id}>
                  {dentist.name} — {dentist.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Preferred date
            <input
              type="date"
              required
              min={minimumDate}
              max={maximumDate}
              value={selection.date}
              onChange={(event) => updateSelection("date", event.target.value)}
            />
          </label>
        </div>

        <div className="availability-box" aria-live="polite">
          {availabilityState === "idle" && (
            <p>Select all three options to view available times.</p>
          )}
          {availabilityState === "loading" && (
            <p className="loading-text">Checking the clinic schedule…</p>
          )}
          {availabilityState === "error" && (
            <p className="form-error">
              Availability could not be loaded. Please try again.
            </p>
          )}
          {availabilityState === "ready" && slots.length === 0 && (
            <p>
              No times are available on this date. Please choose another day.
            </p>
          )}
          {availabilityState === "ready" && slots.length > 0 && (
            <>
              <p className="slot-heading">
                Available times <span>{timeZone}</span>
              </p>
              <div className="slot-grid">
                {slots.map((slot) => (
                  <label
                    className={
                      selectedSlot === slot.scheduledAt
                        ? "time-slot selected"
                        : "time-slot"
                    }
                    key={slot.scheduledAt}
                  >
                    <input
                      type="radio"
                      name="scheduledAt"
                      value={slot.scheduledAt}
                      checked={selectedSlot === slot.scheduledAt}
                      onChange={() => setSelectedSlot(slot.scheduledAt)}
                    />
                    <span>
                      {new Intl.DateTimeFormat("en-PH", {
                        timeZone,
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(slot.scheduledAt))}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </fieldset>

      <fieldset className="consent-fieldset">
        <legend>
          <span>03</span>Review and send
        </legend>
        <label className="consent-check">
          <input name="privacyConsent" type="checkbox" required />
          <span>
            I agree that the clinic may use these details to process and contact
            me about this appointment request.
          </span>
        </label>
        <p className="request-notice">
          Submitting creates a pending request, not a confirmed appointment.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button button-primary submit-button"
          type="submit"
          disabled={submitting || !selectedSlot}
        >
          {submitting ? "Sending request…" : "Send appointment request"}
        </button>
      </fieldset>
    </form>
  );
}
