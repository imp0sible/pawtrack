"use client";

import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { Bug, Send, Lock, MessageSquare } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { timeAgo } from "@/lib/format";
import type { AppRouter } from "@/server/trpc/root";

type Report = inferRouterOutputs<AppRouter>["bug"]["listAll"][number];

type StatusFilter = "ALL" | "OPEN" | "CLOSED";

export default function DevBugsPage() {
  const me = trpc.user.me.useQuery();
  const [filter, setFilter] = useState<StatusFilter>("OPEN");
  const list = trpc.bug.listAll.useQuery({ status: filter }, { enabled: me.data?.isDeveloper === true });

  if (me.data && !me.data.isDeveloper) {
    return (
      <div className="card p-10 text-center">
        <Lock className="mx-auto h-10 w-10 text-[var(--muted)]" />
        <p className="mt-2 font-semibold">Developers only</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bug className="h-6 w-6 text-[var(--brand)]" /> Reported bugs
        </h1>
        <div className="flex gap-2">
          {(["OPEN", "CLOSED", "ALL"] as StatusFilter[]).map((f) => (
            <button key={f} className={`chip ${filter === f ? "chip-active" : ""}`} onClick={() => setFilter(f)}>
              {f[0] + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {list.isLoading ? (
        <div className="card h-40 animate-pulse" />
      ) : list.data && list.data.length > 0 ? (
        list.data.map((r) => <BugCard key={r.id} report={r} />)
      ) : (
        <div className="card p-10 text-center text-sm text-[var(--muted)]">No reports here.</div>
      )}
    </div>
  );
}

function BugCard({ report }: { report: Report }) {
  const utils = trpc.useUtils();
  const [reply, setReply] = useState("");
  const invalidate = () => utils.bug.listAll.invalidate();
  const respond = trpc.bug.respond.useMutation({ onSuccess: () => { setReply(""); invalidate(); } });
  const setStatus = trpc.bug.setStatus.useMutation({ onSuccess: invalidate });

  const open = report.status === "OPEN";

  return (
    <div className="card space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={`badge ${open ? "bg-[var(--danger)] text-white" : "bg-[var(--border)] text-[var(--muted)]"}`}>
              {report.status}
            </span>
            <h2 className="font-semibold">{report.title}</h2>
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {report.reporter.name}
            {report.reporter.username ? ` (@${report.reporter.username})` : ""} · {timeAgo(report.createdAt)}
            {" · "}
            {report.reporter.telegramConnected ? "Telegram ✓" : "no Telegram"}
          </p>
        </div>
        <button
          className="btn-ghost !py-1 text-xs"
          onClick={() => setStatus.mutate({ id: report.id, status: open ? "CLOSED" : "OPEN" })}
          disabled={setStatus.isPending}
        >
          {open ? "Close" : "Reopen"}
        </button>
      </div>

      <p className="whitespace-pre-wrap text-sm">{report.description}</p>

      {report.screenshots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {report.screenshots.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={i} href={src} target="_blank" rel="noopener noreferrer">
              <img src={src} alt={`Screenshot ${i + 1}`} className="h-20 w-20 rounded-lg border border-[var(--border)] object-cover" />
            </a>
          ))}
        </div>
      )}

      {report.responses.length > 0 && (
        <div className="space-y-2 rounded-xl bg-[var(--background)] p-3">
          {report.responses.map((x) => (
            <div key={x.id} className="flex gap-2 text-sm">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
              <div>
                <p className="whitespace-pre-wrap">{x.body}</p>
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{timeAgo(x.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (reply.trim()) respond.mutate({ id: report.id, body: reply.trim() });
        }}
      >
        <textarea
          className="input min-h-10 flex-1"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply to the reporter (sent in-app + via Telegram)…"
          rows={1}
        />
        <button className="btn-primary inline-flex items-center gap-1.5" type="submit" disabled={respond.isPending || !reply.trim()}>
          <Send className="h-4 w-4" /> {respond.isPending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
