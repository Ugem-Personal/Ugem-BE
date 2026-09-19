CREATE TYPE "GemStatus" AS ENUM ('HiddenGem', 'RisingGem', 'HallOfFame');
ALTER TABLE "merchants" ADD COLUMN "gemStatus" "GemStatus";
