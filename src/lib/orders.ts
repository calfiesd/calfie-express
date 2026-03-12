import { prisma } from "@/lib/db";

export async function getStoredOrders(userId: string) {
  return prisma.order.findMany({
    where: {
      userId
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      adjustments: {
        orderBy: {
          createdAt: "desc"
        }
      },
      quote: true,
      user: true
    }
  });
}

export async function getStoredOrderById(id: string, userId?: string) {
  return prisma.order.findFirst({
    where: {
      id,
      ...(userId ? { userId } : {})
    },
    include: {
      adjustments: {
        orderBy: {
          createdAt: "desc"
        }
      },
      quote: true,
      user: true
    }
  });
}

export async function getAllStoredOrders() {
  return prisma.order.findMany({
    orderBy: {
      createdAt: "desc"
    },
    include: {
      adjustments: {
        orderBy: {
          createdAt: "desc"
        }
      },
      quote: true,
      user: true
    }
  });
}
