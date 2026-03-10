from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_user
from app.dtos.drugs import DrugItem, DrugListResponse
from app.models.users import User
from app.services.psych_drugs import PsychDrugService

drug_router = APIRouter(prefix="/drugs", tags=["drugs"])


@drug_router.get("", response_model=DrugListResponse, status_code=status.HTTP_200_OK)
async def list_drugs(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[PsychDrugService, Depends(PsychDrugService)],
    product_name: Annotated[str | None, Query(min_length=1)] = None,
) -> Response:
    items = await service.search_by_product_name(product_name=product_name)
    return Response(
        DrugListResponse(
            items=[
                DrugItem(
                    id=str(item.id),
                    ingredient_name=item.ingredient_name,
                    product_name=item.product_name,
                    side_effects=item.side_effects,
                    precautions=item.precautions,
                )
                for item in items
            ]
        ).model_dump(),
        status_code=status.HTTP_200_OK,
    )
