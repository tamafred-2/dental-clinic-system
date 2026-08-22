import type { Metadata } from "next";
import { AdminConversations } from "../../../components/admin-conversations";

export const metadata: Metadata = {
  title: "Conversations | Dental Clinic Dashboard",
  robots: { index: false, follow: false },
};

export default function AdminConversationsPage() {
  return <AdminConversations />;
}
