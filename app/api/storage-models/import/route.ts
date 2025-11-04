import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  serializeDashboardData,
  type StorageModelWithRelations
} from "@/lib/serializers";

type ColumnSchema = {
  name: string;
  type?: string;
  key?: string | null;
  nullable?: boolean;
  default?: unknown;
  comment?: string | null;
};

const connectionSchema = z
  .object({
    host: z.string().min(1, "数据库地址不能为空"),
    port: z.union([z.string(), z.number()]).optional(),
    user: z.string().min(1, "数据库用户不能为空"),
    password: z.string().optional(),
    database: z.string().min(1, "数据库名称不能为空")
  })
  .transform((data) => {
    const portValue = data.port !== undefined ? Number(data.port) : 3306;
    const port = Number.isFinite(portValue) && portValue > 0 ? portValue : 3306;
    return {
      ...data,
      password: data.password ?? "",
      port
    };
  });

const importSchema = z.object({
  name: z.string().min(1, "模型名称不能为空"),
  description: z.string().optional(),
  connection: connectionSchema
});

export async function POST(request: Request) {
  let connection: mysql.Connection | null = null;

  try {
    const payload = await request.json();
    const { name, description, connection: conn } = importSchema.parse(payload);

    connection = await mysql.createConnection({
      host: conn.host,
      port: conn.port,
      user: conn.user,
      password: conn.password,
      database: conn.database
    });

    const [tableRows] = await connection.query<
      Array<{ tableName: string; tableComment: string }>
    >(
      `SELECT TABLE_NAME as tableName, TABLE_COMMENT as tableComment
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [conn.database]
    );

    const [columnRows] = await connection.query<
      Array<{
        tableName: string;
        columnName: string;
        columnType: string;
        columnKey: string | null;
        isNullable: "YES" | "NO";
        columnDefault: unknown;
        columnComment: string | null;
      }>
    >(
      `SELECT TABLE_NAME as tableName,
              COLUMN_NAME as columnName,
              COLUMN_TYPE as columnType,
              COLUMN_KEY as columnKey,
              IS_NULLABLE as isNullable,
              COLUMN_DEFAULT as columnDefault,
              COLUMN_COMMENT as columnComment
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ?
         ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [conn.database]
    );

    if (tableRows.length === 0) {
      return new NextResponse("目标数据库未检测到数据表", { status: 400 });
    }

    const columnsByTable = new Map<string, ColumnSchema[]>();
    for (const column of columnRows) {
      const list = columnsByTable.get(column.tableName) ?? [];
      list.push({
        name: column.columnName,
        type: column.columnType,
        key: column.columnKey,
        nullable: column.isNullable === "YES",
        default: column.columnDefault,
        comment: column.columnComment
      });
      columnsByTable.set(column.tableName, list);
    }

    const tables = tableRows.map((table) => {
      const columns = columnsByTable.get(table.tableName) ?? [];
      return {
        name: table.tableName,
        description: table.tableComment || null,
        columns
      };
    });

    const createdModel = await prisma.dataStorageModel.create({
      data: {
        name,
        description: description || undefined,
        database: conn.database,
        connection: `mysql://${encodeURIComponent(conn.user)}@${conn.host}:${conn.port}/${conn.database}`,
        schema: {
          importedAt: new Date().toISOString(),
          tables: tables.map((table) => ({
            name: table.name,
            description: table.description,
            columns: table.columns
          }))
        },
        tables: {
          create: tables.map((table) => ({
            name: table.name,
            description: table.description || undefined,
            schema: {
              columns: table.columns
            }
          }))
        }
      },
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
      }
    });

    const serialized = serializeDashboardData({
      storageModels: [createdModel as StorageModelWithRelations],
      viewModels: [],
      formModels: [],
      operationModels: []
    });

    return NextResponse.json(serialized.storageModels[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(error.errors.map((err) => err.message).join("；"), {
        status: 400
      });
    }

    const message =
      error instanceof Error
        ? `生成数据存储模型失败：${error.message}`
        : "生成数据存储模型失败";

    return new NextResponse(message, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
