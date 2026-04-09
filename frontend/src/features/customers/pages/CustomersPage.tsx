import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Edit, Eye, Plus } from "lucide-react"
import { PaginationControls } from "@/components/pagination-controls"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { currency, date } from "@/lib/formatters"
import { getCustomerInvoices, getCustomers, type Customer } from "../api/customers.api"
import { AddCustomerSheet } from "../components/AddCustomerSheet"

export function CustomersPage() {
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const { data, isLoading } = useQuery({
    queryKey: ["customers", search, page, limit],
    queryFn: () => getCustomers({ search: search || undefined, page, limit }).then((r) => r.data),
  })

  const { data: invoiceHistory = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ["customer-invoices", historyCustomer?.id],
    queryFn: () => getCustomerInvoices(historyCustomer!.id).then((r) => r.data),
    enabled: !!historyCustomer,
  })

  const historyTotal = invoiceHistory.reduce((sum, inv) => sum + Number(inv.total), 0)

  return (
    <>
      <AddCustomerSheet open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open); if (!open) setEditingCustomer(null)
      }} customer={editingCustomer} />

      <Sheet open={!!historyCustomer} onOpenChange={(open) => !open && setHistoryCustomer(null)}>
        <SheetContent side="right" className="w-full max-w-none overflow-y-auto sm:!w-[min(64rem,50vw)]">
          <SheetHeader>
            <SheetTitle>{historyCustomer?.name ?? "Customer"} — invoice history</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 p-4">
            {historyCustomer && (
              <Card>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Mobile</p>
                    <p className="font-medium">{historyCustomer.phone ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Email</p>
                    <p className="font-medium truncate">{historyCustomer.email ?? "—"}</p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-muted-foreground text-xs">Invoice Total</p>
                    <p className="font-medium">{currency(historyTotal)}</p>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead className="hidden sm:table-cell">Payment</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isHistoryLoading && (
                      <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                    )}
                    {invoiceHistory.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono font-medium text-sm">{inv.invoice_number}</TableCell>
                        <TableCell className="hidden sm:table-cell capitalize">{inv.payment_method}</TableCell>
                        <TableCell>{currency(inv.total)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{date(inv.created_at)}</TableCell>
                      </TableRow>
                    ))}
                    {!isHistoryLoading && invoiceHistory.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No invoices yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </SheetContent>
      </Sheet>

      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Customers</h2>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Customer</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>

        <Input
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-full sm:max-w-xs"
        />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Address</TableHead>
                  <TableHead className="hidden sm:table-cell">Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                )}
                {data?.items.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-xs text-muted-foreground sm:hidden">{customer.phone ?? "—"}</div>
                      <div className="text-xs text-muted-foreground sm:hidden">{date(customer.created_at)}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{customer.phone ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{customer.email ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground max-w-xs truncate text-sm">{customer.address ?? "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{date(customer.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-7"
                          onClick={() => { setEditingCustomer(customer); setCreateOpen(true) }}>
                          <Edit className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7"
                          onClick={() => setHistoryCustomer(customer)}>
                          <Eye className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && data?.items.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No customers found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          {data && (
            <PaginationControls
              total={data.total} page={data.page} limit={data.limit}
              itemLabel="customers" onPageChange={setPage}
              onLimitChange={(v) => { setLimit(v); setPage(1) }}
            />
          )}
        </Card>
      </div>
    </>
  )
}
