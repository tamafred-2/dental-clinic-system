export type Clinic = {
  id: string;
  slug: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  timeZone: string;
  openingHours: string;
  appointmentPolicy: string;
  cancellationPolicy: string;
};

export type DentalService = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
};

export type Dentist = {
  id: string;
  name: string;
  title: string;
  bio: string | null;
  specializations: string[];
  photoUrl: string | null;
  active: boolean;
};

export type Faq = {
  id: string;
  question: string;
  answer: string;
};

export const fallbackClinic: Clinic = {
  id: "demo-clinic",
  slug: "dental-clinic",
  name: "Dental Clinic Website",
  address: "Calasiao, Pangasinan, Philippines",
  phone: "+63 75 555 0142",
  email: "hello@dentalclinic.test",
  timeZone: "Asia/Manila",
  openingHours: "Monday-Friday, 9:00 AM-6:00 PM",
  appointmentPolicy:
    "Please arrive 10 minutes before your appointment and bring a valid photo ID.",
  cancellationPolicy:
    "Please contact the clinic at least 24 hours before your appointment to cancel or reschedule.",
};

export const fallbackServices: DentalService[] = [
  {
    id: "consultation",
    name: "Dental Consultation",
    description:
      "A thorough oral assessment and a clear, practical treatment plan.",
    durationMinutes: 30,
  },
  {
    id: "cleaning",
    name: "Dental Cleaning",
    description:
      "Professional cleaning to support healthy teeth, gums, and fresh breath.",
    durationMinutes: 45,
  },
  {
    id: "restoration",
    name: "Dental Filling",
    description: "Careful restoration for cavities and minor tooth damage.",
    durationMinutes: 60,
  },
];

export const fallbackDentists: Dentist[] = [
  {
    id: "ava",
    name: "Dr. Ava Santos",
    title: "General Dentist",
    bio: "Focused on preventive care and making every visit easy to understand.",
    specializations: ["Preventive care", "Restorative dentistry"],
    photoUrl: null,
    active: true,
  },
  {
    id: "noah",
    name: "Dr. Noah Lim",
    title: "Orthodontist",
    bio: "Provides considered orthodontic care for children, teens, and adults.",
    specializations: ["Braces", "Clear aligners"],
    photoUrl: null,
    active: true,
  },
  {
    id: "mia",
    name: "Dr. Mia Reyes",
    title: "Pediatric Dentist",
    bio: "Creates calm, positive dental experiences for young patients and families.",
    specializations: ["Children's dentistry"],
    photoUrl: null,
    active: true,
  },
];

export const fallbackFaqs: Faq[] = [
  {
    id: "appointments",
    question: "Do I need an appointment?",
    answer:
      "Appointments are recommended so the clinic can reserve enough time for your visit.",
  },
  {
    id: "first-visit",
    question: "What should I bring to my first visit?",
    answer:
      "Please bring a valid ID and any relevant dental records or insurance information.",
  },
  {
    id: "children",
    question: "Do you treat children?",
    answer:
      "Yes. The clinic provides age-appropriate dental care for children.",
  },
  {
    id: "emergency",
    question: "What if I have a dental emergency?",
    answer:
      "Contact the clinic immediately. For severe bleeding, swelling, or trauma, seek urgent medical care.",
  },
];

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function apiFetchOptional<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiUrl}/api${path}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, fallback: T): Promise<T> {
  return (await apiFetchOptional<T>(path)) ?? fallback;
}

export function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}
