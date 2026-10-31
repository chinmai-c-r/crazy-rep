"use client";

import { ArrowUp, Bot, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chatRequestSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    createClient()
      .from("chat_messages")
      .select("id, role, content, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setMessages(((data as ChatMessage[]) ?? []).reverse());
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function send(text: string) {
    const parsed = chatRequestSchema.safeParse({ message: text, tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message);
    if (sending) return;

    const pending: ChatMessage = { id: `pending-${crypto.randomUUID()}`, role: "user", content: parsed.data.message, created_at: new Date().toISOString() };
    setMessages((m) => [...m, pending]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const json = await res.json();
      if (typeof json.remaining === "number") setRemaining(json.remaining);
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      const saved = (json.messages as ChatMessage[])?.length
        ? (json.messages as ChatMessage[])
        : [pending, { id: crypto.randomUUID(), role: "assistant" as const, content: json.reply, created_at: new Date().toISOString() }];
      setMessages((m) => [...m.filter((x) => x.id !== pending.id), ...saved]);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== pending.id));
      setInput(parsed.data.message);
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function clear() {
    const { error } = await createClient().from("chat_messages").delete().not("id", "is", null);
    if (error) return toast.error(error.message);
    setMessages([]);
    toast.success("Chat cleared");
  }

  return (
    <Page narrow className="min-h-[calc(100dvh-6rem)] grid-rows-[auto_1fr_auto] lg:min-h-dvh">
      <PageHeader eyebrow="Ask about your meals, activity and weight" title="Coach">
        {messages.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="rounded-full text-muted-foreground">
                <Trash2 /> Clear
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
                <AlertDialogDescription>This deletes all messages with the coach. Your meals and logs are not affected.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={clear}>
                  Clear chat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </PageHeader>

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
        <p className="px-3 text-xs text-muted-foreground">
          AI coach, not medical advice.{remaining !== null ? ` ${remaining} messages left today.` : ""}
        </p>
      </form>
    </Page>
  );
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
