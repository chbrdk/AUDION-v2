from app.main import create_app


def test_app_creation() -> None:
    app = create_app()
    assert app.title == "Dynamic Persona Chat API"

