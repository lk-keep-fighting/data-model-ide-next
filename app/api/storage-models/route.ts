import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  serializeDashboardData,
  type StorageModelWithRelations
} from "@/lib/serializers";

export async function GET() {
  const storageModels = (await prisma.dataStorageModel.findMany({
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
  })) as StorageModelWithRelations[];

  const payload = serializeDashboardData({
    storageModels,
    viewModels: [],
    formModels: [],
    operationModels: [],
    domainModels: []
  });

  return NextResponse.json(payload.storageModels);
}
