const roleplayMessages = [
  {
    id: "msg-1",
    name: "Scene",
    content:
      "Đêm mưa phủ xuống chân núi Thanh Vân. Một bóng người đứng đợi trước cổng đá nứt.",
    timestamp: "09:10",
  },
  {
    id: "msg-2",
    name: "Lâm Vân",
    content:
      "Nếu các người đã muốn ta rời đi, vậy từ hôm nay ân oán tự ta ghi nhớ.",
    timestamp: "09:11",
  },
  {
    id: "msg-3",
    name: "You",
    content:
      "Mộ Thanh Hàn không đáp, chỉ đặt một thanh kiếm gãy xuống trước mặt hắn.",
    timestamp: "09:12",
  },
];

export default function RoleplayChat() {
  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="border-b p-5">
        <h2 className="text-lg font-semibold tracking-tight">Live scene</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          In-character exchange and scene testing.
        </p>
      </div>

      <div className="space-y-4 p-5">
        {roleplayMessages.map((message) => (
          <article
            className="rounded-lg border bg-background p-4"
            key={message.id}
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold">{message.name}</p>
              <time className="text-xs text-muted-foreground">
                {message.timestamp}
              </time>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {message.content}
            </p>
          </article>
        ))}
      </div>

      <form className="border-t p-5">
        <label className="sr-only" htmlFor="roleplay-message">
          Message
        </label>
        <textarea
          className="min-h-24 w-full resize-y rounded-md border bg-background p-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
          id="roleplay-message"
          name="message"
          placeholder="Write the next line..."
        />
        <button
          className="mt-3 h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          type="button"
        >
          Send
        </button>
      </form>
    </section>
  );
}
