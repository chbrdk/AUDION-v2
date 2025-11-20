from pipelines.persona_ingest import PersonaSourceRegistry, list_sources


def test_registry_reads_markdown_table():
    registry = PersonaSourceRegistry()
    assert "persona_src_synthlabsai" in registry.sources
    source = registry.get("persona_src_synthlabsai")
    assert source.platform == "Hugging Face"


def test_list_sources_returns_iterable():
    registry = PersonaSourceRegistry()
    ids = list(list_sources(registry))
    assert "persona_src_tianyilab" in ids

