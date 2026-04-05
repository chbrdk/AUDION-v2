"""AiAssist retrieval_query usage (no msqdx_glass_proto dependency)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

pytest.importorskip("structlog")
pytest.importorskip("FlagEmbedding")

from app.services.ai_assist import AiAssistService, PromptTemplateRegistry


@pytest.mark.asyncio
async def test_test_prompt_reports_retrieval_query_for_knowledge_extended_vars() -> None:
    """Each successful RetrievalAgent.run during template render counts as one retrieval_query."""
    hit = MagicMock()
    hit.payload = {"content": "chunk", "document_id": "", "chunk_id": ""}
    hit.score = 0.9

    def fake_run(self, query, target_group_id=None, persona_segment=None):
        return None, [hit]

    with patch("app.agents.retrieval.RetrievalAgent.run", fake_run):
        with patch.object(AiAssistService, "_execute_prompt", new_callable=AsyncMock, return_value=("ok", {})):
            with patch("app.services.ai_assist.report_retrieval_query_usage") as report_rq:
                service = AiAssistService(
                    registry=PromptTemplateRegistry(),
                    session=MagicMock(),
                    retrieval_usage_user_id="plexon-user-1",
                )
                await service.test_prompt(
                    "A ${knowledge:${q1}.content} B ${knowledge:${q2}.content}",
                    {"q1": "alpha", "q2": "beta"},
                )
                report_rq.assert_called_once_with("plexon-user-1", queries=2)


@pytest.mark.asyncio
async def test_test_prompt_skips_retrieval_usage_for_system_user() -> None:
    hit = MagicMock()
    hit.payload = {"content": "x", "document_id": "", "chunk_id": ""}
    hit.score = 1.0

    def fake_run(self, query, target_group_id=None, persona_segment=None):
        return None, [hit]

    with patch("app.agents.retrieval.RetrievalAgent.run", fake_run):
        with patch.object(AiAssistService, "_execute_prompt", new_callable=AsyncMock, return_value=("ok", {})):
            with patch("app.services.ai_assist.report_retrieval_query_usage") as report_rq:
                service = AiAssistService(
                    registry=PromptTemplateRegistry(),
                    session=MagicMock(),
                    retrieval_usage_user_id="system",
                )
                await service.test_prompt("X ${knowledge:${q}.content}", {"q": "q"})
                report_rq.assert_not_called()
