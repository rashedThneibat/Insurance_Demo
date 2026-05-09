import { useEffect, useState } from "react";
import type { Role } from "./types";

const KEY = "claimscopilot_role";
const DEFAULT_ROLE: Role = "adjuster";

export function getRole(): Role {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "adjuster" || v === "senior_approver") return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_ROLE;
}

export function setRole(role: Role): void {
  try {
    localStorage.setItem(KEY, role);
    window.dispatchEvent(new CustomEvent("claimscopilot:role", { detail: role }));
  } catch {
    /* ignore */
  }
}

export function roleLabel(role: Role): string {
  return role === "adjuster" ? "Adjuster" : "Senior Approver";
}

export function roleInitials(role: Role): string {
  return role === "adjuster" ? "JO" : "SA";
}

export function roleDisplayName(role: Role): string {
  return role === "adjuster" ? "Jordan Okafor" : "Sam Avery";
}

/** React hook that re-renders when the role changes (anywhere in the app). */
export function useRole(): [Role, (r: Role) => void] {
  const [role, setRoleState] = useState<Role>(() => getRole());

  useEffect(() => {
    function onChange(e: Event) {
      const detail = (e as CustomEvent<Role>).detail;
      if (detail === "adjuster" || detail === "senior_approver") {
        setRoleState(detail);
      }
    }
    function onStorage(e: StorageEvent) {
      if (e.key === KEY) setRoleState(getRole());
    }
    window.addEventListener("claimscopilot:role", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("claimscopilot:role", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function update(r: Role) {
    setRole(r);
    setRoleState(r);
  }

  return [role, update];
}
