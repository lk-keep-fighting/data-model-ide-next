import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  serializeDashboardData,
  type DomainModelWithRelations
} from "@/lib/serializers";

const domainFieldSchema = z.object({
  key: z.string().min(1, "字段编码不能为空"),
  name: z.string().min(1, "字段名称不能为空"),
  type: z.string().optional(),
  required: z.boolean().optional(),
  description: z.string().optional().nullable()
});

const uniqueIdArraySchema = z
  .array(z.string().min(1))
  .optional()
  .transform((value) => (value ? Array.from(new Set(value)) : []));

const createDomainSchema = z.object({
  name: z.string().min(1, "领域名称不能为空"),
  description: z.string().optional(),
  schema: z.object({
    fields: z.array(domainFieldSchema).min(1, "至少需要定义一个业务字段")
  }),
  storageTableIds: uniqueIdArraySchema,
  viewModelIds: uniqueIdArraySchema,
  formModelIds: uniqueIdArraySchema,
  operationModelIds: uniqueIdArraySchema
});

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
  const domains = (await prisma.dataDomainModel.findMany({
    include: domainModelInclude,
    orderBy: {
      createdAt: "desc"
    }
  })) as DomainModelWithRelations[];

  const payload = serializeDashboardData({
    storageModels: [],
    viewModels: [],
    formModels: [],
    operationModels: [],
    domainModels: domains
  });

  return NextResponse.json(payload.domainModels);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = createDomainSchema.parse(payload);

    const domain = await prisma.dataDomainModel.create({
      data: {
        name: data.name,
        description: data.description || undefined,
        schema: data.schema,
        ...(data.storageTableIds.length
          ? {
              storageTables: {
                create: data.storageTableIds.map((id) => ({
                  storageTable: {
                    connect: { id }
                  }
                }))
              }
            }
          : {}),
        ...(data.viewModelIds.length
          ? {
              viewModels: {
                create: data.viewModelIds.map((id) => ({
                  viewModel: {
                    connect: { id }
                  }
                }))
              }
            }
          : {}),
        ...(data.formModelIds.length
          ? {
              formModels: {
                create: data.formModelIds.map((id) => ({
                  formModel: {
                    connect: { id }
                  }
                }))
              }
            }
          : {}),
        ...(data.operationModelIds.length
          ? {
              operationModels: {
                create: data.operationModelIds.map((id) => ({
                  operationModel: {
                    connect: { id }
                  }
                }))
              }
            }
          : {})
      }
    });

    const detail = (await prisma.dataDomainModel.findUnique({
      where: { id: domain.id },
      include: domainModelInclude
    })) as DomainModelWithRelations | null;

    if (!detail) {
      return new NextResponse("业务领域模型创建失败", { status: 500 });
    }

    const payloadResponse = serializeDashboardData({
      storageModels: [],
      viewModels: [],
      formModels: [],
      operationModels: [],
      domainModels: [detail]
    });

    return NextResponse.json(payloadResponse.domainModels[0], { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(error.errors.map((err) => err.message).join("；"), {
        status: 400
      });
    }

    const message =
      error instanceof Error ? `创建领域模型失败：${error.message}` : "创建领域模型失败";

    return new NextResponse(message, { status: 500 });
  }
}
