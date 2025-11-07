import { Prisma } from "@prisma/client";
import {
  DashboardData,
  DomainField,
  DomainModel,
  FormModel,
  OperationModel,
  StorageModel,
  StorageTable,
  ViewModel
} from "@/types/models";

type IncludeOperationsOption = {
  includeOperations?: boolean;
};

type IncludeFormOption = {
  includeForm?: boolean;
};

export type StorageModelWithRelations = Prisma.DataStorageModelGetPayload<{
  include: {
    tables: {
      include: {
        forms: {
          include: {
            operations: true;
          };
        };
        views: true;
      };
    };
    operations: true;
    views: true;
  };
}>;

export type ViewModelWithRelations = Prisma.DataViewModelGetPayload<{
  include: {
    storageModel: true;
    storageTable: true;
  };
}>;

export type FormModelWithRelations = Prisma.DataFormModelGetPayload<{
  include: {
    storageTable: true;
    operations: true;
  };
}>;

export type OperationModelWithRelations = Prisma.DataOperationModelGetPayload<{
  include: {
    formModel: true;
    storageModel: true;
  };
}>;

export type DomainModelWithRelations = Prisma.DataDomainModelGetPayload<{
  include: {
    storageTables: {
      include: {
        storageTable: {
          include: {
            forms: {
              include: {
                operations: true;
              };
            };
            views: true;
          };
        };
      };
    };
    viewModels: {
      include: {
        viewModel: {
          include: {
            storageModel: true;
            storageTable: true;
          };
        };
      };
    };
    formModels: {
      include: {
        formModel: {
          include: {
            storageTable: true;
            operations: true;
          };
        };
      };
    };
    operationModels: {
      include: {
        operationModel: {
          include: {
            formModel: true;
            storageModel: true;
          };
        };
      };
    };
  };
}>;

function toOperationModel(
  model:
    | OperationModelWithRelations
    | StorageModelWithRelations["operations"][number]
    | FormModelWithRelations["operations"][number],
  options: IncludeFormOption = {}
): OperationModel {
  const base: OperationModel = {
    id: model.id,
    name: model.name,
    description: model.description,
    type: model.type as OperationModel["type"],
    endpoint: model.endpoint,
    method: model.method,
    storageModelId: model.storageModelId ?? undefined,
    formModelId: model.formModelId ?? undefined,
    requestSchema: model.requestSchema as unknown,
    responseSchema: model.responseSchema as unknown,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString()
  };

  if (options.includeForm && "formModel" in model && model.formModel) {
    base.formModel = {
      id: model.formModel.id,
      name: model.formModel.name,
      description: model.formModel.description,
      schema: model.formModel.schema as unknown,
      storageTableId: model.formModel.storageTableId,
      createdAt: model.formModel.createdAt.toISOString(),
      updatedAt: model.formModel.updatedAt.toISOString()
    };
  }

  return base;
}

function toFormModel(
  model:
    | FormModelWithRelations
    | StorageModelWithRelations["tables"][number]["forms"][number],
  options: IncludeOperationsOption = {}
): FormModel {
  const base: FormModel = {
    id: model.id,
    name: model.name,
    description: model.description,
    schema: model.schema as unknown,
    storageTableId: model.storageTableId,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString()
  };

  if (options.includeOperations && "operations" in model) {
    base.operations = model.operations.map((operation) =>
      toOperationModel(operation, { includeForm: false })
    );
  }

  if ("storageTable" in model && model.storageTable) {
    base.storageTable = {
      id: model.storageTable.id,
      name: model.storageTable.name,
      description: model.storageTable.description,
      schema: model.storageTable.schema as unknown,
      storageModelId: model.storageTable.storageModelId,
      createdAt: model.storageTable.createdAt.toISOString(),
      updatedAt: model.storageTable.updatedAt.toISOString(),
      forms: [],
      views: []
    };
  }

  return base;
}

