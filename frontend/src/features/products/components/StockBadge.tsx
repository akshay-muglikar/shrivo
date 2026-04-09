import { Badge } from "@/components/ui/badge"

interface Props {
  current: number
  threshold: number
}

export function StockBadge({ current, threshold }: Props) {
  if (current === 0) return <Badge variant="destructive">Out of stock</Badge>
  if (current <= threshold) return <Badge variant="outline" className="border-orange-400 text-orange-600">Low: {current}</Badge>
  return <Badge variant="secondary">{current}</Badge>
}
