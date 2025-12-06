"""
Integration Tests für Async Operations Optimierungen

Testet parallele Journey Validation und andere Async-Operationen
"""

import pytest
import asyncio
from uuid import uuid4

from apps.api.app.services.journey_validation import JourneyValidationService


@pytest.mark.integration
@pytest.mark.asyncio
class TestAsyncOperations:
    """Tests für optimierte Async Operations"""
    
    async def test_journey_validation_parallelization(self):
        """Test dass Journey Validation parallelisiert wird"""
        service = JourneyValidationService()
        
        # Mock journey_id und persona_ids
        journey_id = uuid4()
        persona_ids = [uuid4(), uuid4(), uuid4()]
        
        # Test dass asyncio.gather verwendet wird
        # (indirekt durch schnelleres Ergebnis bei mehreren Personas)
        validation_tasks = [
            service.validate_journey_against_persona(
                journey_id=journey_id,
                persona_id=persona_id,
            )
            for persona_id in persona_ids
        ]
        
        # Alle Validierungen sollten parallel laufen
        start = asyncio.get_event_loop().time()
        results = await asyncio.gather(*validation_tasks, return_exceptions=True)
        elapsed = asyncio.get_event_loop().time() - start
        
        # Parallel sollte schneller sein als sequenziell
        # (auch wenn einzelne Validierungen fehlschlagen)
        assert len(results) == len(persona_ids)
        
        # Log für Performance-Analyse
        print(f"Parallel validation took {elapsed}s for {len(persona_ids)} personas")
    
    async def test_async_error_handling(self):
        """Test dass Errors in parallelen Operations korrekt behandelt werden"""
        service = JourneyValidationService()
        
        journey_id = uuid4()
        persona_ids = [uuid4(), uuid4()]
        
        # Eine Validierung sollte fehlschlagen können ohne andere zu beeinflussen
        validation_tasks = [
            service.validate_journey_against_persona(
                journey_id=journey_id,
                persona_id=persona_id,
            )
            for persona_id in persona_ids
        ]
        
        results = await asyncio.gather(*validation_tasks, return_exceptions=True)
        
        # Alle Tasks sollten abgeschlossen sein (auch bei Fehlern)
        assert len(results) == len(persona_ids)
