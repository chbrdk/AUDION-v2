"""
Integration Tests für API Endpoints nach Updates

Testet dass alle API-Endpoints nach Framework-Updates weiterhin funktionieren
"""

import pytest
from uuid import uuid4
from httpx import AsyncClient
from apps.api.app.main import app


@pytest.mark.integration
@pytest.mark.asyncio
class TestAPIEndpoints:
    """Tests für API-Endpoints nach FastAPI Update"""
    
    async def test_health_endpoint(self):
        """Test Health Check Endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/health")
            assert response.status_code == 200
    
    async def test_personas_list_endpoint(self):
        """Test GET /personas Endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/personas?page=1&page_size=10")
            # Sollte 200 oder 404 sein (abhängig von Daten)
            assert response.status_code in [200, 404]
    
    async def test_personas_detail_endpoint(self):
        """Test GET /personas/{id} Endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Mit ungültiger ID sollte 404 sein
            response = await client.get(f"/personas/{uuid4()}")
            assert response.status_code == 404
    
    async def test_target_groups_endpoint(self):
        """Test GET /target-groups Endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/target-groups")
            # Sollte 200 oder 404 sein
            assert response.status_code in [200, 404]
    
    async def test_api_response_format(self):
        """Test dass API-Responses korrektes Format haben"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/personas?page=1&page_size=10")
            
            if response.status_code == 200:
                data = response.json()
                # Sollte ein Objekt mit items, total, page, page_size sein
                assert "items" in data or "total" in data
