// The words on a report page, in the nine report languages: page headings, section
// headings and the common column names. `--lang` (or FAIRMAKE_LANG) picks the language.
//
// What does not change with the language: the CSV file (its column names are read by
// scripts), finding codes and status values, the finding sentences and the notes under
// "Limits". A page in another language says so in its footer.
//
// Translations are written by Claude and marked for review by a native speaker.
// A string with no translation is shown in English, never left blank.
import { normLang } from './lang.js';

const ORDER = ['de', 'fr', 'es', 'pt', 'it', 'ja', 'zh', 'ko'];

// English: [de, fr, es, pt, it, ja, zh, ko]. {d} is a date, {1} {2} are numbers.
const PAGE = {
  'All rows ({1})': ['Alle Zeilen ({1})', 'Toutes les lignes ({1})', 'Todas las filas ({1})', 'Todas as linhas ({1})', 'Tutte le righe ({1})', '全行（{1}）', '全部行（{1}）', '전체 행 ({1})'],
  Limits: ['Grenzen', 'Limites', 'Límites', 'Limites', 'Limiti', '制限事項', '限制说明', '한계'],
  'None.': ['Keine.', 'Aucun.', 'Ninguno.', 'Nenhum.', 'Nessuno.', 'なし。', '无。', '없음.'],
  'Written by a Fairmake agent from your files. Nothing was sent or paid.': [
    'Von einem Fairmake-Agenten aus Ihren Dateien erstellt. Es wurde nichts gesendet oder bezahlt.',
    'Rédigé par un agent Fairmake à partir de vos fichiers. Rien n’a été envoyé ni payé.',
    'Escrito por un agente Fairmake a partir de sus archivos. No se envió ni se pagó nada.',
    'Escrito por um agente Fairmake a partir dos seus arquivos. Nada foi enviado nem pago.',
    'Scritto da un agente Fairmake a partire dai vostri file. Nulla è stato inviato o pagato.',
    'Fairmake エージェントがお客様のファイルから作成しました。送信も支払いも行っていません。',
    '由 Fairmake 智能体根据您的文件生成。未发送任何内容，也未付款。',
    'Fairmake 에이전트가 귀사의 파일로 작성했습니다. 아무것도 전송하거나 지급하지 않았습니다.'],
  'The summary line, finding texts, codes and the notes under Limits are in English. This page was translated by Claude; a native speaker has not reviewed it yet.': [
    'Die Zusammenfassung, die Befundtexte, die Codes und die Hinweise unter „Grenzen“ sind auf Englisch. Diese Seite wurde von Claude übersetzt; eine Prüfung durch Muttersprachler steht noch aus.',
    'La ligne de synthèse, les textes des constats, les codes et les notes sous « Limites » sont en anglais. Cette page a été traduite par Claude ; elle n’a pas encore été relue par un locuteur natif.',
    'La línea de resumen, los textos de los hallazgos, los códigos y las notas de «Límites» están en inglés. Esta página fue traducida por Claude; todavía no la ha revisado un hablante nativo.',
    'A linha de resumo, os textos dos apontamentos, os códigos e as notas em “Limites” estão em inglês. Esta página foi traduzida pelo Claude; ainda não foi revisada por um falante nativo.',
    'La riga di sintesi, i testi dei rilievi, i codici e le note sotto «Limiti» sono in inglese. Questa pagina è stata tradotta da Claude; non è ancora stata rivista da un madrelingua.',
    '概要行、指摘の本文、コード、「制限事項」の注記は英語です。このページは Claude が翻訳しました。ネイティブによる確認はまだ行われていません。',
    '摘要行、发现项的文字、代码以及“限制说明”下的备注为英文。本页由 Claude 翻译，尚未经母语人士审校。',
    '요약 문장, 지적 사항의 문구, 코드와 “한계” 아래의 주석은 영어입니다. 이 페이지는 Claude가 번역했으며 원어민 검토는 아직 이루어지지 않았습니다.'],
};

