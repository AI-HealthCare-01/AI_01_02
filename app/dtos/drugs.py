from pydantic import BaseModel


class DrugItem(BaseModel):
    id: str
    ingredient_name: str | None = None
    product_name: str | None = None
    side_effects: str | None = None
    precautions: str | None = None


class DrugListResponse(BaseModel):
    items: list[DrugItem]
