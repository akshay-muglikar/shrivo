import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Download, Printer, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { type Invoice, type InvoiceReturnRead, updateInvoice, returnInvoiceItems, getInvoiceReturns } from "../api/invoices.api"
import { printInvoice, downloadInvoicePdf } from "../utils/printInvoice"
import { WhatsAppShareButton } from "./WhatsAppShareButton"
import { currency, date } from "@/lib/formatters"

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "credit", label: "Credit" },
]

const STATUS_OPTIONS = [
  { value: "paid", label: "Paid" },
  { value: "draft", label: "Draft" },
  { value: "cancelled", label: "Cancelled" },
]

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  paid: "default",
  draft: "secondary",
  cancelled: "destructive",
}

interface ReturnQty {
  [itemId: string]: number
}

function ReturnDialog({
  invoice,
  alreadyReturnedByItemId,
  open,
  onOpenChange,
  onSuccess,
}: {
  invoice: Invoice
  alreadyReturnedByItemId: Record<string, number>
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (ret: InvoiceReturnRead) => void
}) {
  const [quantities, setQuantities] = useState<ReturnQty>({})
  const [notes, setNotes] = useState("")
  const qc = useQueryClient()

  useEffect(() => {
    if (open) {
      setQuantities({})
      setNotes("")
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: () => {
      const items = Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, qty]) => ({ invoice_item_id: itemId, quantity: qty }))
      if (items.length === 0) throw new Error("Select at least one item to return")
      return returnInvoiceItems(invoice.id, { items, notes: notes || null })
    },
    onSuccess: (res) => {
      toast.success(`Return ${res.data.return_number} recorded`)
      qc.invalidateQueries({ queryKey: ["invoices"] })
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["invoice-products"] })
      qc.invalidateQueries({ queryKey: ["invoice-returns", invoice.id] })
      onSuccess(res.data)
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? (err as Error)?.message
      toast.error(msg ?? "Failed to record return")
    },
  })

  const totalReturnQty = Object.values(quantities).reduce((s, v) => s + v, 0)
  // Only show items that still have unreturned quantity
  const returnableItems = invoice.items.filter(
    (item) => item.quantity - (alreadyReturnedByItemId[item.id] ?? 0) > 0
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Return Items — {invoice.invoice_number}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <p className="text-sm text-muted-foreground">
            Select items and quantities to return. Stock will be restored to the original batch.
          </p>

          {returnableItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">All items on this invoice have already been returned.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-center w-20">Available</TableHead>
                    <TableHead className="text-center w-24">Return Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnableItems.map((item) => {
                    const alreadyRet = alreadyReturnedByItemId[item.id] ?? 0
                    const available = item.quantity - alreadyRet
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">
                          <div className="font-medium">{item.product_name}</div>
                          {item.batch_number && (
                            <div className="text-xs text-muted-foreground font-mono">Batch: {item.batch_number}</div>
                          )}
                          {alreadyRet > 0 && (
                            <div className="text-xs text-amber-600">{alreadyRet} already returned</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm">{available}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={available}
                            className="h-8 text-sm text-center"
                            value={quantities[item.id] ?? 0}
                            onChange={(e) => {
                              const v = Math.min(parseInt(e.target.value) || 0, available)
                              setQuantities((prev) => ({ ...prev, [item.id]: v }))
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="return_notes">Notes (optional)</Label>
            <Input
              id="return_notes"
              placeholder="Reason for return…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={totalReturnQty === 0 || mutation.isPending || returnableItems.length === 0}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Processing…" : `Return ${totalReturnQty} unit${totalReturnQty !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface FormValues {
  payment_method: string
  status: string
  notes: string
}

interface Props {
  invoice: Invoice | null
  onOpenChange: (open: boolean) => void
}

export function EditInvoiceSheet({ invoice, onOpenChange }: Props) {
  const qc = useQueryClient()
  const [returnOpen, setReturnOpen] = useState(false)

  const { data: returns = [] } = useQuery({
    queryKey: ["invoice-returns", invoice?.id],
    queryFn: () => getInvoiceReturns(invoice!.id).then((r) => r.data),
    enabled: !!invoice,
    staleTime: 30_000,
  })

  // sum of returned qty per invoice item id across all return records
  const alreadyReturnedByItemId: Record<string, number> = {}
  for (const ret of returns) {
    for (const ri of ret.items) {
      if (ri.invoice_item_id) {
        alreadyReturnedByItemId[ri.invoice_item_id] =
          (alreadyReturnedByItemId[ri.invoice_item_id] ?? 0) + ri.quantity
      }
    }
  }

  const { register, handleSubmit, setValue, watch, reset } = useForm<FormValues>({
    defaultValues: { payment_method: "cash", status: "paid", notes: "" },
  })

  useEffect(() => {
    if (invoice) {
      reset({
        payment_method: invoice.payment_method,
        status: invoice.status,
        notes: invoice.notes ?? "",
      })
    }
  }, [invoice, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateInvoice(invoice!.id, {
        payment_method: values.payment_method,
        status: values.status,
        notes: values.notes || null,
      }),
    onSuccess: () => {
      toast.success("Invoice updated")
      qc.invalidateQueries({ queryKey: ["invoices"] })
      onOpenChange(false)
    },
    onError: () => toast.error("Failed to update invoice"),
  })

  if (!invoice) return null

  const customerName = invoice.customer?.name ?? invoice.walk_in_customer_name ?? "Walk-in"
  const customerPhone = invoice.customer?.phone ?? invoice.walk_in_customer_phone

  return (
    <>
    {returnOpen && (
      <ReturnDialog
        invoice={invoice}
        alreadyReturnedByItemId={alreadyReturnedByItemId}
        open={returnOpen}
        onOpenChange={setReturnOpen}
        onSuccess={() => {}}
      />
    )}
    <Sheet open={!!invoice} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-none overflow-y-auto border-l sm:!w-[min(64rem,50vw)]"
      >
        <SheetHeader className="pb-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <SheetTitle className="font-mono text-lg">{invoice.invoice_number}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{date(invoice.created_at)}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
              <Badge variant={statusVariant[invoice.status] ?? "secondary"} className="text-xs">
                {invoice.status}
              </Badge>
              <WhatsAppShareButton invoice={invoice} variant="icon" />
              {invoice.status === "paid" && (() => {
                const allReturned = invoice.items.every(
                  (item) => (alreadyReturnedByItemId[item.id] ?? 0) >= item.quantity
                )
                return (
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    title={allReturned ? "All items returned" : "Return items"}
                    disabled={allReturned}
                    onClick={() => setReturnOpen(true)}
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                )
              })()}
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                title="Print invoice"
                onClick={() => printInvoice(invoice)}
              >
                <Printer className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                title="Download PDF"
                onClick={() => downloadInvoicePdf(invoice)}
              >
                <Download className="size-3.5" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4 mt-4">
          {/* Customer */}
          <div className="rounded-md border p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">Customer</p>
            <p className="font-medium">{customerName}</p>
            {customerPhone && <p className="text-muted-foreground text-xs mt-0.5">{customerPhone}</p>}
          </div>

          {/* Items */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-24">Batch No</TableHead>
                  <TableHead className="w-24">Expiry</TableHead>
                  <TableHead className="w-20">HSN/SAC</TableHead>
                  <TableHead className="text-center w-12">Qty</TableHead>
                  <TableHead className="text-center w-20">Returned</TableHead>
                  <TableHead className="text-right w-24">MRP</TableHead>
                  <TableHead className="text-right w-20">Disc</TableHead>
                  <TableHead className="text-right w-24">Rate</TableHead>
                  <TableHead className="text-right w-28">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item) => {
                  const mrp = item.mrp ? parseFloat(item.mrp) : null
                  const rate = parseFloat(item.unit_price)
                  const gstR = parseFloat(item.gst_rate) || 0
                  const discountReferencePrice = (mrp !== null && item.price_includes_gst && gstR > 0)
                    ? mrp / (1 + gstR / 100)
                    : mrp
                  const discPerUnit = discountReferencePrice !== null ? discountReferencePrice - rate : null
                  const lineTotal = rate * item.quantity
                  const effectiveGstRate = gstR > 0 ? gstR : (parseFloat(invoice.tax_rate) || 0)
                  const lineTaxAmount = effectiveGstRate > 0 ? (lineTotal * effectiveGstRate) / 100 : 0
                  const lineAmount = lineTotal + lineTaxAmount
                  const retQty = alreadyReturnedByItemId[item.id] ?? 0
                  const fullyReturned = retQty >= item.quantity
                  return (
                    <TableRow key={item.id} className={fullyReturned ? "opacity-60" : ""}>
                      <TableCell className="text-sm font-medium">{item.product_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        {item.batch_number ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.expiry_date
                          ? new Date(item.expiry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        {item.hsn_code ?? "—"}
                      </TableCell>
                      <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                      <TableCell className="text-center text-sm">
                        {retQty > 0 ? (
                          <Badge
                            variant={fullyReturned ? "secondary" : "outline"}
                            className={`text-xs ${fullyReturned ? "" : "border-amber-400 text-amber-700 bg-amber-50"}`}
                          >
                            {retQty}/{item.quantity}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {mrp !== null ? currency(mrp) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-green-600">
                        {discPerUnit !== null && discPerUnit > 0.005 ? `−${currency(discPerUnit)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">{currency(item.unit_price)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{currency(lineAmount)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="rounded-md border p-3 text-sm space-y-1.5 bg-muted/30">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{currency(invoice.subtotal)}</span>
            </div>
            {parseFloat(invoice.tax_rate) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax ({invoice.tax_rate}%)</span>
                <span>{currency(invoice.tax_amount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span>
              <span>{currency(invoice.total)}</span>
            </div>
          </div>

          {/* Returns history */}
          {returns.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Returns</p>
                <div className="flex flex-col gap-2">
                  {returns.map((ret) => (
                    <div key={ret.id} className="rounded-md border p-3 text-sm bg-amber-50/50 dark:bg-amber-950/20">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-medium font-mono text-xs">{ret.return_number}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ret.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {ret.items.map((ri) => (
                          <div key={ri.id} className="flex justify-between text-xs text-muted-foreground">
                            <span>{ri.product_name}{ri.batch_number ? ` (Batch: ${ri.batch_number})` : ""}</span>
                            <span className="font-medium text-foreground">×{ri.quantity}</span>
                          </div>
                        ))}
                      </div>
                      {ret.notes && (
                        <p className="text-xs text-muted-foreground mt-1.5 italic">{ret.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Edit form */}
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Edit details</p>
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Payment method</Label>
                <Select value={watch("payment_method")} onValueChange={(v) => {
                  if (v) setValue("payment_method", v)
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select value={watch("status")} onValueChange={(v) => {
                  if (v) setValue("status", v)
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit_notes">Notes</Label>
              <Input id="edit_notes" placeholder="Optional" {...register("notes")} />
            </div>

            <Button type="submit" disabled={mutation.isPending} className="w-full mt-1">
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
    </>
  )
}
