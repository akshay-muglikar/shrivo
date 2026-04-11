import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PaginationControls } from "@/components/pagination-controls"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { StockBadge } from "../components/StockBadge"
import { AddProductSheet } from "../components/AddProductSheet"
import { BulkStockUpdate } from "../components/BulkStockUpdate"
import { getProducts, stockIn, type Product } from "../api/products.api"
import { getInvoiceSettings } from "@/features/invoices/utils/invoiceSettings"
import { currency } from "@/lib/formatters"
import { Pencil, ScanBarcode, Plus } from "lucide-react"

const SORT_OPTIONS = [
  { value: "name_asc", label: "Name A→Z" },
  { value: "name_desc", label: "Name Z→A" },
  { value: "stock_asc", label: "Stock: low first" },
  { value: "stock_desc", label: "Stock: high first" },
  { value: "price_asc", label: "Price: low first" },
  { value: "price_desc", label: "Price: high first" },
]

function PriceCell({ p }: { p: Product }) {
  const { gstEnabled } = getInvoiceSettings()
  const gstRate = parseFloat(p.gst_rate) || 0
  const price = parseFloat(p.selling_price) || 0

  if (!gstEnabled || gstRate === 0) return <>{currency(price)}</>

  if (p.price_includes_gst) {
    const base = price / (1 + gstRate / 100)
    return (
      <div>
        <div className="font-medium">{currency(price)}</div>
        <div className="text-[11px] text-muted-foreground">incl. {gstRate}% GST · base {currency(base)}</div>
      </div>
    )
  }

  const withGst = price * (1 + gstRate / 100)
  return (
    <div>
      <div className="font-medium">{currency(price)}</div>
      <div className="text-[11px] text-muted-foreground">+ {gstRate}% GST = {currency(withGst)}</div>
    </div>
  )
}

export function ProductsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [lowStock, setLowStock] = useState(false)
  const [sortBy, setSortBy] = useState("name_asc")
  const [addOpen, setAddOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const { data, isLoading } = useQuery({
    queryKey: ["products", search, lowStock, sortBy, page, limit],
    queryFn: () => getProducts({
      search: search || undefined,
      low_stock: lowStock || undefined,
      sort_by: sortBy,
      page, limit,
    }).then((r) => r.data),
  })

  const stockInMutation = useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) => stockIn(id, qty),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast.success("Stock updated") },
    onError: () => toast.error("Failed to update stock"),
  })

  return (
    <>
      <AddProductSheet
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) setEditingProduct(null)
        }}
        product={editingProduct}
      />

      <Tabs defaultValue="products" className="p-4 sm:p-6 gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="bulk-stock">
              <ScanBarcode className="size-4" />
              <span className="hidden sm:inline ml-1.5">Bulk Stock</span>
              <span className="ml-1.5 sm:hidden">Bulk</span>
            </TabsTrigger>
          </TabsList>
          <Button
            size="sm"
            onClick={() => {
              setEditingProduct(null)
              setAddOpen(true)
            }}
            className="w-full sm:w-auto"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>

        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              placeholder="Search name or SKU…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full sm:max-w-xs"
            />
            <Button variant={lowStock ? "default" : "outline"} size="sm" className="w-full sm:w-auto"
              onClick={() => { setLowStock(!lowStock); setPage(1) }}>
              Low stock
            </Button>
            <Select value={sortBy} onValueChange={(v) => {
              if (!v) return
              setSortBy(v)
              setPage(1)
            }}>
              <SelectTrigger className="w-full sm:w-44 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">SKU</TableHead>
                    <TableHead className="hidden md:table-cell">Category</TableHead>
                    <TableHead className="hidden sm:table-cell">Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell>
                    </TableRow>
                  )}
                  {data?.items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground font-mono sm:hidden">{p.sku}</div>
                        <div className="text-xs text-muted-foreground sm:hidden"><PriceCell p={p} /></div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm font-mono">{p.sku}</TableCell>
                      <TableCell className="hidden md:table-cell">{p.category?.name ?? "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell"><PriceCell p={p} /></TableCell>
                      <TableCell>
                        <StockBadge current={p.current_stock} threshold={p.low_stock_threshold} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingProduct(p)
                              setAddOpen(true)
                            }}
                          >
                            <Pencil className="size-3.5 sm:mr-1.5" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                          <Button variant="outline" size="sm" disabled={stockInMutation.isPending}
                            onClick={() => {
                              const qty = Number(prompt(`Stock in quantity for ${p.name}:`))
                              if (qty > 0) stockInMutation.mutate({ id: p.id, qty })
                            }}>
                            <span className="hidden sm:inline">Stock In</span>
                            <span className="sm:hidden">Add</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && data?.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No products found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            {data && (
              <PaginationControls
                total={data.total} page={data.page} limit={data.limit}
                itemLabel="products" onPageChange={setPage}
                onLimitChange={(v) => { setLimit(v); setPage(1) }}
              />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="bulk-stock">
          <BulkStockUpdate />
        </TabsContent>
      </Tabs>
    </>
  )
}
