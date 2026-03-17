import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const sessions = await prisma.session.findMany({
    where: { courseId: id },
    include: {
      teachingClass: { select: { name: true } },
      attendanceRecords: { select: { id: true, status: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json(sessions);
}
