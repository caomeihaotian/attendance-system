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

  const classSession = await prisma.session.findUnique({
    where: { id },
    include: {
      course: { select: { name: true, teacherId: true } },
      teachingClass: {
        include: {
          enrollments: {
            include: {
              student: {
                select: {
                  id: true, name: true, studentId: true,
                  adminClass: true, gender: true,
                },
              },
            },
          },
        },
      },
      attendanceRecords: {
        include: {
          student: { select: { id: true, name: true, studentId: true } },
        },
      },
    },
  });

  if (!classSession) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(classSession);
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

  const updated = await prisma.session.update({
    where: { id },
    data: { status: body.status, title: body.title },
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
  await prisma.session.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
