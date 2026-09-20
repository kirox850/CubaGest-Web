// dashboard-01 — página principal (fiel al block original de shadcn).
import { AppSidebar } from "./components/app-sidebar";
import { ChartAreaInteractive } from "./components/chart-area-interactive";
import { DataTable } from "./components/data-table";
import { SectionCards } from "./components/section-cards";
import { SiteHeader } from "./components/site-header";
import {
  SidebarInset,
  SidebarProvider,
} from "@/blocks/ui/sidebar";
import { payments } from "./data";

export default function Dashboard01Page() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "18rem",
          "--header-height": "3rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div>
              <DataTable data={payments} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
