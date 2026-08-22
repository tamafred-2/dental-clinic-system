import Link from "next/link";

type AdminSidebarProps = {
  active: "dashboard" | "conversations";
};

export function AdminSidebar({ active }: AdminSidebarProps) {
  return (
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/admin">
        <span className="brand-symbol" aria-hidden="true">
          DC
        </span>
        <span>
          <strong>Dental Clinic</strong>
          <small>Staff workspace</small>
        </span>
      </Link>
      <nav aria-label="Dashboard navigation">
        <Link className={active === "dashboard" ? "active" : ""} href="/admin">
          Dashboard
        </Link>
        <Link
          className={active === "conversations" ? "active" : ""}
          href="/admin/conversations"
        >
          Conversations
        </Link>
      </nav>
      <div className="admin-sidebar-future">
        <span>Later modules</span>
        <p>Patients, notifications, settings, knowledge, and audit logs</p>
      </div>
      <Link className="admin-site-link" href="/">
        View public website
      </Link>
    </aside>
  );
}
