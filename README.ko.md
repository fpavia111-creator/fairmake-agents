# Fairmake 제조업 에이전트

*Claude가 번역했으며 원어민 검토는 아직 이루어지지 않았습니다. 영어 [README](README.md)가 우선합니다.*

중소 제조업체와 유통업체의 백오피스를 위한 30개의 작은 MCP 에이전트입니다. 각 에이전트는 작업지시별 표준원가 대비 실제원가, 구매가격차이, 순환 실사 차이, 소매 거래처 공제처럼 **한 가지 일**만 맡으며 그 밖의 일은 할 수 없습니다. NetSuite, SAP Business One, Epicor, Infor, Acumatica, Fishbowl, JobBOSS, Katana, MRPeasy, QuickBooks Enterprise, MES·CMMS·품질 시스템, EDI 850·810·856에서 이미 내보내는 파일을 읽고, 보고서를 사용자의 컴퓨터에 쓰며, 돈을 옮기거나 메시지를 보내거나 운영 중인 시스템을 바꾸기 전에는 이름이 지정된 담당자를 기다립니다.

Mythos Machines의 Fair Agents에 속합니다. MIT 라이선스 · Node 20 이상 · 로컬 파일만 · 자격 증명 불필요 · 의존성 없음. 소프트웨어는 무료이며, 비용은 고객 파일에 맞춘 고정가 설정에만 듭니다.

## 사용해 보기

```bash
npx -y fairmake-cost-variance demo         # 작업지시별 표준원가 대비 실제원가 (가상 데이터)
npx -y fairmake-retailer-deductions demo   # 소매 거래처 공제를 출하 기록과 대조
```

각 에이전트에는 가상 파일로 실행되는 `demo`, 자체 테스트 케이스가 있는 `eval`, MCP 서버(`npx -y <agent> mcp --root <folder>`)가 있습니다.

## 에이전트

**원가와 마진 (7):** `fairmake-cost-variance`(작업지시별 표준원가 대비 실제원가), `fairmake-purchase-price-variance`(구매가격차이), `fairmake-bom-cost-rollup`(BOM 원가 롤업), `fairmake-overhead-absorption`(제조간접비 배부), `fairmake-wip-aging`(재공품 경과일), `fairmake-job-margins`(견적 대비 실제 작업 마진), `fairmake-landed-cost`(매입운임·관세·통관비).

**생산과 엔지니어링 (6):** `fairmake-bom-routing-gaps`(BOM 및 라우팅 완전성), `fairmake-scrap-yield`(표준 대비 불량), `fairmake-labor-efficiency`(작업장별 노동 효율), `fairmake-machine-downtime`(MES 데이터의 가동률·MTTR·MTBF), `fairmake-capacity-load`(주별 부하), `fairmake-preventive-maintenance`(기한이 지난 예방 정비).

**재고와 추적성 (5):** `fairmake-cycle-counts`(ABC 등급별 실사 차이), `fairmake-obsolete-inventory`(저회전·진부화 재고), `fairmake-shelf-life`(유통기한과 선만료 선출), `fairmake-reorder-points`(안전재고와 재주문점), `fairmake-lot-traceability`(로트 추적의 끊김).

**구매와 공급업체 (4):** `fairmake-late-purchase-orders`(미입고·지연 발주), `fairmake-supplier-scorecards`(공급업체 평가), `fairmake-rebate-claims`(리베이트와 가격 계약), `fairmake-material-certs`(자재 성적서와 자사 사양 대조).

**고객·EDI·소매 규정 (4):** `fairmake-order-backlog`(수주잔고와 약속일), `fairmake-retailer-deductions`(공제와 차지백), `fairmake-edi-asn-errors`(사전 출하 통지와 주문·출하 대조), `fairmake-edi-invoice-check`(송장과 고객 주문 대조).

**품질·안전·무역 (4):** `fairmake-calibration-due`(교정 만기), `fairmake-ncr-capa-aging`(부적합과 시정조치), `fairmake-osha-300-log`(산업재해 기록 완전성), `fairmake-hts-codes`(관세 코드 일관성).

## 안전 장치

- **에이전트마다 한 가지 일.** 다른 도구 이름은 모두 차단됩니다.
- **구속력 있는 작업은 저절로 일어나지 않습니다.** ERP 전기, 지급, 출하, 표준·계획 변경, 보류 해제, EDI 전송, 기관 신고, 메시지 발송을 하지 않습니다. 초안에는 DRAFT 표시가 붙고, 승인에는 Auto 모드에서도 항상 이름이 지정된 담당자의 클릭이 필요합니다.
- **개인 데이터 마스킹.** 직원 이름은 AI 모델에 `A.R.#3f9a2c` 같은 토큰으로 전달되며, 컴퓨터의 파일에는 실제 값이 남습니다.
- **로컬 파일만** 사용하고 네트워크 통신이 없으며, `.fairmake/`에 해시 체인 감사 로그가 남습니다.
- **규칙은 고객의 것.** 허용 오차, 목표, 기한, 벌금, 사양, 코드 목록은 고객의 설정 파일에 있습니다.

## 테스트

794개의 테스트와 608개의 평가 케이스가 Windows·Node 24에서 통과하며, 악의적 입력 테스트에서는 문제가 발견되지 않았습니다. 자세한 내용은 [REVIEW-ver1.md](REVIEW-ver1.md)를 참고하세요.

## 한계

이름이 붙은 내보내기 파일의 열 구성은 해당 시스템에 대한 지식으로 작성했으며 실제 계정으로 확인하지 않았습니다. 허용 오차, 벌금, 사양, 관세 코드는 고객이 설정합니다. 법률·세무·통관·안전·회계 자문이 아닙니다.

MIT © 2026 Kurt Francisco
