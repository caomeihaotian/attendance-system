// This page doesn't use the teacher nav - it's a full-screen experience
export default function RollCallLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-950">{children}</div>;
}
