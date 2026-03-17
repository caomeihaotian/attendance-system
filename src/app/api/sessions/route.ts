import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  courseId: z.string().min(1),
  teachingClassId: z.string().min(1),
  title: z.string().min(1),
  scheduledAt: z.string(),
  type: z.enum(["THEORY", "LAB"]).default("THEORY"),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const courseId = searchParams.get("courseId");

  const sessions = await prisma.session.findMany({
    where: {
      course: { teacherId: session.user.id },
      ...(classId ? { teachingClassId: classId } : {}),
      ...(courseId ? { courseId } : {}),
    },
    include: {
      teachingClass: { select: { name: true } },
      attendanceRecords: { select: { id: true, status: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const course = await prisma.course.findFirst({
    where: { id: parsed.data.courseId, teacherId: session.user.id },
  });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const newSession = await prisma.session.create({
    data: {
      courseId: parsed.data.courseId,
      teachingClassId: parsed.data.teachingClassId,
      title: parsed.data.title,
      scheduledAt: new Date(parsed.data.scheduledAt),
      type: parsed.data.type,
    },
  });

  return NextResponse.json(newSession, { status: 201 });
}
