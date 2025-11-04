"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DashboardData,
  FormModel,
  OperationModel,
  StorageModel,
  StorageTable,
  ViewModel
} from "@/types/models";

interface DashboardRootProps {
  initialData: DashboardData;
}

type StorageImportFormState = {
  name: string;
  description: string;
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

type ColumnMeta = {
  name: string;
  type?: string;
  key?: string;
  nullable?: boolean;
  default?: unknown;
  comment?: string | null;
};

type ViewDesignerState = {
  name: string;
  description: string;
  storageModelId: string;
  storageTableId: string;
  selectedColumns: Record<string, boolean>;
};

type FormDesignerField = {
  include: boolean;
  label: string;
  required: boolean;
  component: string;
};

type FormDesignerState = {
  name: string;
  description: string;
  storageModelId: string;
  storageTableId: string;
  fields: Record<string, FormDesignerField>;
};

type OperationDesignerState = {
  name: string;
  description: string;
  type: OperationModel["type"];
  formModelId: string | null;
  storageModelId: string | null;
  endpoint: string;
  method: string;
  requestSchema: string;
  responseSchema: string;
};

const DEFAULT_STORAGE_FORM: StorageImportFormState = {
  name: "",
  description: "",
  host: "",
  port: "3306",
  user: "",
  password: "",
  database: ""
};

const DEFAULT_VIEW_STATE: ViewDesignerState = {
  name: "",
  description: "",
  storageModelId: "",
  storageTableId: "",
  selectedColumns: {}
};

const DEFAULT_FORM_STATE: FormDesignerState = {
  name: "",
  description: "",
  storageModelId: "",
  storageTableId: "",
  fields: {}
};

const DEFAULT_OPERATION_STATE: OperationDesignerState = {
  name: "",
  description: "",
  type: "READ",
  formModelId: null,
  storageModelId: null,
  endpoint: "",
  method: "GET",
  requestSchema: "",
  responseSchema: ""
};

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const OPERATION_TYPES: OperationModel["type"][] = [
  "CREATE",
  "READ",
  "UPDATE",
  "DELETE",
  "CUSTOM"
];

const SELECT_EMPTY_VALUE = "__none__";

const FIELD_COMPONENT_OPTIONS = [
  { value: "text", label: "文本输入" },
  { value: "textarea", label: "多行文本" },
  { value: "number", label: "数值输入" },
  { value: "select", label: "下拉选择" },
  { value: "date", label: "日期选择" }
];

function extractColumns(table?: StorageTable | null): ColumnMeta[] {
  if (!table || !table.schema) return [];
  const schema = table.schema as { columns?: ColumnMeta[] };
  if (schema && Array.isArray(schema.columns)) {
    return schema.columns as ColumnMeta[];
  }
  return [];
}

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Shanghai"
});

function formatDate(value: string) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return DATE_FORMATTER.format(date);
  } catch (error) {
    return value;
  }
}

function inferDefaultFields(columns: ColumnMeta[]): Record<string, FormDesignerField> {
  return columns.reduce<Record<string, FormDesignerField>>((acc, column) => {
    acc[column.name] = {
      include: true,
      label: column.comment || column.name,
      required: column.key === "PRI" || column.nullable === false,
      component: column.type && column.type.includes("text") ? "textarea" : "text"
    };
    return acc;
  }, {});
}

