# Fairmake 制造业智能体

*由 Claude 翻译，尚未经母语人士审校。以英文 [README](README.md) 为准。*

三十个小型 MCP 智能体，面向中小制造商和分销商的后台工作。每个智能体只负责 **一项工作**，例如按生产工单比较标准成本与实际成本、采购价格差异、循环盘点差异或零售客户扣款，不能越出这项工作。它们读取您已经从 NetSuite、SAP Business One、Epicor、Infor、Acumatica、Fishbowl、JobBOSS、Katana、MRPeasy、QuickBooks Enterprise、MES、CMMS 或质量系统导出的文件，以及 EDI 850、810 和 856 文件；在您的电脑上生成报告；在转移资金、发送消息或更改在线系统之前，等待一位具名人员确认。

属于 Mythos Machines 的 Fair Agents。MIT 许可 · Node 20 或更高 · 仅本地文件 · 无需凭据 · 无依赖。软件免费，付费部分是基于您自己文件的固定价格部署。

## 试用

```bash
npx -y fairmake-cost-variance demo         # 按工单比较标准成本与实际成本（虚构数据）
npx -y fairmake-retailer-deductions demo   # 用出货记录核对零售客户扣款
```

每个智能体都有基于虚构文件的 `demo`、带自有测试用例的 `eval`，以及 MCP 服务器（`npx -y <agent> mcp --root <folder>`）。

## 智能体

**成本与毛利（7）：** `fairmake-cost-variance`（按生产工单的标准成本与实际成本）、`fairmake-purchase-price-variance`（采购价格差异）、`fairmake-bom-cost-rollup`（物料清单成本卷积）、`fairmake-overhead-absorption`（制造费用分摊）、`fairmake-wip-aging`（在制品账龄）、`fairmake-job-margins`（报价与实际的工单毛利）、`fairmake-landed-cost`（进货运费、关税与报关费）。

**生产与工程（6）：** `fairmake-bom-routing-gaps`（物料清单与工艺路线完整性）、`fairmake-scrap-yield`（废品与标准对比）、`fairmake-labor-efficiency`（按工作中心的人工效率）、`fairmake-machine-downtime`（基于 MES 导出的可用率、MTTR 和 MTBF）、`fairmake-capacity-load`（每周负荷）、`fairmake-preventive-maintenance`（逾期预防性维护）。

**库存与追溯（5）：** `fairmake-cycle-counts`（按 ABC 类别的盘点差异）、`fairmake-obsolete-inventory`（呆滞与过时库存）、`fairmake-shelf-life`（保质期与先到期先出）、`fairmake-reorder-points`（安全库存与再订货点）、`fairmake-lot-traceability`（批次链条中的断点）。

**采购与供应商（4）：** `fairmake-late-purchase-orders`（未结及延迟的采购订单）、`fairmake-supplier-scorecards`（供应商评分）、`fairmake-rebate-claims`（返利与价格协议）、`fairmake-material-certs`（材料证书与您的规格核对）。

**客户、EDI 与零售合规（4）：** `fairmake-order-backlog`（订单积压与承诺日期）、`fairmake-retailer-deductions`（扣款与罚款）、`fairmake-edi-asn-errors`（发货通知与订单、出货核对）、`fairmake-edi-invoice-check`（发票与客户订单核对）。

**质量、安全与贸易（4）：** `fairmake-calibration-due`（校准到期）、`fairmake-ncr-capa-aging`（不合格与纠正措施）、`fairmake-osha-300-log`（工伤记录完整性）、`fairmake-hts-codes`（关税编码一致性）。

## 安全措施

- **每个智能体只做一件事。** 其他任何工具名称都会被阻止。
- **具有约束力的操作不会自行发生。** 智能体不会在 ERP 中过账、付款、发货、修改标准或计划、解除冻结、传输 EDI、向机构申报或发送消息。草稿标记为 DRAFT；即使在 Auto 模式下，批准也始终需要一位具名人员点击。
- **个人数据已遮蔽。** 员工姓名在返回给 AI 模型的结果中显示为 `A.R.#3f9a2c` 之类的代号；您电脑上的文件保留真实值。
- **仅本地文件**，无网络连接，`.fairmake/` 下有哈希链审计日志。
- **规则由您决定。** 容差、目标、期限、罚款、规格和编码清单都是您自己文件中的设置。

## 测试

795 个测试和 609 个评估用例在 Windows 和 Node 24 上通过；恶意输入测试没有发现问题。详情见 [REVIEW-ver1.md](REVIEW-ver1.md)。

## 限制

命名导出的列布局基于对这些系统的了解，未在真实账户中核实。容差、罚款、规格和关税编码由您设置。不构成法律、税务、海关、安全或会计建议。

MIT © 2026 Kurt Francisco
