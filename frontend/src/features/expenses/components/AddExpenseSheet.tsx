import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { createExpense, type Expense, updateExpense } from "../api/expenses.api"

interface FormValues {
  title: string
  category: string
  amount: string
  expense_date: string
  notes: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense?: Expense | null
}

export function AddExpenseSheet({ open, onOpenChange, expense }: Props) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      expense_date: new Date().toISOString().slice(0, 10),
    },
  })

  useEffect(() => {
    reset({
      title: expense?.title ?? "",
      category: expense?.category ?? "",
      amount: expense?.amount ?? "",
      expense_date: expense?.expense_date ?? new Date().toISOString().slice(0, 10),
      notes: expense?.notes ?? "",
    })
  }, [expense, reset, open])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        title: values.title.trim(),
        category: values.category.trim() || null,
        amount: parseFloat(values.amount),
        expense_date: values.expense_date,
        notes: values.notes.trim() || null,
      }
      return expense ? updateExpense(expense.id, payload) : createExpense(payload)
    },
    onSuccess: () => {
      toast.success(expense ? "Expense updated" : "Expense added")
      qc.invalidateQueries({ queryKey: ["expenses"] })
      reset({ title: "", category: "", amount: "", expense_date: new Date().toISOString().slice(0, 10), notes: "" })
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? "Failed to add expense")
    },
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-none overflow-y-auto sm:!w-[min(48rem,50vw)]">
        <SheetHeader>
          <SheetTitle>{expense ? "Edit Expense" : "Add Expense"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense_title">Title *</Label>
            <Input
              id="expense_title"
              placeholder="Electricity bill"
              aria-invalid={!!errors.title}
              {...register("title", { required: true })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expense_category">Category</Label>
              <Input id="expense_category" placeholder="Utilities" {...register("category")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expense_amount">Amount *</Label>
              <Input
                id="expense_amount"
                type="number"
                min="0"
                step="0.01"
                aria-invalid={!!errors.amount}
                {...register("amount", { required: true })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense_date">Expense Date *</Label>
            <Input id="expense_date" type="date" aria-invalid={!!errors.expense_date} {...register("expense_date", { required: true })} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense_notes">Notes</Label>
            <Textarea id="expense_notes" placeholder="Optional details" {...register("notes")} />
          </div>

          <SheetFooter className="px-0 pt-2">
            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? "Saving…" : expense ? "Update Expense" : "Save Expense"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}