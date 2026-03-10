from tortoise import fields, models


class PsychDrug(models.Model):
    id = fields.BigIntField(primary_key=True)
    ingredient_name = fields.CharField(max_length=255, null=True)
    product_name = fields.CharField(max_length=255, null=True)
    side_effects = fields.TextField(null=True)
    precautions = fields.TextField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "psych_drugs"
        indexes = (("product_name",), ("ingredient_name",))
