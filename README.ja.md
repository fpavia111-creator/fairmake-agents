# Fairmake 製造業向けエージェント

*Claude による翻訳です。ネイティブによる確認はまだ行われていません。英語の [README](README.md) が優先します。*

中小の製造業と卸売業のバックオフィス向けの、30 の小さな MCP エージェントです。各エージェントは製造指図別の標準原価と実際原価、購買価格差異、循環棚卸の差異、小売取引先からの差引など **一つの仕事** だけを担当し、それ以外のことはできません。NetSuite、SAP Business One、Epicor、Infor、Acumatica、Fishbowl、JobBOSS、Katana、MRPeasy、QuickBooks Enterprise、MES・CMMS・品質管理システム、EDI 850・810・856 から既に出力しているファイルを読み、レポートをお使いのコンピューターに書き出し、お金の移動、メッセージの送信、稼働中のシステムの変更の前には、名前の明示された担当者を待ちます。

Mythos Machines の Fair Agents の一部です。MIT ライセンス · Node 20 以降 · ローカルファイルのみ · 認証情報不要 · 依存パッケージなし。ソフトウェアは無料で、有料なのはお客様のファイルでの定額セットアップです。

## 試す

```bash
npx -y fairmake-cost-variance demo         # 製造指図別の標準原価と実際原価（架空データ）
npx -y fairmake-retailer-deductions demo   # 小売取引先の差引を出荷記録と照合
```

各エージェントには架空ファイルで動く `demo`、独自のテストケースを持つ `eval`、MCP サーバー（`npx -y <agent> mcp --root <folder>`）があります。

## エージェント一覧

**原価と利益（7）：** `fairmake-cost-variance`（製造指図別の標準原価と実際原価）、`fairmake-purchase-price-variance`（購買価格差異）、`fairmake-bom-cost-rollup`（部品表の原価積上げ）、`fairmake-overhead-absorption`（製造間接費の配賦）、`fairmake-wip-aging`（仕掛品の滞留）、`fairmake-job-margins`（見積と実績の案件別粗利）、`fairmake-landed-cost`（仕入運賃・関税・通関費用）。

**生産と技術（6）：** `fairmake-bom-routing-gaps`（部品表と工程表の完全性）、`fairmake-scrap-yield`（標準に対する仕損）、`fairmake-labor-efficiency`（作業区別の作業効率）、`fairmake-machine-downtime`（MES 出力からの稼働率・MTTR・MTBF）、`fairmake-capacity-load`（週別負荷）、`fairmake-preventive-maintenance`（予防保全の期限超過）。

**在庫とトレーサビリティ（5）：** `fairmake-cycle-counts`（ABC 区分別の棚卸差異）、`fairmake-obsolete-inventory`（滞留・陳腐化在庫）、`fairmake-shelf-life`（使用期限と先入先出）、`fairmake-reorder-points`（安全在庫と発注点）、`fairmake-lot-traceability`（ロットの追跡の切れ目）。

**購買と仕入先（4）：** `fairmake-late-purchase-orders`（未入荷・遅延の発注）、`fairmake-supplier-scorecards`（仕入先評価）、`fairmake-rebate-claims`（リベートと価格契約）、`fairmake-material-certs`（材料証明書と自社仕様の照合）。

**顧客・EDI・小売取引ルール（4）：** `fairmake-order-backlog`（受注残と回答納期）、`fairmake-retailer-deductions`（差引と違約金）、`fairmake-edi-asn-errors`（事前出荷通知と注文・出荷の照合）、`fairmake-edi-invoice-check`（請求書と顧客注文の照合）。

**品質・安全・貿易（4）：** `fairmake-calibration-due`（校正期限）、`fairmake-ncr-capa-aging`（不適合と是正処置）、`fairmake-osha-300-log`（労働災害記録の完全性）、`fairmake-hts-codes`（関税番号の整合性）。

## 安全のしくみ

- **一つのエージェントに一つの仕事。** それ以外のツール名はすべてブロックされます。
- **拘束力のある操作は勝手に行われません。** ERP への計上、支払い、出荷、標準や計画の変更、保留の解除、EDI の送信、官公庁への届出、メッセージ送信は行いません。下書きには DRAFT と表示され、承認には Auto モードでも名前の明示された担当者のクリックが必要です。
- **個人データはマスクされます。** 従業員の名前は AI モデルには `A.R.#3f9a2c` のような記号で渡り、お使いのコンピューター上のファイルには実際の値が残ります。
- **ローカルファイルのみ。** ネットワーク通信はなく、`.fairmake/` にハッシュチェーンの監査ログが残ります。
- **ルールはお客様のもの。** 許容差、目標、期限、違約金、仕様、コード一覧はお客様の設定ファイルで決まります。

## テスト

795 件のテストと 609 件の評価ケースが Windows・Node 24 で成功し、敵対的入力のテストでは問題は見つかっていません。詳細は [REVIEW-ver1.md](REVIEW-ver1.md) を参照してください。

## 制限事項

名前付きエクスポートの列構成は各システムの知識に基づくもので、実際のアカウントでは確認していません。許容差、違約金、仕様、関税番号はお客様の設定です。法律・税務・通関・安全・会計の助言ではありません。

MIT © 2026 Kurt Francisco
