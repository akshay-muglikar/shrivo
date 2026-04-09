import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download, Pencil, Plus, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PaginationControls } from "@/components/pagination-controls"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { printInvoice, downloadInvoicePdf } from "../utils/printInvoice"
import { currency, date } from "@/lib/formatters"

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  paid: "default",
  draft: "secondary",
  cancelled: "destructive",
}

const paymentLabel: Record<string, string> = {
  cash: "Cash", upi: "UPI", card: "Card", credit: "Credit",
}

export function InvoicesPage() {
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState(toDateInput(new Date()))

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

  return (
    <>
      <CreateInvoiceSheet open={createOpen} onOpenChange={setCreateOpen} />
      <EditInvoiceSheet
        invoice={selectedInvoice}
        onOpenChange={(open) => { if (!open) setSelectedInvoice(null) }}
      />

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
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-7" title="Edit"
                          onClick={(e) => { e.stopPropagation(); fetchAndOpen(inv) }}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 hidden sm:inline-flex" title="Print"
                          onClick={(e) => fetchAndPrint(e, inv)}>
                          <Printer className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7" title="Download PDF"
                          onClick={(e) => fetchAndDownload(e, inv)}>
                          <Download className="size-3.5" />
                        </Button>
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
