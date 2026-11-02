"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Bot, History, Loader2, SquarePen, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { keys, useChatMessages, useChatThreads } from "@/lib/hooks";
import { chatRequestSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage, ChatThread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Page, PageHeader } from "../_components/Page";
import { ChatBubblesSkeleton } from "../_components/Skeletons";

const SUGGESTIONS = [
  "How did I do today?",
  "What's my average protein this week?",
  "Compare this month with last month",
  "How is my weight trending?",
  "Which meals add the most calories?",
  "Suggest a high-protein dinner for my remaining calories",
];

export default function CoachView() {
  const qc = useQueryClient();
  const { threads, loading: threadsLoading } = useChatThreads();
  // undefined: nothing picked yet, so open the latest conversation. null: a new, empty conversation.
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const current = chosen === undefined ? (threads?.[0]?.id ?? null) : chosen;
  const stored = useChatMessages(current);
  const [fresh, setFresh] = useState<ChatMessage[]>([]);
  const messages = useMemo(() => (current === null ? fresh : (stored.messages ?? [])), [current, fresh, stored.messages]);
  const loading = threadsLoading || stored.loading;

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ChatThread | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, current]);

  /** Edits the messages of one conversation (null: the unsaved new one), wherever it's cached. */
  const editMessages = (id: string | null, fn: (m: ChatMessage[]) => ChatMessage[]) =>
    id === null ? setFresh(fn) : qc.setQueryData<ChatMessage[]>(keys.chat(id), (old) => fn(old ?? []));

  async function send(text: string) {
    const parsed = chatRequestSchema.safeParse({ message: text, threadId: current ?? undefined, tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message);
    if (sending) return;

    const target = current;
    const pending: ChatMessage = { id: `pending-${crypto.randomUUID()}`, role: "user", content: parsed.data.message, created_at: new Date().toISOString() };
    editMessages(target, (m) => [...m, pending]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      const saved = (json.messages as ChatMessage[])?.length
        ? (json.messages as ChatMessage[])
        : [pending, { id: crypto.randomUUID(), role: "assistant" as const, content: json.reply, created_at: new Date().toISOString() }];
      const thread = json.thread as ChatThread | null;
      if (target === null && thread) {
        // The first answer created the conversation: move into it
        qc.setQueryData<ChatMessage[]>(keys.chat(thread.id), saved);
        setFresh([]);
        setChosen(thread.id);
      } else {
        editMessages(target, (m) => [...m.filter((x) => x.id !== pending.id), ...saved]);
      }
      if (thread) qc.setQueryData<ChatThread[]>(keys.chatThreads, (old) => [thread, ...(old ?? []).filter((t) => t.id !== thread.id)]);
    } catch (e) {
      editMessages(target, (m) => m.filter((x) => x.id !== pending.id));
      setInput(parsed.data.message);
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  function openThread(id: string) {
    setChosen(id);
    setHistoryOpen(false);
  }

  function newChat() {
    setChosen(null);
    setFresh([]);
    setInput("");
    setHistoryOpen(false);
  }

  async function removeThread(t: ChatThread) {
    const { error } = await createClient().from("chat_threads").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    qc.setQueryData<ChatThread[]>(keys.chatThreads, (old) => (old ?? []).filter((x) => x.id !== t.id));
    qc.removeQueries({ queryKey: keys.chat(t.id) });
    if (current === t.id) newChat();
    toast.success("Chat deleted");
  }

  return (
    <Page narrow className="min-h-[calc(100dvh-6rem)] grid-rows-[auto_1fr_auto] lg:min-h-dvh">
      <PageHeader eyebrow="Ask about your meals, activity and weight" title="Coach">
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon-lg" className="size-11 rounded-full" onClick={() => setHistoryOpen(true)} disabled={sending} aria-label="Chat history">
            <History />
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            className="size-11 rounded-full"
            onClick={newChat}
            disabled={sending || (current === null && fresh.length === 0)}
            aria-label="New chat"
          >
            <SquarePen />
          </Button>
        </div>
      </PageHeader>

      <Drawer open={historyOpen} onOpenChange={setHistoryOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Chat history</DrawerTitle>
            <DrawerDescription>Pick up an earlier conversation or start a new one.</DrawerDescription>
          </DrawerHeader>
          <div data-vaul-no-drag className="grid max-h-[60vh] gap-2 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button className="h-11 rounded-full" onClick={newChat}>
              <SquarePen /> New chat
            </Button>
            {threadsLoading ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-[58px] rounded-xl" />)
            ) : !threads?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No conversations yet.</p>
            ) : (
              threads.map((t) => (
                <div key={t.id} className="flex items-center gap-1">
                  <button
                    onClick={() => openThread(t.id)}
                    aria-current={t.id === current ? "true" : undefined}
                    className={cn(
                      "grid min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-primary/40",
                      t.id === current && "border-primary bg-primary/5",
                    )}
                  >
                    <b className="truncate text-sm">{t.title}</b>
                    <small className="text-xs text-muted-foreground">{when(t.updated_at)}</small>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="size-10 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setHistoryOpen(false);
                      setToDelete(t);
                    }}
                    aria-label={`Delete chat: ${t.title}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              “{toDelete?.title}” and its messages will be deleted. Your meals and logs are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => toDelete && removeThread(toDelete)}>
              Delete chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section className="grid content-start gap-4" aria-live="polite">
        {loading ? (
          <ChatBubblesSkeleton />
        ) : messages.length === 0 ? (
          <div className="grid justify-items-center gap-4 py-8 text-center">
            <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Bot className="size-8" />
            </div>
            <p className="max-w-sm text-muted-foreground">
              I can read your logged meals, activity, water and weight (up to 5 years) and help you spot trends. Try one of these:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="outline" className="h-auto rounded-full px-4 py-2 whitespace-normal" onClick={() => send(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} />)
        )}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" /> Looking at your data…
          </div>
        )}
        <div ref={bottomRef} />
      </section>

      <form
        className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] grid gap-1.5 lg:bottom-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-3xl border bg-card/95 p-2 backdrop-blur-lg">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask your coach…"
            rows={1}
            maxLength={1000}
            className="max-h-40 min-h-11 resize-none border-0 bg-transparent! shadow-none focus-visible:ring-0"
            aria-label="Message"
          />
          <Button type="submit" size="icon-lg" className="size-11 shrink-0 rounded-full" disabled={sending || !input.trim()} aria-label="Send">
            {sending ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </div>
      </form>
    </Page>
  );
}

/** "Today 14:05", "Yesterday", or "Oct 31". */
function when(iso: string) {
  const d = new Date(iso);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return `Today ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(days > 300 ? { year: "numeric" } : {}) });
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === "user";
  return (
    <div className={cn("flex", mine && "justify-end")}>
      <div
        className={cn(
          "max-w-[88%] rounded-3xl px-4 py-3 text-sm leading-relaxed",
          mine ? "rounded-br-lg bg-primary text-primary-foreground" : "rounded-bl-lg border bg-card",
        )}
      >
        {mine ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="grid gap-2 [&_a]:text-primary [&_a]:underline [&_li]:ml-4 [&_ol]:list-decimal [&_strong]:text-primary [&_table]:w-full [&_table]:text-left [&_td]:border-t [&_td]:py-1 [&_td]:pr-3 [&_th]:pr-3 [&_th]:text-muted-foreground [&_ul]:list-disc">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
