import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  Filter,
  FolderOpen,
  Inbox,
  PlusCircle,
  SearchX,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { useClaims } from "@/lib/claimsStore";
import { useRole } from "@/lib/roleStore";
import { hasApiKey } from "@/lib/ai";
import type { Claim, ClaimStatus, ClaimType, Priority } from "@/lib/types";
import {
  claimTypeColor,
  claimTypeLabel,
  formatCurrency,
  priorityColor,
  relativeTime,
  statusLabel,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewClaimModal } from "@/components/NewClaimModal";

// ── Status badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ClaimStatus }) {
  const styles: Record<ClaimStatus, string> = {
    open: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
    in_review: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900",
    awaiting_info: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    closed: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

// ── Priority badge ───────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${priorityColor(priority)}`}
    >
      {priority}
    </span>
  );
}

// ── Risk flags ───────────────────────────────────────────────────────────────
function RiskFlags({ flags }: { flags: string[] }) {
  if (flags.length === 0)
    return <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>;
  const visible = flags.slice(0, 2);
  const extra = flags.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((f) => (
        <span
          key={f}
          className="inline-flex items-center gap-1 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-1.5 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400"
        >
          <AlertTriangle className="size-3" />
          {f.replace(/_/g, " ")}
        </span>
      ))}
      {extra > 0 && (
        <span className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          +{extra} more
        </span>
      )}
    </div>
  );
}

// ── Sort types ───────────────────────────────────────────────────────────────
type SortKey = "amountClaimed" | "reportedAt";
type SortDir = "asc" | "desc";

