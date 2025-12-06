# Test Suite - Optimierungen Dezember 2025

## Übersicht

Erweiterte Test-Suite für alle Optimierungen vom 05. Dezember 2025.

## Test-Struktur

```
tests/
├── baseline_performance.json      # Performance-Baseline
├── conftest.py                    # Pytest Configuration
├── unit/                          # Unit Tests
│   ├── test_react_19_features.test.tsx
│   └── test_pydantic_models.py
├── integration/                   # Integration Tests
│   ├── test_api_endpoints.py
│   ├── test_database_queries.py
│   └── test_async_operations.py
└── e2e/                           # E2E Tests
    ├── test_user_journey.spec.ts
    └── test_admin_workflows.spec.ts
```

## Running Tests

### Python Tests
```bash
# Alle Tests
pytest tests/

# Nur Integration Tests
pytest tests/integration/ -m integration

# Nur Unit Tests
pytest tests/unit/

# Mit Coverage
pytest tests/ --cov=apps/api --cov=apps/chat-api --cov=apps/indexing-api
```

### Frontend Tests
```bash
# TypeScript/React Tests (wenn Jest/React Testing Library eingerichtet)
npm test -- tests/unit/

# E2E Tests (wenn Playwright eingerichtet)
npx playwright test tests/e2e/
```

## Test-Coverage Ziele

- **Unit Tests:** >80% für neue/geänderte Code
- **Integration Tests:** Alle kritischen Flows
- **E2E Tests:** Haupt-User-Journeys

## Performance Tests

### Database Query Performance
```bash
pytest tests/integration/test_database_queries.py::TestDatabaseQueries::test_query_performance_baseline -v
```

### Async Operations Performance
```bash
pytest tests/integration/test_async_operations.py -v
```

## CI/CD Integration

Tests sollten in CI/CD Pipeline integriert werden:
- Pre-commit Hooks
- Pull Request Checks
- Automated Regression Detection

---

**Erstellt:** 05. Dezember 2025
