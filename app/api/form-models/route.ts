import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  serializeDashboardData,
  type FormModelWithRelations
} from "@/lib/serializers";

const formFieldSchema = z.object({
  column: z.string().min(1, "字段名称不能为空"),
  label: z.string().min(1, "展示名称不能为空"),
  required: z.boolean().default(false),
  component: z.string().min(1, "控件类型不能为空")
});

const createFormSchema = z.object({
  name: z.string().min(1, "表单名称不能为空"),
  description: z.string().optional(),
  storageTableId: z.string().min(1, "必须指定数据表"),
  schema: z.object({
    fields: z.array(formFieldSchema).min(1, "至少配置一个字段")
  })
});

export async function GET() {
  const forms = (await prisma.dataFormModel.findMany({
    include: {
      storageTable: true,
      operations: true
    },
    orderBy: {
      createdAt: "desc"
    }
  })) as FormModelWithRelations[];

  const payload = serializeDashboardData({
    storageModels: [],
    viewModels: [],
    formModels: forms,
    operationModels: [],
    domainModels: []
  });

  return NextResponse.json(payload.formModels);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = createFormSchema.parse(payload);

    const form = await prisma.dataFormModel.create({
      data: {
        name: data.name,
        description: data.description,
        storageTableId: data.storageTableId,
        schema: data.schema
      }
    });

    const detail = (await prisma.dataFormModel.findUnique({
      where: { id: form.id },
      include: {
        storageTable: true,
        operations: true
      }
    })) as FormModelWithRelations | null;

    if (!detail) {
      return new NextResponse("表单模型创建失败", { status: 500 });
    }

    const payloadResponse = serializeDashboardData({
      storageModels: [],
      viewModels: [],
      formModels: [detail],
      operationModels: [],
      domainModels: []
    });

    return NextResponse.json(payloadResponse.formModels[0], { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(error.errors.map((err) => err.message).join("；"), {
        status: 400
      });
    }

    const message =
      error instanceof Error ? `创建表单模型失败：${error.message}` : "创建表单模型失败";

    return new NextResponse(message, { status: 500 });
  }
}
