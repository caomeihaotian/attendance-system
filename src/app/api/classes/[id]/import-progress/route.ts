import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SessionType } from "@prisma/client";

interface SessionRow {
  title: string;
  scheduledAt: string;
  type: "THEORY" | "LAB";
  weekNumber?: number;
  lessonNumber?: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const teachingClass = await prisma.teachingClass.findFirst({
    where: { id, course: { teacherId: session.user.id } },
    include: { course: true },
  });
  if (!teachingClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const body = await req.json();
  const rows: SessionRow[] = body.sessions;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No sessions provided" }, { status: 400 });
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const scheduledAt = new Date(row.scheduledAt);
      if (isNaN(scheduledAt.getTime())) {
        errors.push(`无效日期: ${row.scheduledAt}`);
        continue;
      }

      // Check duplicate by date + type + class
      const existing = await prisma.session.findFirst({
        where: {
          teachingClassId: id,
          type: row.type as SessionType,
          scheduledAt: {
            gte: new Date(scheduledAt.toDateString()),
            lt: new Date(new Date(scheduledAt.toDateString()).getTime() + 86400000),
          },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.session.create({
        data: {
          courseId: teachingClass.courseId,
          teachingClassId: id,
          type: row.type as SessionType,
          title: row.title,
          scheduledAt,
          weekNumber: row.weekNumber,
          lessonNumber: row.lessonNumber,
          status: "PENDING",
        },
      });
      created++;
    } catch (err) {
      errors.push(`${row.scheduledAt}: ${String(err)}`);
    }
  }

  return NextResponse.json({ success: true, created, skipped, errors: errors.slice(0, 10) });
}
