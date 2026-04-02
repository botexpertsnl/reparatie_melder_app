export default function ConversationsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Conversations</h1>
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <aside className="card">Thread list with unread counters and stage badges.</aside>
        <section className="card">Active conversation pane with composer and contextual work-item panel.</section>
      </div>
    </div>
  );
}
