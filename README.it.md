# Agenti Fairmake per la produzione

*Tradotto da Claude; revisione di un madrelingua in attesa. Fa fede la [README](README.md) in inglese.*

Trenta piccoli agenti MCP per il back office di produttori e distributori di piccole e medie dimensioni. Ognuno ha **un solo compito**, come costo standard rispetto al consuntivo per ordine di produzione, scostamento del prezzo d'acquisto, differenze dell'inventario a rotazione o detrazioni dei clienti della grande distribuzione, e non può agire oltre. Leggono i file che già esportate da NetSuite, SAP Business One, Epicor, Infor, Acumatica, Fishbowl, JobBOSS, Katana, MRPeasy, QuickBooks Enterprise, dal vostro MES, CMMS o sistema qualità, e i file EDI 850, 810 e 856; scrivono i report sul vostro computer e attendono una persona nominata prima di muovere denaro, inviare un messaggio o cambiare un sistema in produzione.

Parte di Fair Agents di Mythos Machines. Licenza MIT · Node 20 o successivo · solo file locali · nessuna credenziale · nessuna dipendenza. Il software è gratuito; la parte a pagamento è un'installazione a prezzo fisso sui vostri file.

## Provare

```bash
npx -y fairmake-cost-variance demo         # costo standard rispetto al consuntivo per ordine, dati fittizi
npx -y fairmake-retailer-deductions demo   # detrazioni dei distributori rispetto alle vostre spedizioni
```

Ogni agente ha una `demo` su file fittizi, un `eval` con i propri casi di test e un server MCP (`npx -y <agente> mcp --root <cartella>`).

## Gli agenti

**Costi e margini (7):** `fairmake-cost-variance` (costo standard rispetto al consuntivo per ordine di produzione), `fairmake-purchase-price-variance` (scostamento del prezzo d'acquisto), `fairmake-bom-cost-rollup` (roll-up dei costi della distinta base), `fairmake-overhead-absorption` (assorbimento dei costi generali), `fairmake-wip-aging` (anzianità del semilavorato), `fairmake-job-margins` (margine preventivato rispetto al consuntivo), `fairmake-landed-cost` (trasporto in entrata, dazi e spedizioniere doganale).

**Produzione e ingegneria (6):** `fairmake-bom-routing-gaps` (completezza di distinte e cicli), `fairmake-scrap-yield` (scarti rispetto allo standard), `fairmake-labor-efficiency` (efficienza per centro di lavoro), `fairmake-machine-downtime` (disponibilità, MTTR e MTBF dal MES), `fairmake-capacity-load` (carico settimanale), `fairmake-preventive-maintenance` (manutenzione preventiva scaduta).

**Magazzino e tracciabilità (5):** `fairmake-cycle-counts` (differenze d'inventario per classe ABC), `fairmake-obsolete-inventory` (scorte lente e obsolete), `fairmake-shelf-life` (scadenze e FEFO), `fairmake-reorder-points` (scorta di sicurezza e punti di riordino), `fairmake-lot-traceability` (interruzioni nella catena dei lotti).

**Acquisti e fornitori (4):** `fairmake-late-purchase-orders` (ordini d'acquisto aperti e in ritardo), `fairmake-supplier-scorecards` (valutazione fornitori), `fairmake-rebate-claims` (premi e accordi sui prezzi), `fairmake-material-certs` (certificati di materiale rispetto alle vostre specifiche).

**Clienti, EDI e conformità con la distribuzione (4):** `fairmake-order-backlog` (portafoglio ordini e date promesse), `fairmake-retailer-deductions` (detrazioni e addebiti), `fairmake-edi-asn-errors` (avvisi di spedizione rispetto agli ordini), `fairmake-edi-invoice-check` (fatture rispetto agli ordini dei clienti).

**Qualità, sicurezza e commercio estero (4):** `fairmake-calibration-due` (scadenze di taratura), `fairmake-ncr-capa-aging` (non conformità e azioni correttive), `fairmake-osha-300-log` (completezza del registro infortuni), `fairmake-hts-codes` (coerenza dei codici doganali).

## Sicurezza

- **Un compito per agente.** Ogni altro nome di strumento è bloccato.
- **Niente di vincolante avviene da solo.** Nessun agente registra nell'ERP, paga, spedisce, cambia standard o programmi, rilascia blocchi, trasmette EDI, presenta dichiarazioni o invia messaggi. Le bozze sono marcate DRAFT; l'approvazione richiede sempre il clic di una persona nominata, anche in modalità Auto.
- **Dati personali mascherati.** I nomi dei dipendenti arrivano al modello di IA come codici tipo `A.R.#3f9a2c`; i file sul vostro computer mantengono i valori reali.
- **Solo file locali**, nessuna rete, un registro di audit concatenato in `.fairmake/`.
- **Le vostre regole.** Tolleranze, obiettivi, termini, penali, specifiche ed elenchi di codici sono impostazioni nel vostro file.

## Test

{TESTS} test e {EVALS} casi di valutazione passano su Windows con Node 24; i passaggi con input ostili non trovano nulla. Dettagli in [REVIEW-ver1.md](REVIEW-ver1.md).

## Limiti

I tracciati di colonne degli export nominati derivano dalla conoscenza di quei sistemi, non da un account reale. Tolleranze, penali, specifiche e codici doganali sono vostre impostazioni. Non è consulenza legale, fiscale, doganale, di sicurezza o contabile.

MIT © 2026 Kurt Francisco
