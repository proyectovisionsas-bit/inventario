// ════════════════════════════════════════════════════════════════════
// CONTRATO DE SERVICIO · PROYECTOVISION — código compartido
//
// Lo cargan OFICINAS y TECNICOS con <script src="contrato.js"></script>.
// UNA sola copia: si cambia una cláusula, se cambia aquí y las dos apps
// quedan actualizadas. No duplicar este archivo dentro de un HTML.
//
// API:
//   PV_CONTRATO.generarHTML(data)        -> devuelve el HTML del contrato
//   PV_CONTRATO.abrirParaImprimir(data)  -> lo abre en pestaña nueva para imprimir
//   PV_CONTRATO.generarPDF(data)         -> Blob del PDF (necesita jsPDF y html2canvas)
//   PV_CONTRATO.compartirPDF(data)       -> comparte el PDF; devuelve 'archivo',
//                                           'descarga' o 'cancelado'
//   PV_CONTRATO.puedeCompartirArchivos() -> true si el equipo puede adjuntar el PDF
//                                           (celular). En computador suele ser false.
//   PV_CONTRATO.firma.iniciar(canvas)    -> prepara el lienzo para firmar
//   PV_CONTRATO.firma.limpiar()          -> borra el trazo
//   PV_CONTRATO.firma.vacia()            -> true si aún no han firmado
//   PV_CONTRATO.firma.obtener(altoMax)   -> imagen recortada de la firma (base64)
//
// Si data.firma trae una imagen, el contrato sale firmado. Sin ella, el HTML
// es idéntico al que se generaba antes de existir esta funcionalidad.
//
// 'data' es el objeto que arma _imprimirContrato en OFICINAS:
//   { numero, vigencia, valorMin, fechaActivacion, internet, television,
//     adicionales, nombres, apellidos, razonSocial, tipoDoc, numDoc,
//     direccion, barrio, municipio, telefono, correo, plan, velocidad,
//     costoConexion, estrato }
// ════════════════════════════════════════════════════════════════════
(function (global) {
    'use strict';

    // Logo institucional. OFICINAS también lo usa en sus reportes vía LOGO_PV.
    var PV_LOGO = 'data:image/jpeg;base64,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';

    function generarHTML(data) {
        var LOGO_PV = PV_LOGO;

    // Logo PROYECTOVISION embebido en base64

    // Parsear fecha de activación
    let fechaAct={d:'',m:'',a:''};
    if(data.fechaActivacion){
        const [y,m,d]=data.fechaActivacion.split('-');
        fechaAct={d, m, a:y};
    }

    // Generar tabla de permanencia (cuotas mensuales = costoConexion / 12)
    const cuotaBase=Math.round(data.descuento/12);
    const tablaPermanencia=Array.from({length:12},(_,i)=>({
        mes:i+1, valor:cuotaBase*(12-i)
    }));

    // Fmt para PDF — si es contrato en blanco, dejar espacio para llenar
    const blanco = data.esEnBlanco || false;
    const linea = '________________';
    const lineaCorta = '__________';

    // Firma del suscriptor. Si el contrato trae firma (data.firma, una imagen
    // en base64 capturada presencialmente), se dibuja sobre la línea y el hueco
    // en blanco se reduce. Sin firma, la salida queda EXACTAMENTE igual que
    // antes de existir esta funcionalidad: ambas variables valen ''.
    const _firmaImg = data.firma
        ? `<div style="text-align:center;padding-top:2px;"><img src="${data.firma}" alt="Firma del suscriptor" style="max-height:52px;max-width:60%;display:inline-block;"></div>\n        `
        : '';
    const _firmaEstilo = data.firma ? ' style="margin-top:2px;"' : '';
    // v5 — DÓNDE VA UNA RAYA Y DÓNDE NO.
    // Casi todo el contrato YA trae raya impresa: los campos llevan
    // '.field .val { border-bottom:1px solid #000 }' y las celdas de tabla
    // llevan borde completo. Si además se rellenaran con guiones bajos
    // quedaría RAYA DOBLE. Por eso fmt y txt devuelven vacío y dejan que el
    // CSS ponga la línea; el hueco para escribir ya está ahí.
    // La excepción es el párrafo de arriba, donde el valor mensual va suelto
    // dentro de un <strong> SIN raya de CSS: ahí sí hay que dibujarla, y es
    // justo lo que el usuario reportó que no dejaba espacio.
    const fmt=n=>(n?'$'+Number(n).toLocaleString('es-CO'):'');
    const txt=v=>(v||'');
    const txtCorto=v=>(v||'');
    // Para los sitios SIN raya de CSS: si no hay dato, se dibuja una.
    const fmtHueco=n=>(n?'$'+Number(n).toLocaleString('es-CO'):(blanco?'$ '+linea:''));
    const txtHueco=v=>(v||(blanco?lineaCorta:''));
    // Las casillas SÍ dependen de la bandera: un contrato en blanco no debe
    // salir con Internet ya marcado.
    const chk=v=>{
        if(blanco) return '☐';
        return v?'☑':'☐';
    };

    // HTML del contrato (estilo similar al original)
    const html=`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Contrato N° ${txt(data.numero)}</title>
<style>
@page { size: letter; margin: 0.5cm; }
* { box-sizing:border-box; margin:0; padding:0; }
html, body { width:100%; }
body { font-family: Arial, sans-serif; font-size:8.5px; line-height:1.3; color:#000; padding:8px; }

.pagina { page-break-after: always; padding: 6px; }
.pagina:last-child { page-break-after: auto; }

.two-col { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }

.header { text-align:center; margin-bottom:6px; }
.header img { max-width:200px; max-height:110px; display:block; margin:0 auto; }
.header .info { font-size:8px; margin-top:4px; font-weight:bold; }
.header .info .nit { font-size:7.5px; font-weight:normal; }

.section-title { background:#cc0000; color:#fff; font-weight:bold; padding:3px 7px; font-size:9px; margin:6px 0 4px; text-transform:uppercase; letter-spacing:0.3px; }

.field { margin:3px 0; font-size:8.5px; }
.field label { font-weight:bold; }
.field .val { display:inline-block; border-bottom:1px solid #000; min-width:60px; padding:0 4px; }

table { width:100%; border-collapse:collapse; margin:4px 0; font-size:7.8px; }
table th, table td { border:1px solid #000; padding:2px 4px; }
table th { background:#eee; font-weight:bold; text-align:left; }

.checkbox { font-size:11px; font-weight:bold; }

p { margin:4px 0; font-size:8px; text-align:justify; line-height:1.35; }

.permanencia-table { width:100%; border-collapse:collapse; margin-top:4px; font-size:7.5px; }
.permanencia-table td { border:1px solid #000; padding:3px; text-align:center; }
.permanencia-table .mes-label { font-weight:bold; background:#eee; }

.firma-box { border:2px solid #000; padding:6px; margin-top:8px; }
.firma-line { border-top:1px solid #000; padding-top:3px; margin-top:25px; display:flex; justify-content:space-between; font-size:8px; }

.btn-print { position:fixed; top:10px; right:10px; padding:10px 18px; background:#a855f7; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px; box-shadow:0 4px 12px rgba(168,85,247,0.4); }
.btn-print:hover { background:#9333ea; }

@media print { .btn-print { display:none; } }
</style>
</head>
<body>
<button class="btn-print" onclick="window.print()">🖨️ Imprimir contrato</button>

<!-- ═══════════════════════════════════════════════════════ -->
<!-- PÁGINA 1 -->
<!-- ═══════════════════════════════════════════════════════ -->
<div class="pagina">

<div class="header">
    <img src="${LOGO_PV}" alt="Proyectovision">
    <div class="info">
        PROYECTOVISION CLICK ZOMAC S.A.S<br>
        <span class="nit">NIT. 901162494-8 — Registro de TIC No: 96004100</span>
    </div>
</div>

<div class="two-col">

<!-- COLUMNA IZQUIERDA — Datos del cliente y servicio -->
<div>
    <p style="text-align:justify;">Este contrato explica las condiciones para la prestación de los servicios entre usted y PROYECTOVISION CLICK ZOMAC S.A.S. por el que pagará mínimo mensualmente <strong>${fmtHueco(data.valorMin)}</strong>. Este contrato tendrá vigencia de <strong>${txt(data.vigencia)}</strong> meses, contados a partir del <strong>${fechaAct.d?`${fechaAct.d}/${fechaAct.m}/${fechaAct.a}`:'_____/_____/_____'}</strong>. El plazo máximo de instalación es de 5 días hábiles. Acepto que mi contrato se renueve sucesiva y automáticamente por un plazo igual a la inicial.</p>

    <div class="section-title">EL SERVICIO</div>
    <p>Con este contrato nos comprometemos a prestarles los servicios que usted elija: <strong>N° ${txtHueco(data.numero)}</strong></p>
    <p class="checkbox">${chk(data.internet)} Internet fijo &nbsp;&nbsp; ${chk(data.television)} Televisión</p>
    <div class="field"><label>Servicios adicionales:</label> <span class="val">${data.adicionales||''}</span></div>
    <p>Usted se compromete a pagar oportunamente el precio acordado.</p>
    <div class="field"><label>El servicio se activará a más tardar el día:</label> <span class="val">${fechaAct.d?`${fechaAct.d}/${fechaAct.m}/${fechaAct.a}`:''}</span></div>

    <div class="section-title">INFORMACIÓN DEL SUSCRIPTOR</div>
    <div class="field"><label>Contrato No:</label> <span class="val">${txt(data.numero)}</span></div>
    <div class="field"><label>Nombres:</label> <span class="val">${txt(data.nombres)}</span></div>
    <div class="field"><label>Apellidos:</label> <span class="val">${txt(data.apellidos)}</span></div>
    <div class="field"><label>Razón social:</label> <span class="val">${txt(data.razonSocial)}</span></div>
    <div class="field"><label>Documento de identidad:</label>
        ${blanco?'☐':(data.tipoDoc==='CC'?'☑':'☐')} CC &nbsp;
        ${blanco?'☐':(data.tipoDoc==='CE'?'☑':'☐')} CE &nbsp;
        ${blanco?'☐':(data.tipoDoc==='NIT'?'☑':'☐')} NIT
    </div>
    <div class="field"><label>Número:</label> <span class="val">${txt(data.numDoc)}</span></div>
    <div class="field"><label>Dirección:</label> <span class="val">${txt(data.direccion)}</span></div>
    <div class="field">
        <label>Zona:</label> <span class="val">${txt(data.zona)}</span> &nbsp;
        <label>Barrio:</label> <span class="val">${txt(data.barrio)}</span> &nbsp;
        <label>Estrato:</label> <span class="val">${txt(data.estrato)}</span>
    </div>
    <div class="field"><label>Celular:</label> <span class="val">${txt(data.celular)}</span></div>
    <div class="field"><label>Email:</label> <span class="val">${txt(data.email)}</span></div>

    <div class="section-title">CONDICIONES COMERCIALES — CARACTERÍSTICAS DEL PLAN</div>
    <table>
        <tr><th colspan="2">SERVICIOS CONTRATADOS</th><th colspan="2">CARGOS POR INSTALACIÓN/EQUIPOS</th></tr>
        <tr><td>Televisión Básica ${chk(data.tvBasica>0)}</td><td>${fmt(data.tvBasica)}</td><td>Instalación Internet</td><td>${fmt(data.instInternet)}</td></tr>
        <tr><td>Televisor Premium ${chk(data.tvPremium>0)}</td><td>${fmt(data.tvPremium)}</td><td>Instalación TVBox</td><td>${fmt(data.instTvbox)}</td></tr>
        <tr><td>Arriendo TVBox ${chk(data.arrTvbox>0)}</td><td>${fmt(data.arrTvbox)}</td><td>Puntos adicionales</td><td>${fmt(data.ptsAdic)}</td></tr>
        <tr><td><strong>Total Mensuales</strong></td><td><strong>${fmt(data.totalMensual)}</strong></td><td>Otros</td><td>${fmt(data.otros)}</td></tr>
        <tr><td></td><td></td><td><strong>TOTAL A PAGAR 1 VEZ</strong></td><td><strong>${fmt(data.totalUnico)}</strong></td></tr>
    </table>

    <table>
        <tr><th colspan="2">INTERNET</th></tr>
        <tr><td>Plan</td><td>${txt(data.plan)}</td></tr>
        <tr><td>Velocidad ${chk(!!data.velocidad)} Mbps</td><td>${data.velocidad}</td></tr>
        <tr><td><strong>Total internet</strong></td><td><strong>${fmt(data.totalInternet)}</strong></td></tr>
    </table>

    <table>
        <tr><th colspan="3">EQUIPOS ENTREGADOS EN COMODATO</th></tr>
        <tr><th>Equipo</th><th>Serial/Mac</th><th>Valor Comercial</th></tr>
        <tr><td>Cable modem (ONT)</td><td>${txt(data.ontSerial)}</td><td>${fmt(data.ontValor)}</td></tr>
        <tr><td>TVBox</td><td>${txt(data.tvboxSerial)}</td><td>${fmt(data.tvboxValor)}</td></tr>
        <tr><td colspan="2" style="text-align:right;"><strong>Total:</strong></td><td><strong>${fmt(data.totalEquipos)}</strong></td></tr>
    </table>
</div>

<!-- COLUMNA DERECHA — Obligaciones y derechos -->
<div>
    <div class="section-title">PRINCIPALES OBLIGACIONES DEL USUARIO</div>
    <p>1) Pagar oportunamente los servicios prestados,<br>
    2) incluyendo los intereses de mora cuando haya incumplimiento;<br>
    3) Suministrar información verdadera;<br>
    4) Hacer uso adecuado de los equipos y los servicios;<br>
    5) No divulgar ni acceder a pornografía infantil (consultar anexo);<br>
    6) Avisar a las autoridades cualquier evento de robo o hurto de elementos de la red, como el cable;<br>
    7) No cometer o ser partícipe de actividades de fraude.</p>

    <div class="section-title">CALIDAD Y COMPENSACIÓN</div>
    <p>Cuando se presente indisponibilidad del servicio o este se suspenda a pesar de su pago oportuno, lo compensaremos en su próxima factura. Debemos cumplir con las condiciones de calidad definidas por la CRC.</p>

    <div class="section-title">CESIÓN</div>
    <p>Si quiere ceder este contrato a otra persona, debe presentar una solicitud por escrito a través de nuestros Medios de Atención, acompañada de la aceptación por escrito de la persona a la que se hará la cesión. Dentro de los 15 días hábiles siguientes, analizaremos su solicitud y le daremos una respuesta. Si se acepta la cesión queda liberado de cualquier responsabilidad con nosotros.</p>

    <div class="section-title">MODIFICACIÓN</div>
    <p>Nosotros no podemos modificar el contrato sin su autorización. Esto incluye que no podemos cobrarle servicios que no haya aceptado expresamente. Si esto ocurre tiene derecho a terminar el contrato, incluso estando vigente la cláusula de permanencia mínima, sin la obligación de pagar suma alguna por este concepto. No obstante, usted puede en cualquier momento modificar los servicios contratados. Dicha modificación se hará efectiva en el periodo de facturación siguiente, para lo cual deberá presentar la solicitud de modificación por lo menos con 3 días hábiles de anterioridad al corte de facturación.</p>

    <div class="section-title">SUSPENSIÓN</div>
    <p>Usted tiene derecho a solicitar la suspensión del servicio por un máximo de 2 meses al año. Para esto debe presentar la solicitud antes del inicio del ciclo de facturación que desea suspender. Si existe una cláusula de permanencia mínima, su vigencia se prorrogará por el tiempo que dure la suspensión.</p>

    <div class="section-title">TERMINACIÓN</div>
    <p>Usted puede terminar el contrato en cualquier momento después de cumplida la permanencia mínima aceptada por usted en el anexo al presente contrato. Para esto debe realizar una solicitud a través de cualquiera de nuestros Medios de Atención mínimo 3 días hábiles antes del corte de facturación (su corte de facturación es el día 30 de cada mes). Si presenta la solicitud con una anticipación menor, la terminación del servicio se dará en el siguiente periodo de facturación. Así mismo, usted puede cancelar cualquiera de los servicios contratados, para lo que le informaremos las condiciones en las que serán prestados los servicios no cancelados y actualizaremos el contrato. Así mismo, si el operador no inicia la prestación del servicio en el plazo acordado, usted puede pedir la restitución de su dinero y la terminación del contrato.</p>
</div>

</div>
</div>

<!-- ═══════════════════════════════════════════════════════ -->
<!-- PÁGINA 2 -->
<!-- ═══════════════════════════════════════════════════════ -->
<div class="pagina">

<div class="two-col">

<!-- COLUMNA IZQUIERDA — Pago, medios atención, permanencia -->
<div>
    <div class="section-title">PAGO Y FACTURACIÓN</div>
    <p>La factura le debe llegar como mínimo 5 días hábiles antes de la fecha de pago. Si no llega, puede solicitarla a través de nuestros Medios de Atención y debe pagarla oportunamente.</p>
    <p>Si no paga a tiempo, previo aviso, suspenderemos su servicio hasta que pague sus saldos pendientes. Contamos con 3 días hábiles luego de su pago para reconectarle el servicio. Si no paga a tiempo, también podemos reportar su deuda a las centrales de riesgo. Para esto tenemos que avisarle por lo menos con 20 días calendario de anticipación. Si paga luego de este reporte tenemos la obligación dentro del mes de seguimiento de informar su pago para que ya no aparezca reportado.</p>
    <p>Si tiene un reclamo sobre su factura, puede presentarlo antes de la fecha de pago y en ese caso no debe pagar las sumas reclamadas hasta que resolvamos su solicitud. Si ya pagó, tiene 6 meses para presentar la reclamación.</p>

    <p style="border:1px solid #000;padding:4px;margin-top:4px;text-align:center;font-size:7.5px;">Con esta firma acepta recibir la factura solamente por medios electrónicos</p>

    <div class="section-title">CÓMO COMUNICARSE CON NOSOTROS (MEDIOS DE ATENCIÓN)</div>
    <p style="font-size:7.5px;">
    <strong>1.</strong> Nuestros medios de atención son:<br>
    • Cr 6# 12-24 B/ Raicero - Florencia, CEL: 322 847 6612<br>
    • Cr 5# 5-56 - B/ Recreo - El Doncello, CEL: 315 7033416<br>
    • Cr 5 cl 5 esquina B/ centro - El paujil, CEL: 318 6219451<br>
    • Cra. 2 #2-45 -13/ Centro - Cartagena del Chaira, CEL: 311 545 7323<br>
    CORREO: <strong>proyectovisions.a.s@gmail.com</strong></p>
    <p style="font-size:7.5px;"><strong>2.</strong> Presente cualquier queja, petición/reclamo o recurso a través de estos medios y le responderemos en máximo 15 días hábiles.</p>
    <p style="font-size:7.5px;"><strong>3.</strong> Si no respondemos es porque aceptamos su petición o reclamo. Esto se llama silencio administrativo positivo y aplica para internet y telefonía.</p>

    <p style="font-size:8px;font-weight:bold;margin-top:4px;">Si no está de acuerdo con nuestra respuesta:</p>
    <p style="font-size:7.5px;"><strong>4.</strong> Cuando su queja o petición sea por los servicios de telefonía y/o internet, y esté relacionada con actos de negativa del contrato, suspensión del servicio, terminación del contrato, corte y/o facturación; usted puede insistir en su solicitud ante nosotros, dentro de los 10 días hábiles siguientes a la respuesta, y pedir que si no llegamos a una solución satisfactoria para usted, enviemos su reclamo directamente a la SIC (Superintendencia de Industria y Comercio) quien resolverá de manera definitiva su solicitud. Esto se llama recurso de reposición y en subsidio apelación.</p>
    <p style="font-size:7.5px;">Cuando su queja o petición sea por el servicio de televisión, puede enviar la misma al Mintic, para que esta Entidad resuelva su solicitud.</p>

    <div class="section-title">ACEPTO LA CLÁUSULA DE PERMANENCIA ${chk(true)}</div>
    <p>En consideración a que le estamos otorgando un descuento respecto del valor del cargo por conexión, o le diferimos el pago del mismo, se incluye la presente cláusula de permanencia mínima. En la factura encontrará el valor a pagar si decide terminar el contrato anticipadamente.</p>

    <table>
        <tr><td><strong>Costo total del cargo por conexión:</strong></td><td><strong>${fmt(data.costoConexion)}</strong></td></tr>
        <tr><td><strong>Valor de descuento:</strong></td><td><strong>${fmt(data.descuento)}</strong></td></tr>
    </table>

    <table class="permanencia-table">
        <tr>
            <td class="mes-label">Mes 1</td>
            <td class="mes-label">Mes 2</td>
            <td class="mes-label">Mes 3</td>
            <td class="mes-label">Mes 4</td>
            <td class="mes-label">Mes 5</td>
            <td class="mes-label">Mes 6</td>
        </tr>
        <tr>
            ${tablaPermanencia.slice(0,6).map(t=>`<td>${fmt(t.valor)}</td>`).join('')}
        </tr>
        <tr>
            <td class="mes-label">Mes 7</td>
            <td class="mes-label">Mes 8</td>
            <td class="mes-label">Mes 9</td>
            <td class="mes-label">Mes 10</td>
            <td class="mes-label">Mes 11</td>
            <td class="mes-label">Mes 12</td>
        </tr>
        <tr>
            ${tablaPermanencia.slice(6,12).map(t=>`<td>${fmt(t.valor)}</td>`).join('')}
        </tr>
    </table>
</div>

<!-- COLUMNA DERECHA — Cambio domicilio, reconexión, cargos -->
<div>
    <div class="section-title">CAMBIO DE DOMICILIO</div>
    <p>Usted puede cambiar de domicilio y continuar con el servicio siempre que sea técnicamente posible. Si desde el punto de vista técnico no es viable el traslado del servicio, usted puede ceder su contrato a un tercero o terminarlo pagando el valor de la cláusula de permanencia mínima si está vigente.</p>

    <div class="section-title">COBRO POR RECONEXIÓN DEL SERVICIO</div>
    <p>En caso de suspensión del servicio por mora en el pago, podremos cobrarle un valor por reconexión que corresponderá estrictamente a los costos asociados a la operación de reconexión. En caso de servicios empaquetados procede máximo un cobro de reconexión por cada tipo de conexión empleado en la prestación de los servicios. <strong>Costo reconexión: $ 20.000</strong></p>

    <div style="background:#fdecec;border:1px solid #cc0000;padding:6px;margin:5px 0;font-size:7.8px;color:#cc0000;">
        <p style="margin:0;text-align:justify;">El usuario es el <strong>ÚNICO</strong> responsable por el contenido y la información que se curse a través de la red y del uso que se haga de los equipos o de los servicios.</p>
        <p style="margin:3px 0 0;text-align:justify;">Los equipos de comunicaciones que ya no use son desechos que no deben ser botados a la caneca, consulte nuestra política de recolección de aparatos en desuso.</p>
    </div>

    <p style="font-size:7.5px;text-align:justify;"><strong>1. EQUIPOS:</strong> En el evento que la empresa para efectos de la prestación del servicio, ponga a disposición del cliente equipos, éste último reconoce que la empresa es la propietaria legítima de los equipos asociados a la prestación de los servicios, dichos equipos son entregados en comodato y/o alquiler, para la prestación y operación del servicio, las partes acuerdan que deben ser entregados a la terminación del contrato, y que éstos serán facturados y debidamente cancelados por parte del cliente en caso de daño, pérdida, hurto, incluyendo daños derivados por variaciones de energía, descargas atmosféricas o el mal uso de los equipos, conforme el valor comercial de los mismos.</p>

    <p style="font-size:7.5px;text-align:justify;"><strong>2. CARGOS ADICIONALES:</strong> Las partes acuerdan que podrán incluirse otros cargos derivados de la prestación del servicio como; Cargos Eventuales: 1. Cargo por cada solicitud de traslado de equipos a una nueva dirección según la tarifa vigente. 2. Visitas Técnicas, Cuando se presenten fallas en el servicio por causas imputables al cliente, bien sea por conexiones inadecuadas, mal uso o desconfiguración de los equipos, problemas técnicos originados por la red interna del cliente, virus o cualquier otra, que sea de su responsabilidad, el cliente autoriza a través del presente documento cobrar el valor correspondiente en la siguiente factura. 3. Excedente por metro de cable adicional al autorizado para la instalación, al momento de realizar instalaciones y traslados solicitados por usted.</p>

    <p style="font-size:7.5px;text-align:justify;"><strong>4. VELOCIDAD:</strong> No podemos garantizar vía wifi la velocidad contratada, toda vez que ésta depende de múltiples aspectos, que no son siempre directamente imputables al proveedor del servicio, por ejemplo: equipos, configuración, tarjetas de red, obstáculos físicos permanentes y/o transitorios, entre otros.</p>

    <div class="firma-box">
        <p style="text-align:center;font-weight:bold;font-size:9px;margin-bottom:6px;">Aceptación contrato mediante firma o cualquier otro medio válido</p>
        ${_firmaImg}<div class="firma-line"${_firmaEstilo}>
            <span><strong>C.C.</strong> ${txtHueco(data.numDoc)}</span>
            <span><strong>Fecha:</strong> ${blanco?'_____/_____/_____':`${fechaAct.d}/${fechaAct.m}/${fechaAct.a}`}</span>
        </div>
        <p style="font-size:6.5px;color:#666;margin-top:4px;text-align:center;">Consulte el régimen de protección de usuario en www.crcom.gov.co</p>
    </div>
</div>

</div>
</div>

</body>
</html>`;
        return html;
    }

    function abrirParaImprimir(data) {
        var html = generarHTML(data);
        var w = global.open('', '_blank');
        if (!w) { global.alert('⚠️ Permite ventanas emergentes para imprimir el contrato'); return false; }
        w.document.write(html);
        w.document.close();
        return true;
    }


    // ════════════════════════════════════════════════════════════════
    // FIRMA PRESENCIAL
    // Eventos de puntero: sirven igual para dedo, lápiz y mouse.
    // Vive aquí y no en cada app para que OFICINAS y TECNICOS usen lo mismo.
    // ════════════════════════════════════════════════════════════════
    var _fEstado = null;

    function firmaIniciar(canvas, altoCss) {
        if (!canvas) return null;
        var cont = canvas.parentElement || canvas;
        var dpr = global.devicePixelRatio || 1;
        var ancho = Math.max(260, (cont.clientWidth || 320) - 4);
        var alto = altoCss || 180;

        canvas.width = ancho * dpr;
        canvas.height = alto * dpr;
        canvas.style.width = ancho + 'px';
        canvas.style.height = alto + 'px';
        canvas.style.touchAction = 'none';   // sin esto el dedo desplaza la página

        var ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';

        var est = { canvas: canvas, ctx: ctx, dpr: dpr, trazos: 0, dibujando: false };
        _fEstado = est;

        function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
        canvas.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
            est.dibujando = true; est.trazos++;
            var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
        });
        canvas.addEventListener('pointermove', function (e) {
            if (!est.dibujando) return;
            e.preventDefault();
            var p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
        });
        function soltar(e) {
            if (!est.dibujando) return;
            est.dibujando = false;
            try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        }
        canvas.addEventListener('pointerup', soltar);
        canvas.addEventListener('pointercancel', soltar);
        canvas.addEventListener('pointerleave', soltar);
        return est;
    }

    function firmaLimpiar() {
        if (!_fEstado) return;
        _fEstado.ctx.clearRect(0, 0, _fEstado.canvas.width, _fEstado.canvas.height);
        _fEstado.trazos = 0;
    }

    function firmaVacia() { return !_fEstado || _fEstado.trazos === 0; }

    // Recorta el blanco alrededor del trazo. Sin esto se guardaría el lienzo
    // entero: mucho más pesado y la firma saldría diminuta en el contrato.
    function firmaObtener(altoMax) {
        if (firmaVacia()) return null;
        var cv = _fEstado.canvas, dpr = _fEstado.dpr;
        var datos = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        var x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0, hay = false;
        for (var y = 0; y < cv.height; y++) {
            for (var x = 0; x < cv.width; x++) {
                if (datos[(y * cv.width + x) * 4 + 3] > 10) {
                    hay = true;
                    if (x < x0) x0 = x; if (x > x1) x1 = x;
                    if (y < y0) y0 = y; if (y > y1) y1 = y;
                }
            }
        }
        if (!hay) return null;
        var m = Math.round(6 * dpr);
        x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
        x1 = Math.min(cv.width - 1, x1 + m); y1 = Math.min(cv.height - 1, y1 + m);

        var w = x1 - x0 + 1, h = y1 - y0 + 1;
        var esc = Math.min(1, (altoMax || 120) / h);
        var dest = document.createElement('canvas');
        dest.width = Math.round(w * esc); dest.height = Math.round(h * esc);
        dest.getContext('2d').drawImage(cv, x0, y0, w, h, 0, 0, dest.width, dest.height);
        return dest.toDataURL('image/png');
    }

    // ════════════════════════════════════════════════════════════════
    // PDF Y COMPARTIR
    // El contrato se dibuja en una ventana oculta, se captura con
    // html2canvas y se arma un PDF carta con jsPDF, cortándolo en páginas.
    // Ambas librerías deben estar cargadas por la app que llame.
    // ════════════════════════════════════════════════════════════════
    var LIB_JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    var LIB_H2C = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

    function _cargarScript(url) {
        return new Promise(function (res, rej) {
            var s = document.createElement('script');
            s.src = url;
            s.onload = function () { res(); };
            s.onerror = function () { rej(new Error('No se pudo cargar ' + url)); };
            document.head.appendChild(s);
        });
    }

    function _hayPdf() { return !!((global.jspdf && global.jspdf.jsPDF) || global.jsPDF); }

    // Se cargan solo cuando alguien pide un PDF: así ninguna app carga ~400 KB
    // de librerías en cada arranque. OFICINAS ya hacía lo mismo con jsPDF.
    async function _asegurarLibs() {
        var faltan = [];
        if (!_hayPdf()) faltan.push(_cargarScript(LIB_JSPDF));
        if (typeof global.html2canvas === 'undefined') faltan.push(_cargarScript(LIB_H2C));
        if (faltan.length) await Promise.all(faltan);
        if (!_hayPdf() || typeof global.html2canvas === 'undefined') {
            throw new Error('No se pudieron cargar las librerías de PDF. Revisa la conexión a internet.');
        }
    }

    function _nuevoPDF() {
        var C = (global.jspdf && global.jspdf.jsPDF) || global.jsPDF;
        return new C({ unit: 'pt', format: 'letter', orientation: 'portrait' });
    }

    async function generarPDF(data) {
        await _asegurarLibs();

        var caja = document.createElement('div');
        caja.style.cssText = 'position:fixed;left:-10000px;top:0;width:816px;background:#fff;z-index:-1;';
        caja.innerHTML = generarHTML(data)
            .replace(/^[\s\S]*?<body[^>]*>/i, '')
            .replace(/<\/body>[\s\S]*$/i, '')
            .replace(/<button[\s\S]*?<\/button>/gi, '');   // fuera el botón de imprimir
        document.body.appendChild(caja);

        try {
            var lienzo = await global.html2canvas(caja, { scale: 2, backgroundColor: '#fff', logging: false, useCORS: true });
            var pdf = _nuevoPDF();
            var anchoPt = pdf.internal.pageSize.getWidth();
            var altoPt = pdf.internal.pageSize.getHeight();
            var altoPagPx = Math.floor(lienzo.width * (altoPt / anchoPt));
            var paginas = Math.max(1, Math.ceil(lienzo.height / altoPagPx));

            for (var p = 0; p < paginas; p++) {
                var trozo = document.createElement('canvas');
                trozo.width = lienzo.width;
                trozo.height = Math.min(altoPagPx, lienzo.height - p * altoPagPx);
                var c = trozo.getContext('2d');
                c.fillStyle = '#fff'; c.fillRect(0, 0, trozo.width, trozo.height);
                c.drawImage(lienzo, 0, -p * altoPagPx);
                if (p > 0) pdf.addPage();
                pdf.addImage(trozo.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0,
                    anchoPt, trozo.height * (anchoPt / trozo.width));
            }
            return pdf.output('blob');
        } finally {
            caja.remove();
        }
    }

    function _nombreArchivo(data) {
        var n = (data && data.numero ? String(data.numero) : 'contrato').replace(/[^A-Za-z0-9_-]+/g, '_');
        return 'Contrato_' + n + '.pdf';
    }

    // Devuelve cómo se compartió: 'archivo' (adjunto real, típico en celular),
    // 'descarga' (el navegador no permite adjuntar) o 'cancelado'.
    async function compartirPDF(data) {
        var blob = await generarPDF(data);
        var nombre = _nombreArchivo(data);
        var archivo = new File([blob], nombre, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [archivo] }) && navigator.share) {
            try {
                await navigator.share({ files: [archivo], title: nombre });
                return 'archivo';
            } catch (e) {
                if (e && e.name === 'AbortError') return 'cancelado';
            }
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = nombre;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        return 'descarga';
    }

    function puedeCompartirArchivos() {
        try { return !!(navigator.canShare && navigator.share &&
            navigator.canShare({ files: [new File([new Blob(['x'])], 'x.pdf', { type: 'application/pdf' })] })); }
        catch (e) { return false; }
    }


    // ════════════════════════════════════════════════════════════════
    // FORMULARIO COMPARTIDO (v3)
    //
    // Antes cada app dibujaba SU propio formulario: OFICINAS con 37 campos y
    // TECNICOS con 11. Eran dos interfaces distintas para el mismo contrato y
    // se desincronizaban en cada cambio. Ahora el formulario se GENERA desde
    // esta tabla, así que las dos apps son idénticas por construcción.
    //
    // Los ids siguen siendo ctr_* para no romper nada de lo que ya existía.
    // El CSS viaja aquí dentro (con prefijo pvc-) porque TECNICOS no tiene las
    // clases de OFICINAS: sin esto el formulario saldría sin estilo en el móvil.
    // ════════════════════════════════════════════════════════════════
    var FORM_SECCIONES = [
        { tit: 'EL SERVICIO', ico: '📌', campos: [
            { id: 'numero',            et: 'N° de Contrato *',        ph: '0094' },
            { id: 'vigencia',          et: 'Vigencia (meses)',             t: 'number', cfg: 'vigencia' },
            { id: 'valor_min',         et: 'Valor mensual mínimo',    t: 'number', ph: '30000', cfg: 'valorMin' },
            { id: 'fecha_activacion',  et: 'Fecha activación servicio', t: 'date', hoy: true },
            { servicios: true },
            { id: 'adicionales',       et: 'Servicios adicionales',        ph: '(opcional)', ancho: true }
        ] },
        { tit: 'INFORMACIÓN DEL SUSCRIPTOR', ico: '👤', campos: [
            { id: 'nombres',      et: 'Nombres *',            ph: 'JUAN ANDRÉS' },
            { id: 'apellidos',    et: 'Apellidos *',          ph: 'PÉREZ GÓMEZ' },
            { id: 'razon_social', et: 'Razón social',    ph: '(si aplica)' },
            { id: 'tipo_doc',     et: 'Tipo de documento *',  opciones: ['CC', 'CE', 'NIT', 'PAS', 'TI'] },
            { id: 'num_doc',      et: 'Número documento *', ph: '1234567890' },
            { id: 'celular',      et: 'Celular *',            ph: '3001234567' },
            { id: 'direccion',    et: 'Dirección *',     ph: 'Cr 12 # 34-56', ancho: true },
            { id: 'email',        et: 'Email',                t: 'email', ph: 'cliente@email.com' },
            { id: 'zona',         et: 'Zona',                 ph: 'Urbana' },
            { id: 'barrio',       et: 'Barrio',               ph: 'Centro' },
            { id: 'estrato',      et: 'Estrato',              t: 'number', ph: '3' }
        ] },
        { tit: 'CONDICIONES COMERCIALES', ico: '💰', campos: [
            { id: 'tv_basica',     et: 'Televisión Básica $', t: 'number', ph: '0', cfg: 'tvBasica',  suma: true },
            { id: 'tv_premium',    et: 'Televisor Premium $',           t: 'number', ph: '0', cfg: 'tvPremium', suma: true },
            { id: 'arr_tvbox',     et: 'Arriendo TVBox $',              t: 'number', ph: '0', cfg: 'arrTvbox',  suma: true },
            { id: 'total_mensual', et: 'Total Mensual $ *',             t: 'number', ph: '30000', total: true },
            { sub: 'Cargos por instalación / equipos especiales' },
            { id: 'inst_internet', et: 'Instalación Internet $',   t: 'number', ph: '0', cfg: 'instInternet' },
            { id: 'inst_tvbox',    et: 'Instalación TVBox $',      t: 'number', ph: '0', cfg: 'instTvbox' },
            { id: 'pts_adic',      et: 'Puntos adicionales $',          t: 'number', ph: '0', cfg: 'ptsAdic' },
            { id: 'otros',         et: 'Otros $',                       t: 'number', ph: '0' },
            { id: 'total_unico',   et: 'Total a pagar 1 vez $',         t: 'number', ph: '0' }
        ] },
        { tit: 'INTERNET', ico: '🌐', campos: [
            { id: 'plan',           et: 'Plan',              ph: 'Hogar 50 Mbps' },
            { id: 'velocidad',      et: 'Velocidad (Mbps)',  t: 'number', ph: '50' },
            { id: 'total_internet', et: 'Total Internet $',  t: 'number', ph: '0', suma: true }
        ] },
        { tit: 'EQUIPOS EN COMODATO', ico: '📦', campos: [
            { id: 'ont_serial',    et: 'Cable módem (ONT) - Serial/MAC', ph: 'ABC123456' },
            { id: 'ont_valor',     et: 'ONT - Valor Comercial $',   t: 'number', ph: '0', cfg: 'ontValor' },
            { id: 'tvbox_serial',  et: 'TVBox - Serial/MAC',        ph: 'XYZ789012' },
            { id: 'tvbox_valor',   et: 'TVBox - Valor Comercial $', t: 'number', ph: '0', cfg: 'tvboxValor' },
            { id: 'total_equipos', et: 'Total Equipos $',           t: 'number', ph: '0' }
        ] },
        { tit: 'PERMANENCIA', ico: '📅', campos: [
            { id: 'costo_conexion', et: 'Costo total por conexión $', t: 'number', ph: '360000', cfg: 'costoConexion' },
            { id: 'descuento',      et: 'Valor de descuento $',            t: 'number', ph: '360000', cfg: 'descuento' }
        ] }
    ];

    function _escF(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function _hoyLocalF() {
        // Fecha LOCAL: con toISOString() en Colombia (UTC-5) despues de las 7 p.m.
        // el contrato saldria fechado al dia siguiente.
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
               '-' + String(d.getDate()).padStart(2, '0');
    }

    var CSS_FORM = [
        '.pvc-sec{font-size:0.9rem;font-weight:700;color:#ef4444;background:rgba(239,68,68,0.09);',
        'padding:7px 11px;border-radius:6px;margin:16px 0 10px;}',
        '.pvc-sub{font-size:0.8rem;font-weight:600;opacity:0.7;margin:12px 0 6px;}',
        '.pvc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;}',
        '.pvc-campo{display:flex;flex-direction:column;gap:4px;}',
        '.pvc-campo.ancho{grid-column:1/-1;}',
        '.pvc-campo label{font-size:0.76rem;font-weight:600;opacity:0.8;}',
        '.pvc-campo input,.pvc-campo select{width:100%;padding:9px 11px;border-radius:8px;',
        'border:1px solid rgba(128,128,128,0.4);background:rgba(128,128,128,0.08);',
        'color:inherit;font-size:0.9rem;font-family:inherit;box-sizing:border-box;}',
        '.pvc-campo input:focus,.pvc-campo select:focus{outline:2px solid #a855f7;outline-offset:-1px;}',
        '.pvc-serv{display:flex;gap:16px;padding:7px 0;flex-wrap:wrap;}',
        '.pvc-serv label{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85rem;font-weight:500;}',
        '.pvc-serv input{width:auto;}',
        '.pvc-firma-caja{background:#fff;border:2px dashed #9ca3af;border-radius:10px;padding:2px;}',
        '.pvc-firma-caja canvas{display:block;background:#fff;border-radius:8px;width:100%;}',
        '.pvc-aviso{font-size:0.78rem;opacity:0.75;margin:4px 0 0;}'
    ].join('');

    function _ponerCss() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('pvcFormCss')) return;
        var s = document.createElement('style');
        s.id = 'pvcFormCss';
        s.textContent = CSS_FORM;
        document.head.appendChild(s);
    }

    // op = { cfg: condiciones de la oficina, datos: valores iniciales, firma: true }
    function formularioHTML(op) {
        op = op || {};
        var cfg = op.cfg || {};
        var d = op.datos || {};
        _ponerCss();

        var partes = [];
        FORM_SECCIONES.forEach(function (sec) {
            partes.push('<div class="pvc-sec">' + sec.ico + ' ' + _escF(sec.tit) + '</div>');
            partes.push('<div class="pvc-grid">');
            sec.campos.forEach(function (c) {
                if (c.sub) {
                    partes.push('</div><div class="pvc-sub">' + _escF(c.sub) + '</div><div class="pvc-grid">');
                    return;
                }
                if (c.servicios) {
                    partes.push('<div class="pvc-campo ancho"><label>Servicios contratados</label><div class="pvc-serv">' +
                        '<label><input type="checkbox" id="ctr_internet"' + (d.internet === false ? '' : ' checked') + '> Internet fijo</label>' +
                        '<label><input type="checkbox" id="ctr_television"' + (d.television ? ' checked' : '') + '> Televisión</label>' +
                        '</div></div>');
                    return;
                }
                // Valor inicial: lo que venga en datos, si no la condicion de la oficina.
                var val = d[c.id];
                if ((val === undefined || val === null || val === '') && c.cfg) val = cfg[c.cfg];
                if ((val === undefined || val === null) && c.hoy) val = _hoyLocalF();
                if (val === undefined || val === null) val = '';

                var extra = '';
                if (c.suma)  extra = ' oninput="PV_CONTRATO.sumarMensual()"';
                if (c.total) extra = ' oninput="window._ctrTotalManual=true;"';

                partes.push('<div class="pvc-campo' + (c.ancho ? ' ancho' : '') + '">');
                partes.push('<label>' + _escF(c.et) + '</label>');
                if (c.opciones) {
                    partes.push('<select id="ctr_' + c.id + '">' + c.opciones.map(function (o) {
                        return '<option value="' + _escF(o) + '"' + (String(val) === o ? ' selected' : '') + '>' + _escF(o) + '</option>';
                    }).join('') + '</select>');
                } else {
                    partes.push('<input id="ctr_' + c.id + '" type="' + (c.t || 'text') + '"' +
                        (c.ph ? ' placeholder="' + _escF(c.ph) + '"' : '') +
                        ' value="' + _escF(val) + '"' + extra + '>');
                }
                partes.push('</div>');
            });
            partes.push('</div>');
        });

        if (op.firma !== false) {
            partes.push('<div class="pvc-sec">✍️ FIRMA DEL CLIENTE</div>');
            partes.push('<div class="pvc-firma-caja"><canvas id="ctrFirma"></canvas></div>');
            partes.push('<p class="pvc-aviso">Que el cliente firme aquí con el dedo o el mouse ANTES de generar el PDF. Si no puede firmar ahora, se puede guardar sin firma y firmarlo después.</p>');
            partes.push('<button type="button" class="pvc-borrar" onclick="PV_CONTRATO.firma.limpiar()" ' +
                'style="margin-top:8px;padding:7px 12px;border-radius:8px;border:1px solid rgba(128,128,128,0.4);' +
                'background:transparent;color:inherit;cursor:pointer;font-size:0.82rem;">🧹 Borrar firma</button>');
        }
        return partes.join('');
    }

    // Prepara el lienzo de firma DESPUES de que el formulario este en pantalla.
    function iniciarFirmaForm(altoCss) {
        if (typeof document === 'undefined') return;
        var cv = document.getElementById('ctrFirma');
        if (cv) firmaIniciar(cv, altoCss || 150);
    }

    // El TOTAL MENSUAL se calcula solo. Si alguien lo escribe a mano, se respeta.
    function sumarMensual() {
        if (typeof document === 'undefined') return;
        try {
            if (global._ctrTotalManual) return;
            var n = function (id) {
                var v = document.getElementById(id);
                var x = v ? parseFloat(v.value) : 0;
                return isNaN(x) ? 0 : x;
            };
            var total = n('ctr_total_internet') + n('ctr_tv_basica') + n('ctr_tv_premium') + n('ctr_arr_tvbox');
            var el = document.getElementById('ctr_total_mensual');
            if (el) el.value = total > 0 ? total : '';
        } catch (e) {}
    }

    // Lee un numero distinguiendo "vacio" de "escribio 0". Sin esto, un 0 puesto
    // a proposito (cliente sin television, descuento de cero) se trataba como si
    // el campo estuviera sin llenar.
    function _numF(id, porDefecto) {
        var el = (typeof document !== 'undefined') ? document.getElementById(id) : null;
        var s = (el && el.value != null) ? String(el.value).trim() : '';
        if (s === '') return (porDefecto !== undefined ? porDefecto : 0);
        var n = parseFloat(s.replace(/[^0-9.,-]/g, '').replace(',', '.'));
        return isNaN(n) ? 0 : n;
    }

    function _txtF(id) {
        var el = (typeof document !== 'undefined') ? document.getElementById(id) : null;
        return (el && el.value ? String(el.value) : '').trim();
    }

    // Devuelve el objeto de datos del contrato, con la MISMA forma de siempre.
    function leerFormulario(op) {
        op = op || {};
        var cfg = op.cfg || {};
        var d = {
            numero: _txtF('ctr_numero'),
            vigencia: _txtF('ctr_vigencia') || String(cfg.vigencia || 12),
            valorMin: _numF('ctr_valor_min', cfg.valorMin || 0),
            fechaActivacion: _txtF('ctr_fecha_activacion'),
            internet: !!(typeof document !== 'undefined' && document.getElementById('ctr_internet') && document.getElementById('ctr_internet').checked),
            television: !!(typeof document !== 'undefined' && document.getElementById('ctr_television') && document.getElementById('ctr_television').checked),
            adicionales: _txtF('ctr_adicionales'),
            nombres: _txtF('ctr_nombres'),
            apellidos: _txtF('ctr_apellidos'),
            razonSocial: _txtF('ctr_razon_social'),
            tipoDoc: _txtF('ctr_tipo_doc'),
            numDoc: _txtF('ctr_num_doc'),
            celular: _txtF('ctr_celular'),
            telefono: _txtF('ctr_celular'),
            direccion: _txtF('ctr_direccion'),
            email: _txtF('ctr_email'),
            correo: _txtF('ctr_email'),
            zona: _txtF('ctr_zona'),
            barrio: _txtF('ctr_barrio'),
            municipio: op.municipio || '',
            estrato: _txtF('ctr_estrato'),
            tvBasica: _numF('ctr_tv_basica'),
            tvPremium: _numF('ctr_tv_premium'),
            arrTvbox: _numF('ctr_arr_tvbox'),
            totalMensual: _numF('ctr_total_mensual'),
            instInternet: _numF('ctr_inst_internet'),
            instTvbox: _numF('ctr_inst_tvbox'),
            ptsAdic: _numF('ctr_pts_adic'),
            otros: _numF('ctr_otros'),
            totalUnico: _numF('ctr_total_unico'),
            plan: _txtF('ctr_plan'),
            velocidad: _txtF('ctr_velocidad'),
            totalInternet: _numF('ctr_total_internet'),
            ontSerial: _txtF('ctr_ont_serial'),
            ontValor: _numF('ctr_ont_valor'),
            tvboxSerial: _txtF('ctr_tvbox_serial'),
            tvboxValor: _numF('ctr_tvbox_valor'),
            totalEquipos: _numF('ctr_total_equipos'),
            // El valor por defecto solo se aplica si el campo quedo VACIO.
            costoConexion: _numF('ctr_costo_conexion', cfg.costoConexion !== undefined ? cfg.costoConexion : 360000),
            descuento: _numF('ctr_descuento', cfg.descuento !== undefined ? cfg.descuento : 360000)
        };
        if (!firmaVacia()) d.firma = firmaObtener(120);
        return d;
    }

    // Avisos de campos obligatorios. Devuelve '' si todo esta bien.
    function validarFormulario(d) {
        if (!d.numero) return 'El número de contrato es obligatorio.';
        if (!d.nombres || !d.apellidos) return 'Nombres y apellidos son obligatorios.';
        if (!d.numDoc) return 'El número de documento es obligatorio.';
        if (!d.direccion) return 'La dirección es obligatoria.';
        if (!d.celular) return 'El celular es obligatorio.';
        // OJO: aqui NO se usa !d.totalMensual, porque !0 es verdadero en JavaScript
        // y un cero puesto a proposito quedaria rechazado como si faltara.
        if (!(d.totalMensual >= 0)) return 'El total mensual no es un número válido.';
        return '';
    }

    // Contrato EN BLANCO pero CON las condiciones de la oficina ya puestas:
    // vigencia, costo de conexion, descuento y la lista de precios. Solo quedan
    // vacios los datos del cliente, que son los que se llenan a mano.
    function datosEnBlanco(cfg) {
        cfg = cfg || {};
        var v = function (k, d) { var x = cfg[k]; return (x === undefined || x === null || x === '') ? d : x; };
        return {
            // v5: ESTA BANDERA FALTABA Y ROMPIA EL CONTRATO EN BLANCO.
            // generarHTML hace 'const blanco = data.esEnBlanco || false' y de ella
            // dependen los cuatro formateadores (fmt, txt, chk, txtCorto) y las
            // seis casillas de fecha y documento. Como NADIE la ponia, blanco era
            // siempre false: en vez de lineas para escribir salian valores vacios
            // — el valor mensual salia en blanco (porque fmt(0) devuelve '') y la
            // fecha salia como '//' al unir dia, mes y anio vacios. Por eso no
            // habia donde diligenciar.
            esEnBlanco: true,
            numero: '',
            vigencia: String(v('vigencia', 12)),
            valorMin: v('valorMin', 0),
            fechaActivacion: '',
            internet: true, television: false, adicionales: '',
            nombres: '', apellidos: '', razonSocial: '',
            tipoDoc: '', numDoc: '', celular: '', telefono: '',
            direccion: '', email: '', correo: '', zona: '', barrio: '',
            municipio: cfg.municipio || '', estrato: '',
            tvBasica: v('tvBasica', 0), tvPremium: v('tvPremium', 0), arrTvbox: v('arrTvbox', 0),
            totalMensual: v('valorMin', 0),
            instInternet: v('instInternet', 0), instTvbox: v('instTvbox', 0),
            ptsAdic: v('ptsAdic', 0), otros: 0, totalUnico: 0,
            plan: '', velocidad: '', totalInternet: 0,
            ontSerial: '', ontValor: v('ontValor', 0),
            tvboxSerial: '', tvboxValor: v('tvboxValor', 0), totalEquipos: 0,
            costoConexion: v('costoConexion', 360000),
            descuento: v('descuento', 360000)
        };
    }


    // ════════════════════════════════════════════════════════════════
    // GUARDAR EL CONTRATO EN GOOGLE DRIVE (v4)
    //
    // Reutiliza el MISMO Apps Script que ya guarda los comprobantes de pago,
    // porque ya está publicado y configurado; no hace falta montar nada nuevo.
    // Se le manda "carpeta":"CONTRATOS" por si el script sabe separarlos: si no
    // lo entiende, lo ignora y el archivo cae donde caen los comprobantes de esa
    // oficina. En cualquier caso el nombre del archivo lo identifica.
    //
    // El enlace devuelto se guarda en el contrato (campo pdfUrl), que ya existía
    // reservado para esto.
    // ════════════════════════════════════════════════════════════════
    function _blobABase64(blob) {
        return new Promise(function (res, rej) {
            var fr = new FileReader();
            fr.onload = function () { res(String(fr.result)); };   // data:...;base64,....
            fr.onerror = function () { rej(new Error('No se pudo leer el PDF generado.')); };
            fr.readAsDataURL(blob);
        });
    }

    // cfg = { url, clave, oficina, carpeta }
    async function subirADrive(data, cfg) {
        cfg = cfg || {};
        if (!cfg.url)   throw new Error('Falta la dirección del Drive. Configúrala en el panel de administrador.');
        if (!cfg.clave) throw new Error('Falta la clave del Drive. Pídesela al administrador.');

        var blob = await generarPDF(data);
        var base64 = await _blobABase64(blob);

        var cuerpo = {
            clave: cfg.clave,
            oficina: cfg.oficina || 'SIN_OFICINA',
            carpeta: cfg.carpeta || 'CONTRATOS',
            movId: (data && data.numero) ? String(data.numero) : '',
            nombre: _nombreArchivoDrive(data),
            tipo: 'application/pdf',
            base64: base64
        };

        var r = await fetch(cfg.url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },  // texto plano evita el bloqueo CORS de Apps Script
            body: JSON.stringify(cuerpo)
        });

        var res;
        try { res = await r.json(); }
        catch (e) {
            throw new Error('Respuesta inválida del Drive. Revisa que la dirección del script termine en /exec y esté bien publicada.');
        }
        if (!res || !res.ok) throw new Error((res && res.error) || 'Error subiendo el contrato a Drive.');
        return {
            url: res.url,
            verUrl: res.verUrl || res.url,
            fileId: res.fileId || null,
            nombre: cuerpo.nombre
        };
    }

    // Nombre con el que se guarda en Drive: que se pueda encontrar buscando por
    // cédula o por nombre sin abrir el archivo.
    function _nombreArchivoDrive(data) {
        data = data || {};
        var limpia = function (s) {
            return String(s == null ? '' : s)
                .normalize('NFD').replace(/[̀-ͯ]/g, '')
                .replace(/[^A-Za-z0-9 _-]+/g, '').replace(/\s+/g, ' ').trim()
                .replace(/ /g, '_');
        };
        var partes = ['Contrato'];
        if (data.numero) partes.push(limpia(data.numero));
        var ced = limpia(data.numDoc);
        if (ced) partes.push('CC' + ced);
        var nom = limpia((data.nombres || '') + ' ' + (data.apellidos || ''));
        if (nom) partes.push(nom.substring(0, 40));
        return partes.join('_').substring(0, 120) + '.pdf';
    }

    global.PV_LOGO = PV_LOGO;
    global.PV_CONTRATO = {
        generarHTML: generarHTML,
        abrirParaImprimir: abrirParaImprimir,
        generarPDF: generarPDF,
        compartirPDF: compartirPDF,
        puedeCompartirArchivos: puedeCompartirArchivos,
        firma: { iniciar: firmaIniciar, limpiar: firmaLimpiar, vacia: firmaVacia, obtener: firmaObtener },
        // Formulario compartido: OFICINAS y TECNICOS dibujan el MISMO.
        formularioHTML: formularioHTML,
        iniciarFirmaForm: iniciarFirmaForm,
        leerFormulario: leerFormulario,
        validarFormulario: validarFormulario,
        datosEnBlanco: datosEnBlanco,
        sumarMensual: sumarMensual,
        // Guardar el PDF firmado en Google Drive.
        subirADrive: subirADrive,
        nombreArchivoDrive: _nombreArchivoDrive
    };
})(typeof window !== 'undefined' ? window : globalThis);
