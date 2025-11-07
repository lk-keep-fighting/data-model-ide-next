import DashboardRoot from "@/components/dashboard/dashboard-root";
import { serializeDashboardData } from "@/lib/serializers";
import { prisma } from "@/lib/prisma";

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

export default async function HomePage() {
  const [storageModels, viewModels, formModels, operationModels, domainModels] = await Promise.all([
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

  const initialData = serializeDashboardData({
    storageModels,
    viewModels,
    formModels,
    operationModels,
    domainModels
  });

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">数据模型设计器</h1>
          <p className="text-muted-foreground">
            统一管理数据存储、数据视图、数据表单、数据操作与业务领域模型，支持基于真实数据库的自动化建模。
          </p>
        </header>
        <DashboardRoot initialData={initialData} />
      </div>
    </main>
  );
}
