import { createHash } from 'node:crypto';
import { KnowledgeSourceType } from '@prisma/client';
import { KNOWLEDGE_CHUNK_CHARACTER_LIMIT } from './knowledge.constants';
import type { KnowledgeSourceDocument } from './knowledge.types';

type KnowledgeSnapshot = {
  clinics: Array<{
    id: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    timeZone: string;
    openingHours: string;
    appointmentPolicy: string;
    cancellationPolicy: string;
    hours: Array<{ day: string; startTime: string; endTime: string }>;
  }>;
  services: Array<{
    id: string;
    name: string;
    description: string;
    durationMinutes: number;
  }>;
  faqs: Array<{ id: string; question: string; answer: string }>;
  dentists: Array<{
    id: string;
    name: string;
    title: string;
    bio: string;
    specializations: string[];
  }>;
};

function document(
  sourceType: KnowledgeSourceType,
  sourceId: string,
  title: string,
  content: string,
): KnowledgeSourceDocument {
  const normalizedContent = content.trim().replace(/\r\n/g, '\n');
  return {
    key: `${sourceType}:${sourceId}`,
    sourceType,
    sourceId,
    title,
    content: normalizedContent,
    published: true,
    checksum: createHash('sha256').update(normalizedContent).digest('hex'),
  };
}

export function buildKnowledgeDocuments(
  snapshot: KnowledgeSnapshot,
): KnowledgeSourceDocument[] {
  return [
    ...snapshot.clinics.map((clinic) =>
      document(
        KnowledgeSourceType.CLINIC,
        clinic.id,
        clinic.name,
        [
          `Clinic name: ${clinic.name}`,
          `Address: ${clinic.address}`,
          `Phone: ${clinic.phone}`,
          `Email: ${clinic.email}`,
          `Time zone: ${clinic.timeZone}`,
          `Opening hours summary: ${clinic.openingHours}`,
          ...clinic.hours.map(
            (hour) => `${hour.day}: ${hour.startTime}-${hour.endTime}`,
          ),
          `Appointment policy: ${clinic.appointmentPolicy}`,
          `Cancellation policy: ${clinic.cancellationPolicy}`,
        ].join('\n'),
      ),
    ),
    ...snapshot.services.map((service) =>
      document(
        KnowledgeSourceType.SERVICE,
        service.id,
        service.name,
        [
          `Service: ${service.name}`,
          `Description: ${service.description}`,
          `Expected appointment duration: ${service.durationMinutes} minutes`,
          'Treatment suitability and final pricing require assessment by clinic staff or a dentist.',
        ].join('\n'),
      ),
    ),
    ...snapshot.faqs.map((faq) =>
      document(
        KnowledgeSourceType.FAQ,
        faq.id,
        faq.question,
        `Question: ${faq.question}\nAnswer: ${faq.answer}`,
      ),
    ),
    ...snapshot.dentists.map((dentist) =>
      document(
        KnowledgeSourceType.DENTIST,
        dentist.id,
        dentist.name,
        [
          `Dentist: ${dentist.name}`,
          `Title: ${dentist.title}`,
          `Biography: ${dentist.bio}`,
          `Specializations: ${dentist.specializations.join(', ')}`,
          'Current availability must be checked through the appointment system.',
        ].join('\n'),
      ),
    ),
  ];
}

export function chunkKnowledgeContent(
  content: string,
  limit = KNOWLEDGE_CHUNK_CHARACTER_LIMIT,
) {
  const paragraphs = content
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > limit) {
      if (current) chunks.push(current);
      for (let offset = 0; offset < paragraph.length; offset += limit) {
        chunks.push(paragraph.slice(offset, offset + limit));
      }
      current = '';
      continue;
    }

    const candidate = current ? `${current}\n${paragraph}` : paragraph;
    if (candidate.length > limit) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
