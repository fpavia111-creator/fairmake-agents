# Fairmake-Agenten für die Fertigung

*Von Claude übersetzt; Prüfung durch Muttersprachler steht aus. Die englische [README](README.md) ist maßgeblich.*

Dreißig kleine MCP-Agenten für das Backoffice kleiner und mittlerer Fertigungsbetriebe und Großhändler. Jeder ist für **eine Aufgabe** zuständig, etwa Standard- gegenüber Istkosten je Fertigungsauftrag, Einkaufspreisabweichung, Inventurabweichung oder Abzüge von Handelskunden, und kann nicht darüber hinaus handeln. Sie lesen die Dateien, die Sie bereits aus NetSuite, SAP Business One, Epicor, Infor, Acumatica, Fishbowl, JobBOSS, Katana, MRPeasy, QuickBooks Enterprise, Ihrem MES, CMMS oder QMS sowie als EDI 850, 810 und 856 exportieren, schreiben Berichte auf Ihrem Rechner und warten auf eine namentlich genannte Person, bevor Geld bewegt, eine Nachricht gesendet oder ein laufendes System geändert wird.

Teil von Fair Agents von Mythos Machines. MIT-Lizenz · Node 20 oder neuer · nur lokale Dateien · keine Zugangsdaten · keine Abhängigkeiten. Die Software ist kostenlos; bezahlt wird eine Einrichtung zum Festpreis auf Ihren eigenen Dateien.

## Ausprobieren

```bash
npx -y fairmake-cost-variance demo         # Standard- gegenüber Istkosten je Auftrag, fiktive Daten
npx -y fairmake-retailer-deductions demo   # Abzüge von Handelskunden gegen Ihre Versanddaten
```

Jeder Agent hat eine `demo` mit fiktiven Dateien, ein `eval` mit eigenen Testfällen und einen MCP-Server (`npx -y <agent> mcp --root <ordner>`).

## Die Agenten

**Kosten und Marge (7):** `fairmake-cost-variance` (Standard- gegenüber Istkosten je Fertigungsauftrag), `fairmake-purchase-price-variance` (Einkaufspreisabweichung), `fairmake-bom-cost-rollup` (Kostenaufrollung über die Stückliste), `fairmake-overhead-absorption` (Gemeinkostenverrechnung), `fairmake-wip-aging` (Alter der Ware in Arbeit), `fairmake-job-margins` (kalkulierte gegenüber tatsächlicher Auftragsmarge), `fairmake-landed-cost` (Eingangsfracht, Zoll und Abfertigung).

**Fertigung und Technik (6):** `fairmake-bom-routing-gaps` (Vollständigkeit von Stücklisten und Arbeitsplänen), `fairmake-scrap-yield` (Ausschuss gegenüber Standard), `fairmake-labor-efficiency` (Arbeitseffizienz je Arbeitsplatz), `fairmake-machine-downtime` (Verfügbarkeit, MTTR und MTBF aus MES-Exporten), `fairmake-capacity-load` (Kapazitätsbelastung je Woche), `fairmake-preventive-maintenance` (fällige und überfällige Wartung).

**Bestand und Rückverfolgung (5):** `fairmake-cycle-counts` (Inventurabweichungen nach ABC-Klasse), `fairmake-obsolete-inventory` (langsam drehende und obsolete Bestände), `fairmake-shelf-life` (Haltbarkeit und FEFO), `fairmake-reorder-points` (Sicherheits- und Meldebestand), `fairmake-lot-traceability` (Lücken in der Chargenkette).

**Einkauf und Lieferanten (4):** `fairmake-late-purchase-orders` (offene und verspätete Bestellungen), `fairmake-supplier-scorecards` (Lieferantenbewertung), `fairmake-rebate-claims` (Boni und Preisvereinbarungen), `fairmake-material-certs` (Materialzeugnisse gegen Ihre Spezifikationen).

**Kunden, EDI und Handelsvorgaben (4):** `fairmake-order-backlog` (Auftragsbestand und Zusagetermine), `fairmake-retailer-deductions` (Abzüge und Rückbelastungen), `fairmake-edi-asn-errors` (Lieferavis gegen Bestellungen und Versand), `fairmake-edi-invoice-check` (Rechnungen gegen Kundenbestellungen).

**Qualität, Sicherheit und Außenhandel (4):** `fairmake-calibration-due` (Kalibrierfälligkeiten), `fairmake-ncr-capa-aging` (Abweichungen und Korrekturmaßnahmen), `fairmake-osha-300-log` (Vollständigkeit des Unfallprotokolls), `fairmake-hts-codes` (Konsistenz der Zolltarifnummern).

## Sicherheit

- **Eine Aufgabe je Agent.** Jeder andere Werkzeugname wird blockiert.
- **Nichts Verbindliches geschieht von selbst.** Kein Agent bucht im ERP, zahlt, versendet Ware, ändert Standards oder Pläne, gibt Sperren frei, überträgt EDI, meldet an Behörden oder versendet Nachrichten. Entwürfe werden als DRAFT gespeichert; die Freigabe braucht immer den Klick einer namentlich genannten Person, auch im Auto-Modus.
- **Personenbezogene Daten werden maskiert.** Namen von Mitarbeitenden erscheinen im Ergebnis für das KI-Modell nur als Kürzel wie `A.R.#3f9a2c`; die Dateien auf Ihrem Rechner enthalten die echten Werte.
- **Nur lokale Dateien**, kein Netzwerk, ein hashverketteter Prüfpfad unter `.fairmake/`.
- **Ihre Regeln.** Toleranzen, Ziele, Fristen, Strafen, Spezifikationen und Codelisten sind Einstellungen in Ihrer eigenen Datei.

## Prüfung

794 Tests und 608 Eval-Fälle bestehen unter Windows mit Node 24; die Durchläufe mit feindlichen Eingaben finden nichts. Einzelheiten in [REVIEW-ver1.md](REVIEW-ver1.md).

## Grenzen

Die Spaltenlayouts benannter Exporte stammen aus Kenntnis der Systeme, nicht aus einem Live-Konto. Toleranzen, Strafen, Spezifikationen und Tarifnummern sind Ihre Einstellungen. Keine Rechts-, Steuer-, Zoll-, Arbeitsschutz- oder Buchhaltungsberatung.

MIT © 2026 Kurt Francisco
