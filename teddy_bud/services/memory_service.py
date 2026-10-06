from __future__ import annotations

import re


class MemoryService:
    def __init__(self, repository):
        self.repository = repository

    def list(self):
        return self.repository.list()

    def remember(self, content: str) -> str:
        content = content.strip()
        if not content:
            raise ValueError("A memory cannot be empty")
        return self.repository.create(content)

    def update(self, memory_id: str, content: str) -> None:
        content = content.strip()
        if not content:
            raise ValueError("A memory cannot be empty")
        self.repository.update(memory_id, content)

    def forget(self, memory_id: str) -> None:
        self.repository.delete(memory_id)

    def clear(self) -> None:
        self.repository.clear()

    def relevant_to(self, message: str, *, limit: int = 3) -> list[str]:
        ignored = {"about", "after", "again", "also", "from", "have", "into", "just", "more", "that", "them", "then", "there", "these", "they", "this", "with", "would", "your"}

        def terms(value: str) -> set[str]:
            return {word for word in re.findall(r"[a-z0-9]+", value.lower()) if len(word) > 2 and word not in ignored}

        query = terms(message)
        if not query:
            return []
        ranked = []
        for index, item in enumerate(self.repository.list()):
            content = str(item["content"])
            overlap = len(query & terms(content))
            if overlap:
                ranked.append((overlap, -index, content))
        ranked.sort(reverse=True)
        return [content for _, _, content in ranked[:limit]]

