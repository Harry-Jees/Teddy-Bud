# Teddy Bud privacy behavior

Conversation history, approved memories, and settings are stored locally in an
SQLCipher-encrypted database. The database key and device authentication
credentials are kept through the platform secure credential store; there is no
plaintext fallback.

When the user requests a reply, the client sends the current message and a
limited, redacted recent context through the external gateway. When memory use
is enabled, only keyword-relevant approved memories within the client limits
are included. The full local database is never sent.

Users can disable memory use, forget individual memories, clear all memories,
delete conversations, or clear all local data. Clear-all removes the local
database and protected keys. These controls describe the client behavior and do
not make claims about retention or processing performed by the external
gateway, which must be documented by its owner.
