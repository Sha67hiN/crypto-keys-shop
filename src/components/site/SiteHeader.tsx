import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSiteChrome } from "@/lib/site.functions";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function useSiteChrome() {
  return useQuery({ queryKey: ["site-chrome"], queryFn: () => getSiteChrome() });
}

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 text-sm text-fog transition-colors hover:text-snow"
      activeProps={{ className: "bg-snow/5 text-snow ring-1 ring-snow/10" }}
      activeOptions={{ exact: to === "/" }}
    >
      {label}
    </Link>
  );
}

export function SiteHeader() {
  const { data } = useSiteChrome();
  const { user, isAdmin } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const storeName = data?.store_name ?? "Keyvault";

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-7 place-items-center rounded-md bg-cyan/15 font-mono text-sm text-cyan ring-1 ring-cyan/30">
          {storeName.slice(0, 1).toUpperCase()}
        </span>
        <Link to="/" className="text-sm font-semibold tracking-tight text-snow">
          {storeName}
        </Link>
        <span className="label-mono hidden sm:inline">Marketplace</span>
      </div>

      <nav className="flex items-center gap-1">
        <NavLink to="/" label="Store" />
        {user && <NavLink to="/orders" label="My Orders" />}
        {isAdmin && <NavLink to="/admin" label="Admin" />}
      </nav>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            <span className="hidden font-mono text-xs text-fog sm:inline">{user.email}</span>
            <button
              onClick={signOut}
              className={cn(
                "rounded-md bg-snow/5 px-3 py-1.5 font-mono text-xs text-snow ring-1 ring-snow/15",
                "transition-colors hover:bg-snow/10",
              )}
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            to="/auth"
            className="rounded-md bg-cyan px-3.5 py-1.5 font-mono text-xs font-medium text-ink ring-1 ring-cyan/50 transition-colors hover:bg-cyan/90"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { data } = useSiteChrome();
  const handle = data?.telegram_handle;
  return (
    <footer className="mt-10 flex flex-col items-center gap-2 border-t border-snow/10 pt-6 text-center">
      <p className="font-mono text-[11px] text-fog">
        {data?.store_name ?? "Keyvault"} · {data?.footer_note ?? ""}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4 font-mono text-[11px]">
        {handle && (
          <a
            href={`https://t.me/${handle}`}
            target="_blank"
            rel="noreferrer"
            className="text-cyan transition-colors hover:text-snow"
          >
            Telegram support · @{handle}
          </a>
        )}
        {data?.support_email && (
          <a
            href={`mailto:${data.support_email}`}
            className="text-fog transition-colors hover:text-snow"
          >
            {data.support_email}
          </a>
        )}
        {data?.support_hours && <span className="text-fog">{data.support_hours}</span>}
      </div>
    </footer>
  );
}
