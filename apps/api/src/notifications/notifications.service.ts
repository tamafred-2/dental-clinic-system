import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AppointmentCreatedEvent = {
  id: string;
  type: 'appointment.created';
  occurredAt: string;
  appointment: {
    id: string;
    status: string;
    scheduledAt: Date;
    endAt: Date;
    dentist: { name: string; title: string | null };
    service: { name: string; durationMinutes: number };
    patient: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    };
    clinic: {
      name: string;
      address: string;
      phone: string;
      email: string;
      timeZone: string;
      cancellationPolicy: string;
      appointmentPolicy: string;
    };
  };
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly configService: ConfigService) {}

  async publishAppointmentCreated(event: AppointmentCreatedEvent) {
    const webhookUrl = this.configService
      .get<string>('N8N_WEBHOOK_URL')
      ?.trim();
    if (!webhookUrl) return { delivered: false, skipped: true };

    const secret = this.configService.get<string>('N8N_WEBHOOK_SECRET')?.trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(secret ? { 'x-n8n-webhook-secret': secret } : {}),
          'x-event-id': event.id,
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`n8n returned HTTP ${response.status}`);
      }
      return { delivered: true, skipped: false };
    } catch (error) {
      this.logger.warn(
        `n8n appointment event failed for ${event.appointment.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return { delivered: false, skipped: false };
    } finally {
      clearTimeout(timeout);
    }
  }
}
