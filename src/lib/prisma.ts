import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const TRANSIENT_ERROR_CODES = ["P1001", "P1002", "P1008", "P1017", "P2024"];
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function createPrismaClient() {
  const client = new PrismaClient({
    log: ["warn"],
  });

  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            return await query(args);
          } catch (e: unknown) {
            const code = (e as { code?: string }).code;
            const isTransient = code && TRANSIENT_ERROR_CODES.includes(code);
            const isConnectionClosed =
              e instanceof Error &&
              e.message.includes("kind: Closed");

            if ((isTransient || isConnectionClosed) && attempt < MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
              continue;
            }
            throw e;
          }
        }
        throw new Error("Unreachable");
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
