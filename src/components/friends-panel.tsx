"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/react";
import { Avatar } from "@/components/avatar";
import { useT } from "@/lib/i18n/react";

export function FriendsPanel() {
  const t = useT();
  const [query, setQuery] = useState("");
  const utils = trpc.useUtils();
  const list = trpc.friend.list.useQuery();
  const results = trpc.friend.search.useQuery({ query }, { enabled: query.trim().length > 0 });

  const invalidate = () => {
    utils.friend.list.invalidate();
    utils.friend.search.invalidate();
  };
  const request = trpc.friend.request.useMutation({ onSuccess: invalidate });
  const respond = trpc.friend.respond.useMutation({ onSuccess: invalidate });
  const remove = trpc.friend.remove.useMutation({ onSuccess: invalidate });

  return (
    <div className="card p-5">
      <h2 className="mb-3 font-semibold">{t("profile.friends")}</h2>

      {/* Search */}
      <input
        className="input"
        placeholder={t("profile.findPeople")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() && (
        <div className="mt-2 space-y-2">
          {results.isLoading && <p className="text-sm text-[var(--muted)]">{t("friends.searching")}</p>}
          {results.data?.length === 0 && <p className="text-sm text-[var(--muted)]">{t("friends.noUsers")}</p>}
          {results.data?.map((u) => (
            <div key={u.id} className="flex items-center gap-3">
              <Avatar name={u.name} src={u.photoUrl} size={32} />
              <div className="flex-1">
                <p className="text-sm font-medium">{u.name}</p>
                {u.username && <p className="text-xs text-[var(--muted)]">@{u.username}</p>}
              </div>
              {u.isFriend ? (
                <span className="chip chip-active">{t("friends.chipFriends")}</span>
              ) : u.pending === "OUTGOING" ? (
                <span className="chip">{t("friends.requested")}</span>
              ) : u.pending === "INCOMING" ? (
                <span className="chip">{t("friends.wantsConnect")}</span>
              ) : (
                <button className="btn-ghost !py-1 text-xs" onClick={() => request.mutate({ userId: u.id })}>
                  {t("profile.add")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Incoming requests */}
      {list.data && list.data.requests.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t("profile.requests")}</h3>
          <div className="space-y-2">
            {list.data.requests.map((r) => (
              <div key={r.friendshipId} className="flex items-center gap-3">
                <Avatar name={r.name} src={r.photoUrl} size={32} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.name}</p>
                  {r.username && <p className="text-xs text-[var(--muted)]">@{r.username}</p>}
                </div>
                <button className="btn-primary !py-1 text-xs" onClick={() => respond.mutate({ friendshipId: r.friendshipId, accept: true })}>
                  {t("profile.accept")}
                </button>
                <button className="btn-ghost !py-1 text-xs" onClick={() => respond.mutate({ friendshipId: r.friendshipId, accept: false })}>
                  {t("friends.decline")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div className="mt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {t("friends.yourFriends", { count: list.data?.friends.length ?? 0 })}
        </h3>
        {list.data && list.data.friends.length > 0 ? (
          <div className="space-y-2">
            {list.data.friends.map((f) => (
              <div key={f.id} className="flex items-center gap-3">
                <Avatar name={f.name} src={f.photoUrl} size={32} />
                <div className="flex-1">
                  {f.username ? (
                    <Link href={`/profile/${f.username}`} className="text-sm font-medium hover:underline">
                      {f.name}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium">{f.name}</p>
                  )}
                </div>
                <button className="text-xs text-[var(--muted)] hover:text-[var(--danger)]" onClick={() => remove.mutate({ userId: f.id })}>
                  {t("friends.remove")}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">{t("friends.empty")}</p>
        )}
      </div>
    </div>
  );
}
