import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeDashboardData } from "@/lib/serializers";

const domainModelInclude = {
  storageTables: {
    include: {
      storageTable: {
        include: {
          forms: {
            include: {
              operations: true
            }
          },
          views: true
        }
      }
    }
  },
  viewModels: {
    include: {
      viewModel: {
        include: {
          storageModel: true,
          storageTable: true
        }
      }
    }
  },
  formModels: {
    include: {
      formModel: {
        include: {
          storageTable: true,
          operations: true
        }
      }
    }
  },
  operationModels: {
    include: {
      operationModel: {
        include: {
          formModel: true,
          storageModel: true
        }
      }
    }
  }
} as const;

export async function GET() {
  const [storageModels, viewModels, formModels, operationModels, domainModels] =
    await Promise.all([
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
      }),
      prisma.dataDomainModel.findMany({
        include: domainModelInclude,
        orderBy: {
          createdAt: "desc"
        }
      })
    ]);

  const payload = serializeDashboardData({
    storageModels,
    viewModels,
    formModels,
    operationModels,
    domainModels
  });

  return NextResponse.json(payload);
}
