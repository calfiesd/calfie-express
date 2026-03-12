import { prisma } from "@/lib/db";

export async function getStoredQuotes(userId: string) {
  return prisma.quote.findMany({
    where: {
      userId
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getStoredQuoteById(id: string, userId: string) {
  return prisma.quote.findFirst({
    where: {
      id,
      userId
    }
  });
}
