import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  serializeDashboardData,
  type OperationModelWithRelations
} from "@/lib/serializers";

const createOperationSchema = z.object({
  name: z.string().min(1, "操作名称不能为空"),
  description: z.string().optional(),
  type: z.enum(["CREATE", "READ", "UPDATE", "DELETE", "CUSTOM"]).default("READ"),
  endpoint: z.string().optional(),
  method: z.string().optional(),
  storageModelId: z.string().optional().nullable(),
  formModelId: z.string().optional().nullable(),
  requestSchema: z.unknown().optional(),
  responseSchema: z.unknown().optional()
});

export async function GET() {
  const operations = (await prisma.dataOperationModel.findMany({
    include: {
      formModel: true,
      storageModel: true
    },
    orderBy: {
      createdAt: "desc"
    }
  })) as OperationModelWithRelations[];

  const payload = serializeDashboardData({
    storageModels: [],
    viewModels: [],
    formModels: [],
    operationModels: operations
  });

  return NextResponse.json(payload.operationModels);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = createOperationSchema.parse(payload);

    const operation = await prisma.dataOperationModel.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        endpoint: data.endpoint,
        method: data.method,
        storageModelId: data.storageModelId || undefined,
        formModelId: data.formModelId || undefined,
        requestSchema: data.requestSchema,
        responseSchema: data.responseSchema
      }
    });

    const detail = (await prisma.dataOperationModel.findUnique({
      where: { id: operation.id },
      include: {
        formModel: true,
        storageModel: true
      }
    })) as OperationModelWithRelations | null;

    if (!detail) {
      return new NextResponse("操作模型创建失败", { status: 500 });
    }

    const payloadResponse = serializeDashboardData({
      storageModels: [],
      viewModels: [],
      formModels: [],
      operationModels: [detail]
    });

    return NextResponse.json(payloadResponse.operationModels[0], { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(error.errors.map((err) => err.message).join("；"), {
        status: 400
      });
    }

    const message =
      error instanceof Error ? `创建操作模型失败：${error.message}` : "创建操作模型失败";

    return new NextResponse(message, { status: 500 });
  }
}
