import "dotenv/config";
import * as argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import { LOCAL_EMBEDDING_MODEL } from "../apps/api/src/knowledge/knowledge.constants";
import {
  buildKnowledgeDocuments,
  chunkKnowledgeContent,
} from "../apps/api/src/knowledge/knowledge-source";
import { createLocalEmbedding } from "../apps/api/src/knowledge/local-embedding";

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

const conversationPrompts = [
  "What time does the clinic open on weekdays?",
  "Can I request a dental cleaning next week?",
  "Do you provide dental care for children?",
  "I need help rescheduling my appointment.",
  "How long does a dental consultation take?",
  "Do you offer clear aligner consultations?",
  "What should I bring to my first visit?",
  "Can I choose a specific dentist?",
  "How early should I arrive for an appointment?",
  "I would like information about teeth whitening.",
  "What should I do about urgent dental pain?",
  "Where is the clinic located?",
] as const;

const conversationStatuses = [
  "AI_ACTIVE",
  "HUMAN_REQUIRED",
  "HUMAN_ACTIVE",
  "CLOSED",
] as const;

async function main() {
  // Development-only reset: these records are all generated fake data.
  await prisma.knowledgeDocument.deleteMany();
  await prisma.message.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.appointmentIntent.deleteMany();
  await prisma.conversation.deleteMany();
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

  const admin = await prisma.user.create({
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

  const [
    knowledgeClinics,
    knowledgeServices,
    knowledgeFaqs,
    knowledgeDentists,
  ] = await Promise.all([
    prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        timeZone: true,
        openingHours: true,
        appointmentPolicy: true,
        cancellationPolicy: true,
        hours: {
          orderBy: { day: "asc" },
          select: { day: true, startTime: true, endTime: true },
        },
      },
    }),
    prisma.service.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
      },
    }),
    prisma.faq.findMany({
      where: { published: true },
      select: { id: true, question: true, answer: true },
    }),
    prisma.dentist.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        title: true,
        bio: true,
        specializations: true,
      },
    }),
  ]);
  const knowledgeDocuments = buildKnowledgeDocuments({
    clinics: knowledgeClinics,
    services: knowledgeServices,
    faqs: knowledgeFaqs,
    dentists: knowledgeDentists,
  });

  for (const knowledgeDocument of knowledgeDocuments) {
    const chunks = chunkKnowledgeContent(knowledgeDocument.content);
    await prisma.knowledgeDocument.create({
      data: {
        ...knowledgeDocument,
        chunks: {
          create: chunks.map((content, chunkIndex) => ({
            chunkIndex,
            content,
            embedding: createLocalEmbedding(content),
            embeddingModel: LOCAL_EMBEDDING_MODEL,
          })),
        },
      },
    });
  }

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

  const createdPatients = await prisma.patient.findMany({
    orderBy: { email: "asc" },
    take: conversationPrompts.length,
    select: { id: true },
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

  for (const [index, prompt] of conversationPrompts.entries()) {
    const channel = index % 3 === 0 ? "FACEBOOK_MESSENGER" : "WEBSITE";
    const status = conversationStatuses[index % conversationStatuses.length];
    const startedAt = new Date(Date.now() - (index + 1) * 45 * 60_000);
    const conversation = await prisma.conversation.create({
      data: {
        patientId: createdPatients[index].id,
        channel,
        channelReference: `synthetic-${channel.toLowerCase()}-${String(index + 1).padStart(2, "0")}`,
        status,
        assignedStaffId: status === "HUMAN_ACTIVE" ? admin.id : null,
        createdAt: startedAt,
        updatedAt: startedAt,
      },
    });

    const messages: Prisma.MessageCreateManyInput[] = [
      {
        conversationId: conversation.id,
        senderType: "PATIENT",
        content: prompt,
        metadata: { synthetic: true, channel },
        createdAt: startedAt,
      },
    ];

    // AI-active examples deliberately end with a patient message so the
    // protected dashboard "AI reply" action is available for local testing.
    if (status !== "AI_ACTIVE") {
      messages.push({
        conversationId: conversation.id,
        senderType: "AI",
        content:
          "This is synthetic conversation history for demonstrating channel-independent storage.",
        metadata: { synthetic: true },
        createdAt: new Date(startedAt.getTime() + 60_000),
      });
    }

    if (status === "HUMAN_REQUIRED") {
      messages.push({
        conversationId: conversation.id,
        senderType: "SYSTEM",
        content: "The conversation was queued for human assistance.",
        metadata: { synthetic: true },
        createdAt: new Date(startedAt.getTime() + 120_000),
      });
    }
    if (status === "HUMAN_ACTIVE" || status === "CLOSED") {
      messages.push({
        conversationId: conversation.id,
        senderUserId: admin.id,
        senderType: "STAFF",
        content:
          status === "CLOSED"
            ? "This synthetic conversation has been resolved and closed."
            : "A staff member is reviewing this synthetic conversation.",
        metadata: { synthetic: true },
        createdAt: new Date(startedAt.getTime() + 120_000),
      });
    }

    await prisma.message.createMany({ data: messages });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: messages.at(-1)!.createdAt },
    });
  }

  console.log(
    `Seeded 1 clinic, 1 admin, 10 dentists, 12 services, 15 FAQs, ${knowledgeDocuments.length} knowledge documents, 30 patients, 50 schedules, 12 conversations, and synthetic messages.`,
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
