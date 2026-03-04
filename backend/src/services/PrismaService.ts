import { PrismaClient } from "@prisma/client";

export class PrismaService {
    private static instance: PrismaClient;

    private constructor() { }

    public static getInstance(): PrismaClient {
        if (!PrismaService.instance) {
            PrismaService.instance = new PrismaClient();
        }
        return PrismaService.instance;
    }
}

export const prisma = PrismaService.getInstance();
