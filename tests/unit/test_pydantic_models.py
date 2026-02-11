"""
Unit Tests für Pydantic Models

Testet Pydantic Validation und Features
"""

import pytest
from pydantic import BaseModel, ValidationError


class TestPydanticModels:
    """Tests für Pydantic Model Validation"""
    
    def test_basic_model_validation(self):
        """Test dass Pydantic Models korrekt validieren"""
        class TestModel(BaseModel):
            name: str
            age: int | None = None
        
        # Valid model
        model = TestModel(name="Test", age=25)
        assert model.name == "Test"
        assert model.age == 25
        
        # None value
        model = TestModel(name="Test", age=None)
        assert model.age is None
    
    def test_optional_fields(self):
        """Test optionale Felder"""
        class TestModel(BaseModel):
            required: str
            optional: str | None = None
        
        # Mit optional field
        model = TestModel(required="test", optional="value")
        assert model.optional == "value"
        
        # Ohne optional field
        model = TestModel(required="test")
        assert model.optional is None
    
    def test_validation_errors(self):
        """Test dass Validation Errors korrekt geworfen werden"""
        class TestModel(BaseModel):
            name: str
            age: int
        
        # Invalid type
        with pytest.raises(ValidationError):
            TestModel(name="Test", age="not a number")
    
    def test_model_serialization(self):
        """Test Model Serialization"""
        class TestModel(BaseModel):
            name: str
            age: int | None = None
        
        model = TestModel(name="Test", age=25)
        data = model.model_dump()
        
        assert data["name"] == "Test"
        assert data["age"] == 25
        
        # JSON serialization
        json_data = model.model_dump_json()
        assert "Test" in json_data
        assert "25" in json_data
