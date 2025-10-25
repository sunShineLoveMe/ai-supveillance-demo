"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Terminal } from "lucide-react"
import { cn } from "@/lib/utils"

interface SystemLogProps {
  logs: string[]
}

export function SystemLog({ logs }: SystemLogProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Card className="border-border bg-card">
      <div className="flex cursor-pointer items-center justify-between p-4" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">系统日志</h2>
        </div>
        <Button variant="ghost" size="sm">
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </Button>
      </div>

      <div className={cn("overflow-hidden transition-all", isExpanded ? "max-h-96" : "max-h-0")}>
        <div className="border-t border-border bg-secondary/50 p-4">
          <div className="max-h-80 overflow-y-auto rounded-md bg-background p-3 font-mono text-xs">
            {logs.map((log, index) => (
              <div key={index} className="mb-1 text-muted-foreground last:mb-0">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
