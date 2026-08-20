import { describe, expect, it, vi } from "vitest";
import { createRemoteSaveRepository, hydrateFromRemote } from "../../src/platform/RemoteSaveRepository";
import { serialize } from "../../src/core/save/serialize";
import { player } from "../helpers/fixtures";
import type { SaveLoadResult, SaveRepository } from "../../src/core/save/SaveRepository";
import type { PlayerState } from "../../src/core/player/playerState";

function memoryRepo(): SaveRepository & { current: PlayerState | null } {
  const repo = {
    current: null as PlayerState | null,
    isAvailable: () => true,
    load: (): SaveLoadResult => (repo.current ? { status: "ok", player: repo.current } : { status: "empty" }),
    save: (p: PlayerState) => { repo.current = p; },
    clear: () => { repo.current = null; },
  };
  return repo;
}

const ok = () => new Response("", { status: 200 });

describe("remote save adapter (T129)", () => {
  it("writes through to the server AND to local storage", async () => {
    const local = memoryRepo();
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => ok());
    const repo = createRemoteSaveRepository({ endpoint: "/api/save", local, fetchImpl });

    const p = player({ gold: 42 });
    repo.save(p);

    expect(local.current).toBe(p); // local write is synchronous and immediate
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: "PUT" });
  });

  it("answers reads from LOCAL, so a battle never stalls on a network hop", () => {
    const local = memoryRepo();
    const p = player({ gold: 7 });
    local.save(p);
    const repo = createRemoteSaveRepository({ endpoint: "/api/save", local, fetchImpl: vi.fn() });
    expect(repo.load()).toEqual({ status: "ok", player: p });
  });

  it("keeps the local write when the server is unreachable", async () => {
    // Stage 1 is offline-capable. A failed sync must never cost the player their progress.
    const local = memoryRepo();
    const onError = vi.fn();
    const fetchImpl = vi.fn(async () => { throw new Error("offline"); });
    const repo = createRemoteSaveRepository({ endpoint: "/api/save", local, fetchImpl, onError });

    const p = player({ gold: 99 });
    expect(() => repo.save(p)).not.toThrow();
    expect(local.current).toBe(p);
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
  });

  it("reports availability from the local adapter, not the network", () => {
    const local = { ...memoryRepo(), isAvailable: () => false };
    const repo = createRemoteSaveRepository({ endpoint: "/api/save", local, fetchImpl: vi.fn() });
    expect(repo.isAvailable()).toBe(false);
  });
});

describe("hydrating from a server", () => {
  it("adopts a valid server save and writes it locally", async () => {
    const local = memoryRepo();
    const remote = player({ gold: 500, level: 6 });
    const fetchImpl = vi.fn(async () => new Response(serialize(remote), { status: 200 }));

    const result = await hydrateFromRemote("/api/save", local, fetchImpl);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.player.gold).toBe(500);
    expect(local.current?.gold).toBe(500);
  });

  it("falls back to the local save when the server is down", async () => {
    const local = memoryRepo();
    const p = player({ gold: 3 });
    local.save(p);
    const fetchImpl = vi.fn(async () => { throw new Error("offline"); });
    expect(await hydrateFromRemote("/api/save", local, fetchImpl)).toEqual({ status: "ok", player: p });
  });

  it("falls back to local when the server returns something unreadable", async () => {
    const local = memoryRepo();
    const fetchImpl = vi.fn(async () => new Response("{garbage", { status: 200 }));
    expect(await hydrateFromRemote("/api/save", local, fetchImpl)).toEqual({ status: "empty" });
  });
});
