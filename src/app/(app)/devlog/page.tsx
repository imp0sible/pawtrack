"use client";

import { useState } from "react";
import { Newspaper } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { useT } from "@/lib/i18n/react";
import { timeAgo } from "@/lib/format";

export default function DevlogPage() {
  const t = useT();
  const utils = trpc.useUtils();
  const me = trpc.user.me.useQuery();
  const list = trpc.devlog.list.useQuery();

  // Dev-only add form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"MAJOR" | "MINOR">("MINOR");
  const create = trpc.devlog.create.useMutation({
    onSuccess: () => {
      utils.devlog.list.invalidate();
      utils.devlog.latest.invalidate();
      setTitle("");
      setBody("");
      setKind("MINOR");
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Newspaper className="h-6 w-6 text-[var(--brand)]" /> {t("devlog.title")}
        </h1>
        <p className="text-sm text-[var(--muted)]">{t("devlog.subtitle")}</p>
      </div>

      {/* Developer-only: add a new entry (version auto-increments). */}
      {me.data?.isDeveloper && (
        <form
          className="card space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ title: title.trim(), body: body.trim(), kind });
          }}
        >
          <p className="text-sm font-semibold">New entry</p>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={140} />
          <textarea className="input min-h-20" value={body} onChange={(e) => setBody(e.target.value)} placeholder="What changed?" maxLength={4000} />
          <div className="flex flex-wrap items-center gap-2">
            <select className="input !w-auto" value={kind} onChange={(e) => setKind(e.target.value as "MAJOR" | "MINOR")}>
              <option value="MINOR">Small update (+0.0.1)</option>
              <option value="MAJOR">Major update (+0.1.0)</option>
            </select>
            <button className="btn-primary" type="submit" disabled={create.isPending || title.trim().length < 2 || body.trim().length < 2}>
              {create.isPending ? "Publishing…" : "Publish"}
            </button>
          </div>
        </form>
      )}

      {list.isLoading ? (
        <div className="card h-40 animate-pulse" />
      ) : list.data && list.data.length > 0 ? (
        <ol className="space-y-4">
          {list.data.map((e) => (
            <li key={e.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-[var(--brand-soft)] px-2 py-0.5 text-sm font-bold text-[var(--brand-strong)]">
                  v{e.version}
                </span>
                <span
                  className={`badge ${
                    e.kind === "MAJOR" ? "bg-[var(--accent)] text-black" : "bg-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {e.kind === "MAJOR" ? t("devlog.majorTag") : t("devlog.minorTag")}
                </span>
                <span className="ml-auto text-xs text-[var(--muted)]">{timeAgo(e.createdAt)}</span>
              </div>
              <h2 className="mt-2 font-semibold">{e.title}</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">{e.body}</p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="card p-10 text-center text-sm text-[var(--muted)]">{t("devlog.empty")}</div>
      )}
    </div>
  );
}
