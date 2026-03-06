"""
ADHD 지식베이스 문서 정의 및 ChromaDB 인덱싱.
실행: python -m app.services.knowledge.adhd_docs
"""

from __future__ import annotations

ADHD_DOCUMENTS: list[dict] = [
    {
        "id": "adhd-med-001",
        "title": "메틸페니데이트(콘서타/리탈린) 복약 안내",
        "source": "대한소아청소년정신의학회",
        "url": "https://www.kacap.or.kr",
        "content": (
            "메틸페니데이트는 ADHD 치료에 가장 널리 사용되는 중추신경자극제입니다. "
            "콘서타(서방형)는 아침 식사 후 1회 복용하며, 오후 늦게 복용하면 수면 장애를 유발할 수 있습니다. "
            "리탈린(속방형)은 하루 2~3회 복용하며 식사와 함께 복용하면 위장 불편감을 줄일 수 있습니다. "
            "복용 중 식욕 감소, 두통, 수면 어려움이 나타날 수 있으며 지속 시 의료진과 상담하세요. "
            "갑자기 복용을 중단하면 안 되며, 반드시 의료진 지도 하에 용량을 조절해야 합니다."
        ),
    },
    {
        "id": "adhd-med-002",
        "title": "아토목세틴(스트라테라) 복약 안내",
        "source": "식품의약품안전처",
        "url": "https://www.mfds.go.kr",
        "content": (
            "아토목세틴은 비자극제 ADHD 치료제로, 효과가 나타나기까지 4~8주가 소요됩니다. "
            "하루 1~2회 복용하며 식사와 함께 복용하면 구역감을 줄일 수 있습니다. "
            "초기에 졸음, 식욕 감소, 복통이 나타날 수 있으나 대부분 시간이 지나면 호전됩니다. "
            "자살 충동 등 기분 변화가 나타나면 즉시 의료진에게 알려야 합니다. "
            "간 기능 이상 징후(황달, 복통, 짙은 소변)가 나타나면 즉시 복용을 중단하고 진료를 받으세요."
        ),
    },
    {
        "id": "adhd-med-003",
        "title": "ADHD 약물과 카페인 상호작용",
        "source": "대한신경정신의학회",
        "url": "https://www.knpa.or.kr",
        "content": (
            "메틸페니데이트 복용 중 카페인(커피, 에너지음료, 녹차)을 과다 섭취하면 "
            "심박수 증가, 불안, 불면증이 악화될 수 있습니다. "
            "하루 카페인 섭취량을 200mg 이하(커피 1~2잔)로 제한하는 것을 권장합니다. "
            "에너지음료는 카페인 함량이 높아 ADHD 약물 복용 중 피하는 것이 좋습니다."
        ),
    },
    {
        "id": "adhd-med-004",
        "title": "ADHD 약물과 음주 상호작용",
        "source": "대한신경정신의학회",
        "url": "https://www.knpa.or.kr",
        "content": (
            "ADHD 치료제 복용 중 음주는 약물 효과를 저하시키고 부작용을 증가시킵니다. "
            "알코올은 중추신경계에 영향을 주어 집중력 저하, 충동성 증가를 유발합니다. "
            "메틸페니데이트와 알코올을 함께 섭취하면 심혈관계 부담이 증가할 수 있습니다. "
            "ADHD 치료 중에는 금주 또는 최소한의 음주를 권장합니다."
        ),
    },
    {
        "id": "adhd-sleep-001",
        "title": "ADHD 환자의 수면 관리",
        "source": "대한수면학회",
        "url": "https://www.sleepmed.or.kr",
        "content": (
            "ADHD 환자의 약 70%가 수면 문제를 경험합니다. "
            "취침 시간을 일정하게 유지하고 기상 시간도 주말 포함 일정하게 유지하세요. "
            "취침 1시간 전 스마트폰, TV 등 블루라이트 기기 사용을 중단하세요. "
            "메틸페니데이트는 오후 3시 이후 복용을 피해 수면 방해를 최소화하세요. "
            "수면 시간은 성인 기준 7~9시간, 소아청소년은 9~11시간을 목표로 합니다. "
            "낮잠은 30분 이내로 제한하고 오후 3시 이후에는 피하세요."
        ),
    },
    {
        "id": "adhd-sleep-002",
        "title": "ADHD와 수면 위상 지연 증후군",
        "source": "대한수면학회",
        "url": "https://www.sleepmed.or.kr",
        "content": (
            "ADHD 환자는 수면 위상 지연(늦게 자고 늦게 일어나는 패턴)이 흔합니다. "
            "아침 햇빛 노출은 생체리듬 교정에 효과적입니다. 기상 후 30분 내 햇빛을 쬐세요. "
            "저녁 시간 밝은 조명을 줄이고 취침 환경을 어둡고 서늘하게 유지하세요. "
            "멜라토닌 보충제는 의료진 상담 후 사용하세요."
        ),
    },
    {
        "id": "adhd-exercise-001",
        "title": "ADHD 환자의 운동 효과와 권장 사항",
        "source": "대한스포츠의학회",
        "url": "https://www.sportsmed.or.kr",
        "content": (
            "규칙적인 유산소 운동은 ADHD 증상(집중력, 충동성, 과잉행동)을 유의미하게 개선합니다. "
            "주 3~5회, 회당 30~60분의 중강도 유산소 운동(빠른 걷기, 자전거, 수영)을 권장합니다. "
            "운동은 도파민과 노르에피네프린 분비를 촉진해 ADHD 약물과 유사한 효과를 냅니다. "
            "아침 운동은 하루 집중력 향상에 특히 효과적입니다. "
            "고강도 인터벌 트레이닝(HIIT)도 ADHD 증상 개선에 효과적인 것으로 보고됩니다."
        ),
    },
    {
        "id": "adhd-nutrition-001",
        "title": "ADHD 환자의 영양 관리",
        "source": "대한영양사협회",
        "url": "https://www.dietitian.or.kr",
        "content": (
            "오메가-3 지방산(등푸른 생선, 아마씨, 호두)은 ADHD 증상 완화에 도움이 됩니다. "
            "단백질이 풍부한 아침 식사는 집중력 유지에 중요합니다(달걀, 두부, 닭가슴살). "
            "정제 탄수화물과 설탕 과다 섭취는 혈당 급등락으로 집중력을 저하시킬 수 있습니다. "
            "철분, 아연, 마그네슘 결핍은 ADHD 증상을 악화시킬 수 있으므로 균형 잡힌 식사가 중요합니다. "
            "메틸페니데이트 복용으로 식욕이 감소할 수 있으므로 약효가 줄어드는 저녁에 충분히 섭취하세요."
        ),
    },
    {
        "id": "adhd-nutrition-002",
        "title": "ADHD 약물 복용 중 식욕 저하 관리",
        "source": "대한영양사협회",
        "url": "https://www.dietitian.or.kr",
        "content": (
            "메틸페니데이트 복용 중 식욕 저하는 흔한 부작용입니다. "
            "약 복용 전 아침 식사를 충분히 하고, 약효가 줄어드는 저녁에 영양가 있는 식사를 하세요. "
            "소량씩 자주 먹는 방식(하루 5~6회 소식)이 도움이 됩니다. "
            "고칼로리 고영양 간식(견과류, 아보카도, 치즈)을 활용하세요. "
            "체중이 지속적으로 감소하면 의료진과 상담하세요."
        ),
    },
    {
        "id": "adhd-lifestyle-001",
        "title": "ADHD 환자의 디지털 기기 사용 관리",
        "source": "대한소아청소년정신의학회",
        "url": "https://www.kacap.or.kr",
        "content": (
            "ADHD 환자는 스마트폰, 게임 등 디지털 자극에 과몰입하기 쉽습니다. "
            "하루 스마트폰 사용 시간을 2시간 이내로 제한하는 것을 권장합니다. "
            "집중이 필요한 작업 시 방해금지 모드나 앱 차단 도구를 활용하세요. "
            "취침 1시간 전 모든 스크린 사용을 중단하세요. "
            "포모도로 기법(25분 집중 + 5분 휴식)이 ADHD 환자의 집중력 유지에 효과적입니다."
        ),
    },
    {
        "id": "adhd-lifestyle-002",
        "title": "ADHD 환자의 일상 루틴 관리",
        "source": "대한소아청소년정신의학회",
        "url": "https://www.kacap.or.kr",
        "content": (
            "규칙적인 일과 루틴은 ADHD 증상 관리에 핵심적입니다. "
            "매일 같은 시간에 기상, 식사, 복약, 취침하는 습관을 만드세요. "
            "할 일 목록(To-do list)과 알림 기능을 적극 활용하세요. "
            "큰 과제는 작은 단계로 나누어 하나씩 완료하는 방식이 효과적입니다. "
            "복약 알림을 설정해 복약을 빠뜨리지 않도록 하세요."
        ),
    },
    {
        "id": "adhd-sideeffect-001",
        "title": "ADHD 약물 주요 부작용과 대처법",
        "source": "식품의약품안전처",
        "url": "https://www.mfds.go.kr",
        "content": (
            "메틸페니데이트의 주요 부작용: 식욕 감소, 수면 장애, 두통, 복통, 심박수 증가. "
            "아토목세틴의 주요 부작용: 구역감, 졸음, 식욕 감소, 기분 변화. "
            "식욕 감소: 약 복용 전 식사, 저녁에 충분한 영양 섭취로 대처. "
            "수면 장애: 복용 시간을 앞당기거나 의료진과 용량 조절 상담. "
            "두통/복통: 대부분 초기에만 나타나며 지속 시 의료진 상담. "
            "심박수 증가나 흉통이 나타나면 즉시 의료진에게 알리세요."
        ),
    },
    {
        "id": "adhd-sideeffect-002",
        "title": "ADHD 약물 복용 중 위험 징후",
        "source": "식품의약품안전처",
        "url": "https://www.mfds.go.kr",
        "content": (
            "다음 증상이 나타나면 즉시 복용을 중단하고 의료진에게 연락하세요: "
            "심한 흉통 또는 불규칙한 심박, 호흡 곤란, 실신. "
            "심한 기분 변화, 환각, 공격성 증가. "
            "아토목세틴 복용 중 황달(피부/눈 노란색), 짙은 소변, 심한 복통. "
            "발작(경련). 알레르기 반응(두드러기, 얼굴/목 부종). "
            "자살 충동이나 자해 생각이 드는 경우 즉시 정신건강 위기상담전화 1577-0199로 연락하세요."
        ),
    },
    {
        "id": "adhd-smoking-001",
        "title": "ADHD와 흡연",
        "source": "대한신경정신의학회",
        "url": "https://www.knpa.or.kr",
        "content": (
            "ADHD 환자는 일반인보다 흡연율이 높으며, 니코틴이 일시적으로 집중력을 높이기 때문입니다. "
            "그러나 흡연은 장기적으로 ADHD 증상을 악화시키고 약물 효과를 저하시킵니다. "
            "흡연은 심혈관계에 부담을 주어 ADHD 약물(특히 메틸페니데이트)의 심혈관 부작용을 증가시킵니다. "
            "금연 지원 프로그램과 ADHD 치료를 병행하면 금연 성공률이 높아집니다."
        ),
    },
    {
        "id": "adhd-general-001",
        "title": "ADHD 개요 및 치료 원칙",
        "source": "대한소아청소년정신의학회",
        "url": "https://www.kacap.or.kr",
        "content": (
            "ADHD(주의력결핍 과잉행동장애)는 주의력 부족, 과잉행동, 충동성을 특징으로 하는 신경발달장애입니다. "
            "약물치료(메틸페니데이트, 아토목세틴 등)와 행동치료를 병행하는 것이 가장 효과적입니다. "
            "ADHD는 완치 개념보다 증상 관리와 기능 향상을 목표로 합니다. "
            "규칙적인 복약, 수면, 운동, 식사 관리가 치료 효과를 극대화합니다. "
            "본 서비스는 의료진 진료를 대체하지 않으며, 반드시 담당 의료진과 상담하세요."
        ),
    },
]


