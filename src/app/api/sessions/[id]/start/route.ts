import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const classSession = await prisma.session.findFirst({
    where: { id, course: { teacherId: session.user.id } },
    include: {
      teachingClass: {
        include: {
          enrollments: { select: { studentId: true } },
        },
      },
    },
  });

  if (!classSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Initialize all enrolled students as ABSENT
  const enrolledStudentIds = classSession.teachingClass.enrollments.map((e) => e.studentId);

  await prisma.$transaction([
    prisma.session.update({ where: { id }, data: { status: "IN_PROGRESS" } }),
    ...enrolledStudentIds.map((studentId) =>
      prisma.attendanceRecord.upsert({
        where: { sessionId_studentId: { sessionId: id, studentId } },
        create: { sessionId: id, studentId, status: "ABSENT" },
        update: {},
      })
    ),
  ]);

  return NextResponse.json({ success: true });
}
