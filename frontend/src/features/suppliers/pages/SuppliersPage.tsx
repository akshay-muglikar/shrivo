import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { PaginationControls } from "@/components/pagination-controls"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { currency } from "@/lib/formatters"
import { getSuppliers, deleteSupplier, type Supplier } from "../api/suppliers.api"
import { SupplierSheet } from "../components/SupplierSheet"
import { SupplierDetailSheet } from "../components/SupplierDetailSheet"

export function SuppliersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers", search, page, limit],
    queryFn: () =>
      getSuppliers({ search: search || undefined, page, limit }).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      toast.success("Supplier removed")
      qc.invalidateQueries({ queryKey: ["suppliers"] })
    },
    onError: () => toast.error("Failed to remove supplier"),
  })

  function openAdd() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(e: React.MouseEvent, supplier: Supplier) {
    e.stopPropagation()
    setEditing(supplier)
    setSheetOpen(true)
  }

  function handleDelete(e: React.MouseEvent, supplier: Supplier) {
    e.stopPropagation()
    if (!confirm(`Remove "${supplier.name}"?`)) return
    deleteMutation.mutate(supplier.id)
  }

  return (
    <>
      <SupplierSheet open={sheetOpen} onOpenChange={setSheetOpen} supplier={editing} />
      <SupplierDetailSheet
        supplier={detailSupplier}
        open={!!detailSupplier}
        onOpenChange={(open) => { if (!open) setDetailSupplier(null) }}
      />

      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Suppliers</h2>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Supplier</span>
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
                  <TableHead className="hidden sm:table-cell">Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Notes</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {data?.items.map((s) => {
                  const balance = parseFloat(s.balance)
                  return (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() => setDetailSupplier(s)}
                    >
                      <TableCell>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground sm:hidden">{s.phone ?? "—"}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {s.phone ?? <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground max-w-48 truncate">
                        {s.notes ?? <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell>
                        {balance > 0 ? (
                          <span className="text-sm font-medium text-destructive">{currency(balance)}</span>
                        ) : balance < 0 ? (
                          <span className="text-sm font-medium text-green-600">{currency(Math.abs(balance))}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.is_active ? "default" : "secondary"}>
                          {s.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={(e) => openEdit(e, s)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={(e) => handleDelete(e, s)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!isLoading && data?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {search ? "No suppliers match your search." : "No suppliers yet."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          {data && (
            <PaginationControls
              total={data.total}
              page={data.page}
              limit={data.limit}
              itemLabel="suppliers"
              onPageChange={setPage}
              onLimitChange={(value) => { setLimit(value); setPage(1) }}
            />
          )}
        </Card>
      </div>
    </>
  )
}
