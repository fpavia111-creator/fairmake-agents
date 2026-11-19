# Agentes Fairmake para la fabricación

*Traducido por Claude; pendiente de revisión por un hablante nativo. Prevalece la [README](README.md) en inglés.*

Treinta pequeños agentes MCP para el back office de fabricantes y distribuidores pequeños y medianos. Cada uno tiene **una sola tarea**, como coste estándar frente a real por orden de fabricación, variación del precio de compra, diferencias del conteo cíclico o deducciones de clientes minoristas, y no puede actuar fuera de ella. Leen los archivos que ya exporta de NetSuite, SAP Business One, Epicor, Infor, Acumatica, Fishbowl, JobBOSS, Katana, MRPeasy, QuickBooks Enterprise, su MES, CMMS o sistema de calidad, y archivos EDI 850, 810 y 856; escriben sus informes en su ordenador y esperan a una persona con nombre antes de mover dinero, enviar un mensaje o cambiar un sistema en producción.

Parte de Fair Agents de Mythos Machines. Licencia MIT · Node 20 o superior · solo archivos locales · sin credenciales · sin dependencias. El software es gratuito; la parte de pago es una puesta en marcha a precio fijo sobre sus propios archivos.

## Probar

```bash
npx -y fairmake-cost-variance demo         # coste estándar frente a real por orden, datos ficticios
npx -y fairmake-retailer-deductions demo   # deducciones de minoristas frente a sus envíos
```

Cada agente tiene una `demo` con archivos ficticios, un `eval` con sus propios casos y un servidor MCP (`npx -y <agente> mcp --root <carpeta>`).

## Los agentes

**Costes y margen (7):** `fairmake-cost-variance` (coste estándar frente a real por orden de fabricación), `fairmake-purchase-price-variance` (variación del precio de compra), `fairmake-bom-cost-rollup` (acumulación de costes de la lista de materiales), `fairmake-overhead-absorption` (absorción de gastos generales), `fairmake-wip-aging` (antigüedad de la producción en curso), `fairmake-job-margins` (margen cotizado frente a real), `fairmake-landed-cost` (fletes de entrada, aranceles y agente de aduanas).

**Producción e ingeniería (6):** `fairmake-bom-routing-gaps` (integridad de listas de materiales y rutas), `fairmake-scrap-yield` (desperdicio frente al estándar), `fairmake-labor-efficiency` (eficiencia por centro de trabajo), `fairmake-machine-downtime` (disponibilidad, MTTR y MTBF desde el MES), `fairmake-capacity-load` (carga semanal), `fairmake-preventive-maintenance` (mantenimiento preventivo vencido).

**Inventario y trazabilidad (5):** `fairmake-cycle-counts` (diferencias de conteo por clase ABC), `fairmake-obsolete-inventory` (inventario lento y obsoleto), `fairmake-shelf-life` (caducidad y FEFO), `fairmake-reorder-points` (stock de seguridad y puntos de pedido), `fairmake-lot-traceability` (cortes en la cadena de lotes).

**Compras y proveedores (4):** `fairmake-late-purchase-orders` (órdenes de compra abiertas y retrasadas), `fairmake-supplier-scorecards` (evaluación de proveedores), `fairmake-rebate-claims` (rappels y acuerdos de precio), `fairmake-material-certs` (certificados de material frente a sus especificaciones).

**Clientes, EDI y cumplimiento con minoristas (4):** `fairmake-order-backlog` (cartera de pedidos y fechas comprometidas), `fairmake-retailer-deductions` (deducciones y contracargos), `fairmake-edi-asn-errors` (avisos de envío frente a pedidos), `fairmake-edi-invoice-check` (facturas frente a pedidos de clientes).

**Calidad, seguridad y comercio exterior (4):** `fairmake-calibration-due` (vencimientos de calibración), `fairmake-ncr-capa-aging` (no conformidades y acciones correctivas), `fairmake-osha-300-log` (integridad del registro de lesiones), `fairmake-hts-codes` (coherencia de códigos arancelarios).

## Seguridad

- **Una tarea por agente.** Cualquier otro nombre de herramienta se bloquea.
- **Nada vinculante ocurre solo.** Ningún agente contabiliza en el ERP, paga, envía mercancía, cambia estándares o planes, libera retenciones, transmite EDI, presenta ante organismos ni envía mensajes. Los borradores se marcan DRAFT; aprobarlos exige siempre el clic de una persona con nombre, también en modo Auto.
- **Datos personales enmascarados.** Los nombres de empleados llegan al modelo de IA como fichas tipo `A.R.#3f9a2c`; los archivos en su ordenador conservan los valores reales.
- **Solo archivos locales**, sin red, con un registro de auditoría encadenado en `.fairmake/`.
- **Sus reglas.** Tolerancias, objetivos, plazos, multas, especificaciones y listas de códigos son ajustes en su propio archivo.

## Pruebas

794 pruebas y 608 casos de evaluación pasan en Windows con Node 24; las pasadas con entradas hostiles no encuentran nada. Detalles en [REVIEW-ver1.md](REVIEW-ver1.md).

## Límites

Los diseños de columnas de las exportaciones con nombre provienen del conocimiento de esos sistemas, no de una cuenta real. Tolerancias, multas, especificaciones y códigos arancelarios son sus ajustes. No es asesoramiento legal, fiscal, aduanero, de seguridad ni contable.

MIT © 2026 Kurt Francisco
