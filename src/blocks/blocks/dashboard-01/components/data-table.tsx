// DataTable del dashboard-01 — portada a la pila de CubaGest.
// El original usa @tanstack/react-table + @dnd-kit + sonner + zod; aquí se
// replica el MISMO visual y comportamiento (selección, visibilidad de
// columnas, paginación, reordenar filas, viewer con drawer y gráfico) con
// lógica propia y drag & drop nativo, sin dependencias nuevas.
import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { useIsMobile } from "@/blocks/hooks/use-mobile";
import { Badge } from "@/blocks/ui/badge";
import { Button } from "@/blocks/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/blocks/chart-context";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/blocks/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/blocks/ui/dropdown-menu";
import { Input } from "@/blocks/ui/input";
import { Label } from "@/blocks/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/blocks/ui/select";
import { Separator } from "@/blocks/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/blocks/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/blocks/ui/tabs";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleCheck,
  Columns,
  DotsVertical,
  GripVertical,
  Loader,
  Plus,
  TrendingUp,
} from "@/blocks/lib/icons";
import type { Payment } from "../data";

const reviewers = ["Eddie Lake", "Jamik Tashpulatov", "Emily Whalen"];
const types = [
  "Table of Contents",
  "Executive Summary",
  "Technical Approach",
  "Design",
  "Capabilities",
  "Focus Documents",
  "Narrative",
  "Cover Page",
];

// ── Drag handle (drag & drop nativo) ────────────────────────────────────────
function DragHandle({
  id,
  onDragStart,
  onDragEnd,
}: {
  id: number;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", String(id));
        } catch {
          /* noop */
        }
        onDragStart(id);
      }}
      onDragEnd={onDragEnd}
      className="size-7 cursor-grab text-muted hover:bg-transparent active:cursor-grabbing"
    >
      <GripVertical className="size-3.5 text-muted" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  );
}

// ── Columnas (definición) ───────────────────────────────────────────────────
type ColumnDef = {
  id: string;
  header: string;
  hideable?: boolean;
};

const columnsDef: ColumnDef[] = [
  { id: "header", header: "Header" },
  { id: "type", header: "Section Type" },
  { id: "status", header: "Status" },
  { id: "target", header: "Target" },
  { id: "limit", header: "Limit" },
  { id: "reviewer", header: "Reviewer" },
];

// ── Fila arrastrable ────────────────────────────────────────────────────────
function DraggableRow({
  row,
  index,
  selected,
  onToggle,
  onDragStartRow,
  onDragEndRow,
  onDropRow,
  dragId,
  visibility,
  onUpdate,
}: {
  row: Payment;
  index: number;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  onDragStartRow: (id: number) => void;
  onDragEndRow: () => void;
  onDropRow: (id: number) => void;
  dragId: number | null;
  visibility: Record<string, boolean>;
  onUpdate: (id: number, patch: Partial<Payment>) => void;
}) {
  const show = (c: string) => visibility[c] !== false;
  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      onDragOver={(e) => {
        if (dragId !== null) e.preventDefault();
      }}
      onDrop={() => onDropRow(row.id)}
      className="relative z-0"
    >
      <TableCell>
        <DragHandle
          id={row.id}
          onDragStart={onDragStartRow}
          onDragEnd={onDragEndRow}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-center">
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onToggle(!!v)}
            aria-label="Select row"
          />
        </div>
      </TableCell>
      {show("header") && (
        <TableCell>
          <TableCellViewer item={row} index={index} onUpdate={onUpdate} />
        </TableCell>
      )}
      {show("type") && (
        <TableCell>
          <div className="w-32">
            <Badge variant="outline" className="px-1.5 text-muted">
              {row.type}
            </Badge>
          </div>
        </TableCell>
      )}
      {show("status") && (
        <TableCell>
          <Badge variant="outline" className="flex px-1.5 text-muted">
            {row.status === "Done" ? (
              <CircleCheck className="fill-emerald-500 text-emerald-500 dark:fill-emerald-400" />
            ) : (
              <Loader />
            )}
            {row.status}
          </Badge>
        </TableCell>
      )}
      {show("target") && (
        <TableCell>
          <InlineInput
            id={`${row.id}-target`}
            defaultValue={row.target}
            onCommit={(v) => onUpdate(row.id, { target: v })}
          />
        </TableCell>
      )}
      {show("limit") && (
        <TableCell>
          <InlineInput
            id={`${row.id}-limit`}
            defaultValue={row.limit}
            onCommit={(v) => onUpdate(row.id, { limit: v })}
          />
        </TableCell>
      )}
      {show("reviewer") && (
        <TableCell>
          {row.reviewer !== "Assign reviewer" ? (
            row.reviewer
          ) : (
            <>
              <Label htmlFor={`${row.id}-reviewer`} className="sr-only">
                Reviewer
              </Label>
              <Select
                onValueChange={(v) => onUpdate(row.id, { reviewer: v })}
              >
                <SelectTrigger
                  className="w-44"
                  size="sm"
                  id={`${row.id}-reviewer`}
                >
                  <SelectValue placeholder="Assign reviewer" />
                </SelectTrigger>
                <SelectContent align="end">
                  {reviewers.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </TableCell>
      )}
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex size-8 text-muted data-[state=open]:bg-muted"
              size="icon"
            >
              <DotsVertical />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Make a copy</DropdownMenuItem>
            <DropdownMenuItem>Favorite</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// Input inline alineado a la derecha (Target/Limit), con flash de "guardado".
function InlineInput({
  id,
  defaultValue,
  onCommit,
}: {
  id: string;
  defaultValue: string;
  onCommit: (value: string) => void;
}) {
  const [saved, setSaved] = React.useState(false);
  return (
    <form
      className="flex items-center justify-end gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const input = (e.currentTarget.elements.namedItem(id) as HTMLInputElement) ?? null;
        if (input) onCommit(input.value);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1200);
      }}
    >
      <Label htmlFor={id} className="sr-only">
        Value
      </Label>
      <Input
        name={id}
        className="h-8 w-16 border-transparent bg-transparent px-1 text-right shadow-none hover:bg-input-bg/40 focus-visible:border focus-visible:bg-card dark:bg-transparent"
        defaultValue={defaultValue}
        id={id}
      />
      {saved && <CircleCheck className="size-3.5 text-emerald-500" />}
    </form>
  );
}

