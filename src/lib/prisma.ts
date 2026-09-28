// Prisma client singleton for the etCupi application.
import { PrismaClient } from "@prisma/client";

// BigInt is not JSON-serializable by default. All monetary values are BigInt
// minor units, so we serialize them as strings across the API/JSON boundary.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
