import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CheckCheck, FileText, IndianRupee, Mail, MessageCircle, Pencil, Plus, Ticket, Trash2, ShieldCheck, User as UserIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useAuthStore } from "@/features/auth/store/auth.store"
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  type AppUser,
  type UserCreate,
  type UserUpdate,
} from "../api/settings.api"
import { getTickets, closeTicket, type SupportTicket } from "@/features/help/api/support.api"
import { getContactLeads, closeContactLead, type ContactLead } from "@/features/contact/api/contact.api"
import {
  getInvoiceSettings,
  saveInvoiceSettings,
  isThermal,
  TEMPLATE_LABELS,
  SIZE_LABELS,
  type InvoiceSettings,
  type InvoiceTemplate,
  type InvoiceSize,
} from "@/features/invoices/utils/invoiceSettings"
import { DEFAULT_WA_TEMPLATE } from "@/features/invoices/utils/whatsappShare"

// ── Shop info form ───────────────────────────────────────────────
interface ShopInfoValues {
  shopName: string
  shopTagline: string
  shopAddress: string
  shopPhone: string
  shopEmail: string
}

function ShopInfoForm({
  settings,
  onChange,
}: {
  settings: InvoiceSettings
  onChange: (patch: Partial<InvoiceSettings>) => void
}) {
  const { register, handleSubmit, formState: { isDirty } } = useForm<ShopInfoValues>({
    defaultValues: {
      shopName: settings.shopName,
      shopTagline: settings.shopTagline,
      shopAddress: settings.shopAddress,
      shopPhone: settings.shopPhone,
      shopEmail: settings.shopEmail,
    },
  })

  function onSubmit(values: ShopInfoValues) {
    onChange(values)
    toast.success("Shop info saved")
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shopName" className="text-xs">Shop Name *</Label>
          <Input id="shopName" placeholder="e.g. Sharma General Store" {...register("shopName")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shopTagline" className="text-xs">Tagline / Sub-heading</Label>
          <Input id="shopTagline" placeholder="e.g. Quality Products Since 1990" {...register("shopTagline")} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shopAddress" className="text-xs">Address</Label>
        <Textarea
          id="shopAddress"
          placeholder="e.g. 12, MG Road, Pune - 411001, Maharashtra"
          rows={2}
          className="resize-none"
          {...register("shopAddress")}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shopPhone" className="text-xs">Phone</Label>
          <Input id="shopPhone" placeholder="+91 9876543210" {...register("shopPhone")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shopEmail" className="text-xs">Email</Label>
          <Input id="shopEmail" type="email" placeholder="shop@example.com" {...register("shopEmail")} />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={!isDirty}>Save Shop Info</Button>
    </form>
  )
}

// ── User form sheet ──────────────────────────────────────────────
interface FormValues {
  name: string
  email: string
  password: string
  is_owner: boolean
}

interface UserSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: AppUser | null
}

function UserSheet({ open, onOpenChange, user }: UserSheetProps) {
  const qc = useQueryClient()
  const isEdit = !!user

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: "", email: "", password: "", is_owner: false },
  })

  const isOwnerVal = watch("is_owner")

  useEffect(() => {
    if (open) {
      reset(
        user
          ? { name: user.name, email: user.email, password: "", is_owner: user.is_owner }
          : { name: "", email: "", password: "", is_owner: false }
      )
    }
  }, [open, user, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (isEdit) {
        const payload: UserUpdate = {
          name: values.name,
          email: values.email,
          is_owner: values.is_owner,
        }
        if (values.password.trim()) payload.password = values.password
        return updateUser(user!.id, payload)
      }
      const payload: UserCreate = {
        name: values.name,
        email: values.email,
        password: values.password,
        is_owner: values.is_owner,
      }
      return createUser(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? "User updated" : "User created")
      qc.invalidateQueries({ queryKey: ["users"] })
      onOpenChange(false)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? (isEdit ? "Failed to update user" : "Failed to create user")
      toast.error(msg)
    },
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-none overflow-y-auto sm:!w-[min(56rem,50vw)]">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit User" : "Add User"}</SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col gap-4 px-4 pb-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              placeholder="e.g. Rajan Kumar"
              {...register("name", { required: true })}
              aria-invalid={!!errors.name}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@shop.com"
              {...register("email", { required: true })}
              aria-invalid={!!errors.email}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">
              Password {isEdit && <span className="text-muted-foreground font-normal">(leave blank to keep current)</span>}
              {!isEdit && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id="password"
              type="password"
              placeholder={isEdit ? "••••••••" : "Min 8 characters"}
              {...register("password", { required: !isEdit, minLength: isEdit ? 0 : 8 })}
              aria-invalid={!!errors.password}
            />
            {errors.password?.type === "minLength" && (
              <p className="text-xs text-destructive">Password must be at least 8 characters</p>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="is_owner"
              checked={isOwnerVal}
              onCheckedChange={(checked) => setValue("is_owner", !!checked)}
            />
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="is_owner" className="cursor-pointer font-medium">Owner / Admin</Label>
              <p className="text-xs text-muted-foreground">
                Owners can manage users, view all reports, and access settings.
              </p>
            </div>
          </div>

          <SheetFooter className="px-0 pt-2">
            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create User"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ── Delete confirmation dialog ───────────────────────────────────
interface DeleteDialogProps {
  user: AppUser | null
  onClose: () => void
}

function DeleteDialog({ user, onClose }: DeleteDialogProps) {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => deleteUser(user!.id),
    onSuccess: () => {
      toast.success("User deleted")
      qc.invalidateQueries({ queryKey: ["users"] })
      onClose()
    },
    onError: () => toast.error("Failed to delete user"),
  })

  return (
    <Dialog open={!!user} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete user?</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{user?.name}</strong>. They will no longer be able to log in.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ─────────────────────────────────────────────────────────
export function SettingsPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null)

  const isOwner = currentUser?.is_owner ?? false
  const qc = useQueryClient()

  // Invoice settings (localStorage)
  const [invoiceSettings, setInvoiceSettings] = useState(getInvoiceSettings)
  const [waTemplate, setWaTemplate] = useState(() => getInvoiceSettings().whatsappTemplate || DEFAULT_WA_TEMPLATE)
  const [shopGstin, setShopGstin] = useState(() => getInvoiceSettings().shopGstin)
  const [shopState, setShopState] = useState(() => getInvoiceSettings().shopState)

  function handleInvoiceSetting<K extends keyof typeof invoiceSettings>(
    key: K,
    value: (typeof invoiceSettings)[K]
  ) {
    const next = { ...invoiceSettings, [key]: value }
    setInvoiceSettings(next)
    saveInvoiceSettings(next)
    toast.success("Invoice settings saved")
  }

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers().then((r) => r.data),
    enabled: isOwner,
  })

  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => getTickets().then((r) => r.data),
    enabled: isOwner,
  })

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["contact-leads"],
    queryFn: () => getContactLeads().then((r) => r.data),
    enabled: isOwner,
  })

  const closeTicketMutation = useMutation({
    mutationFn: (id: string) => closeTicket(id),
    onSuccess: () => {
      toast.success("Ticket closed")
      qc.invalidateQueries({ queryKey: ["support-tickets"] })
    },
    onError: () => toast.error("Failed to close ticket"),
  })

  const closeLeadMutation = useMutation({
    mutationFn: (id: string) => closeContactLead(id),
    onSuccess: () => {
      toast.success("Lead closed")
      qc.invalidateQueries({ queryKey: ["contact-leads"] })
    },
    onError: () => toast.error("Failed to close lead"),
  })

  function openAdd() {
    setEditingUser(null)
    setSheetOpen(true)
  }

  function openEdit(u: AppUser) {
    setEditingUser(u)
    setSheetOpen(true)
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h2 className="text-lg font-semibold">Settings</h2>

      {/* Shop info */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center gap-2">
          <div className="rounded-md bg-muted p-1.5 shrink-0">
            <ShieldCheck className="size-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Shop Information</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Displayed on every invoice instead of "Shop Manager".
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <ShopInfoForm
            settings={invoiceSettings}
            onChange={(patch) => {
              const next = { ...invoiceSettings, ...patch }
              setInvoiceSettings(next)
              saveInvoiceSettings(next)
            }}
          />
        </CardContent>
      </Card>

      {/* Invoice settings */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center gap-2">
          <div className="rounded-md bg-muted p-1.5 shrink-0">
            <FileText className="size-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Invoice Settings</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Template and paper size used when printing or downloading invoices.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Template */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Template</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TEMPLATE_LABELS) as InvoiceTemplate[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleInvoiceSetting("template", t)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    invoiceSettings.template === t
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <p className="text-xs font-semibold">{TEMPLATE_LABELS[t]}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t === "classic" ? "Bold header, bordered table" : t === "modern" ? "Dark header, card layout" : "Serif font, plain lines"}
                  </p>
                </button>
              ))}
            </div>
            {isThermal(invoiceSettings.size) && (
              <p className="text-[11px] text-muted-foreground">
                Template is ignored for thermal sizes — receipt format is used instead.
              </p>
            )}
          </div>

          {/* Size */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Paper Size</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(SIZE_LABELS) as InvoiceSize[]).map((sz) => (
                <button
                  key={sz}
                  onClick={() => handleInvoiceSetting("size", sz)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    invoiceSettings.size === sz
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <p className="text-xs font-semibold">{sz}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{SIZE_LABELS[sz]}</p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp sharing */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center gap-2">
          <div className="rounded-md bg-muted p-1.5 shrink-0">
            <MessageCircle className="size-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">WhatsApp Sharing</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Show "Send via WhatsApp" button after creating an invoice.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Enable WhatsApp button</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Show after invoice creation and in invoice actions.
              </p>
            </div>
            <Switch
              checked={invoiceSettings.whatsappEnabled}
              onCheckedChange={(checked) => {
                handleInvoiceSetting("whatsappEnabled", checked)
              }}
            />
          </div>

          {/* Message template */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Message Template</Label>
            <Textarea
              value={waTemplate}
              onChange={(e) => setWaTemplate(e.target.value)}
              rows={8}
              className="font-mono text-xs resize-none"
              placeholder={DEFAULT_WA_TEMPLATE}
            />
            <p className="text-[11px] text-muted-foreground">
              Variables: <code className="bg-muted px-1 rounded">{"{customer_name}"}</code>{" "}
              <code className="bg-muted px-1 rounded">{"{invoice_number}"}</code>{" "}
              <code className="bg-muted px-1 rounded">{"{total}"}</code>{" "}
              <code className="bg-muted px-1 rounded">{"{item_count}"}</code>{" "}
              <code className="bg-muted px-1 rounded">{"{payment_method}"}</code>{" "}
              <code className="bg-muted px-1 rounded">{"{shop_name}"}</code>{" "}
              <code className="bg-muted px-1 rounded">{"{shop_phone}"}</code>
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setWaTemplate(DEFAULT_WA_TEMPLATE)
                  const next = { ...invoiceSettings, whatsappTemplate: "" }
                  setInvoiceSettings(next)
                  saveInvoiceSettings(next)
                  toast.success("Template reset to default")
                }}
              >
                Reset to default
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const next = { ...invoiceSettings, whatsappTemplate: waTemplate === DEFAULT_WA_TEMPLATE ? "" : waTemplate }
                  setInvoiceSettings(next)
                  saveInvoiceSettings(next)
                  toast.success("Template saved")
                }}
              >
                Save template
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GST settings */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center gap-2">
          <div className="rounded-md bg-muted p-1.5 shrink-0">
            <IndianRupee className="size-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">GST / Tax Invoice</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enable GST-compliant invoice format with CGST/SGST breakdown.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Enable GST Invoice</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Shows "TAX INVOICE" header and CGST + SGST breakdown on PDFs.
              </p>
            </div>
            <Switch
              checked={invoiceSettings.gstEnabled}
              onCheckedChange={(checked) => handleInvoiceSetting("gstEnabled", checked)}
            />
          </div>

          {invoiceSettings.gstEnabled && (
            <div className="space-y-4 border-t pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="shopGstin" className="text-xs">Your GSTIN</Label>
                  <Input
                    id="shopGstin"
                    placeholder="e.g. 27AABCS1234J1Z5"
                    maxLength={15}
                    value={shopGstin}
                    onChange={(e) => setShopGstin(e.target.value.toUpperCase())}
                    className="font-mono uppercase"
                  />
                  <p className="text-[11px] text-muted-foreground">15-character GST identification number</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="shopState" className="text-xs">State (Place of Supply)</Label>
                  <Input
                    id="shopState"
                    placeholder="e.g. MH, DL, KA, TN"
                    maxLength={2}
                    value={shopState}
                    onChange={(e) => setShopState(e.target.value.toUpperCase())}
                    className="uppercase"
                  />
                  <p className="text-[11px] text-muted-foreground">2-letter state code — determines CGST/SGST vs IGST</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const next = { ...invoiceSettings, shopGstin, shopState }
                  setInvoiceSettings(next)
                  saveInvoiceSettings(next)
                  toast.success("GST settings saved")
                }}
              >
                Save GST Info
              </Button>
              <div className="rounded-lg bg-muted/50 border p-3 text-[11px] text-muted-foreground space-y-1">
                <p className="font-medium text-foreground text-xs">How GST works</p>
                <p>When creating an invoice, enable "GST Invoice" to snapshot CGST/SGST or IGST amounts per item. Products must have an HSN code and GST rate set. Select Place of Supply to determine intra-state vs inter-state tax.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User management */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">User Management</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add staff accounts and manage access roles.
            </p>
          </div>
          {currentUser?.is_owner && (
            <Button size="sm" onClick={openAdd} className="shrink-0">
              <Plus className="size-4 mr-1.5" /> Add User
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {!isOwner ? (
            <p className="text-sm text-muted-foreground p-4">Only the shop owner can manage users.</p>
          ) : isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="divide-y">
              {(users ?? []).map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`rounded-full p-1.5 shrink-0 ${
                      u.is_owner ? "bg-primary/10" : "bg-muted"
                    }`}>
                      {u.is_owner
                        ? <ShieldCheck className="size-4 text-primary" />
                        : <UserIcon className="size-4 text-muted-foreground" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{u.name}</p>
                        {u.id === currentUser?.id && (
                          <Badge variant="secondary" className="text-[11px] py-0">You</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={u.is_owner ? "default" : "secondary"}
                      className="text-[11px]"
                    >
                      {u.is_owner ? "Owner" : "Staff"}
                    </Badge>
                    {isOwner && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(u)}
                          className="size-8"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeletingUser(u)}
                          disabled={u.id === currentUser?.id}
                          className="size-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Support tickets */}
      {isOwner && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <div className="rounded-md bg-muted p-1.5 shrink-0">
              <Mail className="size-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Website Contact Leads</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Messages submitted by new users from the public Contact page.
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {leadsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (leads ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No contact leads yet.</p>
            ) : (
              <div className="divide-y">
                {(leads ?? []).map((lead: ContactLead) => (
                  <div key={lead.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{lead.name}</p>
                        <Badge variant={lead.status === "open" ? "default" : "secondary"} className="text-[11px] shrink-0">
                          {lead.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {lead.email}
                        {lead.phone ? ` · ${lead.phone}` : ""}
                        {lead.business_name ? ` · ${lead.business_name}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{lead.message}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(lead.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    {lead.status === "open" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => closeLeadMutation.mutate(lead.id)}
                        disabled={closeLeadMutation.isPending}
                        className="shrink-0 text-muted-foreground"
                      >
                        <CheckCheck className="size-3.5 mr-1" />
                        Close
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <div className="rounded-md bg-muted p-1.5 shrink-0">
              <Ticket className="size-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Support Tickets</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tickets raised by staff via the Help page.
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {ticketsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (tickets ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No support tickets yet.</p>
            ) : (
              <div className="divide-y">
                {(tickets ?? []).map((t: SupportTicket) => (
                  <div key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{t.subject}</p>
                        <Badge
                          variant={t.status === "open" ? "default" : "secondary"}
                          className="text-[11px] shrink-0"
                        >
                          {t.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.message}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {t.submitted_by_name ?? "Unknown"} · {new Date(t.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    {t.status === "open" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => closeTicketMutation.mutate(t.id)}
                        disabled={closeTicketMutation.isPending}
                        className="shrink-0 text-muted-foreground"
                      >
                        <CheckCheck className="size-3.5 mr-1" />
                        Close
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <UserSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        user={editingUser}
      />
      <DeleteDialog
        user={deletingUser}
        onClose={() => setDeletingUser(null)}
      />
    </div>
  )
}
