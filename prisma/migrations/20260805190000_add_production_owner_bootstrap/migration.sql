CREATE TABLE "ProductionBootstrap" (
    "id" TEXT NOT NULL,
    "ownerEmailHash" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionBootstrap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductionBootstrap_userId_key" ON "ProductionBootstrap"("userId");
