import { HttpException, Injectable } from '@nestjs/common';
import { AppointmentIntentStatus } from '@prisma/client';
import { zodResponsesFunction } from 'openai/helpers/zod';
import { z } from 'zod';
import { AppointmentsService } from '../appointments/appointments.service';
import { AvailabilityService } from '../availability/availability.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AiToolExecution } from './ai.types';

const emptyArguments = z.object({});
const identifier = z.string().trim().min(1).max(64);
const checkAvailabilityArguments = z.object({
  dentistId: identifier,
  serviceId: identifier,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const prepareAppointmentArguments = z.object({
  dentistId: identifier,
  serviceId: identifier,
  scheduledAt: z.string().datetime({ offset: true }),
});
const createAppointmentArguments = z.object({ intentId: identifier });
const handoffArguments = z.object({
  reason: z.string().trim().min(1).max(240),
});

const confirmationSentence =
  'I confirm this appointment request and agree to the privacy policy.';
const intentLifetimeMinutes = 15;

export type AiToolContext = {
  conversationId: string;
  latestPatientMessageId: string;
  latestPatientMessage: string;
};

export type AiToolResult = {
  audit: AiToolExecution;
  output: Record<string, unknown>;
  requestedHandoff: boolean;
};

@Injectable()
export class AiToolsService {
  readonly definitions = [
    zodResponsesFunction({
      name: 'getClinicInformation',
      description: 'Get the clinic public contact details and policies.',
      parameters: emptyArguments,
    }),
    zodResponsesFunction({
      name: 'getServices',
      description: 'List active dental services and their durations.',
      parameters: emptyArguments,
    }),
    zodResponsesFunction({
      name: 'getDentists',
      description: 'List active dentists and their public specialties.',
      parameters: emptyArguments,
    }),
    zodResponsesFunction({
      name: 'getOpeningHours',
      description: 'Get clinic opening hours and timezone.',
      parameters: emptyArguments,
    }),
    zodResponsesFunction({
      name: 'getFAQs',
      description: 'List published clinic frequently asked questions.',
      parameters: emptyArguments,
    }),
    zodResponsesFunction({
      name: 'checkAvailability',
      description:
        'Get live appointment slots for one dentist, service, and clinic-local date.',
      parameters: checkAvailabilityArguments,
    }),
    zodResponsesFunction({
      name: 'prepareAppointmentRequest',
      description:
        'Validate a selected live slot and prepare a short-lived appointment intent. This does not create an appointment.',
      parameters: prepareAppointmentArguments,
    }),
    zodResponsesFunction({
      name: 'createAppointmentRequest',
      description:
        'Create a pending appointment from a prepared intent only after the patient explicitly confirms and consents to the privacy policy.',
      parameters: createAppointmentArguments,
    }),
    zodResponsesFunction({
      name: 'requestHumanHandoff',
      description:
        'Request a clinic staff member for sensitive or unsupported help.',
      parameters: handoffArguments,
    }),
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  async execute(
    name: string,
    rawArguments: string,
    context: AiToolContext,
  ): Promise<AiToolResult> {
    try {
      const parsed: unknown = JSON.parse(rawArguments);
      switch (name) {
        case 'getClinicInformation':
          emptyArguments.parse(parsed);
          return this.getClinicInformation(name);
        case 'getServices':
          emptyArguments.parse(parsed);
          return this.getServices(name);
        case 'getDentists':
          emptyArguments.parse(parsed);
          return this.getDentists(name);
        case 'getOpeningHours':
          emptyArguments.parse(parsed);
          return this.getOpeningHours(name);
        case 'getFAQs':
          emptyArguments.parse(parsed);
          return this.getFaqs(name);
        case 'checkAvailability':
          return this.checkAvailability(
            name,
            checkAvailabilityArguments.parse(parsed),
          );
        case 'prepareAppointmentRequest':
          return this.prepareAppointmentRequest(
            name,
            prepareAppointmentArguments.parse(parsed),
            context,
          );
        case 'createAppointmentRequest':
          return this.createAppointmentRequest(
            name,
            createAppointmentArguments.parse(parsed),
            context,
          );
        case 'requestHumanHandoff':
          return this.requestHumanHandoff(name, handoffArguments.parse(parsed));
        default:
          return this.failure(name, 'TOOL_NOT_ALLOWED');
      }
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof z.ZodError) {
        return this.failure(name, 'INVALID_TOOL_ARGUMENTS');
      }
      return this.failure(name, this.safeErrorCode(error));
    }
  }

  private async getClinicInformation(name: string): Promise<AiToolResult> {
    const clinic = await this.prisma.clinic.findFirst({
      orderBy: { createdAt: 'asc' },
      select: {
        name: true,
        address: true,
        phone: true,
        email: true,
        timeZone: true,
        openingHours: true,
        appointmentPolicy: true,
        cancellationPolicy: true,
      },
    });
    if (!clinic) return this.failure(name, 'CLINIC_NOT_CONFIGURED');
    return this.success(name, 'CLINIC_INFORMATION_FOUND', { clinic });
  }

  private async getServices(name: string): Promise<AiToolResult> {
    const services = await this.prisma.service.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
      },
    });
    return this.success(name, 'SERVICES_FOUND', { services });
  }

  private async getDentists(name: string): Promise<AiToolResult> {
    const dentists = await this.prisma.dentist.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        title: true,
        bio: true,
        specializations: true,
      },
    });
    return this.success(name, 'DENTISTS_FOUND', { dentists });
  }

  private async getOpeningHours(name: string): Promise<AiToolResult> {
    const clinic = await this.prisma.clinic.findFirst({
      orderBy: { createdAt: 'asc' },
      select: {
        timeZone: true,
        openingHours: true,
        hours: {
          orderBy: { day: 'asc' },
          select: { day: true, startTime: true, endTime: true },
        },
      },
    });
    if (!clinic) return this.failure(name, 'CLINIC_NOT_CONFIGURED');
    return this.success(name, 'OPENING_HOURS_FOUND', {
      clinic: {
        ...clinic,
        openingHours: this.formatTimesInText(clinic.openingHours),
        hours: clinic.hours.map((hour) => ({
          ...hour,
          startTime: this.formatClockTime(hour.startTime),
          endTime: this.formatClockTime(hour.endTime),
        })),
      },
    });
  }

  private async getFaqs(name: string): Promise<AiToolResult> {
    const faqs = await this.prisma.faq.findMany({
      where: { published: true },
      orderBy: { displayOrder: 'asc' },
      select: { question: true, answer: true },
    });
    return this.success(name, 'FAQS_FOUND', { faqs });
  }

  private async checkAvailability(
    name: string,
    arguments_: z.infer<typeof checkAvailabilityArguments>,
  ): Promise<AiToolResult> {
    const availability = await this.availabilityService.findSlots(arguments_);
    return this.success(name, 'AVAILABILITY_CHECKED', { availability });
  }

  private async prepareAppointmentRequest(
    name: string,
    arguments_: z.infer<typeof prepareAppointmentArguments>,
    context: AiToolContext,
  ): Promise<AiToolResult> {
    const scheduledAt = new Date(arguments_.scheduledAt);
    const clinic = await this.prisma.clinic.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { timeZone: true },
    });
    if (!clinic) return this.failure(name, 'CLINIC_NOT_CONFIGURED');

    const date = this.localDate(scheduledAt, clinic.timeZone);
    const availability = await this.availabilityService.findSlots({
      dentistId: arguments_.dentistId,
      serviceId: arguments_.serviceId,
      date,
    });
    const selectedSlot = availability.slots.find(
      (slot) => slot.scheduledAt === scheduledAt.toISOString(),
    );
    if (!selectedSlot) return this.failure(name, 'SLOT_UNAVAILABLE');

    const expiresAt = new Date(Date.now() + intentLifetimeMinutes * 60_000);
    const intent = await this.prisma.$transaction(async (transaction) => {
      await transaction.appointmentIntent.updateMany({
        where: {
          conversationId: context.conversationId,
          status: AppointmentIntentStatus.PENDING,
        },
        data: { status: AppointmentIntentStatus.CANCELLED },
      });
      return transaction.appointmentIntent.create({
        data: {
          conversationId: context.conversationId,
          dentistId: arguments_.dentistId,
          serviceId: arguments_.serviceId,
          scheduledAt,
          expiresAt,
        },
        select: {
          id: true,
          scheduledAt: true,
          expiresAt: true,
          dentist: { select: { name: true, title: true } },
          service: { select: { name: true, durationMinutes: true } },
        },
      });
    });

    return this.success(
      name,
      'APPOINTMENT_INTENT_PREPARED',
      {
        intent,
        confirmationRequired: true,
        requiredConfirmation: confirmationSentence,
      },
      intent.id,
    );
  }

  private async createAppointmentRequest(
    name: string,
    arguments_: z.infer<typeof createAppointmentArguments>,
    context: AiToolContext,
  ): Promise<AiToolResult> {
    const intent = await this.prisma.appointmentIntent.findFirst({
      where: {
        id: arguments_.intentId,
        conversationId: context.conversationId,
      },
      select: {
        id: true,
        dentistId: true,
        serviceId: true,
        scheduledAt: true,
        status: true,
        expiresAt: true,
        appointment: { select: { id: true } },
        conversation: {
          select: {
            patient: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });
    if (!intent) return this.failure(name, 'APPOINTMENT_INTENT_NOT_FOUND');
    if (
      intent.status === AppointmentIntentStatus.COMPLETED &&
      intent.appointment
    ) {
      return this.success(
        name,
        'APPOINTMENT_REQUEST_ALREADY_CREATED',
        { appointmentId: intent.appointment.id, status: 'PENDING' },
        intent.appointment.id,
      );
    }
    if (intent.status !== AppointmentIntentStatus.PENDING) {
      return this.failure(name, 'APPOINTMENT_INTENT_INACTIVE');
    }
    if (intent.expiresAt <= new Date()) {
      await this.prisma.appointmentIntent.update({
        where: { id: intent.id },
        data: { status: AppointmentIntentStatus.EXPIRED },
      });
      return this.failure(name, 'APPOINTMENT_INTENT_EXPIRED');
    }
    if (context.latestPatientMessage.trim() !== confirmationSentence) {
      return this.failure(name, 'EXPLICIT_CONFIRMATION_REQUIRED', {
        requiredConfirmation: confirmationSentence,
      });
    }

    const patient = intent.conversation.patient;
    const appointment = await this.appointmentsService.create(
      {
        website: '',
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        dentistId: intent.dentistId,
        serviceId: intent.serviceId,
        scheduledAt: intent.scheduledAt.toISOString(),
        privacyConsent: true,
      },
      { appointmentIntentId: intent.id },
    );
    await this.prisma.appointmentIntent.update({
      where: { id: intent.id },
      data: { status: AppointmentIntentStatus.COMPLETED },
    });

    return this.success(
      name,
      'APPOINTMENT_REQUEST_CREATED',
      {
        appointment: {
          id: appointment.id,
          status: appointment.status,
          scheduledAt: appointment.scheduledAt,
          endAt: appointment.endAt,
          dentist: appointment.dentist,
          service: appointment.service,
        },
      },
      appointment.id,
    );
  }

  private requestHumanHandoff(
    name: string,
    arguments_: z.infer<typeof handoffArguments>,
  ): AiToolResult {
    return {
      audit: { name, success: true, code: 'HUMAN_HANDOFF_REQUESTED' },
      output: {
        ok: true,
        code: 'HUMAN_HANDOFF_REQUESTED',
        reason: arguments_.reason,
      },
      requestedHandoff: true,
    };
  }

  private success(
    name: string,
    code: string,
    data: Record<string, unknown>,
    resourceId?: string,
  ): AiToolResult {
    return {
      audit: {
        name,
        success: true,
        code,
        ...(resourceId ? { resourceId } : {}),
      },
      output: { ok: true, code, ...data },
      requestedHandoff: false,
    };
  }

  private failure(
    name: string,
    code: string,
    data: Record<string, unknown> = {},
  ): AiToolResult {
    return {
      audit: { name, success: false, code },
      output: { ok: false, code, ...data },
      requestedHandoff: false,
    };
  }

  private safeErrorCode(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (
        typeof response === 'object' &&
        response !== null &&
        'code' in response
      ) {
        const code = response.code;
        if (typeof code === 'string') return code;
      }
      return `HTTP_${error.getStatus()}`;
    }
    return 'TOOL_EXECUTION_FAILED';
  }

  private localDate(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  }

  private formatClockTime(value: string) {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return value;
    const hours = Number(match[1]);
    const minutes = match[2];
    if (hours > 23) return value;
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes} ${suffix}`;
  }

  private formatTimesInText(value: string) {
    return value.replace(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/g, (time) =>
      this.formatClockTime(time),
    );
  }
}
