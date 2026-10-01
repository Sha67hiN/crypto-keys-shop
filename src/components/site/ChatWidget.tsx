import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useSiteChrome } from "./SiteHeader";
import { cn } from "@/lib/utils";

export function ChatWidget() {
  const { user, isAdmin } = useSession();
  const { data: chrome } = useSiteChrome();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const endRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["my-support", user?.id],
    enabled: Boolean(user) && open,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("id,sender,body,created_at")
        .eq("user_id", user!.id)
        .order("created_at");
      return data ?? [];
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, open]);

  async function send() {
    const body = text.trim();
    if (!body || !user) return;
    setText("");
    await supabase.from("support_messages").insert({ user_id: user.id, sender: "user", body });
    qc.invalidateQueries({ queryKey: ["my-support", user.id] });
  }

  if (isAdmin) return null;
  const handle = chrome?.telegram_handle;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="panel-frost animate-reveal flex h-[26rem] w-[20rem] max-w-[calc(100vw-2rem)] flex-col rounded-2xl">
          <div className="flex items-center justify-between border-b border-snow/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-snow">Live support</p>
              <p className="label-mono">{chrome?.support_hours || "We reply as soon as we can"}</p>
            </div>
            <button onClick={() => setOpen(false)} className="font-mono text-xs text-fog hover:text-snow">
              close
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {!user ? (
              <p className="text-sm text-fog">
                <Link to="/auth" className="text-cyan">Sign in</Link> to chat with us.
              </p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-fog">Ask anything about products or your orders.</p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    m.sender === "user" ? "ml-auto bg-cyan/15 text-snow" : "bg-snow/5 text-snow",
                  )}
                >
                  {m.body}
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
          {handle && (
            <a
              href={`https://t.me/${handle}`}
              target="_blank"
              rel="noreferrer"
              className="border-t border-snow/10 px-4 py-2 font-mono text-[11px] text-cyan hover:text-snow"
            >
              Prefer Telegram? Message @{handle}
            </a>
          )}
          {user && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex gap-2 border-t border-snow/10 p-3"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 rounded-lg bg-panel/60 px-3 py-2 text-sm text-snow ring-1 ring-snow/10 outline-none focus:ring-cyan/40"
              />
              <button type="submit" className="rounded-lg bg-cyan px-3 font-mono text-xs text-ink">
                Send
              </button>
            </form>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full bg-cyan px-4 py-2.5 font-mono text-xs font-medium text-ink shadow-lg ring-1 ring-cyan/50"
      >
        {open ? "Hide chat" : "Chat with support"}
      </button>
    </div>
  );
}
