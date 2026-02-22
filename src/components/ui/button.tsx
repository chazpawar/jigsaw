import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-700 focus-visible:outline-slate-700",
  secondary:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 focus-visible:outline-slate-400",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-300",
} as const;

type ButtonVariant = keyof typeof buttonVariants;

type BaseButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
};

type NativeButtonProps = BaseButtonProps & {
  asChild?: false;
} & ComponentPropsWithoutRef<"button">;

type LinkButtonProps = BaseButtonProps & {
  asChild: true;
  href: string;
};

type ButtonProps = NativeButtonProps | LinkButtonProps;

export function Button(props: ButtonProps) {
  const baseClassName = cn(
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60",
    buttonVariants[props.variant ?? "primary"],
    props.className,
  );

  if (props.asChild) {
    const { children, href } = props;
    return (
      <Link href={href} className={baseClassName}>
        {children}
      </Link>
    );
  }

  const {
    children,
    asChild: _asChild,
    variant: _variant,
    ...buttonProps
  } = props;

  return (
    <button className={baseClassName} {...buttonProps}>
      {children}
    </button>
  );
}