async def build_index() -> None:
    """ChromaDB에 ADHD 지식 문서를 임베딩하여 인덱싱합니다."""
    import chromadb
    from openai import AsyncOpenAI

    from app.core import config

    chroma = chromadb.HttpClient(host=config.CHROMA_HOST, port=config.CHROMA_PORT)
    collection = chroma.get_or_create_collection(
        name=config.CHROMA_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )

    existing_ids = set(collection.get(include=[])["ids"])
    new_docs = [d for d in ADHD_DOCUMENTS if d["id"] not in existing_ids]
    if not new_docs:
        print("모든 문서가 이미 인덱싱되어 있습니다.")
        return

    openai = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
    texts = [d["content"] for d in new_docs]
    response = await openai.embeddings.create(model=config.OPENAI_EMBEDDING_MODEL, input=texts)
    embeddings = [e.embedding for e in response.data]

    collection.add(
        ids=[d["id"] for d in new_docs],
        embeddings=embeddings,  # type: ignore[arg-type]
        documents=texts,
        metadatas=[{"title": d["title"], "source": d["source"], "url": d["url"]} for d in new_docs],
    )
    print(f"{len(new_docs)}개 문서 인덱싱 완료.")


if __name__ == "__main__":
    import asyncio

    asyncio.run(build_index())
