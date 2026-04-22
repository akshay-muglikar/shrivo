import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, Download, Pencil, Plus, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PaginationControls } from "@/components/pagination-controls"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { resolveDateRange, toDateInput, type DatePreset } from "@/lib/date-filters"
import { type Invoice, type InvoiceListItem, getInvoice, getInvoices } from "../api/invoices.api"
import { CreateInvoiceSheet } from "../components/CreateInvoiceSheet"
import { EditInvoiceSheet } from "../components/EditInvoiceSheet"
import { InvoiceSuccessDialog } from "../components/InvoiceSuccessDialog"
import { printInvoice, downloadInvoicePdf } from "../utils/printInvoice"
import { getInvoiceSettings } from "../utils/invoiceSettings"
import { shareInvoiceViaWhatsApp } from "../utils/whatsappShare"
import { getBatches, getProducts } from "@/features/products/api/products.api"
import { toast } from "sonner"
import { currency, date } from "@/lib/formatters"

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  paid: "default",
  draft: "secondary",
  cancelled: "destructive",
}

const paymentLabel: Record<string, string> = {
  cash: "Cash", upi: "UPI", card: "Card", credit: "Credit",
}

const QUICK_BATCH_AUTO = "__auto_batch__"

export function InvoicesPage() {
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [datePreset, setDatePreset] = useState<DatePreset>("today")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState(toDateInput(new Date()))
  const [quickSearch, setQuickSearch] = useState("")
  const [isQuickSearchMinimized, setIsQuickSearchMinimized] = useState(false)
  const [quickQty, setQuickQty] = useState("1")
  const [selectedQuickProductId, setSelectedQuickProductId] = useState<string | null>(null)
  const [selectedQuickBatchId, setSelectedQuickBatchId] = useState(QUICK_BATCH_AUTO)
  const [quickAddCounter, setQuickAddCounter] = useState(0)
  const [quickAddRequest, setQuickAddRequest] = useState<{
    requestId: number
    productId: string
    quantity: number
    batchId?: string | null
  } | null>(null)

  const { startDate, endDate } = resolveDateRange(datePreset, customStartDate, customEndDate)

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", search, page, limit, startDate, endDate],
    queryFn: () => getInvoices({
      search: search || undefined,
      start_date: startDate,
      end_date: endDate,
      page,
      limit,
    }).then((r) => r.data),
  })

  const { data: products = { items: [] } } = useQuery({
    queryKey: ["invoice-quick-products"],
    queryFn: () => getProducts({ limit: 500 }).then((r) => r.data),
    enabled: createOpen,
  })

  const quickProducts = products.items
    .filter((p) => p.is_active)
    .filter((p) => {
      const term = quickSearch.trim().toLowerCase()
      if (!term) return true
      return p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
    })
  const selectedQuickProduct = quickProducts.find((p) => p.id === selectedQuickProductId)

  const { data: selectedProductBatches = [] } = useQuery({
    queryKey: ["invoice-quick-product-batches", selectedQuickProductId],
    queryFn: () => getBatches(selectedQuickProductId!).then((r) => r.data),
    enabled: createOpen && !!selectedQuickProductId,
    staleTime: 60_000,
  })
  const activeQuickBatches = selectedProductBatches.filter((b) => b.quantity_remaining > 0)

  async function fetchAndOpen(row: InvoiceListItem) {
    const res = await getInvoice(row.id)
    setSelectedInvoice(res.data)
  }

  async function fetchAndPrint(e: React.MouseEvent, row: InvoiceListItem) {
    e.stopPropagation()
    const res = await getInvoice(row.id)
    printInvoice(res.data)
  }

  async function fetchAndDownload(e: React.MouseEvent, row: InvoiceListItem) {
    e.stopPropagation()
    const res = await getInvoice(row.id)
    downloadInvoicePdf(res.data)
  }

  async function fetchAndShareWA(e: React.MouseEvent, row: InvoiceListItem) {
    e.stopPropagation()
    const settings = getInvoiceSettings()
    if (!settings.whatsappEnabled) return
    const res = await getInvoice(row.id)
    shareInvoiceViaWhatsApp(res.data, settings).catch(() => {})
  }

  return (
    <>
      <CreateInvoiceSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(inv) => setCreatedInvoice(inv)}
        quickAddRequest={quickAddRequest}
      />
      <EditInvoiceSheet
        invoice={selectedInvoice}
        onOpenChange={(open) => { if (!open) setSelectedInvoice(null) }}
      />
      <InvoiceSuccessDialog
        invoice={createdInvoice}
        open={!!createdInvoice}
        onClose={() => setCreatedInvoice(null)}
      />

      {createOpen && (
        <div
          className={`hidden xl:block fixed z-[60] ${
            isQuickSearchMinimized
              ? "bottom-0 left-72 right-[min(64rem,50vw)]"
              : "top-16 bottom-4 left-72 right-[min(64rem,50vw)] pr-4"
          }`}
        >
          <Card className={isQuickSearchMinimized ? "rounded-b-none rounded-t-lg overflow-hidden border-b-0" : "h-full overflow-hidden"}>
            <CardContent className={isQuickSearchMinimized ? "py-2 px-4" : "h-full p-4 flex flex-col gap-3"}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Quick Product Search</p>
                  {!isQuickSearchMinimized && (
                    <p className="text-xs text-muted-foreground">Tap product, set qty, add to current invoice.</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsQuickSearchMinimized((v) => !v)}
                  className="h-8"
                >
                  {isQuickSearchMinimized ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  {isQuickSearchMinimized ? "Expand" : "Minimize"}
                </Button>
              </div>

              {!isQuickSearchMinimized && (
                <>
                  <Input
                    placeholder="Search product name or SKU..."
                    value={quickSearch}
                    onChange={(e) => setQuickSearch(e.target.value)}
                  />

                  {selectedQuickProduct && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <p className="text-sm font-medium truncate">{selectedQuickProduct.name}</p>
                      {activeQuickBatches.length > 0 && (
                        <div className="space-y-1">
                          <Label htmlFor="quick_batch_select" className="text-xs">Batch</Label>
                          <select
                            id="quick_batch_select"
                            value={selectedQuickBatchId}
                            onChange={(e) => setSelectedQuickBatchId(e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <option value={QUICK_BATCH_AUTO}>Auto (FEFO)</option>
                            {activeQuickBatches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.batch_number ? `Batch ${b.batch_number}` : "No batch no."}
                                {b.expiry_date
                                  ? ` · Exp ${new Date(b.expiry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                                  : ""}
                                {` · ${b.quantity_remaining} left`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                        <div className="space-y-1">
                          <Label htmlFor="quick_add_qty_outside" className="text-xs">Qty</Label>
                          <Input
                            id="quick_add_qty_outside"
                            type="number"
                            min="1"
                            value={quickQty}
                            onChange={(e) => setQuickQty(e.target.value)}
                          />
                        </div>
                        <Button
                          onClick={() => {
                            if (!selectedQuickProductId) return
                            const qty = parseInt(quickQty || "0") || 0
                            if (qty <= 0) {
                              toast.error("Enter a valid quantity")
                              return
                            }
                            const requestId = quickAddCounter + 1
                            setQuickAddCounter(requestId)
                            setQuickAddRequest({
                              requestId,
                              productId: selectedQuickProductId,
                              quantity: qty,
                              batchId: selectedQuickBatchId === QUICK_BATCH_AUTO ? null : selectedQuickBatchId,
                            })
                            setSelectedQuickProductId(null)
                            setSelectedQuickBatchId(QUICK_BATCH_AUTO)
                            setQuickQty("1")
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {quickProducts.slice(0, 100).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedQuickProductId(p.id)
                          setSelectedQuickBatchId(QUICK_BATCH_AUTO)
                          setQuickQty("1")
                        }}
                        className="w-full rounded-lg border bg-card p-2.5 text-left transition-colors hover:bg-muted"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{p.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{p.sku}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{p.current_stock}</span>
                        </div>
                      </button>
                    ))}
                    {quickProducts.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-6">No products found.</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Invoices</h2>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">New Invoice</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Input
            placeholder="Search invoice or customer…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full sm:max-w-xs"
          />
          <Select value={datePreset} onValueChange={(v) => { setDatePreset(v as DatePreset); setPage(1) }}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dates</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="1m">Last month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {datePreset === "custom" && (
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              <Input type="date" value={customStartDate} onChange={(e) => { setCustomStartDate(e.target.value); setPage(1) }} className="w-full sm:w-36" />
              <Input type="date" value={customEndDate} onChange={(e) => { setCustomEndDate(e.target.value); setPage(1) }} className="w-full sm:w-36" />
            </div>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden sm:table-cell">Payment</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell>
                  </TableRow>
                )}
                {data?.items.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer" onClick={() => fetchAndOpen(inv)}>
                    <TableCell className="font-mono font-medium text-sm">{inv.invoice_number}</TableCell>
                    <TableCell className="max-w-[140px]">
                      <div className="truncate">
                        {inv.customer?.name ?? inv.walk_in_customer_name ?? (
                          <span className="text-muted-foreground">Walk-in</span>
                        )}
                      </div>
                      <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground sm:hidden">
                        <div>{paymentLabel[inv.payment_method] ?? inv.payment_method}</div>
                        <div className="capitalize">{inv.status}</div>
                        <div>{date(inv.created_at)}</div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                      {paymentLabel[inv.payment_method] ?? inv.payment_method}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={statusVariant[inv.status] ?? "secondary"}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{currency(inv.total)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{date(inv.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="size-7" title="Edit"
                          onClick={(e) => { e.stopPropagation(); fetchAndOpen(inv) }}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 hidden sm:inline-flex" title="Print"
                          onClick={(e) => fetchAndPrint(e, inv)}>
                          <Printer className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 hidden sm:inline-flex" title="Download PDF"
                          onClick={(e) => fetchAndDownload(e, inv)}>
                          <Download className="size-3.5" />
                        </Button>
                        {getInvoiceSettings().whatsappEnabled && (
                          <button
                            title="Send via WhatsApp"
                            className="inline-flex size-7 items-center justify-center rounded-md text-[#25D366] hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
                            onClick={(e) => fetchAndShareWA(e, inv)}
                          >
                            <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden>
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && data?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No invoices yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          {data && (
            <PaginationControls
              total={data.total} page={data.page} limit={data.limit}
              itemLabel="invoices" onPageChange={setPage}
              onLimitChange={(v) => { setLimit(v); setPage(1) }}
            />
          )}
        </Card>
      </div>
    </>
  )
}
