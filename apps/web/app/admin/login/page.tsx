import type { Metadata } from "next";
import { AdminLoginForm } from "../../../components/admin-login-form";

export const metadata: Metadata = {
  title: "Staff Sign In | Dental Clinic Website",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return <AdminLoginForm />;
}
