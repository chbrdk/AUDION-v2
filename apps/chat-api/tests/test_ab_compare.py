from __future__ import annotations

from app.routers.chat import ChatMessage, _ab_compare_system_instruction_de, _maybe_append_ab_compare_system_instruction


def test_ab_compare_instruction_is_stable_and_mentions_ordering_and_winner():
    instr = _ab_compare_system_instruction_de()
    assert "FIRST image" in instr
    assert "SECOND image" in instr
    assert "MUST pick a winner" in instr


def test_maybe_append_ab_compare_adds_instruction_only_for_exactly_two_images():
    system_parts: list[str] = ["base"]

    _maybe_append_ab_compare_system_instruction(
        system_parts=system_parts,
        msg=ChatMessage(role="user", content="x", image_ids=["i1", "i2"], ab_compare=True),
        persona_id="p1",
    )
    assert any("A/B Compare Mode" in s for s in system_parts)

    system_parts2: list[str] = ["base"]
    _maybe_append_ab_compare_system_instruction(
        system_parts=system_parts2,
        msg=ChatMessage(role="user", content="x", image_ids=["i1"], ab_compare=True),
        persona_id="p1",
    )
    assert len(system_parts2) == 1

    system_parts3: list[str] = ["base"]
    _maybe_append_ab_compare_system_instruction(
        system_parts=system_parts3,
        msg=ChatMessage(role="assistant", content="x", image_ids=["i1", "i2"], ab_compare=True),
        persona_id="p1",
    )
    assert len(system_parts3) == 1

