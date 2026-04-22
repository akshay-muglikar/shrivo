import * as React from "react"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { LayoutDashboard, Package, Receipt, ShoppingCart, Users, Wallet,
  Settings2Icon,
  CircleHelpIcon,
  CommandIcon,
  CalendarX2,
} from "lucide-react"
import { useAuthStore } from "@/features/auth/store/auth.store"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuthStore()
  const isOwner = !!user?.is_owner
  
const data = {
  user: {
    name: user?.name || "Shop Manager",
    email: user?.email || "",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    ...(isOwner ? [{ url: "/app", title: "Dashboard", icon: (<LayoutDashboard/>), }] : []),
    { url: "/app/products", title: "Products", icon: (<Package/>), },
    { url: "/app/invoices", title: "Invoices", icon: (<Receipt/>), },
    ...(isOwner ? [{ url: "/app/customers", title: "Customers", icon: (<Users/>), }] : []),
    { url: "/app/expenses", title: "Expenses", icon: (<Wallet/>), },
    ...(isOwner ? [{ url: "/app/suppliers", title: "Suppliers", icon: (<ShoppingCart/>), }] : []),
  ] ,
  navReports: [
    { url: "/app/expiry", title: "Expiry Report", icon: (<CalendarX2/>), },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/app/settings",
      icon: (
        <Settings2Icon
        />
      ),
    },
    {
      title: "Get Help",
      url: "/app/help",
      icon: (
        <CircleHelpIcon
        />
      ),
    },
  ],
}
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="#" />}
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">Shrivo</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavMain items={data.navReports} title="Reports" />
       
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