function DashboardRoot({ initialData }: DashboardRootProps) {
  const [storageModels, setStorageModels] = useState<StorageModel[]>(
    initialData.storageModels
  );
  const [viewModels, setViewModels] = useState<ViewModel[]>(initialData.viewModels);
  const [formModels, setFormModels] = useState<FormModel[]>(initialData.formModels);
  const [operationModels, setOperationModels] = useState<OperationModel[]>(
    initialData.operationModels
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [storageForm, setStorageForm] = useState<StorageImportFormState>(
    DEFAULT_STORAGE_FORM
  );
  const [isImportingStorage, setIsImportingStorage] = useState(false);

  const [viewState, setViewState] = useState<ViewDesignerState>(() => {
    const firstModel = initialData.storageModels[0];
    return {
      ...DEFAULT_VIEW_STATE,
      storageModelId: firstModel?.id ?? "",
      storageTableId: firstModel?.tables[0]?.id ?? "",
      selectedColumns: {}
    };
  });
  const [formState, setFormState] = useState<FormDesignerState>(() => {
    const firstModel = initialData.storageModels[0];
    return {
      ...DEFAULT_FORM_STATE,
      storageModelId: firstModel?.id ?? "",
      storageTableId: firstModel?.tables[0]?.id ?? "",
      fields: {}
    };
  });
  const [operationState, setOperationState] = useState<OperationDesignerState>(
    DEFAULT_OPERATION_STATE
  );
  const [isCreatingView, setIsCreatingView] = useState(false);
  const [isCreatingForm, setIsCreatingForm] = useState(false);
  const [isCreatingOperation, setIsCreatingOperation] = useState(false);

  const selectedViewStorage = useMemo(
    () => storageModels.find((model) => model.id === viewState.storageModelId),
    [storageModels, viewState.storageModelId]
  );
  const selectedViewTable = useMemo(
    () => selectedViewStorage?.tables.find((table) => table.id === viewState.storageTableId),
    [selectedViewStorage, viewState.storageTableId]
  );
  const selectedViewColumns = useMemo(
    () => extractColumns(selectedViewTable),
    [selectedViewTable]
  );

  const selectedFormStorage = useMemo(
    () => storageModels.find((model) => model.id === formState.storageModelId),
    [storageModels, formState.storageModelId]
  );
  const selectedFormTable = useMemo(
    () => selectedFormStorage?.tables.find((table) => table.id === formState.storageTableId),
    [selectedFormStorage, formState.storageTableId]
  );
  const selectedFormColumns = useMemo(
    () => extractColumns(selectedFormTable),
    [selectedFormTable]
  );

  useEffect(() => {
    if (selectedViewColumns.length && Object.keys(viewState.selectedColumns).length === 0) {
      setViewState((prev) => ({
        ...prev,
        selectedColumns: selectedViewColumns.reduce<Record<string, boolean>>(
          (acc, column) => ({
            ...acc,
            [column.name]: true
          }),
          {}
        )
      }));
    }
  }, [selectedViewColumns, viewState.selectedColumns]);

  useEffect(() => {
    if (selectedFormColumns.length && Object.keys(formState.fields).length === 0) {
      setFormState((prev) => ({
        ...prev,
        fields: inferDefaultFields(selectedFormColumns)
      }));
    }
  }, [formState.fields, selectedFormColumns]);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/dashboard");
      if (!response.ok) {
        throw new Error("无法刷新数据，请稍后再试");
      }
      const payload: DashboardData = await response.json();
      setStorageModels(payload.storageModels);
      setViewModels(payload.viewModels);
      setFormModels(payload.formModels);
      setOperationModels(payload.operationModels);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "刷新失败");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleStorageSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!storageForm.name || !storageForm.host || !storageForm.user || !storageForm.database) {
        toast.error("请完整填写模型名称、数据库连接信息");
        return;
      }

      setIsImportingStorage(true);
      try {
        const response = await fetch("/api/storage-models/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: storageForm.name,
            description: storageForm.description || undefined,
            connection: {
              host: storageForm.host,
              port: Number(storageForm.port) || 3306,
              user: storageForm.user,
              password: storageForm.password,
              database: storageForm.database
            }
          })
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "导入数据存储模型失败");
        }

        toast.success("数据存储模型生成成功");
        setStorageForm(DEFAULT_STORAGE_FORM);
        await refreshData();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "导入失败");
      } finally {
        setIsImportingStorage(false);
      }
    },
    [refreshData, storageForm]
  );

  const toggleViewColumn = useCallback((column: string) => {
    setViewState((prev) => ({
      ...prev,
      selectedColumns: {
        ...prev.selectedColumns,
        [column]: !prev.selectedColumns[column]
      }
    }));
  }, []);

  const updateFormField = useCallback(
    (column: string, partial: Partial<FormDesignerField>) => {
      setFormState((prev) => ({
        ...prev,
        fields: {
          ...prev.fields,
          [column]: {
            ...prev.fields[column],
            ...partial
          }
        }
      }));
    },
    []
  );

  const handleCreateView = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!viewState.name || !viewState.storageModelId || !viewState.storageTableId) {
        toast.error("请填写视图名称并选择对应的数据表");
        return;
      }
      const selectedColumns = Object.entries(viewState.selectedColumns)
        .filter(([, checked]) => checked)
        .map(([column]) => column);

      if (!selectedColumns.length) {
        toast.error("请至少选择一个字段用于展示");
        return;
      }

      setIsCreatingView(true);
      try {
        const layout = {
          fields: selectedColumns.map((column) => {
            const metadata = selectedViewColumns.find((item) => item.name === column);
            return {
              column,
              label: metadata?.comment || column,
              type: metadata?.type,
              sortable: metadata?.key === "PRI" || metadata?.type?.includes("int")
            };
          })
        };

        const response = await fetch("/api/view-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: viewState.name,
            description: viewState.description || undefined,
            storageModelId: viewState.storageModelId,
            storageTableId: viewState.storageTableId,
            layout
          })
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "创建视图模型失败");
        }

        toast.success("数据展示视图创建成功");
        setViewState((prev) => ({
          ...DEFAULT_VIEW_STATE,
          storageModelId: prev.storageModelId,
          storageTableId: prev.storageTableId,
          selectedColumns: prev.selectedColumns
        }));
        await refreshData();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "创建失败");
      } finally {
        setIsCreatingView(false);
      }
    },
    [refreshData, selectedViewColumns, viewState]
  );

  const handleCreateForm = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!formState.name || !formState.storageTableId) {
        toast.error("请填写表单名称并选择数据表");
        return;
      }

      const activeFields = Object.entries(formState.fields)
        .filter(([, config]) => config?.include)
        .map(([column, config]) => ({
          column,
          label: config.label || column,
          required: config.required,
          component: config.component
        }));

      if (!activeFields.length) {
        toast.error("请至少选择一个字段用于表单");
        return;
      }

      setIsCreatingForm(true);
      try {
        const schema = {
          fields: activeFields
        };
        const response = await fetch("/api/form-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formState.name,
            description: formState.description || undefined,
            storageTableId: formState.storageTableId,
            schema
          })
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "创建数据表单模型失败");
        }

        toast.success("数据表单模型创建成功");
        setFormState((prev) => ({
          ...DEFAULT_FORM_STATE,
          storageModelId: prev.storageModelId,
          storageTableId: prev.storageTableId,
          fields: prev.fields
        }));
        await refreshData();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "创建失败");
      } finally {
        setIsCreatingForm(false);
      }
    },
    [formState, refreshData]
  );

  const handleCreateOperation = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!operationState.name) {
        toast.error("请填写操作名称");
        return;
      }

      let requestSchema: unknown = undefined;
      let responseSchema: unknown = undefined;

      if (operationState.requestSchema) {
        try {
          requestSchema = JSON.parse(operationState.requestSchema);
        } catch (error) {
          toast.error("请求参数 JSON 解析失败");
          return;
        }
      }

      if (operationState.responseSchema) {
        try {
          responseSchema = JSON.parse(operationState.responseSchema);
        } catch (error) {
          toast.error("响应结果 JSON 解析失败");
          return;
        }
      }

      setIsCreatingOperation(true);
      try {
        const response = await fetch("/api/operation-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: operationState.name,
            description: operationState.description || undefined,
            type: operationState.type,
            endpoint: operationState.endpoint || undefined,
            method: operationState.method || undefined,
            storageModelId: operationState.storageModelId || undefined,
            formModelId: operationState.formModelId || undefined,
            requestSchema,
            responseSchema
          })
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "创建操作模型失败");
        }

        toast.success("数据操作模型创建成功");
        setOperationState(DEFAULT_OPERATION_STATE);
        await refreshData();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "创建失败");
      } finally {
        setIsCreatingOperation(false);
      }
    },
    [operationState, refreshData]
  );

  const handleSyncRequestSchema = useCallback(
    (formModelId: string | null) => {
      if (!formModelId) return;
      const targetForm = formModels.find((item) => item.id === formModelId);
      if (!targetForm) return;
      setOperationState((prev) => ({
        ...prev,
        requestSchema: JSON.stringify(targetForm.schema, null, 2)
      }));
    },
    [formModels]
  );

  return (
    <Tabs defaultValue="storage" className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <TabsList>
          <TabsTrigger value="storage">数据存储模型</TabsTrigger>
          <TabsTrigger value="view">数据展示视图</TabsTrigger>
          <TabsTrigger value="form">数据提交表单</TabsTrigger>
          <TabsTrigger value="operation">数据操作模型</TabsTrigger>
        </TabsList>
        <Button variant="outline" onClick={refreshData} disabled={isRefreshing}>
          {isRefreshing ? "刷新中..." : "刷新数据"}
        </Button>
      </div>

      <TabsContent value="storage" className="space-y-6">
        <StorageModelsTab
          storageModels={storageModels}
          formState={storageForm}
          setFormState={setStorageForm}
          onSubmit={handleStorageSubmit}
          isSubmitting={isImportingStorage}
        />
      </TabsContent>

      <TabsContent value="view" className="space-y-6">
        <ViewModelsTab
          storageModels={storageModels}
          viewModels={viewModels}
          formState={viewState}
          setFormState={setViewState}
          onSubmit={handleCreateView}
          toggleColumn={toggleViewColumn}
          columns={selectedViewColumns}
          isSubmitting={isCreatingView}
        />
      </TabsContent>

      <TabsContent value="form" className="space-y-6">
        <FormModelsTab
          storageModels={storageModels}
          formModels={formModels}
          designerState={formState}
          setDesignerState={setFormState}
          columns={selectedFormColumns}
          onFieldChange={updateFormField}
          onSubmit={handleCreateForm}
          isSubmitting={isCreatingForm}
        />
      </TabsContent>

      <TabsContent value="operation" className="space-y-6">
        <OperationModelsTab
          storageModels={storageModels}
          formModels={formModels}
          operationModels={operationModels}
          state={operationState}
          setState={setOperationState}
          onSubmit={handleCreateOperation}
          onSyncRequestSchema={handleSyncRequestSchema}
          isSubmitting={isCreatingOperation}
        />
      </TabsContent>
    </Tabs>
  );
}

