import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { createCustomer, type Customer, updateCustomer } from "../api/customers.api"

interface FormValues {
  name: string
  phone: string
  email: string
  address: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer | null
}

export function AddCustomerSheet({ open, onOpenChange, customer }: Props) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>()

  useEffect(() => {
    reset({
      name: customer?.name ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      address: customer?.address ?? "",
    })
  }, [customer, reset, open])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name.trim(),
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        address: values.address.trim() || null,
      }
      return customer ? updateCustomer(customer.id, payload) : createCustomer(payload)
    },
    onSuccess: () => {
      toast.success(customer ? "Customer updated" : "Customer added")
      qc.invalidateQueries({ queryKey: ["customers"] })
      qc.invalidateQueries({ queryKey: ["invoice-customers"] })
      reset()
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? "Failed to add customer")
    },
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-none overflow-y-auto sm:!w-[min(56rem,50vw)]">
        <SheetHeader>
          <SheetTitle>{customer ? "Edit Customer" : "Add Customer"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customer_name">Name *</Label>
            <Input
              id="customer_name"
              placeholder="Customer name"
              aria-invalid={!!errors.name}
              {...register("name", { required: true })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer_phone">Mobile</Label>
              <Input id="customer_phone" placeholder="Phone" {...register("phone")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer_email">Email</Label>
              <Input id="customer_email" type="email" placeholder="Email" {...register("email")} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customer_address">Address</Label>
            <Textarea id="customer_address" placeholder="Optional address" {...register("address")} />
          </div>

          <SheetFooter className="px-0 pt-2">
            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? "Saving…" : customer ? "Update Customer" : "Save Customer"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}