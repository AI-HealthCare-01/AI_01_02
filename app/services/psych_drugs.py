import re
from difflib import SequenceMatcher

from app.models.psych_drugs import PsychDrug


def _normalize(text: str) -> str:
    return "".join(ch for ch in text.lower() if not ch.isspace())


_CHOSUNG = [
    "ㄱ",
    "ㄲ",
    "ㄴ",
    "ㄷ",
    "ㄸ",
    "ㄹ",
    "ㅁ",
    "ㅂ",
    "ㅃ",
    "ㅅ",
    "ㅆ",
    "ㅇ",
    "ㅈ",
    "ㅉ",
    "ㅊ",
    "ㅋ",
    "ㅌ",
    "ㅍ",
    "ㅎ",
]


def _initials(text: str) -> str:
    result = []
    for ch in text:
        code = ord(ch)
        if 0xAC00 <= code <= 0xD7A3:
            index = (code - 0xAC00) // 588
            result.append(_CHOSUNG[index])
        elif ch.isalnum():
            result.append(ch.lower())
    return "".join(result)


def _edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        cur = [i]
        for j, cb in enumerate(b, start=1):
            cost = 0 if ca == cb else 1
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost))
        prev = cur
    return prev[-1]


def _similarity(a: str, b: str) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    ratio = SequenceMatcher(None, a, b).ratio()
    dist = _edit_distance(a, b)
    max_len = max(len(a), len(b))
    typo_score = 1.0 - (dist / max_len) if max_len else 0.0
    return max(ratio, typo_score)


class PsychDrugService:
    _MATCH_CACHE_MAX_SIZE = 512
    _match_cache: dict[str, PsychDrug | None] = {}

    @staticmethod
    def _strip_dose_from_name(name: str) -> str:
        cleaned = re.sub(r"\(\s*\d+(?:\.\d+)?\s*mg\s*\)", "", name, flags=re.IGNORECASE)
        cleaned = re.sub(r"\d+(?:\.\d+)?\s*mg\b", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned

    async def search_by_product_name(self, *, product_name: str | None = None) -> list[PsychDrug]:
        query = PsychDrug.all()
        if not product_name:
            return await query.order_by("product_name")

        exact = await PsychDrug.filter(product_name__iexact=product_name).order_by("product_name")
        if exact:
            return exact

        # dose가 포함된 이름(예: "졸로푸트정100mg")에서 dose 제거 후 재검색
        cleaned_name = self._strip_dose_from_name(product_name)
        search_names = [product_name]
        if cleaned_name and cleaned_name.lower() != product_name.lower():
            search_names.append(cleaned_name)

        candidates: list[PsychDrug] = []
        seen_ids: set[int] = set()
        for name in search_names:
            for c in await PsychDrug.filter(product_name__icontains=name):
                if c.id not in seen_ids:
                    seen_ids.add(c.id)
                    candidates.append(c)
        if not candidates:
            return []

        qn = _normalize(product_name)
        qi = _initials(product_name)

        def score(item: PsychDrug) -> tuple[int, float, int, str]:
            name = item.product_name or ""
            nn = _normalize(name)
            ni = _initials(name)
            prefix_bonus = 1 if nn.startswith(qn) else 0
            initial_prefix_bonus = 1 if qi and ni.startswith(qi) else 0
            sim = _similarity(qn, nn)
            initial_sim = _similarity(qi, ni) if qi and ni else 0.0
            combined_sim = max(sim, initial_sim)
            length_gap = abs(len(nn) - len(qn))
            # Sort by: exact/prefix, 초성 prefix, higher similarity, shorter length gap, name
            return (-prefix_bonus, -initial_prefix_bonus, -combined_sim, length_gap, name)

        return sorted(candidates, key=score)

    @staticmethod
    def format_dose(dose_mg: float) -> str:
        if dose_mg.is_integer():
            return str(int(dose_mg))
        return str(dose_mg).rstrip("0").rstrip(".")

    async def find_best_match(self, *, product_name: str, dose_mg: float | None = None) -> PsychDrug | None:
        if not product_name:
            return None
        cache_key = f"{product_name}::{dose_mg}"
        if cache_key in self._match_cache:
            return self._match_cache[cache_key]
        if len(self._match_cache) >= self._MATCH_CACHE_MAX_SIZE:
            self._match_cache.clear()
        cleaned_name = self._strip_dose_from_name(product_name)
        query_names: list[str] = [product_name]
        if cleaned_name and cleaned_name.lower() != product_name.lower():
            query_names.append(cleaned_name)

        for query_name in query_names:
            exact = await PsychDrug.filter(product_name__iexact=query_name).first()
            if exact:
                self._match_cache[cache_key] = exact
                return exact

            contains = await PsychDrug.filter(product_name__icontains=query_name).order_by("product_name").first()
            if contains:
                self._match_cache[cache_key] = contains
                return contains

        if dose_mg is None:
            self._match_cache[cache_key] = None
            return None

        dose_str = self.format_dose(dose_mg)
        for query_name in query_names:
            dose_contains = (
                await PsychDrug.filter(product_name__icontains=f"{query_name}{dose_str}mg")
                .order_by("product_name")
                .first()
            )
            if dose_contains:
                self._match_cache[cache_key] = dose_contains
                return dose_contains
        self._match_cache[cache_key] = None
        return None
