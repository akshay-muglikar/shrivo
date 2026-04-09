import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { createSupplier, updateSupplier, type Supplier } from "../api/suppliers.api"

interface FormValues {
  name: string
  phone: string
  notes: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier?: Supplier | null
}

export function SupplierSheet({ open, onOpenChange, supplier }: Props) {
  const qc = useQueryClient()
  const isEdit = !!supplier

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { name: "", phone: "", notes: "" },
  })

  useEffect(() => {
    if (open) {
      reset(
        supplier
          ? { name: supplier.name, phone: supplier.phone ?? "", notes: supplier.notes ?? "" }
          : { name: "", phone: "", notes: "" }
      )
    }
  }, [open, supplier, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        phone: values.phone.trim() || null,
        notes: values.notes.trim() || null,
      }
      return isEdit
        ? updateSupplier(supplier!.id, payload)
        : createSupplier(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? "Supplier updated" : "Supplier added")
      qc.invalidateQueries({ queryKey: ["suppliers"] })
      onOpenChange(false)
    },
    onError: () => toast.error(isEdit ? "Failed to update supplier" : "Failed to add supplier"),
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-none overflow-y-auto sm:!w-[min(56rem,50vw)]">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Supplier" : "Add Supplier"}</SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col gap-4 px-4 pb-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g. Metro Wholesale"
              {...register("name", { required: true })}
              aria-invalid={!!errors.name}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              placeholder="e.g. 9876543210"
              {...register("phone")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Payment terms, contact person, etc."
              {...register("notes")}
            />
          </div>

          <SheetFooter className="px-0 pt-2">
            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Add Supplier"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