const TITLES = {
  'Standard against actual cost by work order': ['Standard- gegenüber Istkosten je Fertigungsauftrag', 'Coût standard face au coût réel par ordre de fabrication', 'Coste estándar frente a real por orden de fabricación', 'Custo padrão frente ao real por ordem de produção', 'Costo standard rispetto al consuntivo per ordine di produzione', '製造指図別の標準原価と実際原価', '按生产工单的标准成本与实际成本', '작업지시별 표준원가 대비 실제원가'],
  'Purchase price variance': ['Einkaufspreisabweichung', 'Écart sur prix d’achat', 'Variación del precio de compra', 'Variação do preço de compra', 'Scostamento del prezzo d’acquisto', '購買価格差異', '采购价格差异', '구매가격차이'],
  'BOM cost roll-up': ['Stücklisten-Kostenaufrollung', 'Cumul des coûts de nomenclature', 'Acumulación de costes de la lista de materiales', 'Rollup de custos da estrutura de produto', 'Roll-up dei costi della distinta base', '部品表の原価積上げ', '物料清单成本卷积', 'BOM 원가 롤업'],
  'Overhead absorption': ['Gemeinkostenverrechnung', 'Absorption des frais généraux', 'Absorción de gastos generales', 'Absorção de custos indiretos', 'Assorbimento dei costi generali', '製造間接費の配賦', '制造费用分摊', '제조간접비 배부'],
  'WIP aging as of {d}': ['Alter der Ware in Arbeit, Stand {d}', 'Ancienneté des en-cours au {d}', 'Antigüedad de la producción en curso al {d}', 'Envelhecimento do estoque em processo em {d}', 'Anzianità del semilavorato in corso al {d}', '仕掛品の滞留（{d} 時点）', '在制品账龄（截至 {d}）', '재공품 경과일 ({d} 기준)'],
  'Quoted against actual job margin': ['Kalkulierte gegenüber tatsächlicher Auftragsmarge', 'Marge devisée face à la marge réelle par affaire', 'Margen cotizado frente a real por trabajo', 'Margem orçada frente à real por trabalho', 'Margine preventivato rispetto al consuntivo per commessa', '見積と実績の案件別粗利', '报价与实际的工单毛利', '견적 대비 실제 작업 마진'],
  'Landed cost and freight-in': ['Einstandskosten und Eingangsfracht', 'Coût de revient rendu et fret entrant', 'Coste en destino y fletes de entrada', 'Custo de internação e frete de entrada', 'Costo di sbarco e trasporto in entrata', '輸入諸掛と仕入運賃', '到岸成本与进货运费', '수입부대비용과 매입운임'],
  'BOM and routing completeness': ['Vollständigkeit von Stücklisten und Arbeitsplänen', 'Complétude des nomenclatures et des gammes', 'Integridad de listas de materiales y rutas', 'Completude de estruturas e roteiros', 'Completezza di distinte base e cicli', '部品表と工程表の完全性', '物料清单与工艺路线的完整性', 'BOM 및 라우팅 완전성'],
  'Scrap and yield': ['Ausschuss und Ausbeute', 'Rebuts et rendement', 'Desperdicio y rendimiento', 'Refugo e rendimento', 'Scarti e resa', '仕損と歩留まり', '废品与良率', '불량과 수율'],
  'Labor efficiency by work center': ['Arbeitseffizienz je Arbeitsplatz', 'Efficacité de la main-d’œuvre par poste de charge', 'Eficiencia de mano de obra por centro de trabajo', 'Eficiência de mão de obra por centro de trabalho', 'Efficienza della manodopera per centro di lavoro', '作業区別の作業効率', '按工作中心的人工效率', '작업장별 노동 효율'],
  'Machine downtime': ['Maschinenstillstand', 'Arrêts machine', 'Paradas de máquina', 'Paradas de máquina', 'Fermi macchina', '設備停止', '设备停机', '설비 정지'],
  'Capacity load against available hours': ['Kapazitätsbelastung gegenüber verfügbaren Stunden', 'Charge face aux heures disponibles', 'Carga de capacidad frente a horas disponibles', 'Carga de capacidade frente às horas disponíveis', 'Carico di capacità rispetto alle ore disponibili', '負荷と稼働可能時間', '产能负荷与可用工时', '가용 시간 대비 부하'],
  'Preventive maintenance as of {d}': ['Vorbeugende Wartung, Stand {d}', 'Maintenance préventive au {d}', 'Mantenimiento preventivo al {d}', 'Manutenção preventiva em {d}', 'Manutenzione preventiva al {d}', '予防保全（{d} 時点）', '预防性维护（截至 {d}）', '예방 정비 ({d} 기준)'],
  'Calibration due dates as of {d}': ['Kalibrierfälligkeiten, Stand {d}', 'Échéances d’étalonnage au {d}', 'Vencimientos de calibración al {d}', 'Vencimentos de calibração em {d}', 'Scadenze di taratura al {d}', '校正期限（{d} 時点）', '校准到期日（截至 {d}）', '교정 만기 ({d} 기준)'],
  'Cycle count variance': ['Abweichungen der permanenten Inventur', 'Écarts d’inventaire tournant', 'Diferencias del conteo cíclico', 'Divergências da contagem cíclica', 'Differenze dell’inventario a rotazione', '循環棚卸の差異', '循环盘点差异', '순환 실사 차이'],
  'Slow-moving and obsolete inventory as of {d}': ['Langsam drehende und obsolete Bestände, Stand {d}', 'Stocks à rotation lente et obsolètes au {d}', 'Inventario de lento movimiento y obsoleto al {d}', 'Estoque de giro lento e obsoleto em {d}', 'Scorte a lenta rotazione e obsolete al {d}', '滞留在庫と陳腐化在庫（{d} 時点）', '呆滞与过时库存（截至 {d}）', '저회전 및 진부화 재고 ({d} 기준)'],
  'Shelf life and expiry as of {d}': ['Haltbarkeit und Verfall, Stand {d}', 'Durée de conservation et péremption au {d}', 'Vida útil y caducidad al {d}', 'Validade e vencimento em {d}', 'Durata e scadenza al {d}', '保存期間と使用期限（{d} 時点）', '保质期与到期（截至 {d}）', '유통기한 및 만료 ({d} 기준)'],
  'Safety stock and reorder points': ['Sicherheitsbestand und Meldebestand', 'Stock de sécurité et points de commande', 'Stock de seguridad y puntos de pedido', 'Estoque de segurança e pontos de pedido', 'Scorta di sicurezza e punti di riordino', '安全在庫と発注点', '安全库存与再订货点', '안전재고와 재주문점'],
  'Lot and serial traceability': ['Chargen- und Seriennummernrückverfolgung', 'Traçabilité des lots et numéros de série', 'Trazabilidad de lotes y números de serie', 'Rastreabilidade de lotes e números de série', 'Tracciabilità di lotti e numeri di serie', 'ロットとシリアルのトレーサビリティ', '批次与序列号追溯', '로트 및 시리얼 추적성'],
  'Open purchase orders as of {d}': ['Offene Bestellungen, Stand {d}', 'Commandes d’achat ouvertes au {d}', 'Órdenes de compra abiertas al {d}', 'Pedidos de compra em aberto em {d}', 'Ordini d’acquisto aperti al {d}', '未入荷の発注（{d} 時点）', '未结采购订单（截至 {d}）', '미입고 발주 ({d} 기준)'],
  'Supplier scorecard': ['Lieferantenbewertung', 'Tableau de bord fournisseurs', 'Cuadro de mando de proveedores', 'Scorecard de fornecedores', 'Scorecard dei fornitori', '仕入先スコアカード', '供应商评分卡', '공급업체 평가표'],
  'Rebates and price agreements': ['Boni und Preisvereinbarungen', 'Remises et accords de prix', 'Rappels y acuerdos de precio', 'Rebates e acordos de preço', 'Premi e accordi sui prezzi', 'リベートと価格契約', '返利与价格协议', '리베이트와 가격 계약'],
  'Customer deductions and chargebacks': ['Kundenabzüge und Rückbelastungen', 'Déductions et pénalités clients', 'Deducciones y contracargos de clientes', 'Deduções e estornos de clientes', 'Detrazioni e addebiti dei clienti', '顧客の差引と違約金', '客户扣款与罚款', '고객 공제 및 차지백'],
  'Advance ship notice checks': ['Prüfung der Lieferavis', 'Contrôle des avis d’expédition', 'Revisión de avisos de envío', 'Verificação de avisos de embarque', 'Verifica degli avvisi di spedizione', '事前出荷通知の確認', '提前发货通知检查', '사전 출하 통지 점검'],
  'Order backlog and promise dates as of {d}': ['Auftragsbestand und zugesagte Termine, Stand {d}', 'Carnet de commandes et dates promises au {d}', 'Cartera de pedidos y fechas comprometidas al {d}', 'Carteira de pedidos e datas prometidas em {d}', 'Portafoglio ordini e date promesse al {d}', '受注残と回答納期（{d} 時点）', '订单积压与承诺日期（截至 {d}）', '수주잔고와 약속일 ({d} 기준)'],
  'Nonconformance and corrective action aging as of {d}': ['Alter von Abweichungen und Korrekturmaßnahmen, Stand {d}', 'Ancienneté des non-conformités et actions correctives au {d}', 'Antigüedad de no conformidades y acciones correctivas al {d}', 'Envelhecimento de não conformidades e ações corretivas em {d}', 'Anzianità di non conformità e azioni correttive al {d}', '不適合と是正処置の経過（{d} 時点）', '不合格与纠正措施账龄（截至 {d}）', '부적합 및 시정조치 경과 ({d} 기준)'],
  'Injury and illness log completeness': ['Vollständigkeit des Unfall- und Erkrankungsprotokolls', 'Complétude du registre des accidents et maladies', 'Integridad del registro de lesiones y enfermedades', 'Completude do registro de lesões e doenças', 'Completezza del registro di infortuni e malattie', '労働災害・疾病記録の完全性', '工伤与职业病记录完整性', '산업재해 및 질병 기록 완전성'],
  'Tariff code consistency': ['Konsistenz der Zolltarifnummern', 'Cohérence des codes tarifaires', 'Coherencia de códigos arancelarios', 'Consistência dos códigos tarifários', 'Coerenza dei codici doganali', '関税番号の整合性', '关税编码一致性', '관세 코드 일관성'],
  'Customer invoices against customer orders': ['Kundenrechnungen gegenüber Kundenaufträgen', 'Factures clients face aux commandes clients', 'Facturas de clientes frente a pedidos de clientes', 'Faturas de clientes frente a pedidos de clientes', 'Fatture clienti rispetto agli ordini clienti', '顧客請求書と顧客注文の照合', '客户发票与客户订单核对', '고객 송장 대 고객 주문'],
  'Material certificates on receipts': ['Materialzeugnisse zu Wareneingängen', 'Certificats matière des réceptions', 'Certificados de material de las recepciones', 'Certificados de material dos recebimentos', 'Certificati di materiale dei ricevimenti', '入荷時の材料証明書', '收货材料证书', '입고 자재 성적서'],
};

