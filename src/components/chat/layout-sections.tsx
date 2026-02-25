import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { forwardRef } from "react";

export function Sidebar({
  isMobileChatOpen,
  isCollapsed,
  children,
}: {
  isMobileChatOpen: boolean;
  isCollapsed: boolean;
  children: ReactNode;
}) {
  return (
    <aside
      className={`overflow-hidden bg-[#16171b] transition-[width] duration-300 ease-in-out md:flex md:flex-col md:border-r md:border-neutral-700/40 ${
        isCollapsed
          ? "md:w-[86px] md:min-w-[86px] md:max-w-[86px]"
          : "md:w-[22%] md:min-w-[320px] md:max-w-[380px]"
      } ${isMobileChatOpen ? "hidden" : "flex flex-1 flex-col"}`}
    >
      {children}
    </aside>
  );
}

export const MessageList = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div">
>(({ children, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      {...props}
      className={`relative flex-1 space-y-3 overflow-y-auto bg-[#0a0b0d] p-4 md:p-6 ${className ?? ""}`}
    >
      {children}
    </div>
  );
});

MessageList.displayName = "MessageList";

export function Composer({ children }: { children: ReactNode }) {
  return <div className="bg-[#0a0b0d] p-3 md:p-4">{children}</div>;
}

export function ForwardModal({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      {children}
    </div>
  );
}
