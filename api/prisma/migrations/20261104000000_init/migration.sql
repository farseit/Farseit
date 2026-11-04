-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "ShopStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ShopRole" AS ENUM ('OWNER', 'AGENT');

-- CreateEnum
CREATE TYPE "ShopOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ShopStatus" NOT NULL DEFAULT 'TRIAL',
    "plan" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "botEnabled" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "orderSeq" INTEGER NOT NULL DEFAULT 0,
    "planEndsAt" TIMESTAMP(3),
    "usagePeriod" TEXT,
    "usageReplies" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopMember" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ShopRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPage" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "name" TEXT,
    "tokenEnc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopChat" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "psid" TEXT NOT NULL,
    "name" TEXT,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "handoffUntil" TIMESTAMP(3),
    "unread" INTEGER NOT NULL DEFAULT 0,
    "lastText" TEXT,
    "lastFrom" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopProduct" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "minPrice" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "trackStock" BOOLEAN NOT NULL DEFAULT true,
    "images" TEXT[],
    "options" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT,
    CONSTRAINT "ShopProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopBotSettings" (
    "shopId" TEXT NOT NULL,
    "botName" TEXT NOT NULL DEFAULT 'Assistant',
    "tone" TEXT NOT NULL DEFAULT 'FRIENDLY',
    "greeting" TEXT,
    "insideArea" TEXT NOT NULL DEFAULT 'ঢাকা সিটির ভিতরে',
    "deliveryInside" INTEGER NOT NULL DEFAULT 60,
    "deliveryOutside" INTEGER NOT NULL DEFAULT 120,
    "bargainEnabled" BOOLEAN NOT NULL DEFAULT false,
    "rules" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopBotSettings_pkey" PRIMARY KEY ("shopId")
);

-- CreateTable
CREATE TABLE "ShopOrder" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "chatId" TEXT,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "zone" TEXT NOT NULL DEFAULT 'INSIDE',
    "note" TEXT,
    "subtotal" INTEGER NOT NULL,
    "deliveryCharge" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "status" "ShopOrderStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'MESSENGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "option" TEXT,
    "price" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    CONSTRAINT "ShopOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopAiUsage" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "inTokens" INTEGER NOT NULL DEFAULT 0,
    "outTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopAiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPayment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "senderNumber" TEXT NOT NULL,
    "trxId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "ShopPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopAiKey" (
    "shopId" TEXT NOT NULL,
    "keyEnc" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "lastError" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopAiKey_pkey" PRIMARY KEY ("shopId")
);

-- CreateTable
CREATE TABLE "ShopIssue" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'WARN',
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "ShopIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PasswordReset_userId_createdAt_idx" ON "PasswordReset"("userId", "createdAt");
CREATE UNIQUE INDEX "ShopMember_shopId_userId_key" ON "ShopMember"("shopId", "userId");
CREATE INDEX "ShopMember_userId_idx" ON "ShopMember"("userId");
CREATE UNIQUE INDEX "ShopPage_pageId_key" ON "ShopPage"("pageId");
CREATE INDEX "ShopPage_shopId_idx" ON "ShopPage"("shopId");
CREATE UNIQUE INDEX "ShopChat_pageId_psid_key" ON "ShopChat"("pageId", "psid");
CREATE INDEX "ShopChat_shopId_lastMessageAt_idx" ON "ShopChat"("shopId", "lastMessageAt");
CREATE INDEX "ShopMessage_chatId_createdAt_idx" ON "ShopMessage"("chatId", "createdAt");
CREATE UNIQUE INDEX "ShopProduct_code_key" ON "ShopProduct"("code");
CREATE INDEX "ShopProduct_shopId_active_idx" ON "ShopProduct"("shopId", "active");
CREATE UNIQUE INDEX "ShopOrder_shopId_number_key" ON "ShopOrder"("shopId", "number");
CREATE INDEX "ShopOrder_shopId_createdAt_idx" ON "ShopOrder"("shopId", "createdAt");
CREATE INDEX "ShopOrder_shopId_status_idx" ON "ShopOrder"("shopId", "status");
CREATE INDEX "ShopOrderItem_orderId_idx" ON "ShopOrderItem"("orderId");
CREATE INDEX "ShopAiUsage_shopId_createdAt_idx" ON "ShopAiUsage"("shopId", "createdAt");
CREATE UNIQUE INDEX "ShopPayment_trxId_key" ON "ShopPayment"("trxId");
CREATE INDEX "ShopPayment_status_createdAt_idx" ON "ShopPayment"("status", "createdAt");
CREATE INDEX "ShopPayment_shopId_idx" ON "ShopPayment"("shopId");
CREATE UNIQUE INDEX "ShopIssue_shopId_code_subject_key" ON "ShopIssue"("shopId", "code", "subject");
CREATE INDEX "ShopIssue_shopId_lastAt_idx" ON "ShopIssue"("shopId", "lastAt");

-- AddForeignKey
ALTER TABLE "ShopMember" ADD CONSTRAINT "ShopMember_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopMember" ADD CONSTRAINT "ShopMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopPage" ADD CONSTRAINT "ShopPage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopChat" ADD CONSTRAINT "ShopChat_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopMessage" ADD CONSTRAINT "ShopMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "ShopChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopProduct" ADD CONSTRAINT "ShopProduct_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopBotSettings" ADD CONSTRAINT "ShopBotSettings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopPayment" ADD CONSTRAINT "ShopPayment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopAiKey" ADD CONSTRAINT "ShopAiKey_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopIssue" ADD CONSTRAINT "ShopIssue_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

