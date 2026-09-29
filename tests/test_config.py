from teddy_bud.config.settings import load_settings


def test_settings_contains_only_gateway_configuration(monkeypatch, tmp_path):
    monkeypatch.setenv("TEDDY_GATEWAY_URL", "https://worker.example.test")
    settings = load_settings(data_dir=tmp_path)
    assert settings.gateway_url == "https://worker.example.test"
    assert settings.__slots__ == ("environment", "debug", "gateway_url", "database_path")

