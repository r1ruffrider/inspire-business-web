import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// One button system for the whole site. The look lives in index.css (.btn*),
// so the static pre-render shell and React share it.
const buttonVariants = cva("btn", {
  variants: {
    variant: {
      primary: "btn--primary",
      secondary: "btn--secondary",
      inverse: "btn--inverse",
    },
    size: {
      md: "",
      sm: "btn--sm",
    },
    block: {
      none: "",
      always: "btn--block",
      phone: "btn--block-sm",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
    block: "none",
  },
})

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, block }), className)}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button }
