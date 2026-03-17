import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import TeacherNav from "@/components/TeacherNav";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      <TeacherNav userName={session.user.name ?? "教师"} />
      <main className="flex-1 ml-64 p-6 overflow-auto">{children}</main>
    </div>
  );
}
