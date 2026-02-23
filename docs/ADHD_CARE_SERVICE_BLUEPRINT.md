# 사용자

### 주 타겟

ADHD약을 복용중인 환자

### 사용자 시나리오

ADHD 약을 복용 중인 환자가 약물 관리 및 생활습관 관리를 위해서 웹에 자신의 정보를 입력해서 가입후

처방받은 약의 처방전 사진을 웹에 올림 웹은 사용자의 정보와 약의 정보를 저장 및 분석하여 구조화된 출력방식으로 가이드를 제공함 (사용자의 정보와 약 정보를 바탕으로 정해진 기준에 맞춰서 웹이 가이드를 정함)

웹은 약이 떨어지기 일주일 전부터 D-day 방식으로 약 소진을 안내함

# 목표

ADHD 환자의 일상 기록을 **데이터 기반의 건강 지표로 분석**하여, 꾸준한 약 복용과 부작용 관리를 돕습니다. 나아가 스스로 발견하기 어려운 **생활 패턴의 문제를 AI로 교정**하고 맞춤형 지침을 제공하여, 건강하고 규칙적인 일상을 되찾아 주는 것이 목표입니다.

# LLM 기반 안내 가이드

# 개인별 건강 상태 반영 기능 포함 사용자 진료 기록 및 복약 정보를 기반으로  맞춤형 복약/생활습관 가이드를 자동 생성

사용자가 입력한 신체 정보, 생활 습관, ADHD 증상 특성, 처방 약물 정보를 통합하여

LLM 기반으로 **개인 맞춤형 복약 안내 및 실행 가능한 행동 단위 생활습관 가이드**를 자동 생성한다.

### **사용자 입력 및 OCR 연동 프로세스 (Service Flow)**

 [데이터 수집] → [데이터 정제] → [AI 분석] → [결과 제공]

### **Step 1: 환자 정보 입력 (Frontend)**

- **설문 UI**: 사용자가 자신의 상태를 입력함
    - 기본 정보: 키, 몸무게, 나이
    - 생활 습관: "하루에 8시간 앉아서 근무", "주 2회 축구"
    - 기저 질환, 수술이력
    - 수면 패턴 (평균 기상시간/취침 시간)
    - 불편 사항 체크리스트 : 아침에 일어나는것이 힘들다 (아침 기상알람)

