import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const course = await prisma.course.findFirst({
    where: { id, teacherId: session.user.id },
    include: {
      semester: true,
      teachingClasses: {
        include: {
          enrollments: {
            include: { student: { select: { id: true, name: true, studentId: true, adminClass: true } } },
          },
          sessions: { orderBy: { scheduledAt: "asc" } },
        },
      },
    },
  });

  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(course);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const course = await prisma.course.findFirst({ where: { id, teacherId: session.user.id } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.course.update({
    where: { id },
    data: {
      name: body.name,
      code: body.code,
      credit: body.credit,
      nature: body.nature,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const course = await prisma.course.findFirst({ where: { id, teacherId: session.user.id } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.course.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
