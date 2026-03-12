import { prisma } from "@/lib/db";

export async function getAdminCustomers() {
  return prisma.user.findMany({
    where: {
      role: "CUSTOMER"
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      pricingProfile: true,
      orders: {
        orderBy: {
          createdAt: "desc"
        },
        take: 1
      },
      walletTransactions: {
        orderBy: {
          createdAt: "desc"
        },
        take: 8,
        include: {
          order: {
            select: {
              id: true,
              selectedCarrier: true,
              selectedService: true,
              status: true
            }
          }
        }
      },
      _count: {
        select: {
          orders: true,
          quotes: true
        }
      }
    }
  });
}
