import "dotenv/config";
import * as argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const dentists = [
  [
    "Ava Santos",
    "General Dentist",
    ["Preventive Care", "Restorative Dentistry"],
  ],
  ["Noah Lim", "Orthodontist", ["Braces", "Clear Aligners"]],
  [
    "Mia Reyes",
    "Pediatric Dentist",
    ["Children's Dentistry", "Preventive Care"],
  ],
  ["Ethan Tan", "Endodontist", ["Root Canal Treatment", "Dental Trauma"]],
  ["Olivia Cruz", "Periodontist", ["Gum Health", "Dental Implants"]],
  ["Liam Wong", "Oral Surgeon", ["Tooth Extraction", "Wisdom Teeth"]],
  ["Sophia Lee", "Cosmetic Dentist", ["Teeth Whitening", "Veneers"]],
  ["Lucas Garcia", "Prosthodontist", ["Crowns", "Dentures"]],
  ["Isla Martin", "General Dentist", ["Family Dentistry", "Dental Fillings"]],
  ["Henry Chua", "Orthodontist", ["Clear Aligners", "Retainers"]],
] as const;

const services = [
  ["Dental Consultation", "A comprehensive oral-health consultation.", 30],
  ["Dental Cleaning", "Professional cleaning and plaque removal.", 45],
  ["Dental Filling", "Restoration for a cavity or minor tooth damage.", 60],
  ["Tooth Extraction", "Removal of a tooth when clinically required.", 60],
  ["Teeth Whitening", "Professional whitening consultation and treatment.", 60],
  [
    "Root Canal Treatment",
    "Treatment for an infected or damaged tooth pulp.",
    90,
  ],
  ["Dental Crown", "Consultation and preparation for a dental crown.", 90],
  ["Braces Consultation", "Orthodontic assessment for braces.", 45],
  ["Clear Aligner Consultation", "Assessment for clear aligner treatment.", 45],
  ["Pediatric Dental Visit", "Routine dental care for children.", 30],
  ["Gum Treatment", "Assessment and treatment for gum health.", 60],
  [
    "Emergency Dental Visit",
    "Urgent assessment for dental pain or injury.",
    30,
  ],
] as const;

const faqs = [
  [
    "Do I need an appointment?",
    "Appointments are recommended so we can reserve time for your visit.",
  ],
  [
    "What should I bring to my first visit?",
    "Please bring a valid ID and any relevant dental records or insurance information.",
  ],
  [
    "How often should I have a dental checkup?",
    "Most patients benefit from a checkup every six months; your dentist may recommend a different schedule.",
  ],
  [
    "Do you treat children?",
    "Yes. We provide age-appropriate dental care for children.",
  ],
  [
    "What happens during a dental cleaning?",
    "Your dental team removes plaque and tartar, polishes teeth, and reviews your oral health.",
  ],
  [
    "Can I reschedule an appointment?",
    "Yes. Please contact the clinic as early as possible so we can offer another available time.",
  ],
  [
    "Do you accept walk-ins?",
    "We will assist walk-ins when capacity allows, but an appointment is the best way to secure a slot.",
  ],
  [
    "How long does a consultation take?",
    "A standard consultation usually takes around 30 minutes.",
  ],
  [
    "What if I have a dental emergency?",
    "Contact the clinic immediately. If you have severe bleeding, swelling, or trauma, seek urgent medical care.",
  ],
  [
    "Do you offer teeth whitening?",
    "Yes. Your dentist will first check whether whitening is suitable for you.",
  ],
  [
    "How do I care for my teeth between visits?",
    "Brush twice daily with fluoride toothpaste, clean between teeth daily, and follow your dentist's advice.",
  ],
  [
    "Can I choose my dentist?",
    "Yes, subject to the dentist's availability and the service you need.",
  ],
  [
    "Are treatment prices fixed?",
    "A treatment plan and estimate are provided after clinical assessment when needed.",
  ],
  [
    "Do you provide orthodontic treatment?",
    "Yes. We offer orthodontic consultations for braces and clear aligners.",
  ],
  [
    "How do I cancel an appointment?",
    "Contact the clinic as early as possible so the appointment can be released to another patient.",
  ],
] as const;

const firstNames = [
  "Alex",
  "Jamie",
  "Casey",
  "Taylor",
  "Jordan",
  "Riley",
  "Morgan",
  "Avery",
  "Quinn",
  "Parker",
];
const lastNames = [
  "Adams",
  "Bennett",
  "Carter",
  "Diaz",
  "Evans",
  "Flores",
  "Green",
  "Hughes",
  "Irwin",
  "Jones",
];
const weekdays = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
] as const;

async function main() {
  // Development-only reset: these records are all generated fake data.
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.blockedDate.deleteMany();
  await prisma.clinicHour.deleteMany();
  await prisma.dentist.deleteMany();
  await prisma.service.deleteMany();
  await prisma.faq.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.clinic.deleteMany();

  const clinic = await prisma.clinic.create({
    data: {
      slug: "dental-clinic-website",
      name: "Dental Clinic Website",
      address: "Calasiao, Pangasinan, Philippines",
      phone: "+63 75 555 0142",
      email: "hello@dentalclinic.test",
      timeZone: "Asia/Manila",
      openingHours: "Monday–Friday, 09:00–18:00",
      appointmentPolicy:
        "Please arrive 10 minutes before your appointment and bring a valid photo ID. Appointment requests are confirmed by the clinic.",
      cancellationPolicy:
        "Please contact the clinic at least 24 hours before your appointment if you need to cancel or reschedule. Repeated late cancellations or no-shows may require a deposit for future bookings.",
    },
  });

  await prisma.clinicHour.createMany({
    data: weekdays.map((day) => ({
      clinicId: clinic.id,
      day,
      startTime: "09:00",
      endTime: "18:00",
    })),
  });

  const passwordHash = await argon2.hash("DevelopmentOnlyPassword!2026", {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.user.create({
    data: {
      name: "Development Admin",
      email: "admin@brightsmile.test",
      passwordHash,
      role: "ADMIN",
    },
  });

  const createdDentists = await Promise.all(
    dentists.map(([name, title, specializations]) =>
      prisma.dentist.create({
        data: {
          name,
          title,
          bio: `${name} provides compassionate, evidence-based dental care.`,
          specializations: [...specializations],
        },
      }),
    ),
  );

  await prisma.service.createMany({
    data: services.map(([name, description, durationMinutes], index) => ({
      name,
      description,
      durationMinutes,
      displayOrder: index + 1,
    })),
  });

  await prisma.faq.createMany({
    data: faqs.map(([question, answer], index) => ({
      question,
      answer,
      displayOrder: index + 1,
    })),
  });

  await prisma.patient.createMany({
    data: Array.from({ length: 30 }, (_, index) => {
      const firstName = firstNames[index % firstNames.length];
      const lastName = lastNames[(index * 3) % lastNames.length];
      const sequence = String(index + 1).padStart(2, "0");

      return {
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${sequence}@example.test`,
        phone: `+63 917 000 ${String(index + 1).padStart(4, "0")}`,
      };
    }),
  });

  await prisma.schedule.createMany({
    data: createdDentists.flatMap((dentist) =>
      weekdays.map((day) => ({
        dentistId: dentist.id,
        day,
        startTime: "09:00",
        endTime: "17:00",
      })),
    ),
  });

  console.log(
    "Seeded 1 clinic, 1 admin, 10 dentists, 12 services, 15 FAQs, 30 patients, and 50 schedules.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
