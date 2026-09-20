// NavSecondary del dashboard-01: items fijos al pie del contenido.
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/blocks/ui/sidebar";
import type { Icon } from "@/blocks/lib/icons";

export function NavSecondary({
  items,
  className,
}: {
  items: {
    title: string;
    url: string;
    icon: Icon;
  }[];
  className?: string;
}) {
  return (
    <SidebarGroup className={className}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title}>
                <a href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
