import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PaginationControlsProps {
  total: number
  page: number
  limit: number
  itemLabel: string
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

const PAGE_SIZES = [20, 50, 100]

export function PaginationControls({
  total,
  page,
  limit,
  itemLabel,
  onPageChange,
  onLimitChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.min(page, totalPages)
  const start = total === 0 ? 0 : (currentPage - 1) * limit + 1
  const end = Math.min(currentPage * limit, total)

  const pageNumbers = []
  const from = Math.max(1, currentPage - 1)
  const to = Math.min(totalPages, currentPage + 1)

  for (let pageNumber = from; pageNumber <= to; pageNumber += 1) {
    pageNumbers.push(pageNumber)
  }

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3">
      <div className="text-sm text-muted-foreground">
        Showing {start}-{end} of {total} {itemLabel}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <span className="text-sm text-muted-foreground">Rows</span>
          <Select value={String(limit)} onValueChange={(value) => onLimitChange(Number(value))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((pageSize) => (
                <SelectItem key={pageSize} value={String(pageSize)}>{pageSize}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="ml-auto text-sm text-muted-foreground sm:hidden">
            {currentPage}/{totalPages}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex-1 sm:flex-none"
          >
            Previous
          </Button>
          <div className="hidden items-center gap-1 sm:flex">
            {pageNumbers.map((pageNumber) => (
              <Button
                key={pageNumber}
                variant={pageNumber === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNumber)}
              >
                {pageNumber}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="flex-1 sm:flex-none"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}