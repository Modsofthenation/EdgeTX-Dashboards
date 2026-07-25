import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { getDataDirectory } from "~/server/generatorFacade";
import type { ChatSummary, StoredChat } from "~/lib/chatTypes";
import type {
  ChatRepository,
  CreateChatInput,
  UpdateChatInput,
} from "~/lib/db/chatRepository";
import { SqliteChatRepository } from "~/lib/db/sqliteChatRepository";

export type { CreateChatInput, UpdateChatInput };
export { SqliteChatRepository };

let defaultRepository: SqliteChatRepository | null = null;

export function getChatRepository(): ChatRepository {
  if (!defaultRepository) {
    const dir = getDataDirectory();
    mkdirSync(dir, { recursive: true });
    defaultRepository = new SqliteChatRepository(join(dir, "chats.db"));
  }
  return defaultRepository;
}

/** @internal Reset singleton (tests). */
export function resetChatRepositoryForTests(repo?: SqliteChatRepository): void {
  defaultRepository = repo ?? null;
}

export function listChats(limit?: number): ChatSummary[] {
  return getChatRepository().listChats(limit);
}

export function getChat(id: string): StoredChat | null {
  return getChatRepository().getChat(id);
}

export function createChat(input: CreateChatInput): StoredChat {
  return getChatRepository().createChat(input);
}

export function updateChat(
  id: string,
  input: UpdateChatInput,
): StoredChat | null {
  return getChatRepository().updateChat(id, input);
}

export function deleteChat(id: string): boolean {
  return getChatRepository().deleteChat(id);
}

export function clearAllChats(): void {
  const repo = getChatRepository();
  if ("clearAll" in repo && typeof repo.clearAll === "function") {
    repo.clearAll();
  }
}
