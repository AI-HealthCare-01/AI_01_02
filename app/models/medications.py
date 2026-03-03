from tortoise import fields, models


class Medication(models.Model):
    id = fields.BigIntField(primary_key=True)
    drug_code = fields.CharField(max_length=100, unique=True)
    name_ko = fields.CharField(max_length=255)
    ingredient = fields.CharField(max_length=255, null=True)
    aliases: list = fields.JSONField(default=list)  # type: ignore[assignment]
    is_adhd_target = fields.BooleanField(default=True)
    is_active = fields.BooleanField(default=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "medications"
        indexes = (("name_ko",), ("is_active",))