const SECTIONS = {
  'By finding': ['Nach Befund', 'Par constat', 'Por hallazgo', 'Por apontamento', 'Per rilievo', '指摘別', '按发现项', '지적 사항별'],
  'By cost element': ['Nach Kostenart', 'Par élément de coût', 'Por elemento de coste', 'Por elemento de custo', 'Per elemento di costo', '原価要素別', '按成本要素', '원가 요소별'],
  'By supplier': ['Nach Lieferant', 'Par fournisseur', 'Por proveedor', 'Por fornecedor', 'Per fornitore', '仕入先別', '按供应商', '공급업체별'],
  'By customer': ['Nach Kunde', 'Par client', 'Por cliente', 'Por cliente', 'Per cliente', '顧客別', '按客户', '고객별'],
  'By estimator': ['Nach Kalkulator', 'Par chiffreur', 'Por estimador', 'Por orçamentista', 'Per preventivista', '見積担当者別', '按报价员', '견적 담당자별'],
  'By work center': ['Nach Arbeitsplatz', 'Par poste de charge', 'Por centro de trabajo', 'Por centro de trabalho', 'Per centro di lavoro', '作業区別', '按工作中心', '작업장별'],
  'By reason': ['Nach Grund', 'Par motif', 'Por motivo', 'Por motivo', 'Per causa', '理由別', '按原因', '사유별'],
  'By age': ['Nach Alter', 'Par ancienneté', 'Por antigüedad', 'Por idade', 'Per anzianità', '経過日数別', '按账龄', '경과일별'],
  'By week': ['Nach Woche', 'Par semaine', 'Por semana', 'Por semana', 'Per settimana', '週別', '按周', '주별'],
  'By class': ['Nach Klasse', 'Par classe', 'Por clase', 'Por classe', 'Per classe', 'クラス別', '按类别', '등급별'],
  'By bucket': ['Nach Gruppe', 'Par tranche', 'Por tramo', 'Por faixa', 'Per fascia', '区分別', '按区间', '구간별'],
  'By promise month': ['Nach Zusagemonat', 'Par mois promis', 'Por mes comprometido', 'Por mês prometido', 'Per mese promesso', '回答納期の月別', '按承诺月份', '약속 월별'],
  'By outcome': ['Nach Folge', 'Par conséquence', 'Por resultado', 'Por desfecho', 'Per esito', '結果別', '按结果', '결과별'],
  'By machine': ['Nach Maschine', 'Par machine', 'Por máquina', 'Por máquina', 'Per macchina', '設備別', '按设备', '설비별'],
  'By item': ['Nach Artikel', 'Par article', 'Por artículo', 'Por item', 'Per articolo', '品目別', '按物料', '품목별'],
  'By status': ['Nach Status', 'Par statut', 'Por estado', 'Por situação', 'Per stato', 'ステータス別', '按状态', '상태별'],
  'By agreement': ['Nach Vereinbarung', 'Par accord', 'Por acuerdo', 'Por acordo', 'Per accordo', '契約別', '按协议', '계약별'],
  'By purchase order': ['Nach Bestellung', 'Par commande', 'Por pedido', 'Por pedido', 'Per ordine', '注文別', '按订单', '주문별'],
  'By type': ['Nach Art', 'Par type', 'Por tipo', 'Por tipo', 'Per tipo', '種類別', '按类型', '유형별'],
  'Standards to review': ['Zu prüfende Standards', 'Standards à revoir', 'Estándares a revisar', 'Padrões a revisar', 'Standard da rivedere', '見直す標準', '待复核的标准', '검토할 표준'],
  'Proposed standards': ['Vorgeschlagene Standards', 'Standards proposés', 'Estándares propuestos', 'Padrões propostos', 'Standard proposti', '提案する標準', '建议的标准', '제안 표준'],
  'Proposed rates': ['Vorgeschlagene Sätze', 'Taux proposés', 'Tasas propuestas', 'Taxas propostas', 'Tassi proposti', '提案する配賦率', '建议的分摊率', '제안 배부율'],
  'Unmatched charges': ['Nicht zugeordnete Kosten', 'Frais non rapprochés', 'Cargos sin asignar', 'Encargos não vinculados', 'Costi non abbinati', '未照合の諸掛', '未匹配的费用', '미대사 비용'],
  'Suspect work orders': ['Verdächtige Fertigungsaufträge', 'Ordres de fabrication suspects', 'Órdenes de fabricación sospechosas', 'Ordens de produção suspeitas', 'Ordini di produzione sospetti', '影響が疑われる製造指図', '可疑生产工单', '의심 작업지시'],
  'Proposed reorder points': ['Vorgeschlagene Meldebestände', 'Points de commande proposés', 'Puntos de pedido propuestos', 'Pontos de pedido propostos', 'Punti di riordino proposti', '提案する発注点', '建议的再订货点', '제안 재주문점'],
  'Repeat defects': ['Wiederkehrende Fehler', 'Défauts répétés', 'Defectos repetidos', 'Defeitos repetidos', 'Difetti ricorrenti', '再発している不良', '重复缺陷', '반복 불량'],
  'Totals': ['Summen', 'Totaux', 'Totales', 'Totais', 'Totali', '合計', '合计', '합계'],
};

