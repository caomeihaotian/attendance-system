import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const sessions = await prisma.session.findMany({
    where: {
      course: { teacherId: session.user.id },
      scheduledAt: { gte: todayStart, lt: weekEnd },
    },
    include: {
      course: { select: { name: true } },
      teachingClass: { select: { name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const today = sessions.filter(
    (s) => s.scheduledAt >= todayStart && s.scheduledAt < new Date(todayStart.getTime() + 86400000)
  );
  const thisWeek = sessions.filter(
    (s) => s.scheduledAt >= new Date(todayStart.getTime() + 86400000)
  );

  return NextResponse.json({ today, thisWeek });
}
