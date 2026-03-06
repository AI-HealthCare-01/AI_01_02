# ADHD Care Wireframe Guidelines

## Scope Rules

- Maintain only these core capabilities: LLM guide, real-time chatbot, OCR medical info recognition, notifications.
- Do not add or regenerate `pill image classification` or `pill identification camera` flows.
- Keep feature labels aligned with docs: `복약 안내`, `생활습관`, `주의사항`, `OCR 확인/수정`, `알림 읽음 처리`.

## API Alignment Rules

- Sign-up UI fields must include: `email`, `password`, `name`, `gender`, `birth_date`, `phone_number`.
- OCR UI must support `PDF/JPG/PNG` upload and include a user review/edit step for low-confidence fields.
- Chat UI must represent session-based conversation and streaming behavior, with crisis guardrail blocking.
- Notification UI must include: list, unread count, single read, read-all.

## UX Rules

- Mobile-first layout for OCR capture and review.
- Any D-day UI should be shown as `7 days before depletion` onward.
- Surface safety notice in guide screens: this service does not replace medical consultation.
- For uncertain OCR fields, prioritize correction flow over auto-confirm.

## Visual Rules

- Keep existing brand palette (`#20B2AA`, `#FFD166`, `#FFFCF5`, `#2D3436`).
- Keep high-contrast text and avoid dense blocks without section headers.
- Use consistent card spacing and rounded containers for task grouping.
