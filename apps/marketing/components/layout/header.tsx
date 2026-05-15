"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLogoNavigation } from "@cusown/shared/client";

function Header() {
  const pathname = usePathname();
  const { handleLogoClick } = useLogoNavigation();
  const [, setChecking] = useState(true);
  const [, setUserState] = useState<any>(null);

  const onOwnerRoute = pathname?.startsWith("/owner");
  const onCustomerRoute = pathname?.startsWith("/customer");

  const hiddenRoutes = ["/select-role"];

  const hideCompletely =
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/booking") ||
    hiddenRoutes.includes(pathname || "");

  useEffect(() => {
    let mounted = true;

    const loadState = async () => {
      try {
        const stateRes = await fetch("/api/user/state", {
          credentials: "include",
        });
        if (!stateRes.ok) {
          if (!mounted) return;
          setUserState(null);
          return;
        }
        const json = await stateRes.json();
        const state = json?.data;
        if (!mounted) return;
        setUserState(state ?? null);
      } catch {
        if (!mounted) return;
        setUserState(null);
      } finally {
        if (!mounted) return;
        setChecking(false);
      }
    };

    if (onOwnerRoute || onCustomerRoute) loadState();
    else setChecking(false);

    return () => {
      mounted = false;
    };
  }, [pathname, onOwnerRoute, onCustomerRoute]);

  if (hideCompletely) return null;

  const logoTitle = (
    <button type="button" onClick={handleLogoClick}>
      <h1 className="text-xl font-calegar font-semibold uppercase">CUSOWN</h1>
    </button>
  );

  // OWNER ROUTES
  if (onOwnerRoute) {
    return (
      <header className="h-14 flex items-center justify-center px-4 border-b bg-white lg:hidden">
        {logoTitle}
      </header>
    );
  }

  // CUSTOMER ROUTES
  if (onCustomerRoute) {
    return (
      <header className="h-14 flex items-center justify-center px-4 border-b bg-white lg:hidden">
        {logoTitle}
      </header>
    );
  }

  // PUBLIC ROUTES — Mobile Only
  return (
    <header className="h-14 flex items-center justify-center px-4 border-b bg-white lg:hidden">
      {logoTitle}
    </header>
  );
}

export default Header;
export { Header };