// Column names on report pages (the CSV keeps the English names). Unknown columns are shown in English.
const COLUMNS = {
  work_order: ['Fertigungsauftrag', 'Ordre de fabrication', 'Orden de fabricación', 'Ordem de produção', 'Ordine di produzione', '製造指図', '生产工单', '작업지시'],
  item: ['Artikel', 'Article', 'Artículo', 'Item', 'Articolo', '品目', '物料', '품목'],
  supplier: ['Lieferant', 'Fournisseur', 'Proveedor', 'Fornecedor', 'Fornitore', '仕入先', '供应商', '공급업체'],
  customer: ['Kunde', 'Client', 'Cliente', 'Cliente', 'Cliente', '顧客', '客户', '고객'],
  status: ['Status', 'Statut', 'Estado', 'Situação', 'Stato', 'ステータス', '状态', '상태'],
  reasons: ['Gründe', 'Motifs', 'Motivos', 'Motivos', 'Motivi', '理由', '原因', '사유'],
  findings: ['Befunde', 'Constats', 'Hallazgos', 'Apontamentos', 'Rilievi', '指摘', '发现项', '지적 사항'],
  code: ['Code', 'Code', 'Código', 'Código', 'Codice', 'コード', '代码', '코드'],
  count: ['Anzahl', 'Nombre', 'Cantidad', 'Quantidade', 'Numero', '件数', '数量', '건수'],
  amount: ['Betrag', 'Montant', 'Importe', 'Valor', 'Importo', '金額', '金额', '금액'],
  value: ['Wert', 'Valeur', 'Valor', 'Valor', 'Valore', '金額', '价值', '가액'],
  variance: ['Abweichung', 'Écart', 'Variación', 'Variação', 'Scostamento', '差異', '差异', '차이'],
  variance_pct: ['Abweichung %', 'Écart %', 'Variación %', 'Variação %', 'Scostamento %', '差異 %', '差异 %', '차이 %'],
  standard: ['Standard', 'Standard', 'Estándar', 'Padrão', 'Standard', '標準', '标准', '표준'],
  actual: ['Ist', 'Réel', 'Real', 'Real', 'Consuntivo', '実際', '实际', '실제'],
  element: ['Kostenart', 'Élément', 'Elemento', 'Elemento', 'Elemento', '原価要素', '成本要素', '원가 요소'],
  qty: ['Menge', 'Quantité', 'Cantidad', 'Quantidade', 'Quantità', '数量', '数量', '수량'],
  unit_price: ['Stückpreis', 'Prix unitaire', 'Precio unitario', 'Preço unitário', 'Prezzo unitario', '単価', '单价', '단가'],
  unit_cost: ['Stückkosten', 'Coût unitaire', 'Coste unitario', 'Custo unitário', 'Costo unitario', '単位原価', '单位成本', '단위원가'],
  std_cost: ['Standardkosten', 'Coût standard', 'Coste estándar', 'Custo padrão', 'Costo standard', '標準原価', '标准成本', '표준원가'],
  rolled_cost: ['Aufgerollte Kosten', 'Coût cumulé', 'Coste acumulado', 'Custo acumulado', 'Costo calcolato', '積上げ原価', '卷积成本', '롤업 원가'],
  change_pct: ['Änderung %', 'Variation %', 'Cambio %', 'Variação %', 'Variazione %', '変動 %', '变动 %', '변동 %'],
  ppv: ['Preisabweichung', 'Écart sur prix', 'Variación de precio', 'Variação de preço', 'Scostamento prezzo', '価格差異', '价格差异', '가격 차이'],
  receipt: ['Wareneingang', 'Réception', 'Recepción', 'Recebimento', 'Ricevimento', '入荷', '收货', '입고'],
  receipt_date: ['Eingangsdatum', 'Date de réception', 'Fecha de recepción', 'Data de recebimento', 'Data di ricevimento', '入荷日', '收货日期', '입고일'],
  po_number: ['Bestellnummer', 'N° de commande', 'N.º de pedido', 'N.º do pedido', 'N. ordine', '注文番号', '订单号', '주문 번호'],
  due_date: ['Fälligkeitsdatum', 'Date d’échéance', 'Fecha de vencimiento', 'Data de vencimento', 'Data di scadenza', '期日', '到期日', '만기일'],
  days: ['Tage', 'Jours', 'Días', 'Dias', 'Giorni', '日数', '天数', '일수'],
  days_open: ['Tage offen', 'Jours ouverts', 'Días abierta', 'Dias em aberto', 'Giorni aperti', '経過日数', '未结天数', '경과일'],
  age_bucket: ['Altersgruppe', 'Tranche d’ancienneté', 'Tramo de antigüedad', 'Faixa de idade', 'Fascia di anzianità', '経過区分', '账龄区间', '경과 구간'],
  wip_value: ['WIP-Wert', 'Valeur des en-cours', 'Valor en curso', 'Valor em processo', 'Valore WIP', '仕掛金額', '在制品价值', '재공 금액'],
  work_center: ['Arbeitsplatz', 'Poste de charge', 'Centro de trabajo', 'Centro de trabalho', 'Centro di lavoro', '作業区', '工作中心', '작업장'],
  machine: ['Maschine', 'Machine', 'Máquina', 'Máquina', 'Macchina', '設備', '设备', '설비'],
  hours: ['Stunden', 'Heures', 'Horas', 'Horas', 'Ore', '時間', '工时', '시간'],
  efficiency_pct: ['Effizienz %', 'Efficacité %', 'Eficiencia %', 'Eficiência %', 'Efficienza %', '効率 %', '效率 %', '효율 %'],
  availability_pct: ['Verfügbarkeit %', 'Disponibilité %', 'Disponibilidad %', 'Disponibilidade %', 'Disponibilità %', '稼働率 %', '可用率 %', '가동률 %'],
  load_pct: ['Auslastung %', 'Charge %', 'Carga %', 'Carga %', 'Carico %', '負荷率 %', '负荷率 %', '부하율 %'],
  week: ['Woche', 'Semaine', 'Semana', 'Semana', 'Settimana', '週', '周', '주'],
  reason: ['Grund', 'Motif', 'Motivo', 'Motivo', 'Causa', '理由', '原因', '사유'],
  location: ['Lagerort', 'Emplacement', 'Ubicación', 'Localização', 'Ubicazione', 'ロケーション', '库位', '위치'],
  on_hand: ['Bestand', 'Stock disponible', 'Existencias', 'Em estoque', 'Giacenza', '手持在庫', '现有库存', '현재고'],
  lot: ['Charge', 'Lot', 'Lote', 'Lote', 'Lotto', 'ロット', '批次', '로트'],
  expiry_date: ['Verfallsdatum', 'Date de péremption', 'Fecha de caducidad', 'Data de validade', 'Data di scadenza', '使用期限', '到期日期', '만료일'],
  scrap_pct: ['Ausschuss %', 'Rebut %', 'Desperdicio %', 'Refugo %', 'Scarto %', '仕損率 %', '废品率 %', '불량률 %'],
  margin_pct: ['Marge %', 'Marge %', 'Margen %', 'Margem %', 'Margine %', '粗利率 %', '毛利率 %', '마진율 %'],
  score: ['Punktzahl', 'Score', 'Puntuación', 'Pontuação', 'Punteggio', 'スコア', '得分', '점수'],
  rank: ['Rang', 'Rang', 'Puesto', 'Posição', 'Posizione', '順位', '排名', '순위'],
  on_time_pct: ['Pünktlich %', 'À l’heure %', 'A tiempo %', 'No prazo %', 'Puntuale %', '納期遵守率 %', '准时率 %', '납기 준수율 %'],
  ppm: ['ppm', 'ppm', 'ppm', 'ppm', 'ppm', 'ppm', 'ppm', 'ppm'],
  dispute_by: ['Einspruch bis', 'Contester avant le', 'Disputar antes del', 'Contestar até', 'Contestare entro il', '異議申立期限', '申诉截止日', '이의 제기 기한'],
  promise_date: ['Zugesagter Termin', 'Date promise', 'Fecha comprometida', 'Data prometida', 'Data promessa', '回答納期', '承诺日期', '약속일'],
  open_value: ['Offener Wert', 'Valeur ouverte', 'Valor abierto', 'Valor em aberto', 'Valore aperto', '未出荷金額', '未结金额', '미결 금액'],
  decision: ['Entscheidung', 'Décision', 'Decisión', 'Decisão', 'Decisione', '判断', '决定', '결정'],
  month: ['Monat', 'Mois', 'Mes', 'Mês', 'Mese', '月', '月份', '월'],
  type: ['Art', 'Type', 'Tipo', 'Tipo', 'Tipo', '種類', '类型', '유형'],
  total: ['Summe', 'Total', 'Total', 'Total', 'Totale', '合計', '合计', '합계'],
};

