import { prisma } from "@/lib/db";
import { demoCustomer } from "@/lib/mock-data";
import { hashPassword } from "@/lib/auth/password";

export async function ensureDemoCustomerRecord() {
  const passwordHash = hashPassword(process.env.DEMO_CUSTOMER_PASSWORD ?? "CalfieDemo123", "calfie-demo-salt");

  return prisma.user.upsert({
    where: {
      email: demoCustomer.email
    },
    update: {
      name: demoCustomer.name,
      companyName: demoCustomer.companyName,
      stripeCustomerId: demoCustomer.stripeCustomerId
    },
    create: {
      email: demoCustomer.email,
      passwordHash,
      name: demoCustomer.name,
      companyName: demoCustomer.companyName,
      stripeCustomerId: demoCustomer.stripeCustomerId,
      pricingProfile: {
        create: {
          markupPercent: demoCustomer.pricingProfile.markupPercent,
          flatFee: demoCustomer.pricingProfile.flatFee,
          minimumProfit: demoCustomer.pricingProfile.minimumProfit,
          residentialSurcharge: demoCustomer.pricingProfile.residentialSurcharge,
          signatureSurcharge: demoCustomer.pricingProfile.signatureSurcharge
        }
      }
    }
  });
}