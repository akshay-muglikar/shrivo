import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PaginationControls } from "@/components/pagination-controls"
import { getAllBatches, type BatchWithProduct } from "../api/products.api"
import { currency } from "@/lib/formatters"

type StatusFilter = "all" | "expired" | "expiring_soon" | "ok"

function daysUntilExpiry(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

function ExpiryBadge({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return <span className="text-muted-foreground text-xs">—</span>

  const days = daysUntilExpiry(dateStr)!
  const formatted = new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  })

  if (days < 0) {
    return (
      <div>
        <div className="text-sm text-destructive font-medium">{formatted}</div>
        <div className="text-xs text-destructive">{Math.abs(days)}d ago</div>
      </div>
    )
  }
  if (days <= 30) {
    return (
      <div>
        <div className="text-sm text-amber-700 dark:text-amber-400 font-medium">{formatted}</div>
        <div className="text-xs text-amber-600 dark:text-amber-500">{days}d left</div>
      </div>
    )
  }
  return (
    <div>
      <div className="text-sm">{formatted}</div>
      <div className="text-xs text-muted-foreground">{days}d left</div>
    </div>
  )
}

function SummaryCards({ allData }: { allData: BatchWithProduct[] }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const soon = new Date(today)
  soon.setDate(soon.getDate() + 30)

  const expired = allData.filter(b => b.expiry_date && new Date(b.expiry_date) < today)
  const expiringSoon = allData.filter(b => {
    if (!b.expiry_date) return false
    const d = new Date(b.expiry_date)
    return d >= today && d <= soon
  })
  const ok = allData.filter(b => !b.expiry_date || new Date(b.expiry_date) > soon)

  const expiredQty = expired.reduce((s, b) => s + b.quantity_remaining, 0)
  const soonQty = expiringSoon.reduce((s, b) => s + b.quantity_remaining, 0)
  const okQty = ok.reduce((s, b) => s + b.quantity_remaining, 0)

  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="border-destructive/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="size-4 text-destructive" />
            <span className="text-xs font-medium text-destructive uppercase tracking-wide">Expired</span>
          </div>
          <div className="text-2xl font-bold text-destructive">{expired.length}</div>
          <div className="text-xs text-muted-foreground">{expiredQty} units · {expired.length} batch{expired.length !== 1 ? "es" : ""}</div>
        </CardContent>
      </Card>
      <Card className="border-amber-300/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide">Expiring ≤30d</span>
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{expiringSoon.length}</div>
          <div className="text-xs text-muted-foreground">{soonQty} units · {expiringSoon.length} batch{expiringSoon.length !== 1 ? "es" : ""}</div>
        </CardContent>
      </Card>
      <Card className="border-green-300/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wide">OK</span>
          </div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">{ok.length}</div>
          <div className="text-xs text-muted-foreground">{okQty} units · {ok.length} batch{ok.length !== 1 ? "es" : ""}</div>
        </CardContent>
      </Card>
    </div>
  )
}

function BatchTable({
  batches,
  isLoading,
}: {
  batches: BatchWithProduct[]
  isLoading: boolean
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Batch No</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead className="text-right w-24">Stock</TableHead>
              <TableHead className="text-right w-28">Cost Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell>
              </TableRow>
            )}
            {!isLoading && batches.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No batches found.</TableCell>
              </TableRow>
            )}
            {batches.map((b) => {
              const days = daysUntilExpiry(b.expiry_date)
              const isExpired = days !== null && days < 0
              const isSoon = days !== null && days >= 0 && days <= 30

              const costValue = b.cost_price && b.quantity_remaining > 0
                ? parseFloat(b.cost_price) * b.quantity_remaining
                : null

              return (
                <TableRow key={b.id} className={isExpired ? "bg-destructive/5" : isSoon ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
                  <TableCell>
                    <div className="font-medium text-sm">{b.product_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{b.product_sku}</div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {b.batch_number ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <ExpiryBadge dateStr={b.expiry_date} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={b.quantity_remaining === 0 ? "secondary" : "outline"}
                      className={`text-xs ${isExpired && b.quantity_remaining > 0 ? "border-destructive text-destructive" : ""}`}
                    >
                      {b.quantity_remaining}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {costValue !== null ? currency(costValue) : "—"}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function ExpiryReportPage() {
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<StatusFilter>("all")
  const [page, setPage] = useState(1)
  const limit = 50

  const statusParam = tab === "all" ? undefined : tab

  const { data, isLoading } = useQuery({
    queryKey: ["batches-all", tab, search, page],
    queryFn: () => getAllBatches({
      status: statusParam,
      search: search || undefined,
      page,
      limit,
    }).then((r) => r.data),
    staleTime: 30_000,
  })

  // Separate query for summary cards (no filter, high limit)
  const { data: summaryData } = useQuery({
    queryKey: ["batches-all-summary"],
    queryFn: () => getAllBatches({ limit: 1000 }).then((r) => r.data.items),
    staleTime: 60_000,
  })

  const batches = data?.items ?? []

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Expiry Report</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track batch-wise expiry across all products</p>
      </div>

      {summaryData && <SummaryCards allData={summaryData} />}

      <Tabs value={tab} onValueChange={(v) => { setTab(v as StatusFilter); setPage(1) }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="expired" className="data-[state=active]:text-destructive">
              Expired
            </TabsTrigger>
            <TabsTrigger value="expiring_soon" className="data-[state=active]:text-amber-700">
              Expiring Soon
            </TabsTrigger>
            <TabsTrigger value="ok" className="data-[state=active]:text-green-700">
              OK
            </TabsTrigger>
          </TabsList>
          <Input
            placeholder="Search product or batch…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full sm:max-w-xs"
          />
        </div>

        <TabsContent value={tab} className="mt-3">
          <BatchTable batches={batches} isLoading={isLoading} />
          {data && (
            <PaginationControls
              total={data.total}
              page={data.page}
              limit={data.limit}
              itemLabel="batches"
              onPageChange={setPage}
              onLimitChange={() => {}}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
