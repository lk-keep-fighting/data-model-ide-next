export interface StorageTable {
  id: string;
  name: string;
  description?: string | null;
  schema: unknown | null;
  storageModelId: string;
  createdAt: string;
  updatedAt: string;
  forms: FormModel[];
  views: ViewModel[];
}

export interface StorageModel {
  id: string;
  name: string;
  description?: string | null;
  database: string;
  connection?: string | null;
  schema: unknown | null;
  createdAt: string;
  updatedAt: string;
  tables: StorageTable[];
  operations: OperationModel[];
  views: ViewModel[];
}

export interface ViewModel {
  id: string;
  name: string;
  description?: string | null;
  layout: unknown;
  storageModelId: string;
  storageTableId: string;
  createdAt: string;
  updatedAt: string;
  storageTable?: StorageTable;
}

export interface FormModel {
  id: string;
  name: string;
  description?: string | null;
  schema: unknown;
  storageTableId: string;
  createdAt: string;
  updatedAt: string;
  storageTable?: StorageTable;
  operations?: OperationModel[];
}

export interface OperationModel {
  id: string;
  name: string;
  description?: string | null;
  type: "CREATE" | "READ" | "UPDATE" | "DELETE" | "CUSTOM";
  endpoint?: string | null;
  method?: string | null;
  storageModelId?: string | null;
  formModelId?: string | null;
  requestSchema?: unknown;
  responseSchema?: unknown;
  createdAt: string;
  updatedAt: string;
  formModel?: FormModel | null;
}

export interface DomainField {
  key: string;
  name: string;
  type?: string;
  required?: boolean;
  description?: string | null;
}

export interface DomainSchema {
  fields: DomainField[];
}

export interface DomainModel {
  id: string;
  name: string;
  description?: string | null;
  schema: DomainSchema | null;
  fields: DomainField[];
  storageTables: StorageTable[];
  viewModels: ViewModel[];
  formModels: FormModel[];
  operationModels: OperationModel[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  storageModels: StorageModel[];
  viewModels: ViewModel[];
  formModels: FormModel[];
  operationModels: OperationModel[];
  domainModels: DomainModel[];
}

