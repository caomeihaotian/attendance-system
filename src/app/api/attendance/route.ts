import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AttendanceStatus } from "@prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  sessionId: z.string(),
  studentId: z.string(),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  note: z.string().optional(),
});

const batchSchema = z.object({
  records: z.array(updateSchema),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Batch update
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ops = parsed.data.records.map((r) =>
    prisma.attendanceRecord.upsert({
      where: {
        sessionId_studentId: { sessionId: r.sessionId, studentId: r.studentId },
      },
      create: {
        sessionId: r.sessionId,
        studentId: r.studentId,
        status: r.status as AttendanceStatus,
        note: r.note,
      },
      update: {
        status: r.status as AttendanceStatus,
        note: r.note,
        checkedAt: new Date(),
      },
    })
  );

  await prisma.$transaction(ops);
  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const studentId = searchParams.get("studentId");

  if (sessionId) {
    const records = await prisma.attendanceRecord.findMany({
      where: { sessionId },
      include: {
        student: { select: { id: true, name: true, studentId: true, adminClass: true } },
      },
    });
    return NextResponse.json(records);
  }

  if (studentId) {
    const records = await prisma.attendanceRecord.findMany({
      where: { studentId },
      include: {
        session: {
          include: { course: { select: { name: true } } },
        },
      },
      orderBy: { checkedAt: "desc" },
    });
    return NextResponse.json(records);
  }

  return NextResponse.json({ error: "sessionId or studentId required" }, { status: 400 });
}
