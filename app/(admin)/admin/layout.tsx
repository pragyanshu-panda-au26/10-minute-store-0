import React from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      {/* Admin Command Center Header / Sidebar will go here */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
