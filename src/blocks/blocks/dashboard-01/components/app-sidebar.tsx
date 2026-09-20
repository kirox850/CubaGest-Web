// AppSidebar del dashboard-01 — estructura fiel al original con la marca
// del sandbox (blocks / CubaGest).
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/blocks/ui/sidebar";
import { NavDocuments } from "./nav-documents";
import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { NavUser } from "./nav-user";
import {
  Boxes,
  ChartBar,
  Database,
  FileText,
  Folder,
  GalleryVerticalEnd,
  LayoutDashboard,
  LifeBuoy,
  Search,
  Settings,
  Users,
  type Icon,
} from "@/blocks/lib/icons";

// Icono Report no definido en icons.tsx: FileText sirve de equivalente.
const ReportIcon = FileText;

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
  },
  navMain: [
    { title: "Dashboard", url: "#", icon: LayoutDashboard },
    { title: "Lifecycle", url: "#", icon: Boxes },
    { title: "Analytics", url: "#", icon: ChartBar },
    { title: "Projects", url: "#", icon: Folder },
    { title: "Team", url: "#", icon: Users },
  ],
  navSecondary: [
    { title: "Settings", url: "#", icon: Settings },
    { title: "Get Help", url: "#", icon: LifeBuoy },
    { title: "Search", url: "#", icon: Search },
  ],
  documents: [
    { name: "Data Library", url: "#", icon: Database },
    { name: "Reports", url: "#", icon: ReportIcon },
    { name: "Word Assistant", url: "#", icon: FileText },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#/blocks">
                <div className="flex size-6 items-center justify-center rounded-md bg-brand text-white">
                  <GalleryVerticalEnd className="size-4" />
                </div>
                <span className="text-base font-semibold">CubaGest</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}

// Re-export del tipo Icon para consumidores de este módulo.
export type { Icon };
