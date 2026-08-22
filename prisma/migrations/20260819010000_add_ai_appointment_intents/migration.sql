-- CreateEnum
CREATE TYPE "AppointmentIntentStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "appointmentIntentId" TEXT;

-- CreateTable
CREATE TABLE "AppointmentIntent" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "dentistId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentIntentStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_appointmentIntentId_key" ON "Appointment"("appointmentIntentId");

-- CreateIndex
CREATE INDEX "AppointmentIntent_conversationId_status_expiresAt_idx" ON "AppointmentIntent"("conversationId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "AppointmentIntent_expiresAt_status_idx" ON "AppointmentIntent"("expiresAt", "status");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_appointmentIntentId_fkey" FOREIGN KEY ("appointmentIntentId") REFERENCES "AppointmentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentIntent" ADD CONSTRAINT "AppointmentIntent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentIntent" ADD CONSTRAINT "AppointmentIntent_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "Dentist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentIntent" ADD CONSTRAINT "AppointmentIntent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
