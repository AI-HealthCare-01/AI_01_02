from app.models.psych_drugs import PsychDrug


class PsychDrugService:
    async def search_by_product_name(self, *, product_name: str | None = None) -> list[PsychDrug]:
        query = PsychDrug.all()
        if not product_name:
            return await query.order_by("product_name")

        exact = await PsychDrug.filter(product_name__iexact=product_name).order_by("product_name")
        if exact:
            return exact

        return await PsychDrug.filter(product_name__icontains=product_name).order_by("product_name")

    async def find_best_match(self, *, product_name: str) -> PsychDrug | None:
        if not product_name:
            return None
        return (
            await PsychDrug.filter(product_name__icontains=product_name)
            .order_by("product_name")
            .first()
        )
