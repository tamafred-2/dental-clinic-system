# Dental Clinic Website + AI Automation System
![Next.js](https://img.shields.io/badge/Next.js-15.x-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E?logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17.x-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![n8n](https://img.shields.io/badge/n8n-Automation-EA4B71?logo=n8n&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker&logoColor=white)

A full-stack dental clinic website and automation platform combining
appointment management, AI administrative assistance, Facebook Messenger,
Gmail notifications, and a staff dashboard.

> **Architecture:** Modular Monolith + Headless API + Automation Layer  



---

## Overview

This project provides a centralized system for a dental clinic where patients can:

* View clinic information
* View dental services
* View dentist information
* Check clinic hours and location
* Read frequently asked questions
* Request appointments
* Ask general administrative questions through AI
* Communicate through Facebook Messenger
* Receive appointment notifications

Clinic staff can:

* Manage appointments
* Manage schedules
* Manage dentists
* Manage services
* View conversations
* Take over AI conversations
* Receive automated notifications

---

## Core Features

### Patient Website

* Responsive homepage
* Dental services
* Dentist information
* Clinic information
* Clinic hours
* Location/contact information
* FAQ
* Appointment request form
* AI chat assistant

### Appointment Management

* Appointment requests
* Dentist assignment
* Service selection
* Schedule management
* Availability checking
* Appointment status
* Cancellation
* Rescheduling
* Appointment history

### AI Administrative Assistant

The AI can assist with:

* Clinic hours
* Clinic location
* Dental services
* General FAQs
* Appointment procedures
* Appointment availability
* Administrative questions

The AI is **not intended to diagnose patients or make clinical treatment decisions**.

Clinical questions should be redirected to qualified dental professionals or clinic staff.

### Facebook Messenger

The system is designed to connect Facebook Messenger to the same backend AI and appointment system used by the website.

```text
Facebook Messenger
        |
        v
Meta Webhook
        |
        v
NestJS
        |
        v
AI / Appointment Services
        |
        v
Messenger Response
```

### Gmail Automation

Automated email workflows can include:

* Appointment confirmation
* Appointment request notification
* Appointment reminder
* Cancellation notification
* Rescheduling notification
* Staff notification

n8n is used as the automation layer.

---

# Architecture

```text
                         PATIENT
                            |
               +------------+------------+
               |                         |
               v                         v
        Next.js Website          Facebook Messenger
               |                         |
               +------------+------------+
                            |
                            v
                    +---------------+
                    |   NestJS API  |
                    |               |
                    | Modular       |
                    | Monolith      |
                    +-------+-------+
                            |
              +-------------+-------------+
              |             |             |
              v             v             v
        PostgreSQL       AI Layer        n8n
                            |             |
                            v             +---- Gmail
                       OpenAI API         +---- Messenger
                            |             +---- Notifications
                            v
                           RAG
                            |
                            v
                       AI Tools
                            |
                            v
                     NestJS Services
```

## Architecture Principles

| Component    | Responsibility                 |
| ------------ | ------------------------------ |
| Next.js      | User interface                 |
| NestJS       | Business logic and API         |
| PostgreSQL   | Primary data storage           |
| Prisma       | Database access                |
| AI           | Natural-language assistance    |
| RAG          | Clinic knowledge retrieval     |
| n8n          | Automation and integrations    |
| Gmail        | Email communication            |
| Messenger    | Patient communication          |
| Redis/BullMQ | Optional background processing |

---

# Technology Stack

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui

## Backend

* NestJS
* TypeScript
* REST API
* Prisma

## Database

* PostgreSQL

## Automation

* n8n

## AI

* OpenAI API
* RAG
* Tool calling
* AI safety/guardrails

## Optional Infrastructure

* Redis
* BullMQ
* Docker
* Docker Compose

## Testing

* Jest
* Supertest
* Playwright

---

# Project Structure

```text
dental-clinic-system/
|
+-- apps/
|   +-- web/
|   +-- api/
|   +-- worker/
|
+-- packages/
|   +-- ui/
|   +-- types/
|   +-- validation/
|   +-- config/
|
+-- prisma/
|
+-- n8n/
|   +-- workflows/
|
+-- docs/
|
+-- docker/
|
+-- .env.example
+-- docker-compose.yml
+-- README.md
+-- PROJECT_GUIDE.md
```

---

# Local Development

The recommended development environment can run on a single computer.

```text
Your PC
|
+-- Next.js       :3000
+-- NestJS        :4000
+-- PostgreSQL    :5432
+-- n8n           :5678
+-- Redis         :6379 (optional)
```

## Requirements

Install:

* Node.js
* npm/pnpm
* Git
* Docker
* Docker Compose
* VS Code or another IDE

---

# Basic Setup

Clone the repository:

```bash
git clone <repository-url>
cd dental-clinic-system
```

Install dependencies:

```bash
npm install
```

or, if using pnpm:

```bash
pnpm install
```

Start infrastructure:

```bash
docker compose up -d
```

Run the web application:

```bash
npm run dev
```

The exact commands may change depending on the final monorepo configuration.

---

# Local URLs

Website:

```text
http://localhost:3000
```

Backend API:

```text
http://localhost:4000
```

n8n:

```text
http://localhost:5678
```

PostgreSQL:

```text
localhost:5432
```

Redis, if enabled:

```text
localhost:6379
```

---

# Environment Variables

Create a local `.env` file.

Example:

```env
DATABASE_URL=

OPENAI_API_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

META_APP_ID=
META_APP_SECRET=
META_PAGE_ACCESS_TOKEN=
META_VERIFY_TOKEN=

N8N_WEBHOOK_URL=

REDIS_URL=

SESSION_SECRET=
```

Never commit `.env` to GitHub.

Commit:

```text
.env.example
```

instead.

---

# AI Safety

The AI is designed for administrative assistance.

### Allowed

```text
"What time do you open?"

"Where are you located?"

"Do you offer teeth cleaning?"

"How do I schedule an appointment?"

"Can I request Saturday?"
```

### Restricted

```text
"What medicine should I take?"

"Do I have an infection?"

"Do I need an extraction?"

"Can you diagnose this?"
```

Clinical questions should be redirected to appropriate dental professionals.

---

# n8n Automation

n8n is used as the automation layer.

Example workflow:

```text
Appointment Created
        |
        v
       n8n
        |
   +----+----+
   |         |
   v         v
 Gmail     Staff
Patient    Notification
   |
   v
Reminder
```

n8n should not replace the NestJS backend.

NestJS remains responsible for business rules and the database.

---

# Database

The primary database is PostgreSQL.

Core entities include:

```text
Users
Roles
Patients
Dentists
Services
Appointments
Schedules
Clinic Settings
Conversations
Messages
FAQ
Knowledge Documents
Notifications
Audit Logs
```

The appointment system is the source of truth for availability.

The AI must not invent appointment slots.

---

# Responsive Design

The application is designed as a responsive web application.

It should work on:

```text
Desktop
Tablet
Mobile
```

A separate mobile application is not required for the MVP.

---

# Security

Because this project may process sensitive patient-related information, security is a major design consideration.

The system should implement:

* HTTPS
* Authentication
* Role-based access control
* Password hashing
* Secure sessions/cookies
* Input validation
* Rate limiting
* Audit logging
* Secure secrets management
* Database backups
* Least-privilege access

Development should use fake/test patient data.

Do not commit real patient information to the repository.

---

# Development Roadmap

## Phase 1 — Planning

* [ ] Requirements
* [ ] Use cases
* [ ] Roles and permissions
* [ ] Architecture
* [ ] ERD
* [ ] Wireframes

## Phase 2 — Project Setup

* [ ] Monorepo
* [ ] Next.js
* [ ] NestJS
* [ ] PostgreSQL
* [ ] Prisma
* [ ] Docker
* [ ] n8n

## Phase 3 — Backend

* [ ] Authentication
* [ ] RBAC
* [ ] Patients
* [ ] Dentists
* [ ] Services
* [ ] Appointments
* [ ] Availability
* [ ] Clinic information

## Phase 4 — Website

* [ ] Homepage
* [ ] Services
* [ ] Dentists
* [ ] FAQ
* [ ] Contact
* [ ] Appointment form
* [ ] Responsive design

## Phase 5 — Admin Dashboard

* [ ] Dashboard
* [ ] Appointment management
* [ ] Calendar
* [ ] Patient management
* [ ] Dentist management
* [ ] Service management
* [ ] Conversation management

## Phase 6 — Automation

* [ ] n8n
* [ ] Gmail
* [ ] Appointment confirmation
* [ ] Staff notification
* [ ] Reminder workflow
* [ ] Cancellation workflow

## Phase 7 — AI

* [ ] AI service
* [ ] OpenAI integration
* [ ] Clinic knowledge base
* [ ] RAG
* [ ] AI tools
* [ ] Appointment tool
* [ ] Safety guardrails
* [ ] Human handoff

## Phase 8 — Facebook

* [ ] Meta developer configuration
* [ ] Messenger webhook
* [ ] Receive messages
* [ ] Send messages
* [ ] AI integration
* [ ] Conversation storage
* [ ] Human handoff

## Phase 9 — Testing

* [ ] Unit tests
* [ ] Integration tests
* [ ] API tests
* [ ] E2E tests
* [ ] AI safety tests
* [ ] Authentication tests
* [ ] Authorization tests
* [ ] Webhook tests

## Phase 10 — Deployment

* [ ] Production environment
* [ ] Production database
* [ ] Environment secrets
* [ ] Domain
* [ ] HTTPS
* [ ] Monitoring
* [ ] Backups
* [ ] Security review

---

# MVP

The first version should focus on:

```text
Patient Website
       +
Appointment System
       +
Admin Dashboard
       +
Gmail Automation
       +
n8n
       +
AI Administrative Assistant
       +
Facebook Messenger
```

Advanced features such as payments, patient medical records, prescriptions, AI diagnosis, native mobile applications, and microservices should be considered future features.

---

# Documentation

Detailed development documentation is available in:

```text
PROJECT_GUIDE.md
```

Recommended additional documentation:

```text
docs/
|
+-- architecture/
|   +-- architecture.md
|
+-- database/
|   +-- erd.md
|
+-- api/
|   +-- api.md
|
+-- ai/
|   +-- ai-architecture.md
|
+-- n8n/
|   +-- workflows.md
|
+-- deployment/
|   +-- deployment.md
```

---

# Project Goals

The project is intended to demonstrate practical knowledge of:

* Full-stack development
* REST API design
* Database design
* Authentication and authorization
* Appointment scheduling
* Responsive UI development
* AI integration
* RAG
* Tool calling
* AI safety
* Workflow automation
* Facebook integration
* Gmail integration
* Webhooks
* Docker
* Testing
* Cloud deployment
* Security architecture

---

# Important Disclaimer

This system is designed as an administrative and informational platform.

The AI must not be treated as a dentist, medical professional, or diagnostic system.

Any real-world deployment involving patient information must undergo appropriate security, privacy, legal, regulatory, and clinical review before being used with real patients.

---

## License

Copyright (c) 2026 [Alfred M. Tamayo](https://github.com/tamafred-2). All rights reserved.

This repository is publicly available for portfolio and demonstration
purposes.

No permission is granted to copy, modify, distribute, sublicense,
publish, or commercially use this software without prior written
permission from the copyright holder.

For commercial licensing, customization, or deployment inquiries,
please contact the author.
