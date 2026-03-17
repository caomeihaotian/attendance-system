import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { signOut } from "next-auth/react";
import StudentNav from "@/components/StudentNav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <StudentNav userName={session.user.name ?? "学生"} />
      <main className="pt-16 p-6">{children}</main>
    </div>
  );
}
