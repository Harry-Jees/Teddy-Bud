from teddy_bud.config.settings import DEFAULT_GATEWAY_URL, load_settings


def test_settings_contains_only_gateway_configuration(monkeypatch, tmp_path):
    monkeypatch.setenv("TEDDY_GATEWAY_URL", "https://worker.example.test")
    settings = load_settings(data_dir=tmp_path)
    assert settings.gateway_url == "https://worker.example.test"
    assert settings.__slots__ == ("environment", "debug", "gateway_url", "database_path")


def test_deployed_gateway_is_the_non_secret_default(monkeypatch):
    monkeypatch.delenv("TEDDY_GATEWAY_URL", raising=False)
    assert load_settings().gateway_url == DEFAULT_GATEWAY_URL

