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
      teachingClasses: {
        include: {
          enrollments: {
            include: { student: { select: { id: true, name: true, studentId: true } } },
          },
          sessions: {
            where: { status: "COMPLETED" },
            include: {
              attendanceRecords: true,
            },
          },
        },
      },
    },
  });

  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Build per-student stats
  const studentStats: Record<
    string,
    { student: { id: string; name: string; studentId: string | null }; present: number; absent: number; late: number; excused: number; total: number }
  > = {};

  for (const cls of course.teachingClasses) {
    for (const enrollment of cls.enrollments) {
      const sid = enrollment.student.id;
      if (!studentStats[sid]) {
        studentStats[sid] = { student: enrollment.student, present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      }
      for (const sess of cls.sessions) {
        const record = sess.attendanceRecords.find((r) => r.studentId === sid);
        if (record) {
          studentStats[sid].total++;
          if (record.status === "PRESENT") studentStats[sid].present++;
          else if (record.status === "ABSENT") studentStats[sid].absent++;
          else if (record.status === "LATE") studentStats[sid].late++;
          else if (record.status === "EXCUSED") studentStats[sid].excused++;
        }
      }
    }
  }

  const totalSessions = course.teachingClasses.reduce((acc, c) => acc + c.sessions.length, 0);

  return NextResponse.json({
    course: { id: course.id, name: course.name },
    totalSessions,
    studentStats: Object.values(studentStats).sort((a, b) =>
      a.student.name.localeCompare(b.student.name)
    ),
  });
}