function toViewModel(
  model:
    | ViewModelWithRelations
    | StorageModelWithRelations["views"][number]
    | StorageModelWithRelations["tables"][number]["views"][number]
): ViewModel {
  const base: ViewModel = {
    id: model.id,
    name: model.name,
    description: model.description,
    layout: (model as any).layout as unknown,
    storageModelId: model.storageModelId,
    storageTableId: model.storageTableId,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString()
  };

  if ("storageTable" in model && model.storageTable) {
    base.storageTable = {
      id: model.storageTable.id,
      name: model.storageTable.name,
      description: model.storageTable.description,
      schema: model.storageTable.schema as unknown,
      storageModelId: model.storageTable.storageModelId,
      createdAt: model.storageTable.createdAt.toISOString(),
      updatedAt: model.storageTable.updatedAt.toISOString(),
      forms: [],
      views: []
    };
  }

  return base;
}

function toStorageTable(
  table: StorageModelWithRelations["tables"][number]
): StorageTable {
  return {
    id: table.id,
    name: table.name,
    description: table.description,
    schema: table.schema as unknown,
    storageModelId: table.storageModelId,
    createdAt: table.createdAt.toISOString(),
    updatedAt: table.updatedAt.toISOString(),
    forms: table.forms.map((form) => toFormModel(form, { includeOperations: true })),
    views: table.views.map(toViewModel)
  };
}

function toStorageModel(model: StorageModelWithRelations): StorageModel {
  return {
    id: model.id,
    name: model.name,
    description: model.description,
    database: model.database,
    connection: model.connection,
    schema: model.schema as unknown,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
    tables: model.tables.map(toStorageTable),
    operations: model.operations.map((operation) =>
      toOperationModel(operation, { includeForm: false })
    ),
    views: model.views.map(toViewModel)
  };
}

function toDomainFields(schema: unknown): DomainField[] {
  if (!schema || typeof schema !== "object") {
    return [];
  }

  const { fields } = schema as { fields?: unknown };
  if (!Array.isArray(fields)) {
    return [];
  }

  return fields
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      const key = typeof record.key === "string" ? record.key : typeof record.column === "string" ? record.column : "";
      const name =
        typeof record.name === "string"
          ? record.name
          : typeof record.label === "string"
            ? record.label
            : "";

      if (!key || !name) {
        return null;
      }

      const type =
        typeof record.type === "string"
          ? record.type
          : typeof record.dataType === "string"
            ? record.dataType
            : undefined;
      const required = typeof record.required === "boolean" ? record.required : undefined;
      const description =
        typeof record.description === "string"
          ? record.description
          : record.description === null
            ? null
            : undefined;

      return {
        key,
        name,
        type,
        required,
        description
      } as DomainField;
    })
    .filter((field): field is DomainField => field !== null);
}

function toDomainModel(model: DomainModelWithRelations): DomainModel {
  const fields = toDomainFields(model.schema);
  const schema = model.schema ? { fields } : null;

  return {
    id: model.id,
    name: model.name,
    description: model.description,
    schema,
    fields,
    storageTables: model.storageTables.map((item) =>
      toStorageTable(
        item.storageTable as unknown as StorageModelWithRelations["tables"][number]
      )
    ),
    viewModels: model.viewModels.map((item) =>
      toViewModel(item.viewModel as unknown as ViewModelWithRelations)
    ),
    formModels: model.formModels.map((item) =>
      toFormModel(item.formModel as unknown as FormModelWithRelations, {
        includeOperations: true
      })
    ),
    operationModels: model.operationModels.map((item) =>
      toOperationModel(item.operationModel as unknown as OperationModelWithRelations, {
        includeForm: true
      })
    ),
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString()
  };
}

export function serializeDashboardData(params: {
  storageModels: StorageModelWithRelations[];
  viewModels: ViewModelWithRelations[];
  formModels: FormModelWithRelations[];
  operationModels: OperationModelWithRelations[];
  domainModels: DomainModelWithRelations[];
}): DashboardData {
  return {
    storageModels: params.storageModels.map(toStorageModel),
    viewModels: params.viewModels.map(toViewModel),
    formModels: params.formModels.map((model) =>
      toFormModel(model, { includeOperations: true })
    ),
    operationModels: params.operationModels.map((operation) =>
      toOperationModel(operation, { includeForm: true })
    ),
    domainModels: params.domainModels.map(toDomainModel)
  };
}
