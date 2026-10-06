import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Pular para o conteúdo
      </a>
      <AppSidebar />
      <div className="md:pl-64 flex flex-col min-h-screen">
        <AppHeader />
        <main id="conteudo" tabIndex={-1} className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1600px] w-full mx-auto outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
