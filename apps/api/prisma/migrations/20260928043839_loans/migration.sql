-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "bookCopyId" TEXT NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'REQUESTED',
    "deliveryShipmentId" TEXT NOT NULL,
    "returnShipmentId" TEXT,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMPTZ(3),
    "returnedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Loan_userId_status_idx" ON "Loan"("userId", "status");

-- CreateIndex
CREATE INDEX "Loan_deliveryShipmentId_idx" ON "Loan"("deliveryShipmentId");

-- CreateIndex
CREATE INDEX "Loan_returnShipmentId_idx" ON "Loan"("returnShipmentId");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_bookCopyId_fkey" FOREIGN KEY ("bookCopyId") REFERENCES "BookCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_deliveryShipmentId_fkey" FOREIGN KEY ("deliveryShipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_returnShipmentId_fkey" FOREIGN KEY ("returnShipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