[ADHD 체크 리스트](https://www.notion.so/ADHD-30fcaf5650aa805c869df1cd5a88d463?pvs=21)

### **Step 1-1: 사용자 프로필 구조화**

- 사용자가 입력한 정보와 불편 사항 체크리스트등의 정보를 하나의 객체로 만듬

### **Step 2: 처방전, 진료기록 입력**

- **카메라 호출**: 처방전이나 약봉투를 찍을 수 있는 인터페이스를 제공

### **Step 3: OCR 및 데이터 정형화 (Backend & LLM)**

- **텍스트 추출**: OCR이 사진(진료기록, 처방전)속 글자를 읽어옴
- LLM모델 예시 : Gemini 3 Pro , **Gemini 3 Flash**
- LLM에게
    - OCR 텍스트에서 약 이름, 하루 복용 횟수, 1회 복용 갯수 및 복용량,조제 일자를 JSON 형식으로 추출해줘
    - 인식 실패하면 사용자에게 “처방전을 다시 찍어주세요”라고 안내

### **Step 3-1: 데이터 신뢰도를 확인후 지정된 임계값보다 낮을 경우 사용자에게 직접 수정 요구**

1. API 응답 데이터에서 신뢰도 추출

2. 데이터 정제 단계에서 임계값을 설정해 조건문을 작성

- 데이터의 중요도에 따라서 임계값 설정 (높게 : 약물명>용량> 복용횟수, 복용일자)
- 추출된 필드의 신뢰도 평균값이 설정한 임계값보다 낮으면 사용자에게 데이터 수정을 요구함

        - 안내문구 “정보를 정확히 읽지 못하였습니다. 다음 정보가 맞는지 확인해주세요”

     or 의약품 사전등의 데이터 베이스를 불러와서 가장 유사한 이름의 약물을 추천 리스트로 보여줌

### **Step 3-2: 사용자 정보 최종 확인 및 수정**

- 진료기록이나 처방전 속 데이터를 사용자에게 보여주고 확인을 클릭하면 다음 단계로 넘어감
- 만약 데이터가 틀리다면 정보 수정을 직접 가능하도록

### **Step 3-3 : OCR 데이터 정제**

- 이미지에서 읽어온 비정형 텍스트를 약물명, 용량, 횟수 등의 필드로 나눔
- **LLM 정제**: OCR로 읽은 텍스트는 오타가 많고 비정형 → LLM에게 보내 정형 데이터(JSON)로 바꿈

### **Step 4: 개인별 컨텍스트 결합 (Context Augmentation)**

- 사용자가 입력한 신체 정보(키, 몸무게)와 생활 습관(운동량, 앉아있는 시간)을 위에서 정제된 약물 정보와 병합
- **데이터 결합**: [환자 입력 정보] + [정제된 처방 정보]를 합침

### **Step 5: RAG(검색 증강 생성) 기반 지식 연동**

- **Vector DB 구축**: 약물 백과사전, 질병별 식단/운동 가이드라인 PDF를 벡터화하여 저장합니다.
- **지식 참조 (RAG)**: 데이터베이스 에 저장된 의학 지식(예: "A 약물은 위 점막을 자극함")을 검색합니다.
- **프로세스**:
    1. 사용자의 질문/상태가 입력됨
    2. 질문과 관련된 의학 가이드라인을 Vector DB에서 검색
    3. 검색된 "전문 지식" + "사용자 정보" + "처방 정보"를 LLM에게 전달하여 가이드 생성

[vector DB에 들어갈 내용(약) (2)](https://www.notion.so/vector-DB-2-30fcaf5650aa8002b3bbc49d4d5ead46?pvs=21)

### **Step 5-1: 사용자와 약물 사이의 상관관계 파악**

- **불편 사항 분석**: 사용자가 호소한 '속쓰림'이나 '기상 어려움'이 현재 처방받은 약의 부작용인지, 혹은 생활 습관(커피 섭취 등) 때문인지를 논리적으로 연결합니다.
- **활동 위험도 평가**: 사용자의 활동(예: 운전)와 약물의 특성(예: 근이완제 또는 졸음 유발)을 대조하여 주의가 필요한 활동을 식별합니다.

### **Step 5-2: 역할 부여, 제약 조건 적용, 추합 및 생성**

- **할 부여**: 시스템은 AI에게 "너는 약사이자 퍼스널 트레이너"라는 정체성을 부여합니다.
- **제약 조건 적용**: "의학적 근거가 없는 말은 하지 말 것", "환자의 생활 습관에 맞춰 시간을 제안할 것" , ”정확한 약 복용 안내는 의사와 상담이 필요함을 안내” 등의 규칙을 적용합니다.
- **추합 및 생성**: 사용자의 '기상 어려움'을 해결하기 위해 약 복용 시간을 배치하고, '속쓰림'을 줄이기 위한 식단 가이드를 논리적으로 엮어서 답변을 생성합니다.

### **Step 6: 맞춤형 가이드 생성 엔진 (Prompt Engineering)**

- 맞춤형 가이드는 **'복약 안내'**와 **'생활 습관'** , 마지막 **주의사항**으로 안내
- 생성된 가이드 대화를 저장해서 이후에도 챗봇이 기억할수있도록함

*응답포맷*

**복약 안내** 

- 현재 처방 약물 요약
- 복용 시간 권장안
- 식사와의 관계
- 카페인/알코올 상호작용
- 복용 누락 시 대처법

**생활 습관**

- 집중 블록 설계
- 스마트폰 자극 차단
- 운동 전략
- 수면 리듬 교정
- 식사 패턴 보완

**주의사항** 

- 주요 부작용 경고
- 악화 신호
- 즉시 진료 필요 상황
- 임의 증량 금지

### **Step 7:  서비스 인터페이스 및 알림 (UI/UX)**

생성된 가이드를 사용자에게 효과적으로 전달합니다.

- **가이드 카드**: 텍스트 위주가 아닌, 카드 뉴스 형태나 아이콘을 활용한 UI로 가독성을 높입니다.
- **실시간 챗봇 연동**: 가이드를 보다가 궁금한 점(예: "이 약 먹고 커피 마셔도 돼?")을 바로 물어볼 수 있도록 대화창을 유지합니다. 이때 이전 대화 맥락(Memory)을 유지하여 연속성 있는 답변을 제공합니다.

# 데이터 구조화

## <기본 프로필 (바뀌지 않는 정보)>

- **email** : ""   str
- **name** : “”  str
- **nickname** : “”  str
- **age** (나이) int
- **sex : “male | female**“ Enum
- **phone_number** :   str

## <입력 스키마>

**`basic_info`**

- **height_cm** float
- **weight_kg** float

**`medical_history`**

- **underlying_diseases**: 기저질환  array
- **psychiatric_diseases**: 정신과적 질환 array
- **surgical_history**: 수술이력 array
- **drug_allergies**: 약 알러지 array

**`lifestyle`**

**<exercise_hours>**

- **low_intensity**: 저강도 운동을 일주일 동안 몇시간 하는지 int
- **moderate_intensity** : 중강도 운동을 일주일 동안 몇시간 하는지 int
- **high_intensity**: 고강도 운동을 일주일 동안 몇시간 하는지 int

     → 저 ,중,고강도 운동별로 각각 가중치를 주고 총합으로 기준 잡아서 그 이하시 운동 가이드 

**<digital_usage>**

- **pc_hours_per_day** : 하루에 컴퓨터 하는 시간  int
- **smartphone_hours_per_day** : 하루에 핸드폰 하는 시간 int

      → 자극 과다로 집중 방해 요인 제거 전략

**<substance_usage>**

- **caffeine_cups_per_day:** 하루에 커피를 몇잔 마시는지 **** int
- **smoking:** 하루에 몇 개피 피는지 (비흡연자는 0)  **** int

       → 커피와 담배는 중추신경흥분제로 약과 함께 복용시 악화

- **alcohol_frequency_per_week**  : 일주일에 술을 몇번 먹는지 int

       → 술은 중추신경억제제, 수면 질의 저하 및 ADHD는 알콜중독이 될확률이 높음

**`sleep_input`**

- **bed_time**:  잠이 드는 시간 “HH:MM”   str
- **wake_time**:  일어나는 시간 “HH:MM”   str
- **sleep_latency_minutes** : 잠이 들기까지 걸리기까지 몇분 걸리는지 int
- **night_awakenings_per_week**: 일주일 동안 잠자는 중에 중간에 깨는 횟수 int
- **daytime_sleepiness** (0~10점사이) : 낮에 얼마나 졸린지  int (0~10 사이)
    
    0  = 전혀 졸리지 않음
    3  = 약간 졸림 (가끔 집중 저하 느낌)
    5  = 중등도 졸림 (오후 집중 유지 어려움)
    7  = 심한 졸림 (업무 효율 현저히 감소)
    10 = 매우 심함 (활동 유지 어려움, 반복적으로 졸음)
    

 

**`nutrition_status`**

- **appetite_level** (0~10점 사이) : 식욕 정도   int (0~10 사이)
- **meal_regular** : 식사 시간이 규칙적인지 “True or False” Enum

**`check_list`** : 

**`ocr_result`**

- **raw_text** : 사진에서 읽어낸 텍스트 전체 “ ” str
- **extracted_medications**
    - **drug_name** : 약의 이름 str
    - **dose** : 약의 용량 float
    - **frequency_per_day** : 하루 복용 횟수 int
    - **dosage_per_once** : 1회 복용 갯수 int
    - **intake_time** : 복용시점  Enum
        
        아침 | 점심 | 저녁 | 자기전 | 필요시
        
        “ **morning | lunch | dinner | bedtime | PRN** “
        
        → 하루 1번(아침),하루 2번(아침,저녁), 하루 3번(아침,점심,저녁)
        
    - **administration_timing** :  투여 시점  ****Enum
        
         직전 | 30분 전 | 직후 | 30분 후 
        
        **“before meals | 30 minutes before meals | after meals | 30 minutes after meals”** 
        
    - **dispensed_date** : "YYYY-MM-DD” str
    - **total_days** : 총 처방일 int

```python
{
  "basic_info": {
    "height_cm": 0,
    "weight_kg": 0
  },
  
  "medical_history": {
    "underlying_diseases": [],
    "psychiatric_diseases": [],
    "surgical_history": [],
    "drug_allergies": []
  },

  "lifestyle_input": {
    "exercise_hours": {
      "low_intensity": 0,
      "moderate_intensity": 0,
      "high_intensity": 0
    },
    "digital_usage": {
      "pc_hours_per_day": 0,
      "smartphone_hours_per_day": 0
    },
    "substance_usage": {
      "caffeine_cups_per_day": 0,
      "smoking": 0,
      "alcohol_frequency_per_week": 0
    }
  },

  "sleep_input": {
    "bed_time": "HH:MM",
    "wake_time": "HH:MM",
    "sleep_latency_minutes": 0,
    "night_awakenings_per_week": 0,
    "daytime_sleepiness_score": 0 
  },

  "nutrition_input": {
    "appetite_score": 0,
    "is_meal_regular": true
  },

  "ocr_result": {
    "raw_text": "",
    "extracted_medications": [
      {
        "drug_name": "",
        "frequency_per_day": 0,
        "dosage_per_once": 0,
        "dispensed_date": "YYYY-MM-DD"
      }
    ]
  }
}
```

## <출력 스키마>

**`basic_info`**

- **age** (나이) int
- **sex :** male | female
- **height_cm** int
- **weight_kg** int
- **BMI** (자동 계산) float

      - 저체중시 → 영양 보강 가이드

      - 과체중시 → 운동 가이드

**`lifestyle_analysis`**

- **weighted_exercise_score** : 가중치 적용 운동 점수 float

     → 입력 데이터에서 받은 저 ,중,고강도 운동별로 각각 가중치를 주고 총합으로 기준 잡아서 그 이하시 운동 가이드

→ *bmi*가 높을시 운동가이드

- **exercise_sufficiency**: 권장운동량 충족 | 권장 운동량 미달 **“sufficient | insufficient”**  Enum
- **total_digital_time** : 컴퓨터 + 핸드폰 하는 시간 int

      → 자극 과다로 집중 방해 요인 제거 전략

- **caffeine_cups_per_day:** 양호 | 보통 | 위험 **“low_risk | moderate_risk | high_risk”**  Enum
    
    → 중추신경흥분제로 약과 함께 복용시 악화
    
    → **low_risk** (0~1잔) | **moderate_risk**(2잔) | **high_risk** (3잔)
    
- **smoking** **:** 양호 | 보통 | 위험 **“low_risk | moderate_risk | high_risk”**  Enum

       → 중추신경흥분제로 약과 함께 복용시 악화

 → **low_risk** (0~4개피) | **moderate_risk**(5~10개피) | **high_risk** (11개피)

- **alcohol_frequency_per_week:** 양호 | 보통 | 위험 **“low_risk | moderate_risk | high_risk”**  Enum

       → 중추신경억제제, 수면 질의 저하 및 ADHD는 알콜중독이 될 확률이 높음

**`sleep_analysis`**

- **calculated_sleep_hours** :  수면시간 float

   → *wake_time* (일어나는 시간) - *bed_time *****(잠드는 시간) = 수면시간

   → 6시간 미만시에는 수면 가이드 제공

- **sleep_quality_status** : 수면 질 상태 “**good | fair | poor”** Enum
    
      → 아래 기준에서 1개 이상시 **fair** , 2개 이상시 **poor** 
    
    - *sleep_latency_minutes* (잠들기까지 걸리는 시간): 30분 이상
    - *night_awakenings_per_week* (자다 깨는 횟수):  5회 이상
    - *daytime_sleepiness* (주간 졸음 점수): 5점 이상

**`nutrition_analysis`**

- **nutrition_status** : 영양 상태  **“good | fair | poor”** Enum
- **malnutrition_risk** : 영양불균형 위험도 **“low | moderate | high”** Enum
    - *bmi* 가 매우 낮을 시  **“high”**
    - *bmi* 와 *appetite_level* (식욕정도)가 매우 낮을때  **“high”**
    - *bmi* 와 *appetite_level* (식욕정도)가 낮고 *meal_regular* (규칙적식사)가 False일시 **“high”**
    - *bmi 나* *appetite_level* (식욕정도)가 낮으면 **“moderate”**

**`personalized_guides (맞춤형 가이드)`**

**medication_guide (복약안내)**

- **schedule**
    - **time**: "HH:MM"
    - **drug_name_dose**: "약 이름 + 약 용량"
    - i**nstruction** : "하루 3번 식후 30분 복용"
    - **refill_reminder_days_before** : “약 떨어지기 00일전”
        
        → 현재 날짜와 조제일자를 기준으로 계산
        
    - **substance_caution** : "카페인/흡연/음주와 약물 상호작용 경고 문구"
        
        → 카페인 : 카페인은 ADHD 약물의 각성 효과를 증폭시켜 초조감, 집중력 저하, 손떨림, 수면장애를 유발할 수 있습니다. 하루 카페인 섭취량을 제한하고 증상 악화 시 의료진과 상담하십시오.
        
        → 흡연: 흡연은 중추신경계에 자극 작용을 하여 ADHD 약물의 효과 및 부작용(심박수 증가, 혈압 상승, 불안)을 변화시킬 수 있습니다. 약물 복용 중 증상 악화시 반드시 의료진과 상담하십시오.
        
        → 음주: “ADHD 약물과 함께 음주할 경우 수면장애, 집중력 저하, 불안 악화가 나타날 수 있습니다.  약물 복용 중 증상 악화시 반드시 의료진과 상담하십시오.”
        

 **health_coaching (건강 가이드)** : 사용자가 아래에 해당하는 상태일 때 가이드가 뜸

- **nutrition_guide** : "저체중 또는 식욕 저하 시 영양 보강 전략"
- **exercise_guide** : "과체중 또는 운동량 부족 시 맞춤 운동 처방"
- **concentration_strategy** : "자극 과다(스크린타임) 시 집중력 회복 전략"
- **sleep_guide** : "6시간 미만 또는 잠들기 어려움 발생 시 수면 위생 가이드"

**risk_flags (위험 징후 알림)**

- **alcohol_addiction_risk** : 알코올 중독 위험
    
    → 안내문구
    
    “현재 음주 상태는 건강에 심각한 위험을 초래할 수 있습니다. 음주 조절이 필요하며,
    
    혼자서 조절이 어렵다고 느껴질 경우 전문가의 도움을 받는 것을 권장드립니다.
    
    어지러움, 의식 저하, 극심한 불안이나 우울 증상이 동반될 경우에는 즉시 의료기관을 방문하시기 바랍니다.”
    
- **drug_allergy_Warning** : 약물 알러지 경고
    
    → 안내문구
    
    “해당 약물에는 사용자가 등록한 알레르기 반응을 유발할 수 있는 성분이 포함되어 있을 가능성이 있습니다. 복용하지 마시고, 의료기관에 즉시 연락하시기 바랍니다.
    
    호흡곤란, 두드러기, 입술·얼굴 부종 등의 증상이 나타나면 즉시 응급실을 방문하십시오.”
    
- **High_Risk_Drowsiness_Warning** : 그외 전문의 상담 필요한 경우
    - 졸음 점수가 8점 이상인 경우 or 수면 시간이 4시간 미만
        
        → 안내문구
        
        수면 시간이 충분하지 않아 일상 기능 저하가 의심됩니다.
        
        졸림, 집중력 저하, 판단력 감소가 있는 경우 운전, 기계 조작, 고위험 작업 등 사고 위험이 있는 활동을 피하고 의료진과의 상담을 권장합니다.
        
- **Malnutrition_Risk_Warning** : 과한 저체중시
    - BMI < 17.0 이하시
        
        →  현재 체질량지수(BMI)가 낮은 수준으로 확인되어 영양 부족 상태가 의심됩니다.
        
        지속될 경우 면역력 저하, 근육 감소, 피로, 집중력 저하 등의 문제가 발생할 수 있습니다.
        
        정확한 원인 평가 및 영양 상태 확인을 위해 의료진의 진료를 받으시기 바랍니다.
        

```basic
{
  "analysis_summary": {
    "basic_info": {
      "age": 0,
      "sex": "male | female | other",
      "height_cm": 0,
      "weight_kg": 0,
      "bmi": 0.0,
      "weight_status": "underweight | normal | overweight | obese"
    },
    "lifestyle_analysis": {
      "weighted_exercise_score": 0.0,
      "exercise_sufficiency": "sufficient | insufficient",
      "total_digital_time": 0,
      "caffeine_cups_per_day": 0,
      "smoking": 0,
      "alcohol_frequency_per_week": 0
    },
    "sleep_analysis": {
      "calculated_sleep_hours": 0.0,
      "sleep_quality_status": "good | fair | poor",
    }
    "nutrition_analysis": {
      "nutrition_status": "good | fair | poor",
      "malnutrition_risk": "low | moderate | high"
    },
  },

  "personalized_guides": {
    "medication_guide": {
      "schedule": [
        {
          "time": "HH:MM",
          "drug_name": "",
          "instruction": "식후 30분 복용 등"
        }
      ],
      "substance_caution": "카페인/흡연/음주와 약물 상호작용 경고 문구"
    },
    "health_coaching": {
      "nutrition_guide": "저체중 또는 식욕 저하 시 영양 보강 전략",
      "exercise_guide": "과체중 또는 운동량 부족 시 맞춤 운동 처방",
      "concentration_strategy": "자극 과다(스크린타임) 시 집중력 회복 전략",
      "sleep_guide": "6시간 미만 또는 잠들기 어려움 발생 시 수면 위생 가이드"
    }
  },

  "risk_flags": {
    "is_alcohol_addiction_risk": false,
    "is_drug_allergy_alert": false,
    "is_psychiatric_followup_needed": false
  }
}
```

### 입력을 받아서 응답 포멧을 만든다

- 사용자가 입력한 정보 중에서 우리 DB 컬럼에 저장할 핵심 정보들만 골라내어 JSON 형태로 규격화
    
    **1단계: 입력 분석 (Parsing)**
    
    사용자가 보낸 문장에서 핵심 정보를 찾아냅니다.
    
    **2단계: 설계한 스키마(틀)에 끼워 맞추기**
    
    우리가 미리 정해둔 필드(Field) 이름에 값을 채워 넣음
    
    **3단계: 최종 포맷(JSON)으로 출력**
    
    최종적으로 다른 프로그램이 가져다 쓰기 좋게 JSON 형태로 내뱉습니다.
    

### **데이터를 만든것을 어떻게  DB에 넣을지 DB 저장 방식**

1. **어떤 DB를 쓸 것인가? (DB Type)**
    - 관계형 (RDBMS) : 데이터 구조가 명확하고 관계가 중요할 때 (예: MySQL, PostgreSQL). 표(Table) 형태로 저장
    - 비 관계형 (noSQL) : 데이터 구조가 자주 바뀌거나 대용량 데이터를 빠르게 쌓아야 할 때 (예: MongoDB, Redis). JSON 같은 문서 형식
2. **저장 방식과 주기 (Ingestion Strategy)**
    - 실시간(Real-time): 데이터가 생성되자마자 즉시 DB에 반영

### 어떤 필드 , 데이터를 구조화 시킴, **입출력 스키마를 맞춤,** 응답을 구조화시킴

1. **데이터 모델링 (Schema Design)**
    - 테이블 구조: 어떤 컬럼(속성)이 필요한가? (예: 이름, 날짜 등)
    - 데이터 타입: 각 데이터는 숫자인가, 문자인가?
    - 관계(Relationship): 데이터끼리 어떻게 연결되는가? → 테이블끼리 연결되는
        
        → 아직 어떤 테이블을 만들지 생각못함
        

1. **성능과 확장성 (Efficiency)**
    - 인덱스(Index)로 특정 데이터를 빨리 찾게 설정하는게 좋아보임??

### json으로 데이터를 긁을수 있는 = 데이터를 가공하기 쉬운 형태로 확보

- 데이터를 그냥 화면에 글자로만 보여주지 말고, 나중에 다른 프로그램이나 DB에서 바로 써먹을 수 있게 JSON 규격(구조화된 필드)으로 뽑아낼 수 있게 만드는 것
- 데이터를 '이름(Key): 값(Value)'의 쌍으로 묶어서 컴퓨터가 즉시 계산이나 저장을 할 수 있는 상태로 만드는 것
- 필요한 '필드' 정의하기 → 객체(Object) 만들기 → JSON으로 변환(Serialization)하여 내보내기

### LLM 호출

- 외부 API(Gemini 등)를 사용하여 **REST API 방식**으로 호출
    
    **Request (요청)** : 우리 서버가 AI 서버에게 "누가 보내는지(API Key)", "어떤 방식으로 주는지(JSON)”를 명시한 상태로 요청
    
    → **Processing (처리)** : OpenAI의 서버가 AI 모델을 돌림
    
    → **Response (응답)** : AI 서버가 우리 서버로 답변이 담긴 JSON 상자를 돌려줌
    
    → **Parsing (가공)** : 우리 서버는 필요한 내용만 뽑아내어 사용자의 화면에 보여주거나 DB에 넣음
    

### 프롬프트 호출 방식

- 호출 방식은 입출력 스키마를 맞추기 위해서 중요함

**기술적 방식**

**:** 우리 서버가 AI 서버에 프롬프트를 어떤 '통로'로 전달하느냐 (전달 메커니즘)

- **SDK (Software Development Kit)**
    - 복잡한 작업의 자동화**:** 인증(API Key 적용), 데이터 형식 변환(JSON 만들기), 오류 발생 시 재시도 등을 SDK가 알아서 다 해줌
    - 안정적이고 코드가 줄어듬

**설계적 방식**

**:** AI가 원하는 답을 내놓도록 프롬프트를 어떤 '전략'으로 구성하느냐 (프롬프트 엔지니어링 전략)

**1.  퓨샷(Few-shot) 호출 방식 [예시 제공]**

- AI가 감을 잡도록 ****2~3개의 예시를 프롬프트에 포함해 호출하는 방식
    
    

**2. 시스템/ 유저/ 어시스턴트 역할 분리 방식 [역할 분리]**

- **System Prompt:** AI의 페르소나와 규칙을 정함
- (예: "너는 사용자의 건강 관리사야. 모든 응답은 반드시 JSON 필드 ___, ____ 을 포함해야 해.")
- (ADHD환자가 너에게 질문을 할꺼야 ___ , ___ , 질문 외에 질문에는  “” 이런 식으로 말해줘
- 그리고 항상 마지막에는 의료진과 상담을 해야 정확하다라는 문구를 해줘)
- **User Prompt:** 사용자가 실제로 입력한 데이터
- **Assistant Prompt:** 이전 대화 내용을 기록해 대화의 맥락을 유지함

**3. 구조화된 출력 호출 방식 [구조 강제]**

가장 중요한 부분입니다. AI가 소설을 쓰는 게 아니라 **우리 DB에 들어갈 데이터**를 뱉게 만드는 방식

- **JSON Mode 호출:** 호출 시 옵션에 "json_object"를 설정하면, AI가 무조건 JSON 형식으로만 대답합니다.
- **스키마 강제(Schema Constraints):** 프롬프트 끝에 "응답은 반드시 다음 스키마를 따라야 함: `{ "food": string, "amount": number }`"라고 못박는 방식입니다.