// Measure names an agent passes as its own column labels.
const LABELS = {
  'On-time %': ['Pünktlich %', 'À l’heure %', 'A tiempo %', 'No prazo %', 'Puntuale %', '納期遵守率 %', '准时率 %', '납기 준수율 %'],
  'Price variance %': ['Preisabweichung %', 'Écart de prix %', 'Variación de precio %', 'Variação de preço %', 'Scostamento prezzo %', '価格差異 %', '价格差异 %', '가격 차이 %'],
  'Rejects (ppm)': ['Ausschuss (ppm)', 'Rejets (ppm)', 'Rechazos (ppm)', 'Rejeições (ppm)', 'Scarti (ppm)', '不良 (ppm)', '拒收 (ppm)', '불량 (ppm)'],
};


/** Every catalog, for the tests: { name: { english: [8 translations] } }. */
export const REPORT_TEXT = Object.freeze({ page: PAGE, titles: TITLES, sections: SECTIONS, columns: COLUMNS, labels: LABELS });
export const ENGLISH_NOTE = 'The summary line, finding texts, codes and the notes under Limits are in English. This page was translated by Claude; a native speaker has not reviewed it yet.';

const DATE = /\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?/;
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : vars[k]));

/** Find a phrase in a catalog: as written, then with its date as {d}, then with its numbers as {1} {2}. */
function lookup(cat, s) {
  if (Object.hasOwn(cat, s)) return [cat[s], {}];
  const d = DATE.exec(s);
  if (d) { const k = s.replace(DATE, '{d}'); if (Object.hasOwn(cat, k)) return [cat[k], { d: d[0] }]; }
  const vars = {}; let n = 0; const k = s.replace(/\d+(?:\.\d+)?/g, (m) => { vars[++n] = m; return `{${n}}`; });
  return n && Object.hasOwn(cat, k) ? [cat[k], vars] : [null, {}];
}

/**
 * Text for a report page in one language:
 *   t.page(s), t.title(s), t.section(s)  a phrase, translated when the catalog has it;
 *   t.column(name, label)                a column heading (label is the agent's own, when it set one);
 *   t.english                            true when nothing is translated.
 */
export function reportText(lang) {
  const l = normLang(lang); const i = ORDER.indexOf(l);
  const tr = (cat) => (s) => { if (i < 0) return s; const [hit, vars] = lookup(cat, String(s)); return hit && hit[i] ? fill(hit[i], vars) : s; };
  const label = tr(LABELS);
  return {
    lang: l, english: i < 0, page: tr(PAGE), title: tr(TITLES), section: tr(SECTIONS),
    column: (name, own) => { if (own) return label(own); if (i >= 0 && Object.hasOwn(COLUMNS, name) && COLUMNS[name][i]) return COLUMNS[name][i]; return String(name).replace(/_/g, ' '); },
  };
}