interface StorageModelsTabProps {
  storageModels: StorageModel[];
  formState: StorageImportFormState;
  setFormState: Dispatch<SetStateAction<StorageImportFormState>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isSubmitting: boolean;
}

function StorageModelsTab({
  storageModels,
  formState,
  setFormState,
  onSubmit,
  isSubmitting
}: StorageModelsTabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
      <Card>
        <CardHeader>
          <CardTitle>数据库快速建模</CardTitle>
          <CardDescription>
            通过连接 MySQL 数据库自动生成数据存储模型，默认同步库内全部数据表与字段。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="storage-name">模型名称</Label>
              <Input
                id="storage-name"
                placeholder="例如：业务数据仓库"
                value={formState.name}
                onChange={(event) =>
                  setFormState({ ...formState, name: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storage-desc">模型说明</Label>
              <Textarea
                id="storage-desc"
                placeholder="用于描述数据存储模型的业务含义"
                value={formState.description}
                onChange={(event) =>
                  setFormState({ ...formState, description: event.target.value })
                }
              />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="db-host">数据库地址</Label>
                <Input
                  id="db-host"
                  placeholder="例如：127.0.0.1"
                  value={formState.host}
                  onChange={(event) =>
                    setFormState({ ...formState, host: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-port">端口</Label>
                <Input
                  id="db-port"
                  placeholder="默认 3306"
                  value={formState.port}
                  onChange={(event) =>
                    setFormState({ ...formState, port: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="db-user">用户名</Label>
                <Input
                  id="db-user"
                  placeholder="数据库用户"
                  value={formState.user}
                  onChange={(event) =>
                    setFormState({ ...formState, user: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-password">密码</Label>
                <Input
                  id="db-password"
                  type="password"
                  placeholder="数据库密码"
                  value={formState.password}
                  onChange={(event) =>
                    setFormState({ ...formState, password: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="db-database">数据库名称</Label>
              <Input
                id="db-database"
                placeholder="需要同步的数据库"
                value={formState.database}
                onChange={(event) =>
                  setFormState({ ...formState, database: event.target.value })
                }
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "生成中..." : "连接并生成模型"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-4">
        {storageModels.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>暂无数据存储模型</CardTitle>
              <CardDescription>
                通过左侧表单连接数据库后即可自动生成数据结构定义。
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          storageModels.map((model) => (
            <Card key={model.id}>
              <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {model.name}
                    <Badge variant="secondary">{model.database}</Badge>
                  </CardTitle>
                  {model.description ? (
                    <CardDescription>{model.description}</CardDescription>
                  ) : null}
                </div>
                <div className="text-sm text-muted-foreground">
                  最近更新：{formatDate(model.updatedAt)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>数据表：{model.tables.length} 个</span>
                  <span>视图：{model.views.length} 个</span>
                  <span>操作：{model.operations.length} 个</span>
                </div>
                {model.tables.map((table) => (
                  <div key={table.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-semibold">{table.name}</h4>
                        {table.description ? (
                          <p className="text-sm text-muted-foreground">
                            {table.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>字段：{extractColumns(table).length}</span>
                        <span>视图：{table.views.length}</span>
                        <span>表单：{table.forms.length}</span>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>字段名</TableHead>
                          <TableHead>类型</TableHead>
                          <TableHead>约束</TableHead>
                          <TableHead>说明</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extractColumns(table).map((column) => (
                          <TableRow key={column.name}>
                            <TableCell>{column.name}</TableCell>
                            <TableCell>{column.type}</TableCell>
                            <TableCell>
                              {column.key === "PRI" ? "主键" : column.nullable ? "可空" : "非空"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {column.comment || "--"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

interface ViewModelsTabProps {
  storageModels: StorageModel[];
  viewModels: ViewModel[];
  formState: ViewDesignerState;
  setFormState: Dispatch<SetStateAction<ViewDesignerState>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  toggleColumn: (column: string) => void;
  columns: ColumnMeta[];
  isSubmitting: boolean;
}

function ViewModelsTab({
  storageModels,
  viewModels,
  formState,
  setFormState,
  onSubmit,
  toggleColumn,
  columns,
  isSubmitting
}: ViewModelsTabProps) {
  const selectedModel = storageModels.find((model) => model.id === formState.storageModelId);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
      <Card>
        <CardHeader>
          <CardTitle>设计数据展示视图</CardTitle>
          <CardDescription>
            基于数据存储模型选择数据表及展示字段，快速生成列表视图配置。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="view-name">视图名称</Label>
              <Input
                id="view-name"
                placeholder="例如：用户列表"
                value={formState.name}
                onChange={(event) =>
                  setFormState({ ...formState, name: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="view-desc">视图说明</Label>
              <Textarea
                id="view-desc"
                placeholder="用于描述视图用途"
                value={formState.description}
                onChange={(event) =>
                  setFormState({ ...formState, description: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>选择数据模型</Label>
              <Select
                value={formState.storageModelId}
                onValueChange={(value) => {
                  const target = storageModels.find((model) => model.id === value);
                  setFormState({
                    ...formState,
                    storageModelId: value,
                    storageTableId: target?.tables[0]?.id ?? "",
                    selectedColumns: {}
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择数据存储模型" />
                </SelectTrigger>
                <SelectContent>
                  {storageModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>选择数据表</Label>
              <Select
                value={formState.storageTableId}
                onValueChange={(value) =>
                  setFormState({
                    ...formState,
                    storageTableId: value,
                    selectedColumns: {}
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择数据表" />
                </SelectTrigger>
                <SelectContent>
                  {selectedModel?.tables.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>选择展示字段</Label>
                <span className="text-xs text-muted-foreground">
                  已选 {Object.values(formState.selectedColumns).filter(Boolean).length} 个字段
                </span>
              </div>
              <div className="grid gap-2">
                {columns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">请选择数据表以加载字段信息</p>
                ) : (
                  columns.map((column) => (
                    <label
                      key={column.name}
                      className="flex cursor-pointer items-center justify-between rounded-md border bg-card px-3 py-2 text-sm shadow-sm"
                    >
                      <div>
                        <div className="font-medium">{column.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {column.type} {column.comment ? `· ${column.comment}` : ""}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={formState.selectedColumns[column.name] ?? false}
                        onChange={() => toggleColumn(column.name)}
                      />
                    </label>
                  ))
                )}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "创建中..." : "生成视图模型"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-4">
        {viewModels.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>暂无视图模型</CardTitle>
              <CardDescription>
                创建完成后可以用于前端界面列表渲染或低代码平台配置。
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          viewModels.map((view) => (
            <Card key={view.id}>
              <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>{view.name}</CardTitle>
                  {view.description ? (
                    <CardDescription>{view.description}</CardDescription>
                  ) : null}
                </div>
                <div className="text-sm text-muted-foreground">
                  更新于：{formatDate(view.updatedAt)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  绑定数据表：{view.storageTable?.name ?? view.storageTableId}
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>字段</TableHead>
                        <TableHead>展示名称</TableHead>
                        <TableHead>类型</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.isArray((view.layout as any)?.fields) ? (
                        (view.layout as any).fields.map((field: any) => (
                          <TableRow key={field.column}>
                            <TableCell>{field.column}</TableCell>
                            <TableCell>{field.label}</TableCell>
                            <TableCell>{field.type || "--"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                            暂无字段配置
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

interface FormModelsTabProps {
  storageModels: StorageModel[];
  formModels: FormModel[];
  designerState: FormDesignerState;
  setDesignerState: Dispatch<SetStateAction<FormDesignerState>>;
  columns: ColumnMeta[];
  onFieldChange: (column: string, partial: Partial<FormDesignerField>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isSubmitting: boolean;
}

function FormModelsTab({
  storageModels,
  formModels,
  designerState,
  setDesignerState,
  columns,
  onFieldChange,
  onSubmit,
  isSubmitting
}: FormModelsTabProps) {
  const selectedModel = storageModels.find((model) => model.id === designerState.storageModelId);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
      <Card>
        <CardHeader>
          <CardTitle>设计提交表单</CardTitle>
          <CardDescription>
            选择数据表字段并定义校验、控件类型，生成可复用的数据提交表单模型。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="form-name">表单名称</Label>
              <Input
                id="form-name"
                placeholder="例如：用户信息录入表单"
                value={designerState.name}
                onChange={(event) =>
                  setDesignerState({ ...designerState, name: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-desc">表单说明</Label>
              <Textarea
                id="form-desc"
                placeholder="用于描述表单用途与业务场景"
                value={designerState.description}
                onChange={(event) =>
                  setDesignerState({
                    ...designerState,
                    description: event.target.value
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>选择数据模型</Label>
              <Select
                value={designerState.storageModelId}
                onValueChange={(value) => {
                  const target = storageModels.find((model) => model.id === value);
                  setDesignerState({
                    ...designerState,
                    storageModelId: value,
                    storageTableId: target?.tables[0]?.id ?? "",
                    fields: {}
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择数据存储模型" />
                </SelectTrigger>
                <SelectContent>
                  {storageModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>选择数据表</Label>
              <Select
                value={designerState.storageTableId}
                onValueChange={(value) =>
                  setDesignerState({
                    ...designerState,
                    storageTableId: value,
                    fields: {}
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择数据表" />
                </SelectTrigger>
                <SelectContent>
                  {selectedModel?.tables.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>字段配置</Label>
                <span className="text-xs text-muted-foreground">
                  已选 {Object.values(designerState.fields).filter((item) => item?.include).length} 个字段
                </span>
              </div>
              <div className="space-y-3">
                {columns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">请选择数据表以加载字段信息</p>
                ) : (
                  columns.map((column) => {
                    const fieldConfig =
                      designerState.fields[column.name] ?? {
                        include: true,
                        label: column.comment || column.name,
                        required: column.key === "PRI",
                        component: "text"
                      };
                    return (
                      <div key={column.name} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-medium">{column.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {column.type} {column.comment ? `· ${column.comment}` : ""}
                            </div>
                          </div>
                          <label className="flex items-center gap-2 text-xs">
                            <span>包含字段</span>
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={fieldConfig.include}
                              onChange={(event) =>
                                onFieldChange(column.name, { include: event.target.checked })
                              }
                            />
                          </label>
                        </div>
                        {fieldConfig.include ? (
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">展示名称</Label>
                              <Input
                                value={fieldConfig.label}
                                onChange={(event) =>
                                  onFieldChange(column.name, { label: event.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">控件类型</Label>
                              <Select
                                value={fieldConfig.component}
                                onValueChange={(value) =>
                                  onFieldChange(column.name, { component: value })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="选择控件" />
                                </SelectTrigger>
                                <SelectContent>
                                  {FIELD_COMPONENT_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <label className="flex items-center gap-2 text-xs">
                              <span>必填</span>
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={fieldConfig.required}
                                onChange={(event) =>
                                  onFieldChange(column.name, { required: event.target.checked })
                                }
                              />
                            </label>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "创建中..." : "生成表单模型"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-4">
        {formModels.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>暂无表单模型</CardTitle>
              <CardDescription>创建表单模型后可用于数据录入、审批等场景。</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          formModels.map((form) => (
            <Card key={form.id}>
              <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>{form.name}</CardTitle>
                  {form.description ? (
                    <CardDescription>{form.description}</CardDescription>
                  ) : null}
                </div>
                <div className="text-sm text-muted-foreground">
                  更新于：{formatDate(form.updatedAt)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>绑定数据表：{form.storageTable?.name ?? form.storageTableId}</span>
                  <span>关联操作：{form.operations?.length ?? 0} 个</span>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>字段</TableHead>
                        <TableHead>展示名称</TableHead>
                        <TableHead>控件</TableHead>
                        <TableHead>必填</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.isArray((form.schema as any)?.fields) ? (
                        (form.schema as any).fields.map((field: any) => (
                          <TableRow key={field.column}>
                            <TableCell>{field.column}</TableCell>
                            <TableCell>{field.label}</TableCell>
                            <TableCell>{field.component}</TableCell>
                            <TableCell>{field.required ? "是" : "否"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                            暂无字段配置
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

interface OperationModelsTabProps {
  storageModels: StorageModel[];
  formModels: FormModel[];
  operationModels: OperationModel[];
  state: OperationDesignerState;
  setState: Dispatch<SetStateAction<OperationDesignerState>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onSyncRequestSchema: (formModelId: string | null) => void;
  isSubmitting: boolean;
}

function OperationModelsTab({
  storageModels,
  formModels,
  operationModels,
  state,
  setState,
  onSubmit,
  onSyncRequestSchema,
  isSubmitting
}: OperationModelsTabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
      <Card>
        <CardHeader>
          <CardTitle>设计数据操作</CardTitle>
          <CardDescription>
            配置 CRUD 或自定义接口操作，可绑定已有表单模型自动生成参数结构。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="operation-name">操作名称</Label>
              <Input
                id="operation-name"
                placeholder="例如：创建用户"
                value={state.name}
                onChange={(event) =>
                  setState({ ...state, name: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operation-desc">操作说明</Label>
              <Textarea
                id="operation-desc"
                placeholder="可选：用于描述操作触发场景"
                value={state.description}
                onChange={(event) =>
                  setState({ ...state, description: event.target.value })
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>操作类型</Label>
                <Select
                  value={state.type}
                  onValueChange={(value) => setState({ ...state, type: value as OperationModel["type"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>HTTP Method</Label>
                <Select
                  value={state.method}
                  onValueChange={(value) => setState({ ...state, method: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择请求方式" />
                  </SelectTrigger>
                  <SelectContent>
                    {HTTP_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="operation-endpoint">接口地址</Label>
              <Input
                id="operation-endpoint"
                placeholder="例如：/api/users"
                value={state.endpoint}
                onChange={(event) =>
                  setState({ ...state, endpoint: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>关联数据存储模型</Label>
              <Select
                value={state.storageModelId ?? SELECT_EMPTY_VALUE}
                onValueChange={(value) =>
                  setState({
                    ...state,
                    storageModelId: value === SELECT_EMPTY_VALUE ? null : value
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="可选：关联数据存储模型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_EMPTY_VALUE}>不关联</SelectItem>
                  {storageModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>绑定表单模型</Label>
              <Select
                value={state.formModelId ?? SELECT_EMPTY_VALUE}
                onValueChange={(value) => {
                  const resolved = value === SELECT_EMPTY_VALUE ? null : value;
                  setState({ ...state, formModelId: resolved });
                  onSyncRequestSchema(resolved);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="可选：绑定表单模型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_EMPTY_VALUE}>不绑定</SelectItem>
                  {formModels.map((form) => (
                    <SelectItem key={form.id} value={form.id}>
                      {form.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>请求参数结构 (JSON)</Label>
              <Textarea
                rows={6}
                placeholder="可粘贴 JSON 结构，或绑定表单模型后自动生成"
                value={state.requestSchema}
                onChange={(event) =>
                  setState({ ...state, requestSchema: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>响应结构 (JSON)</Label>
              <Textarea
                rows={6}
                placeholder="可选：定义接口返回数据结构"
                value={state.responseSchema}
                onChange={(event) =>
                  setState({ ...state, responseSchema: event.target.value })
                }
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "创建中..." : "创建操作模型"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-4">
        {operationModels.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>暂无操作模型</CardTitle>
              <CardDescription>创建操作模型可用于驱动接口调用、流程执行等场景。</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          operationModels.map((operation) => (
            <Card key={operation.id}>
              <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle>{operation.name}</CardTitle>
                    <Badge>{operation.type}</Badge>
                    {operation.method ? (
                      <Badge variant="outline">{operation.method}</Badge>
                    ) : null}
                  </div>
                  {operation.description ? (
                    <CardDescription>{operation.description}</CardDescription>
                  ) : null}
                </div>
                <div className="text-sm text-muted-foreground">
                  更新于：{formatDate(operation.updatedAt)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm text-muted-foreground">
                  {operation.endpoint ? (
                    <div>
                      接口地址：<span className="font-medium text-foreground">{operation.endpoint}</span>
                    </div>
                  ) : null}
                  {operation.storageModelId ? (
                    <div>关联存储模型：{operation.storageModelId}</div>
                  ) : null}
                  {operation.formModelId ? (
                    <div>绑定表单模型：{operation.formModelId}</div>
                  ) : null}
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <h4 className="mb-2 text-sm font-semibold">请求参数</h4>
                    <pre className="max-h-60 overflow-auto text-xs text-muted-foreground">
                      {operation.requestSchema
                        ? JSON.stringify(operation.requestSchema, null, 2)
                        : "--"}
                    </pre>
                  </div>
                  <div className="rounded-md border p-3">
                    <h4 className="mb-2 text-sm font-semibold">响应结构</h4>
                    <pre className="max-h-60 overflow-auto text-xs text-muted-foreground">
                      {operation.responseSchema
                        ? JSON.stringify(operation.responseSchema, null, 2)
                        : "--"}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default DashboardRoot;
