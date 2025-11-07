import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  serializeDashboardData,
  type ViewModelWithRelations
} from "@/lib/serializers";

const layoutFieldSchema = z.object({
  column: z.string().min(1, "字段名称不能为空"),
  label: z.string().min(1, "展示名称不能为空"),
  type: z.string().optional(),
  sortable: z.boolean().optional()
});

const createViewSchema = z.object({
  name: z.string().min(1, "视图名称不能为空"),
  description: z.string().optional(),
  storageModelId: z.string().min(1, "必须指定数据存储模型"),
  storageTableId: z.string().min(1, "必须指定数据表"),
  layout: z.object({
    fields: z.array(layoutFieldSchema).min(1, "至少选择一个字段")
  })
});

export async function GET() {
  const views = (await prisma.dataViewModel.findMany({
    include: {
      storageModel: true,
      storageTable: true
    },
    orderBy: {
      createdAt: "desc"
    }
  })) as ViewModelWithRelations[];

  const payload = serializeDashboardData({
    storageModels: [],
    viewModels: views,
    formModels: [],
    operationModels: [],
    domainModels: []
  });

  return NextResponse.json(payload.viewModels);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = createViewSchema.parse(payload);

    const view = await prisma.dataViewModel.create({
      data: {
        name: data.name,
        description: data.description,
        storageModelId: data.storageModelId,
        storageTableId: data.storageTableId,
        layout: data.layout
      }
    });

    const detail = (await prisma.dataViewModel.findUnique({
      where: { id: view.id },
      include: {
        storageModel: true,
        storageTable: true
      }
    })) as ViewModelWithRelations | null;

    if (!detail) {
      return new NextResponse("视图模型创建失败", { status: 500 });
    }

    const payloadResponse = serializeDashboardData({
      storageModels: [],
      viewModels: [detail],
      formModels: [],
      operationModels: [],
      domainModels: []
    });

    return NextResponse.json(payloadResponse.viewModels[0], { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(error.errors.map((err) => err.message).join("；"), {
        status: 400
      });
    }

    const message =
      error instanceof Error ? `创建视图模型失败：${error.message}` : "创建视图模型失败";

    return new NextResponse(message, { status: 500 });
  }
}
