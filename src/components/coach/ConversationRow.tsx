import Link from "next/link";
import { Lock, Mail, Star } from "lucide-react";
import type { ConversationSafeMetadata, MessageAccess } from "@/lib/types";

export function ConversationRow({
  conversation,
  access,
}: {
  conversation: ConversationSafeMetadata;
  access: MessageAccess;
}) {
  return (
    <Link
      href={`/coach/messages/${conversation.id}`}
      className="grid gap-2 border-b border-slate-200 bg-white p-4 last:border-b-0 hover:bg-slate-50 md:grid-cols-[1fr_auto]"
    >
      <div>
        <div className="flex items-center gap-2">
          {access.hasAccess ? (
            <Mail className="h-4 w-4 text-[#2f6f5e]" />
          ) : (
            <Lock className="h-4 w-4 text-slate-500" />
          )}
          <h2 className="font-semibold text-slate-950">
            {access.hasAccess ? "Training request" : "Locked training request"}
          </h2>
          {conversation.is_unread_by_coach ? (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
              unread
            </span>
          ) : null}
          {conversation.is_saved ? <Star className="h-4 w-4 text-amber-500" /> : null}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {conversation.sport ?? "Training"} · Ages {conversation.age_range ?? "not provided"} ·{" "}
          {conversation.general_location ?? "Area not provided"}
        </p>
      </div>
      <div className="text-sm text-slate-500 md:text-right">
        <p>{new Date(conversation.created_at).toLocaleDateString()}</p>
        <p className="mt-1 capitalize">{conversation.status}</p>
      </div>
    </Link>
  );
}
