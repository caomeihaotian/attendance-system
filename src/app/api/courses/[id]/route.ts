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

  try {
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
  } catch (e) {
    console.error("Get course error:", e);
    return NextResponse.json({ error: "获取课程失败" }, { status: 500 });
  }
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

  try {
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
  } catch (e) {
    console.error("Update course error:", e);
    return NextResponse.json({ error: "更新课程失败" }, { status: 500 });
  }
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

  try {
    const deleted = await prisma.course.deleteMany({
      where: { id, teacherId: session.user.id },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete course error:", e);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
