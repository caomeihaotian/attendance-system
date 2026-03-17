import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

interface StudentRow {
  studentId: string;
  name: string;
  gender?: string;
  major?: string;
  adminClass?: string;
  remark?: string;
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

  // Verify class belongs to teacher
  const teachingClass = await prisma.teachingClass.findFirst({
    where: { id, course: { teacherId: session.user.id } },
    include: { course: true },
  });
  if (!teachingClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const body = await req.json();
  const students: StudentRow[] = body.students;

  if (!Array.isArray(students) || students.length === 0) {
    return NextResponse.json({ error: "No students provided" }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  let retakes = 0;
  const errors: string[] = [];

  for (const row of students) {
    if (!row.studentId || !row.name) {
      errors.push(`跳过：学号或姓名为空`);
      continue;
    }

    try {
      const isRetake = row.remark?.includes("重修") ?? false;
      const defaultPassword = row.studentId.slice(-6);
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      // Upsert user
      const existingUser = await prisma.user.findUnique({
        where: { studentId: row.studentId },
      });

      let userId: string;

      if (existingUser) {
        await prisma.user.update({
          where: { studentId: row.studentId },
          data: {
            name: row.name,
            gender: row.gender,
            major: row.major,
            adminClass: row.adminClass,
            remark: row.remark,
          },
        });
        userId = existingUser.id;
        updated++;
      } else {
        const newUser = await prisma.user.create({
          data: {
            studentId: row.studentId,
            name: row.name,
            role: "STUDENT",
            passwordHash,
            gender: row.gender,
            major: row.major,
            adminClass: row.adminClass,
            remark: row.remark,
          },
        });
        userId = newUser.id;
        created++;
      }

      if (isRetake) retakes++;

      // Upsert enrollment
      await prisma.enrollment.upsert({
        where: {
          studentId_teachingClassId: {
            studentId: userId,
            teachingClassId: id,
          },
        },
        create: {
          studentId: userId,
          courseId: teachingClass.courseId,
          teachingClassId: id,
          status: isRetake ? "重修" : "正常",
        },
        update: {
          status: isRetake ? "重修" : "正常",
        },
      });
    } catch (err) {
      errors.push(`${row.studentId} ${row.name}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    success: true,
    created,
    updated,
    retakes,
    total: students.length,
    errors: errors.slice(0, 10),
  });
}
