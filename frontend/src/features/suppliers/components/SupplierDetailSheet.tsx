import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Plus, PackageCheck, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { currency, date } from "@/lib/formatters"
import {
  getPurchaseOrders,
  getSupplierReturns,
  updatePurchaseOrder,
  deletePurchaseOrder,
  recordPayment,
  getPayments,
  bulkReceivePOs,
  bulkCancelPOs,
  type PurchaseOrderListItem,
  type SupplierReturn,
} from "../api/purchase_orders.api"
import { getSupplier, type Supplier } from "../api/suppliers.api"
import { SupplierSheet } from "./SupplierSheet"
import { CreatePOSheet } from "./CreatePOSheet"
import { ReceivePODialog } from "./ReceivePODialog"
import { CreateSupplierReturnSheet } from "./CreateSupplierReturnSheet"
import { PurchaseOrderDetailSheet } from "./PurchaseOrderDetailSheet"

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  received: "default",
  ordered: "secondary",
  draft: "outline",
  cancelled: "destructive",
}

interface Props {
  supplier: Supplier | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SupplierDetailSheet({ supplier, open, onOpenChange }: Props) {
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [createPOOpen, setCreatePOOpen] = useState(false)
  const [createReturnOpen, setCreateReturnOpen] = useState(false)
  const [receivePOId, setReceivePOId] = useState<string | null>(null)
  const [detailPOId, setDetailPOId] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [selectedPOs, setSelectedPOs] = useState<Set<string>>(new Set())

  // Re-fetch the supplier to get updated balance
  const { data: liveSupplier } = useQuery({
    queryKey: ["supplier", supplier?.id],
    queryFn: () => getSupplier(supplier!.id).then((r) => r.data),
    enabled: !!supplier?.id && open,
  })

  const s = liveSupplier ?? supplier

  const { data: posData, isLoading: isPOsLoading } = useQuery({
    queryKey: ["purchase-orders", { supplier_id: supplier?.id }],
    queryFn: () =>
      getPurchaseOrders({ supplier_id: supplier!.id, limit: 100 }).then((r) => r.data),
    enabled: !!supplier?.id && open,
  })

  const { data: payments = [] } = useQuery({
    queryKey: ["supplier-payments", supplier?.id],
    queryFn: () => getPayments(supplier!.id).then((r) => r.data),
    enabled: !!supplier?.id && open,
  })

  const { data: supplierReturns = [] } = useQuery({
    queryKey: ["supplier-returns", supplier?.id],
    queryFn: () => getSupplierReturns(supplier!.id).then((r) => r.data),
    enabled: !!supplier?.id && open,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => updatePurchaseOrder(id, { status: "cancelled" }),
    onSuccess: () => {
      toast.success("Purchase order cancelled")
      qc.invalidateQueries({ queryKey: ["purchase-orders"] })
    },
    onError: () => toast.error("Failed to cancel order"),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePurchaseOrder,
    onSuccess: () => {
      toast.success("Purchase order deleted")
      qc.invalidateQueries({ queryKey: ["purchase-orders"] })
    },
    onError: () => toast.error("Failed to delete order"),
  })

  const paymentMutation = useMutation({
    mutationFn: ({ amount, notes }: { amount: number; notes: string | null }) =>
      recordPayment(supplier!.id, { amount, notes }),
    onSuccess: () => {
      toast.success("Payment recorded")
      setPaymentAmount("")
      setPaymentNotes("")
      qc.invalidateQueries({ queryKey: ["supplier", supplier?.id] })
      qc.invalidateQueries({ queryKey: ["supplier-payments", supplier?.id] })
      qc.invalidateQueries({ queryKey: ["suppliers"] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? "Failed to record payment")
    },
  })

  const bulkReceiveMutation = useMutation({
    mutationFn: (ids: string[]) => bulkReceivePOs(ids),
    onSuccess: (res) => {
      const r = res.data
      const received = r.received?.length ?? 0
      const skipped = r.skipped.length
      const errors = r.errors.length
      toast.success(
        `${received} received${skipped ? `, ${skipped} skipped` : ""}${errors ? `, ${errors} failed` : ""}`
      )
      setSelectedPOs(new Set())
      qc.invalidateQueries({ queryKey: ["purchase-orders"] })
      qc.invalidateQueries({ queryKey: ["supplier", supplier?.id] })
      qc.invalidateQueries({ queryKey: ["suppliers"] })
      qc.invalidateQueries({ queryKey: ["products"] })
    },
    onError: () => toast.error("Bulk receive failed"),
  })

  const bulkCancelMutation = useMutation({
    mutationFn: (ids: string[]) => bulkCancelPOs(ids),
    onSuccess: (res) => {
      const r = res.data
      const cancelled = r.cancelled?.length ?? 0
      const skipped = r.skipped.length
      toast.success(`${cancelled} cancelled${skipped ? `, ${skipped} skipped` : ""}`)
      setSelectedPOs(new Set())
      qc.invalidateQueries({ queryKey: ["purchase-orders"] })
    },
    onError: () => toast.error("Bulk cancel failed"),
  })

  function handlePayment() {
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) return toast.error("Enter a valid amount")
    paymentMutation.mutate({ amount, notes: paymentNotes.trim() || null })
  }

  if (!s) return null

  const balance = parseFloat(s.balance)
  const pos: PurchaseOrderListItem[] = posData?.items ?? []

  return (
    <>
      <SupplierSheet open={editOpen} onOpenChange={setEditOpen} supplier={s} />
      <ReceivePODialog
        poId={receivePOId}
        supplierId={s.id}
        open={!!receivePOId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setReceivePOId(null)
        }}
      />
      <PurchaseOrderDetailSheet
        poId={detailPOId}
        open={!!detailPOId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDetailPOId(null)
        }}
        onReceiveGRN={(poId) => {
          setDetailPOId(null)
          setReceivePOId(poId)
        }}
        onCancelPO={(poId) => {
          cancelMutation.mutate(poId)
        }}
        isCancelling={cancelMutation.isPending}
      />
      {createPOOpen && (
        <CreatePOSheet open={createPOOpen} onOpenChange={setCreatePOOpen} supplier={s} />
      )}
      {createReturnOpen && (
        <CreateSupplierReturnSheet open={createReturnOpen} onOpenChange={setCreateReturnOpen} supplier={s} />
      )}

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full max-w-none overflow-y-auto sm:!w-[min(68rem,60vw)]">
          <SheetHeader className="flex flex-row items-center justify-between pr-8">
            <div>
              <SheetTitle>{s.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={s.is_active ? "default" : "secondary"} className="text-xs">
                  {s.is_active ? "Active" : "Inactive"}
                </Badge>
                {balance > 0 && (
                  <span className="text-sm text-destructive font-medium">
                    Payable: {currency(balance)}
                  </span>
                )}
                {balance < 0 && (
                  <span className="text-sm text-green-600 font-medium">
                    Advance: {currency(Math.abs(balance))}
                  </span>
                )}
                {balance === 0 && (
                  <span className="text-sm text-muted-foreground">Balance: cleared</span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5 mr-1" />
              Edit
            </Button>
          </SheetHeader>

          <Tabs defaultValue="orders" className="mt-4">
            <TabsList className="mx-4">
              <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
              <TabsTrigger value="returns">Returns</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="info">Info</TabsTrigger>
            </TabsList>

            {/* ── Purchase Orders tab ── */}
            <TabsContent value="orders" className="px-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{pos.length} order{pos.length !== 1 ? "s" : ""}</span>
                <Button size="sm" onClick={() => setCreatePOOpen(true)}>
                  <Plus className="size-4" />
                  New PO
                </Button>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={
                            pos.filter((p) => p.status === "draft" || p.status === "ordered").length > 0 &&
                            pos
                              .filter((p) => p.status === "draft" || p.status === "ordered")
                              .every((p) => selectedPOs.has(p.id))
                          }
                          onCheckedChange={(checked) => {
                            const actionable = pos.filter((p) => p.status === "draft" || p.status === "ordered")
                            setSelectedPOs(checked ? new Set(actionable.map((p) => p.id)) : new Set())
                          }}
                        />
                      </TableHead>
                      <TableHead>PO #</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isPOsLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Loading…
                        </TableCell>
                      </TableRow>
                    )}
                    {!isPOsLoading && pos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No purchase orders yet. Create one to start tracking stock.
                        </TableCell>
                      </TableRow>
                    )}
                    {pos.map((po) => {
                      const isActionable = po.status === "draft" || po.status === "ordered"
                      return (
                        <TableRow key={po.id} className="cursor-pointer" onClick={() => setDetailPOId(po.id)}>
                          <TableCell>
                            <Checkbox
                              checked={selectedPOs.has(po.id)}
                              disabled={!isActionable}
                              onClick={(e) => e.stopPropagation()}
                              onCheckedChange={(checked) => {
                                setSelectedPOs((prev) => {
                                  const next = new Set(prev)
                                  if (checked) next.add(po.id)
                                  else next.delete(po.id)
                                  return next
                                })
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-mono font-medium text-sm">{po.po_number}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant[po.status] ?? "secondary"} className="capitalize">
                              {po.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{currency(po.total_amount)}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                            {date(po.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isActionable && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setReceivePOId(po.id)
                                  }}
                                >
                                  <PackageCheck className="size-3 mr-1" />
                                  Receive GRN
                                </Button>
                              )}
                              {isActionable && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 text-muted-foreground hover:text-orange-500"
                                  title="Cancel"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    cancelMutation.mutate(po.id)
                                  }}
                                  disabled={cancelMutation.isPending}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              )}
                              {po.status !== "received" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 text-muted-foreground hover:text-destructive"
                                  title="Delete"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (!confirm(`Delete ${po.po_number}?`)) return
                                    deleteMutation.mutate(po.id)
                                  }}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Floating bulk action bar */}
              {selectedPOs.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border bg-popover px-4 py-2.5 shadow-lg">
                  <span className="text-sm font-medium text-foreground">
                    {selectedPOs.size} selected
                  </span>
                  <Button
                    size="sm"
                    onClick={() => bulkReceiveMutation.mutate(Array.from(selectedPOs))}
                    disabled={bulkReceiveMutation.isPending || bulkCancelMutation.isPending}
                  >
                    <PackageCheck className="size-3.5 mr-1" />
                    Quick Receive All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkCancelMutation.mutate(Array.from(selectedPOs))}
                    disabled={bulkReceiveMutation.isPending || bulkCancelMutation.isPending}
                  >
                    <X className="size-3.5 mr-1" />
                    Cancel All
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedPOs(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="returns" className="px-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {supplierReturns.length} return{supplierReturns.length !== 1 ? "s" : ""}
                </span>
                <Button size="sm" onClick={() => setCreateReturnOpen(true)}>
                  <Plus className="size-4" />
                  New Return
                </Button>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Return #</TableHead>
                      <TableHead className="hidden sm:table-cell">Credit Note</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierReturns.map((ret: SupplierReturn) => (
                      <TableRow key={ret.id}>
                        <TableCell className="font-mono font-medium text-sm">{ret.return_number}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {ret.supplier_credit_note_no ?? "-"}
                        </TableCell>
                        <TableCell>{ret.items.length}</TableCell>
                        <TableCell className="font-medium">{currency(ret.total_amount)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {date(ret.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}

                    {supplierReturns.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No supplier returns yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ── Account tab ── */}
            <TabsContent value="account" className="px-4 space-y-4">
              {/* Balance summary */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
                <p className="text-sm text-muted-foreground">Outstanding payable</p>
                <p className={`text-2xl font-bold ${balance > 0 ? "text-destructive" : balance < 0 ? "text-green-600" : ""}`}>
                  {currency(Math.abs(balance))}
                </p>
                {balance < 0 && (
                  <p className="text-xs text-muted-foreground">Advance / overpaid</p>
                )}
                {balance === 0 && (
                  <p className="text-xs text-muted-foreground">Account is settled</p>
                )}
              </div>

              {/* Record payment */}
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-semibold">Record Payment</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pay-amount">Amount (₹) *</Label>
                    <Input
                      id="pay-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pay-notes">Reference / notes</Label>
                    <Input
                      id="pay-notes"
                      placeholder="Cheque no., UPI ref…"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handlePayment}
                  disabled={paymentMutation.isPending || !paymentAmount}
                >
                  {paymentMutation.isPending ? "Saving…" : "Record Payment"}
                </Button>
              </div>

              {/* Payment history */}
              {payments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Payment History</p>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-sm text-muted-foreground">{date(p.created_at)}</TableCell>
                            <TableCell className="font-medium text-green-600">{currency(p.amount)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{p.notes ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Info tab ── */}
            <TabsContent value="info" className="px-4">
              <div className="rounded-lg border p-4 space-y-3 text-sm">
                <InfoRow label="Phone" value={s.phone} />
                <Separator />
                <InfoRow label="Email" value={s.email} />
                <Separator />
                <InfoRow label="Address" value={s.address} />
                <Separator />
                <InfoRow label="Notes" value={s.notes} />
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-4">
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <span className={value ? "text-foreground" : "text-muted-foreground/50"}>
        {value || "—"}
      </span>
    </div>
  )
}
