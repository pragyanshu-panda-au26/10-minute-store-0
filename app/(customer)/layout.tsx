import React from "react";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Customer Header will go here */}
      <main className="flex-1">{children}</main>
      {/* Customer Footer will go here */}
    </div>
  );
}
