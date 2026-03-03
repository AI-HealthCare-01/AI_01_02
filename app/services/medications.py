from app.models.medications import Medication


class MedicationSearchService:
    async def search(self, *, q: str, limit: int = 10) -> list[Medication]:
        return await Medication.filter(name_ko__icontains=q, is_active=True).order_by("name_ko").limit(limit)
