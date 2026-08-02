-- Lightweight accountability-partner social feature: shareable connect code,
-- bidirectional friend connections, and a cheer/nudge log.
ALTER TABLE "User" ADD COLUMN "friendCode" TEXT;
CREATE UNIQUE INDEX "User_friendCode_key" ON "User"("friendCode");

CREATE TABLE "FriendConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "friendId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FriendConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FriendConnection_userId_friendId_key" ON "FriendConnection"("userId", "friendId");

ALTER TABLE "FriendConnection" ADD CONSTRAINT "FriendConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FriendConnection" ADD CONSTRAINT "FriendConnection_friendId_fkey"
  FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FriendCheer" (
  "id" TEXT NOT NULL,
  "fromUserId" TEXT NOT NULL,
  "toUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FriendCheer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FriendCheer_toUserId_fromUserId_createdAt_idx" ON "FriendCheer"("toUserId", "fromUserId", "createdAt");

ALTER TABLE "FriendCheer" ADD CONSTRAINT "FriendCheer_fromUserId_fkey"
  FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FriendCheer" ADD CONSTRAINT "FriendCheer_toUserId_fkey"
  FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