function SortIcon({ col, active, dir }: { col: SortKey; active: SortKey; dir: SortDir }) {
  if (col !== active)
    return <ChevronDown className="size-3.5 text-slate-300 dark:text-slate-600 ml-1 inline" />;
  return dir === "desc" ? (
    <ChevronDown className="size-3.5 text-slate-600 dark:text-slate-300 ml-1 inline" />
  ) : (
    <ChevronUp className="size-3.5 text-slate-600 dark:text-slate-300 ml-1 inline" />
  );
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-24" />
          </TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-3 w-28" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ── KPI tile ──────────────────────────────────────────────────────────────────
function KpiTile({
  icon,
  label,
  value,
  hint,
  tone,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: "slate" | "amber" | "red" | "emerald";
  active?: boolean;
  onClick?: () => void;
}) {
  const toneStyles: Record<typeof tone, { ring: string; bar: string; iconBg: string; iconFg: string; valueFg: string }> = {
    slate: {
      ring: "hover:border-slate-300 dark:hover:border-slate-600",
      bar: "bg-slate-400",
      iconBg: "bg-slate-100 dark:bg-slate-800",
      iconFg: "text-slate-600 dark:text-slate-300",
      valueFg: "text-slate-900 dark:text-slate-100",
    },
    amber: {
      ring: "hover:border-amber-300 dark:hover:border-amber-700",
      bar: "bg-amber-500",
      iconBg: "bg-amber-50 dark:bg-amber-950",
      iconFg: "text-amber-600 dark:text-amber-400",
      valueFg: "text-amber-700 dark:text-amber-300",
    },
    red: {
      ring: "hover:border-red-300 dark:hover:border-red-800",
      bar: "bg-red-500",
      iconBg: "bg-red-50 dark:bg-red-950",
      iconFg: "text-red-600 dark:text-red-400",
      valueFg: "text-red-700 dark:text-red-300",
    },
    emerald: {
      ring: "hover:border-emerald-300 dark:hover:border-emerald-800",
      bar: "bg-emerald-500",
      iconBg: "bg-emerald-50 dark:bg-emerald-950",
      iconFg: "text-emerald-600 dark:text-emerald-400",
      valueFg: "text-emerald-700 dark:text-emerald-300",
    },
  };
  const s = toneStyles[tone];
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`group relative text-left rounded-xl border bg-white dark:bg-slate-900 px-4 py-4 transition-all overflow-hidden ${
        active
          ? "border-slate-900 dark:border-slate-100 shadow-sm"
          : `border-slate-200 dark:border-slate-700 ${interactive ? s.ring + " hover:shadow-sm cursor-pointer" : "cursor-default"}`
      }`}
    >
      <span className={`absolute left-0 top-0 h-full w-1 ${s.bar}`} />
      <div className="flex items-start justify-between gap-2">
        <div className={`rounded-lg p-2 ${s.iconBg}`}>
          <span className={s.iconFg}>{icon}</span>
        </div>
        {interactive && (
          <span className="text-[10px] uppercase tracking-wide text-slate-300 dark:text-slate-600 group-hover:text-slate-400">
            {active ? "Filtered" : "Filter"}
          </span>
        )}
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tabular-nums leading-none ${s.valueFg}`}>{value}</p>
      <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
    </button>
  );
}

// ── First-run no-API-key banner ──────────────────────────────────────────────
function FirstRunBanner() {
  const navigate = useNavigate();
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 px-4 py-3">
      <Sparkles className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          No OpenRouter API key configured
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
          Add a key in Settings to enable AI damage estimates and fraud analysis.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 gap-1.5 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200"
        onClick={() => navigate("/settings")}
      >
        Open Settings
        <ExternalLink className="size-3.5" />
      </Button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function QueuePage() {
  const navigate = useNavigate();
  const { claims: allClaims } = useClaims();
  const [role] = useRole();
  const [newClaimOpen, setNewClaimOpen] = useState(false);
  const keyOk = hasApiKey();

  // ── Initial load skeleton (300 ms)
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsInitialLoad(false), 300);
    return () => clearTimeout(t);
  }, []);

  // ── Filter state — when role becomes senior_approver, default to "awaiting_info"
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ClaimType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "all">(
    role === "senior_approver" ? "awaiting_info" : "all"
  );
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [aiFlaggedOnly, setAiFlaggedOnly] = useState(false);

  // Re-apply default when role changes
  useEffect(() => {
    setStatusFilter(role === "senior_approver" ? "awaiting_info" : "all");
  }, [role]);

  // ── Sort state
  const [sortKey, setSortKey] = useState<SortKey>("reportedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtersActive =
    search !== "" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    aiFlaggedOnly;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setAiFlaggedOnly(false);
  }

  // ── Metrics
  const openOnlyCount = allClaims.filter((c) => c.status === "open").length;
  const inReviewCount = allClaims.filter((c) => c.status === "in_review").length;
  const openCount = openOnlyCount + inReviewCount; // for header line
  const awaitingCount = allClaims.filter((c) => c.status === "awaiting_info").length;
  const rejectedCount = allClaims.filter(
    (c) => c.status === "in_review" && !!c.rejectionInfo
  ).length;
  const aiFlaggedCount = allClaims.filter(
    (c) =>
      c.status !== "closed" &&
      (c.aiFraudAnalysis?.riskLevel === "high" || c.aiFraudAnalysis?.riskLevel === "critical")
  ).length;
  const totalExposure = allClaims
    .filter((c) => c.status !== "closed")
    .reduce(
      (s, c) => s + (c.adjusterAdjustedAmount ?? c.amountClaimed),
      0
    );

  // ── Filtered + sorted list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const results: Claim[] = allClaims.filter((c) => {
      if (
        q &&
        !c.id.toLowerCase().includes(q) &&
        !c.claimantName.toLowerCase().includes(q) &&
        !c.policyNumber.toLowerCase().includes(q)
      )
        return false;
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (priorityFilter !== "all" && c.priority !== priorityFilter) return false;
      if (
        aiFlaggedOnly &&
        !(c.aiFraudAnalysis?.riskLevel === "high" || c.aiFraudAnalysis?.riskLevel === "critical")
      )
        return false;
      return true;
    });

    results.sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === "reportedAt") {
        av = new Date(a.reportedAt).getTime();
        bv = new Date(b.reportedAt).getTime();
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      return sortDir === "desc" ? bv - av : av - bv;
    });

    return results;
  }, [allClaims, search, typeFilter, statusFilter, priorityFilter, aiFlaggedOnly, sortKey, sortDir]);

  function SortableHead({
    col,
    children,
    className,
  }: {
    col: SortKey;
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <TableHead
        className={`cursor-pointer select-none whitespace-nowrap hover:text-slate-800 dark:hover:text-slate-200 ${className ?? ""}`}
        onClick={() => toggleSort(col)}
      >
        {children}
        <SortIcon col={col} active={sortKey} dir={sortDir} />
      </TableHead>
    );
  }

  return (
    <div className="py-8 space-y-6">
      {/* ── First-run API key banner */}
      {!keyOk && <FirstRunBanner />}

      {/* ── Page header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {role === "senior_approver" ? "Approval Queue" : "Claims Queue"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            <span className="text-blue-600 dark:text-blue-400 font-medium">{openCount} open</span>
            {" · "}
            <span className="text-purple-600 dark:text-purple-400 font-medium">{inReviewCount} in review</span>
            {" · "}
            <span className="text-amber-600 dark:text-amber-400 font-medium">{awaitingCount} pending approval</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Awaiting My Approval chip */}
          {awaitingCount > 0 && (
            <button
              onClick={() => setStatusFilter(statusFilter === "awaiting_info" ? "all" : "awaiting_info")}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === "awaiting_info"
                  ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                  : "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900 hover:bg-amber-100 dark:hover:bg-amber-900"
              }`}
            >
              <Inbox className="size-3.5" />
              {role === "senior_approver" ? "Awaiting my approval" : "Pending approval"}
              <span className="rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-1.5 py-0 text-[10px] font-semibold">
                {awaitingCount}
              </span>
              {statusFilter === "awaiting_info" && <X className="size-3" />}
            </button>
          )}
          {role !== "senior_approver" && (
            <Button className="shrink-0 gap-1.5" onClick={() => setNewClaimOpen(true)}>
              <PlusCircle className="size-4" />
              New Claim
            </Button>
          )}
        </div>
      </div>

      {/* ── KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiTile
          icon={<FolderOpen className="size-4" />}
          label="Open Claims"
          value={String(openOnlyCount)}
          hint="New, awaiting triage"
          tone="slate"
          active={statusFilter === "open"}
          onClick={() => {
            setAiFlaggedOnly(false);
            setStatusFilter(statusFilter === "open" ? "all" : "open");
          }}
        />
        <KpiTile
          icon={<Sparkles className="size-4" />}
          label="In Review"
          value={String(inReviewCount)}
          hint={
            rejectedCount > 0
              ? `${rejectedCount} sent back by senior`
              : "Adjuster actively working"
          }
          tone={rejectedCount > 0 ? "red" : "slate"}
          active={statusFilter === "in_review"}
          onClick={() => {
            setAiFlaggedOnly(false);
            setStatusFilter(statusFilter === "in_review" ? "all" : "in_review");
          }}
        />
        <KpiTile
          icon={<ClipboardList className="size-4" />}
          label="Pending Senior Approval"
          value={String(awaitingCount)}
          hint={awaitingCount === 0 ? "All caught up" : "Awaiting authorization"}
          tone="amber"
          active={statusFilter === "awaiting_info"}
          onClick={() => {
            setAiFlaggedOnly(false);
            setStatusFilter(statusFilter === "awaiting_info" ? "all" : "awaiting_info");
          }}
        />
        <KpiTile
          icon={<ShieldAlert className="size-4" />}
          label="AI-Flagged Risk"
          value={String(aiFlaggedCount)}
          hint={aiFlaggedCount === 0 ? "No high-risk claims" : "High or critical fraud risk"}
          tone="red"
          active={aiFlaggedOnly}
          onClick={() => setAiFlaggedOnly((v) => !v)}
        />
        <KpiTile
          icon={<Banknote className="size-4" />}
          label="Reserve Exposure"
          value={formatCurrency(totalExposure)}
          hint="Across all open claims"
          tone="emerald"
        />
      </div>

      {/* ── Filter bar + table card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60">
          <div className="relative flex-1 min-w-48">
            <Input
              placeholder="Search ID, name, policy…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-3 h-8 text-sm bg-white dark:bg-slate-900"
            />
          </div>

          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as ClaimType | "all")}
          >
            <SelectTrigger className="h-8 text-sm w-40 bg-white dark:bg-slate-900">
              <SelectValue placeholder="Resolution" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Resolutions</SelectItem>
              <SelectItem value="repair">Repair</SelectItem>
              <SelectItem value="total_loss">Total Loss</SelectItem>
              <SelectItem value="reimbursement">Reimbursement</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as ClaimStatus | "all")}
          >
            <SelectTrigger className="h-8 text-sm w-40 bg-white dark:bg-slate-900">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="awaiting_info">Pending Approval</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v as Priority | "all")}
          >
            <SelectTrigger className="h-8 text-sm w-36 bg-white dark:bg-slate-900">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-slate-500 dark:text-slate-400 gap-1.5"
              onClick={clearFilters}
            >
              <Filter className="size-3.5" />
              Clear
            </Button>
          )}
        </div>

        {/* Table */}
        {filtered.length === 0 && !isInitialLoad ? (
          role === "senior_approver" && statusFilter === "awaiting_info" && !search && typeFilter === "all" && priorityFilter === "all" ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400 dark:text-slate-500">
              <CheckCircle2 className="size-10 stroke-1 text-emerald-500" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">All caught up</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">No claims awaiting your approval right now.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400 dark:text-slate-500">
              <SearchX className="size-10 stroke-1" />
              <p className="text-sm font-medium">No claims match your filters</p>
              <Button variant="outline" size="sm" className="text-xs" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Claim ID</TableHead>
                <TableHead>Claimant</TableHead>
                <TableHead>Resolution</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Risk Flags</TableHead>
                <SortableHead col="amountClaimed" className="text-right">
                  Amount
                </SortableHead>
                <SortableHead col="reportedAt">Reported</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isInitialLoad ? (
                <SkeletonRows />
              ) : (
                filtered.map((claim) => (
                  <TableRow
                    key={claim.id}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    onClick={() => navigate(`/claim/${claim.id}`)}
                  >
                    <TableCell>
                      <span className="font-mono text-sm text-slate-700 dark:text-slate-300">
                        {claim.id}
                      </span>
                      {claim.rejectionInfo && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300">
                          <AlertTriangle className="size-2.5" />
                          Sent back
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">{claim.claimantName}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{claim.policyNumber}</div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${claimTypeColor(claim.type)}`}
                      >
                        {claimTypeLabel(claim.type)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={claim.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={claim.priority} />
                    </TableCell>
                    <TableCell>
                      <RiskFlags flags={claim.riskFlags} />
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                      {formatCurrency(claim.amountClaimed)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {relativeTime(claim.reportedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {/* Footer count */}
        {filtered.length > 0 && !isInitialLoad && (
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Showing{" "}
              <span className="font-medium text-slate-600 dark:text-slate-300">{filtered.length}</span> of{" "}
              <span className="font-medium text-slate-600 dark:text-slate-300">{allClaims.length}</span> claims
            </p>
          </div>
        )}
      </div>

      {/* New Claim Modal */}
      <NewClaimModal open={newClaimOpen} onClose={() => setNewClaimOpen(false)} />
    </div>
  );
}

