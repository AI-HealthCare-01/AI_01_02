from pydantic import BaseModel


class DrugItem(BaseModel):
    id: str
    ingredient_name: str | None = None
    product_name: str | None = None
    dosage: str | None = None
    usage: str | None = None
    efficacy: str | None = None
    side_effects: str | None = None
    precautions: str | None = None
    contraindications: str | None = None
    cautious_patients: str | None = None


class DrugListResponse(BaseModel):
    items: list[DrugItem]
