import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { bindRateLimitStore } from '../common/rate-limit';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // সব transaction-এর ডিফল্ট সময় ৫ সেকেন্ড থেকে বাড়ানো হলো (cold start-এও যাতে অর্ডার না আটকায়)
    super({ transactionOptions: { maxWait: 10000, timeout: 20000 } });
  }
  async onModuleInit() {
    await this.$connect();
    bindRateLimitStore(this); // rate limit counter DB-te rakhbe
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}