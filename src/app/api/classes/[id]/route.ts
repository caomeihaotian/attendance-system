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

  const teachingClass = await prisma.teachingClass.findFirst({
    where: { id, course: { teacherId: session.user.id } },
    include: {
      course: { include: { semester: true } },
      enrollments: {
        include: {
          student: {
            select: {
              id: true, name: true, studentId: true,
              gender: true, major: true, adminClass: true, remark: true,
            },
          },
        },
        orderBy: { enrolledAt: "asc" },
      },
      sessions: { orderBy: { scheduledAt: "asc" } },
    },
  });

  if (!teachingClass) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(teachingClass);
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

  const cls = await prisma.teachingClass.findFirst({
    where: { id, course: { teacherId: session.user.id } },
  });
  if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.teachingClass.update({
    where: { id },
    data: { name: body.name, location: body.location, schedule: body.schedule },
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
  const cls = await prisma.teachingClass.findFirst({
    where: { id, course: { teacherId: session.user.id } },
  });
  if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.teachingClass.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
