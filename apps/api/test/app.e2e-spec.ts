import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('/api (GET)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect({ service: 'dental-api', status: 'ok' });
  });

  it('applies security headers to API responses', async () => {
    const response = await request(app.getHttpServer()).get('/api');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.pragma).toBe('no-cache');
  });

  it('does not expose an appointment listing endpoint', async () => {
    await request(app.getHttpServer()).get('/api/appointments').expect(404);
  });

  it('protects every admin appointment endpoint without a session', async () => {
    await request(app.getHttpServer())
      .get('/api/appointments/admin/overview')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/appointments/admin')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/appointments/admin/appointment-1')
      .expect(401);
    await request(app.getHttpServer())
      .patch('/api/appointments/admin/appointment-1/status')
      .send({ status: 'CONFIRMED' })
      .expect(401);
    await request(app.getHttpServer())
      .patch('/api/appointments/admin/appointment-1/reschedule')
      .send({ scheduledAt: '2030-01-07T02:00:00.000Z' })
      .expect(401);
  });

  it('protects conversation records and messages without a session', async () => {
    await request(app.getHttpServer())
      .get('/api/conversations/admin')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/conversations/admin/conversation-1')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/conversations/admin/conversation-1/messages')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/conversations/admin/conversation-1/claim')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/conversations/admin/conversation-1/messages')
      .send({ content: 'This must not be stored.' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/conversations/admin/conversation-1/ai-response')
      .expect(401);
  });

  it('protects the clinic knowledge index without a session', async () => {
    await request(app.getHttpServer())
      .get('/api/knowledge/admin/status')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/knowledge/admin/search')
      .send({ query: 'opening hours' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/knowledge/admin/reindex')
      .expect(401);
  });

  it('rejects protected clinic data without a session', async () => {
    await request(app.getHttpServer()).get('/api/blocked-dates').expect(401);
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('rejects an unexpected appointment property before business logic', async () => {
    await request(app.getHttpServer())
      .post('/api/appointments')
      .send({
        website: '',
        firstName: 'Security',
        lastName: 'Test',
        email: 'security@example.test',
        phone: '+63 917 000 0999',
        dentistId: 'dentist-does-not-matter',
        serviceId: 'service-does-not-matter',
        scheduledAt: '2030-01-07T02:00:00.000Z',
        privacyConsent: true,
        admin: true,
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toContain(
          'property admin should not exist',
        );
      });
  });

  it('allows only the configured browser origin', async () => {
    const allowed = await request(app.getHttpServer())
      .options('/api/clinic')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    const rejected = await request(app.getHttpServer())
      .options('/api/clinic')
      .set('Origin', 'https://attacker.example')
      .set('Access-Control-Request-Method', 'GET');

    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects form-encoded write requests', async () => {
    await request(app.getHttpServer())
      .post('/api/appointments')
      .type('form')
      .send({ firstName: 'Unexpected format' })
      .expect(415)
      .expect({
        statusCode: 415,
        message: 'Content-Type must be application/json.',
        error: 'Unsupported Media Type',
      });
  });

  it('rejects cross-origin mutations carrying a session cookie', async () => {
    await request(app.getHttpServer())
      .post('/api/services')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', 'dental_session=fake-session-token')
      .send({
        name: 'Unauthorized service',
        description: 'This must never reach the controller.',
        durationMinutes: 30,
      })
      .expect(403)
      .expect((response) => {
        expect(response.body.message).toBe('Request origin is not allowed.');
      });
  });

  it('rate-limits repeated appointment submissions', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/appointments')
        .send({})
        .expect(400);
    }

    await request(app.getHttpServer())
      .post('/api/appointments')
      .send({})
      .expect(429);
  });

  it('rejects oversized JSON request bodies', async () => {
    await request(app.getHttpServer())
      .post('/api/appointments')
      .send({ firstName: 'a'.repeat(110_000) })
      .expect(413)
      .expect({
        statusCode: 413,
        message: 'Request body is too large.',
        error: 'Payload Too Large',
      });
  });

  it('rejects a SQL-injection-shaped login identifier as invalid input', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: "' OR 1=1 --",
        password: 'NotARealPassword!2026',
      })
      .expect(400);
  });

  afterEach(async () => {
    await app.close();
  });
});
