import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Platform super admin toiri (SaaS owner). ADMIN_PHONE / ADMIN_EMAIL / ADMIN_PASSWORD env diye bodlano jay */
async function main() {
  const phone = process.env.ADMIN_PHONE || '01700000000';
  const email = (process.env.ADMIN_EMAIL || 'admin@farseit.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin@12345';
  await prisma.user.upsert({
    where: { phone },
    update: { role: 'ADMIN' },
    create: { name: process.env.ADMIN_NAME || 'Farse AI Admin', phone, email, password: await bcrypt.hash(password, 10), role: 'ADMIN' },
  });
  console.log(`Super admin ready: ${phone} / ${email}`);
}

main().finally(() => prisma.$disconnect());
