import type { ReactNode } from "react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export type ResultCardStatusVariant = "success" | "warning" | "danger" | "info" | "neutral"

type ResultCardProps = {
  icon: LucideIcon
  title: string
  status?: {
    label: string
    variant: ResultCardStatusVariant
  }
  animate?: boolean
  children: ReactNode
}

const statusStyles: Record<ResultCardStatusVariant, { card: string; icon: string; badge: string }> = {
  success: {
    card: "border-success/50 bg-success/10",
    icon: "bg-success/20 text-success",
    badge: "bg-success/20 text-success",
  },
  warning: {
    card: "border-warning/50 bg-warning/10",
    icon: "bg-warning/20 text-warning",
    badge: "bg-warning/20 text-warning",
  },
  danger: {
    card: "border-destructive/60 bg-destructive/10",
    icon: "bg-destructive/20 text-destructive",
    badge: "bg-destructive/20 text-destructive",
  },
  info: {
    card: "border-primary/40 bg-primary/10",
    icon: "bg-primary/20 text-primary",
    badge: "bg-primary/20 text-primary",
  },
  neutral: {
    card: "border-border bg-card/70",
    icon: "bg-muted/30 text-muted-foreground",
    badge: "bg-muted/20 text-muted-foreground",
  },
}

export function ResultCard({ icon: Icon, title, status, animate = false, children }: ResultCardProps) {
  const tone = status ? statusStyles[status.variant] : statusStyles.neutral

  return (
    <Card
      className={cn(
        "border-2 p-6 transition-all",
        tone.card,
        animate ? "animate-alert-surface" : "",
        "shadow-sm backdrop-blur",
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2", tone.icon)}>
            <Icon className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </div>
        {status?.label ? (
          <Badge className={cn("text-xs font-semibold", tone.badge)}>{status.label}</Badge>
        ) : null}
      </div>
      <div className="space-y-4 text-sm text-foreground/90">{children}</div>
    </Card>
  )
}
