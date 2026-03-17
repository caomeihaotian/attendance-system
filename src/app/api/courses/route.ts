import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  semesterId: z.string().min(1),
  code: z.string().optional(),
  credit: z.number().optional(),
  nature: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const semesterId = searchParams.get("semesterId");

  const courses = await prisma.course.findMany({
    where: {
      teacherId: session.user.id,
      ...(semesterId ? { semesterId } : {}),
    },
    include: {
      semester: { select: { id: true, name: true } },
      teachingClasses: {
        include: {
          enrollments: { select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(courses);
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

  const course = await prisma.course.create({
    data: {
      name: parsed.data.name,
      semesterId: parsed.data.semesterId,
      teacherId: session.user.id,
      code: parsed.data.code,
      credit: parsed.data.credit,
      nature: parsed.data.nature,
    },
  });

  return NextResponse.json(course, { status: 201 });
}