// ── Viewer (drawer con gráfico + formulario) ────────────────────────────────
const viewerChartConfig = {
  desktop: { label: "Desktop", color: "var(--primary)" },
  mobile: { label: "Mobile", color: "var(--primary)" },
} satisfies ChartConfig;

const viewerChartData = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
];

function TableCellViewer({
  item,
  index,
  onUpdate,
}: {
  item: Payment;
  index: number;
  onUpdate: (id: number, patch: Partial<Payment>) => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    header: item.header,
    type: item.type,
    status: item.status,
    target: item.target,
    limit: item.limit,
    reviewer: item.reviewer,
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="link" className="w-fit px-0 text-left text-foreground">
          {item.header}
        </Button>
      </SheetTrigger>
      <SheetContent side={isMobile ? "bottom" : "right"} className="sm:max-w-lg">
        <SheetHeader className="gap-1">
          <SheetTitle>{item.header}</SheetTitle>
          <SheetDescription>
            Showing total visitors for the last 6 months
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4 text-sm">
          {!isMobile && (
            <>
              <ChartContainer
                config={viewerChartConfig}
                id={`viewer-${item.id}-${index}`}
                className="aspect-auto h-[200px] w-full"
              >
                <AreaChart data={viewerChartData} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => String(value).slice(0, 3)}
                    hide
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Area
                    dataKey="mobile"
                    type="natural"
                    fill="var(--color-mobile)"
                    fillOpacity={0.6}
                    stroke="var(--color-mobile)"
                    stackId="a"
                  />
                  <Area
                    dataKey="desktop"
                    type="natural"
                    fill="var(--color-desktop)"
                    fillOpacity={0.4}
                    stroke="var(--color-desktop)"
                    stackId="a"
                  />
                </AreaChart>
              </ChartContainer>
              <Separator />
              <div className="grid gap-2">
                <div className="flex gap-2 font-medium leading-none">
                  Trending up by 5.2% this month <TrendingUp className="size-4" />
                </div>
                <div className="text-muted">
                  Showing total visitors for the last 6 months. This is demo
                  data for the sandbox preview.
                </div>
              </div>
              <Separator />
            </>
          )}
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              onUpdate(item.id, form);
              setOpen(false);
            }}
          >
            <div className="flex flex-col gap-3">
              <Label htmlFor="bk-header">Header</Label>
              <Input
                id="bk-header"
                value={form.header}
                onChange={(e) => setForm((f) => ({ ...f, header: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="bk-type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger id="bk-type" className="w-full">
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="bk-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger id="bk-status" className="w-full">
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Done", "In Process", "Not Started"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="bk-target">Target</Label>
                <Input
                  id="bk-target"
                  value={form.target}
                  onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="bk-limit">Limit</Label>
                <Input
                  id="bk-limit"
                  value={form.limit}
                  onChange={(e) => setForm((f) => ({ ...f, limit: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="bk-reviewer">Reviewer</Label>
              <Select
                value={form.reviewer}
                onValueChange={(v) => setForm((f) => ({ ...f, reviewer: v }))}
              >
                <SelectTrigger id="bk-reviewer" className="w-full">
                  <SelectValue placeholder="Select a reviewer" />
                </SelectTrigger>
                <SelectContent>
                  {reviewers.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SheetFooter className="flex-row gap-2 p-0">
              <Button type="submit">Submit</Button>
              <SheetClose asChild>
                <Button type="button" variant="outline">
                  Done
                </Button>
              </SheetClose>
            </SheetFooter>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── DataTable ───────────────────────────────────────────────────────────────
export function DataTable({ data: initialData }: { data: Payment[] }) {
  const [data, setData] = React.useState<Payment[]>(initialData);
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [visibility, setVisibility] = React.useState<Record<string, boolean>>({});
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  const [dragId, setDragId] = React.useState<number | null>(null);

  const pageCount = Math.max(1, Math.ceil(data.length / pagination.pageSize));
  const pageRows = data.slice(
    pagination.pageIndex * pagination.pageSize,
    (pagination.pageIndex + 1) * pagination.pageSize
  );
  const selectedCount = Object.values(rowSelection).filter(Boolean).length;
  const allPageSelected =
    pageRows.length > 0 && pageRows.every((r) => rowSelection[r.id]);
  const somePageSelected = pageRows.some((r) => rowSelection[r.id]);

  function handleDrop(targetId: number) {
    if (dragId === null || dragId === targetId) return;
    setData((prev) => {
      const from = prev.findIndex((r) => r.id === dragId);
      const to = prev.findIndex((r) => r.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragId(null);
  }

  function updateRow(id: number, patch: Partial<Payment>) {
    setData((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <Tabs defaultValue="outline" className="flex w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select
          defaultValue="outline"
          onValueChange={(v) => {
            /* vista demo: solo outline tiene contenido */
          }}
        >
          <SelectTrigger className="flex w-fit @4xl/main:hidden" size="sm" id="view-selector">
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="outline">Outline</SelectItem>
            <SelectItem value="past-performance">Past Performance</SelectItem>
            <SelectItem value="key-personnel">Key Personnel</SelectItem>
            <SelectItem value="focus-documents">Focus Documents</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-slate-400/40 **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="outline">Outline</TabsTrigger>
          <TabsTrigger value="past-performance">
            Past Performance <Badge variant="secondary">3</Badge>
          </TabsTrigger>
          <TabsTrigger value="key-personnel">
            Key Personnel <Badge variant="secondary">2</Badge>
          </TabsTrigger>
          <TabsTrigger value="focus-documents">Focus Documents</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {columnsDef
                .filter((c) => c.hideable !== false)
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={visibility[column.id] !== false}
                    onCheckedChange={(value) =>
                      setVisibility((v) => ({ ...v, [column.id]: !!value }))
                    }
                  >
                    {column.header}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm">
            <Plus />
            <span className="hidden lg:inline">Add Section</span>
          </Button>
        </div>
      </div>

      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-10">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={
                        allPageSelected || (somePageSelected && "indeterminate")
                      }
                      onCheckedChange={(value) => {
                        const next = { ...rowSelection };
                        pageRows.forEach((r) => {
                          next[r.id] = !!value;
                        });
                        setRowSelection(next);
                      }}
                      aria-label="Select all"
                    />
                  </div>
                </TableHead>
                {visibility["header"] !== false && <TableHead>Header</TableHead>}
                {visibility["type"] !== false && <TableHead>Section Type</TableHead>}
                {visibility["status"] !== false && <TableHead>Status</TableHead>}
                {visibility["target"] !== false && (
                  <TableHead>
                    <div className="w-full text-right">Target</div>
                  </TableHead>
                )}
                {visibility["limit"] !== false && (
                  <TableHead>
                    <div className="w-full text-right">Limit</div>
                  </TableHead>
                )}
                {visibility["reviewer"] !== false && <TableHead>Reviewer</TableHead>}
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length ? (
                pageRows.map((row, index) => (
                  <DraggableRow
                    key={row.id}
                    row={row}
                    index={index}
                    selected={!!rowSelection[row.id]}
                    onToggle={(checked) =>
                      setRowSelection((s) => ({ ...s, [row.id]: checked }))
                    }
                    onDragStartRow={setDragId}
                    onDragEndRow={() => setDragId(null)}
                    onDropRow={handleDrop}
                    dragId={dragId}
                    visibility={visibility}
                    onUpdate={updateRow}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted lg:flex">
            {selectedCount} of {data.length} row(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${pagination.pageSize}`}
                onValueChange={(value) => {
                  setPagination((p) => ({
                    ...p,
                    pageSize: Number(value),
                    pageIndex: 0,
                  }));
                }}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue placeholder={pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {pagination.pageIndex + 1} of {pageCount}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => setPagination((p) => ({ ...p, pageIndex: 0 }))}
                disabled={pagination.pageIndex === 0}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() =>
                  setPagination((p) => ({ ...p, pageIndex: Math.max(0, p.pageIndex - 1) }))
                }
                disabled={pagination.pageIndex === 0}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() =>
                  setPagination((p) => ({
                    ...p,
                    pageIndex: Math.min(pageCount - 1, p.pageIndex + 1),
                  }))
                }
                disabled={pagination.pageIndex >= pageCount - 1}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() =>
                  setPagination((p) => ({ ...p, pageIndex: pageCount - 1 }))
                }
                disabled={pagination.pageIndex >= pageCount - 1}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="past-performance" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed" />
      </TabsContent>
      <TabsContent value="key-personnel" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed" />
      </TabsContent>
      <TabsContent value="focus-documents" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed" />
      </TabsContent>
    </Tabs>
  );
}
