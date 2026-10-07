import type { AttachmentId, ConversationId } from "@camena-ai/contracts"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { AtomRegistry } from "effect/unstable/reactivity"
import { httpClientLayerAtom } from "../api/studio-api.ts"
import {
  attachmentName,
  draftAttachmentsAtom,
  draftBusy,
  draftDetail,
  sendableIds,
  uploadAttachmentAtom,
} from "./attachments.ts"
import { sendTurnAtom } from "./conversations.ts"

const ATTACHMENT = "44444444-4444-4444-8444-444444444444" as AttachmentId
const CONVERSATION = "55555555-5555-4555-8555-555555555555" as ConversationId

const attachment = (status: "pending" | "done" | "failed", extra: object = {}) => ({
  id: ATTACHMENT,
  status,
  label: status === "done" ? "clean" : null,
  rejection: null,
  mime: status === "done" ? "text/plain; charset=utf-8" : null,
  sizeBytes: 12,
  createdAt: new Date(0).toISOString(),
  ...extra,
})

function registryWith(respond: (request: Request, gets: number) => Response) {
  const requests: Array<Request> = []
  let gets = 0
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request.clone())
    if (request.method === "GET") gets++
    return respond(request, gets)
  }
  const layer = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
  )
  return {
    registry: AtomRegistry.make({ initialValues: [[httpClientLayerAtom, layer]] }),
    requests,
  }
}

const settle = (registry: AtomRegistry.AtomRegistry) =>
  Effect.gen(function* () {
    for (let i = 0; i < 60 && draftBusy(registry.get(draftAttachmentsAtom)); i++) {
      yield* Effect.sleep("100 millis")
    }
  })

describe("uploadAttachmentAtom", () => {
  it.live("uploads the bytes, polls until checked and marks the draft ready", () =>
    Effect.gen(function* () {
      const { registry, requests } = registryWith((request, gets) =>
        request.method === "POST"
          ? Response.json({ id: ATTACHMENT, status: "pending" }, { status: 201 })
          : Response.json(attachment(gets < 2 ? "pending" : "done")),
      )
      const unmount = registry.mount(uploadAttachmentAtom)
      registry.set(
        uploadAttachmentAtom,
        new File(["windmill fax"], "notes.txt", { type: "text/plain" }),
      )
      yield* settle(registry)

      const post = requests.find((r) => r.method === "POST")
      assert.strictEqual(new URL(post?.url ?? "").pathname, "/v1/attachments")
      assert.strictEqual(post?.headers.get("studio-declared-type"), "text/plain")
      assert.strictEqual(
        yield* Effect.promise(() => post?.text() ?? Promise.resolve("")),
        "windmill fax",
      )

      const [draft] = registry.get(draftAttachmentsAtom)
      assert.deepInclude(draft, {
        name: "notes.txt",
        id: ATTACHMENT,
        state: "ready",
        label: "clean",
      })
      assert.deepStrictEqual(sendableIds(registry.get(draftAttachmentsAtom)), [ATTACHMENT])
      unmount()
    }),
  )

  it.live("shows the gateway's rejection and sends nothing for it", () =>
    Effect.gen(function* () {
      const { registry } = registryWith((request) =>
        request.method === "POST"
          ? Response.json({ id: ATTACHMENT, status: "pending" }, { status: 201 })
          : Response.json(attachment("failed", { rejection: { code: "image_only_pdf" } })),
      )
      const unmount = registry.mount(uploadAttachmentAtom)
      registry.set(
        uploadAttachmentAtom,
        new File(["%PDF"], "scan.pdf", { type: "application/pdf" }),
      )
      yield* settle(registry)
      const [draft] = registry.get(draftAttachmentsAtom)
      assert.strictEqual(draft?.state, "failed")
      assert.match(draftDetail(draft as never) ?? "", /scanned or image-only/)
      assert.deepStrictEqual(sendableIds(registry.get(draftAttachmentsAtom)), [])
      unmount()
    }),
  )
})

describe("two uploads at once", () => {
  it.live("both settle", () =>
    Effect.gen(function* () {
      const ids = ["66666666-6666-4666-8666-666666666661", "66666666-6666-4666-8666-666666666662"]
      let posts = 0
      const { registry } = registryWith((request) => {
        if (request.method === "POST") {
          return Response.json({ id: ids[posts++], status: "pending" }, { status: 201 })
        }
        const id = new URL(request.url).pathname.split("/").at(-1)
        return Response.json({ ...attachment("done"), id })
      })
      const unmount = registry.mount(uploadAttachmentAtom)
      registry.set(uploadAttachmentAtom, new File(["a"], "a.txt", { type: "text/plain" }))
      registry.set(uploadAttachmentAtom, new File(["b"], "b.txt", { type: "text/plain" }))
      yield* settle(registry)
      assert.deepStrictEqual(
        registry.get(draftAttachmentsAtom).map((d) => [d.name, d.state]),
        [
          ["a.txt", "ready"],
          ["b.txt", "ready"],
        ],
      )
      unmount()
    }),
  )
})

describe("sendTurnAtom with attachments", () => {
  it.effect("sends the checked files' ids with the turn", () =>
    Effect.gen(function* () {
      const { registry, requests } = registryWith((request) =>
        request.method === "POST"
          ? new Response("event: done\ndata: {}\n\n", {
              headers: { "content-type": "text/event-stream" },
            })
          : new Response(null, { status: 503 }),
      )
      const unmount = registry.mount(sendTurnAtom(CONVERSATION))
      registry.set(sendTurnAtom(CONVERSATION), {
        text: "Summarise this",
        model: "m",
        idempotencyKey: "key-a",
        attachments: [{ id: ATTACHMENT, label: "clean", mime: null }],
      })
      yield* AtomRegistry.getResult(registry, sendTurnAtom(CONVERSATION), {
        suspendOnWaiting: true,
      })
      const post = requests.find((r) => r.method === "POST")
      const body = yield* Effect.promise(() => post?.json() ?? Promise.resolve({}))
      assert.deepStrictEqual(body, {
        text: "Summarise this",
        model: "m",
        attachmentIds: [ATTACHMENT],
      })
      unmount()
    }),
  )
})

describe("attachmentName", () => {
  it("uses the session's name, else the detected type", () => {
    const names = new Map([[ATTACHMENT, "plan.docx"]])
    assert.strictEqual(attachmentName(names, { id: ATTACHMENT, mime: null }), "plan.docx")
    assert.strictEqual(
      attachmentName(new Map(), { id: "x", mime: "application/pdf" }),
      "PDF document",
    )
    assert.strictEqual(
      attachmentName(new Map(), { id: "x", mime: "text/csv; charset=utf-8" }),
      "CSV file",
    )
    assert.strictEqual(
      attachmentName(new Map(), {
        id: "x",
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "Excel workbook",
    )
  })
})
