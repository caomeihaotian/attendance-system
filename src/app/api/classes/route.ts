import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  courseId: z.string().min(1),
  location: z.string().optional(),
  schedule: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");

  const classes = await prisma.teachingClass.findMany({
    where: {
      course: { teacherId: session.user.id },
      ...(courseId ? { courseId } : {}),
    },
    include: {
      course: { select: { id: true, name: true } },
      enrollments: { select: { id: true } },
      sessions: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(classes);
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

  // Verify course belongs to teacher
  const course = await prisma.course.findFirst({
    where: { id: parsed.data.courseId, teacherId: session.user.id },
  });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const teachingClass = await prisma.teachingClass.create({
    data: {
      name: parsed.data.name,
      courseId: parsed.data.courseId,
      location: parsed.data.location,
      schedule: parsed.data.schedule,
    },
  });

  return NextResponse.json(teachingClass, { status: 201 });
}
