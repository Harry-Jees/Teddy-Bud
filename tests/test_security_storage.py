from teddy_bud.core.context import build_context
from teddy_bud.ai.models import TaskType
from teddy_bud.security.redaction import redact_secrets
from teddy_bud.storage.database import EncryptedDatabase


class FakeKeyStore:
    def __init__(self, value: bytes):
        self.value = value

    def get_or_create_key(self, alias: str) -> bytes:
        return self.value

    def delete_key(self, alias: str) -> None:
        pass


def test_context_is_minimized_and_redacted():
    request = build_context(
        TaskType.CONVERSATION,
        [{"role": "user", "content": "token: super-secret hello"}] * 20,
        ["keep this memory"],
    )
    assert len(request.messages) == 12
    assert "super-secret" not in request.messages[-1]["content"]
    assert request.memories == ("keep this memory",)


def test_redaction_masks_secret_like_values():
    assert "private-value" not in redact_secrets("api_key=private-value")


def test_sqlcipher_rejects_wrong_key(tmp_path):
    path = tmp_path / "encrypted.sqlite3"
    database = EncryptedDatabase(path, FakeKeyStore(b"correct-key"))
    database.open()
    database.execute("CREATE TABLE secret_data (value TEXT)")
    database.execute("INSERT INTO secret_data VALUES (?)", ("private",))
    database.connection.commit()
    database.close()

    wrong = EncryptedDatabase(path, FakeKeyStore(b"wrong-key"))
    try:
        wrong.open()
    except Exception:
        pass
    else:
        raise AssertionError("SQLCipher opened with an incorrect key")
