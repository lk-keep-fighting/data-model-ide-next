import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeDashboardData } from "@/lib/serializers";

export async function GET() {
  const [storageModels, viewModels, formModels, operationModels] = await Promise.all([
    prisma.dataStorageModel.findMany({
      include: {
        tables: {
          include: {
            forms: {
              include: {
                operations: true
              }
            },
            views: true
          }
        },
        operations: true,
        views: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.dataViewModel.findMany({
      include: {
        storageModel: true,
        storageTable: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.dataFormModel.findMany({
      include: {
        storageTable: true,
        operations: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.dataOperationModel.findMany({
      include: {
        formModel: true,
        storageModel: true
      },
      orderBy: {
        createdAt: "desc"
      }
    })
  ]);

  const payload = serializeDashboardData({
    storageModels,
    viewModels,
    formModels,
    operationModels
  });

  return NextResponse.json(payload);
}
