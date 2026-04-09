import { useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  BadgeIndianRupee,
  BarChart2,
  CheckCircle2,
  CircleHelp,
  Mail,
  Package,
  Receipt,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { createTicket } from "../api/support.api"

const sections = [
  {
    icon: BarChart2,
    title: "Dashboard",
    body: "View revenue, expenses, and net profit for any date range. Use the preset buttons (Today, Last 3 days, Last month) or pick a custom range. The sales trend chart updates automatically.",
  },
  {
    icon: Package,
    title: "Products",
    body: "Add products with SKU, category, price, and stock threshold. Use 'Stock In' to record incoming inventory. Products with stock at or below the threshold appear in the Low Stock widget on the dashboard.",
  },
  {
    icon: Receipt,
    title: "Invoices",
    body: "Create invoices for registered customers or walk-in customers. Walk-in customers with a mobile number are saved automatically so they appear in future invoices. You can print or download any invoice as a PDF.",
  },
  {
    icon: Users,
    title: "Customers",
    body: "Browse all customers including walk-ins captured during invoicing. Search by name or phone. Tap a customer to see their invoice history.",
  },
  {
    icon: Wallet,
    title: "Expenses",
    body: "Record shop expenses with a date, amount, and optional description. Expenses in the selected date range are subtracted from revenue to compute net profit on the dashboard.",
  },
  {
    icon: ShoppingCart,
    title: "Suppliers",
    body: "Maintain a list of your suppliers with contact details. Suppliers can be linked to products to track sourcing.",
  },
  {
    icon: BadgeIndianRupee,
    title: "Billing & payments",
    body: "Invoices support Cash, UPI, Card, and Credit payment methods. Status can be Paid, Draft, or Cancelled. Only Paid invoices count towards revenue.",
  },
]

// ── Support ticket dialog ────────────────────────────────────────
interface FormValues {
  subject: string
  message: string
}

function SupportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [submitted, setSubmitted] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { subject: "", message: "" },
  })

  const mutation = useMutation({
    mutationFn: (v: FormValues) => createTicket(v),
    onSuccess: () => {
      setSubmitted(true)
      reset()
    },
    onError: () => toast.error("Failed to submit ticket. Please try again."),
  })

  function handleClose(v: boolean) {
    if (!v) setSubmitted(false)
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-10 text-green-500" />
            <DialogTitle>Ticket submitted!</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Your support ticket has been received. The shop owner will review it shortly.
            </p>
            <Button className="mt-2 w-full" onClick={() => handleClose(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Raise a Support Ticket</DialogTitle>
              <DialogDescription>
                Describe your issue and we'll get back to you as soon as possible.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  placeholder="e.g. Invoice not printing correctly"
                  {...register("subject", { required: true })}
                  aria-invalid={!!errors.subject}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  placeholder="Describe the issue in detail…"
                  rows={5}
                  {...register("message", { required: true })}
                  aria-invalid={!!errors.message}
                  className="resize-none"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={mutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Submitting…" : "Submit Ticket"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Page ─────────────────────────────────────────────────────────
export function HelpPage() {
  const [ticketOpen, setTicketOpen] = useState(false)

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <CircleHelp className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Get Help</h2>
            <p className="text-sm text-muted-foreground">How to use Shop Manager</p>
          </div>
        </div>
        <Button onClick={() => setTicketOpen(true)} variant="outline" className="shrink-0">
          <Mail className="size-4 mr-1.5" />
          Raise a Support Ticket
        </Button>
      </div>

      {/* Feature guide */}
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.title}>
            <CardHeader className="pb-1.5 flex flex-row items-center gap-2">
              <div className="rounded-md bg-muted p-1.5 shrink-0">
                <s.icon className="size-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-sm font-semibold">{s.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Contact */}
      <Card>
        <CardHeader className="pb-1.5 flex flex-row items-center gap-2">
          <div className="rounded-md bg-muted p-1.5 shrink-0">
            <Mail className="size-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-sm font-semibold">Need more help?</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Can't find what you're looking for? Raise a support ticket and the shop owner will get back to you.
          </p>
          <Button size="sm" variant="outline" onClick={() => setTicketOpen(true)} className="shrink-0">
            Open ticket
          </Button>
        </CardContent>
      </Card>

      <SupportDialog open={ticketOpen} onOpenChange={setTicketOpen} />
    </div>
  )
}
