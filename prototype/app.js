/**
 * Klickbarer Redesign-Prototyp für den Schweizer Ruhestandsrechner.
 * Vereinfachte Beispielrechnung, nicht der echte Rechenkern der App.
 * Keine Speicherung, kein Netz, keine Fremdskripte.
 */
(function () {
  "use strict";

  const JAHR_HEUTE = 2026;
  const AHV_MAX_MONAT = 2520;
  const AHV_MIN_MONAT = 1260;
  const REFERENZALTER = 65;
  const UWS = 0.055;
  const INFLATION = 0.02;
  const RENDITE_NOMINAL = 0.07;
  const RENDITE_REAL = (1 + RENDITE_NOMINAL) / (1 + INFLATION) - 1;
  const PK_ZINS_REAL = (1.0125) / (1 + INFLATION) - 1;
  const S3A_MAX = 7258;
  const PLANUNGSALTER = 95;
  const STEUER_CH = 0.14;
  const STEUER_PT = 0.05;
  const BEISPIEL = {
    zivilstand: "allein",
    geburtsjahr: 1976,
    geschlecht: "m",
    lohn: 120000,
    wunschalter: 65,
    ahvModus: "schaetzen",
    ahvMonat: 0,
    pk: 450000,
    s3a: 80000,
    vermoegen: 200000,
    ausgaben: 72000,
    kanton: "ZH",
    eigentum: false,
    verkehrswert: 900000,
    hypothek: 400000,
    p2: { geburtsjahr: 1978, lohn: 80000, pk: 280000, s3a: 50000 },
  };

  const state = structuredClone(BEISPIEL);
  const szenario = { faktorAusgaben: 1, wegzug: "ch", krise: false };

  const SCHIRME = ["start", "wer", "partner", "arbeit", "vorsorge", "alltag", "ergebnis"];
  const SCHRITT_OHNE_PARTNER = ["wer", "arbeit", "vorsorge", "alltag"];
  const SCHRITT_MIT_PARTNER = ["wer", "partner", "arbeit", "vorsorge", "alltag"];

  let schirm = "start";

  const $ = (id) => document.getElementById(id);
  const text = (el, wert) => {
    if (el) el.textContent = wert;
  };

  function fmtChf(n, mitFranken) {
    const v = Math.round(Number(n) || 0);
    const vorz = v < 0 ? "−" : "";
    const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "’");
    return mitFranken === false ? vorz + s : vorz + "CHF " + s;
  }

  function parseBetrag(roh) {
    const t = String(roh || "")
      .replace(/[’'`´]/g, "")
      .replace(/\s/g, "")
      .replace(/,/g, ".");
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function betragAnzeigen(el, wert) {
    el.value = fmtChf(wert, false);
  }

  function alterVon(jahr) {
    return Math.max(0, JAHR_HEUTE - (Number(jahr) || JAHR_HEUTE));
  }

  function schritteAktuell() {
    return state.zivilstand === "paar" ? SCHRITT_MIT_PARTNER : SCHRITT_OHNE_PARTNER;
  }

  function ahvSchaetzung(lohn, paar) {
    const basis = Math.max(0, Number(lohn) || 0);
    const anteil = Math.min(1, basis / 102900);
    const roh = AHV_MIN_MONAT + (AHV_MAX_MONAT - AHV_MIN_MONAT) * anteil * 0.92;
    const monat = Math.round(roh / 10) * 10;
    if (!paar) return monat;
    const partner = ahvSchaetzung(state.p2.lohn, false);
    return Math.round(Math.min(AHV_MAX_MONAT * 1.5, monat + partner) / 10) * 10;
  }

  function ahvMonatEffektiv(alterRuecktritt, monatsrente) {
    const start = Math.max(alterRuecktritt, 63);
    const bezug = Math.max(start, Math.min(70, alterRuecktritt < REFERENZALTER ? start : Math.max(alterRuecktritt, REFERENZALTER)));
    // Vereinfacht: Vorbezug 6,8 % pro Jahr, Aufschub 5,2 % pro Jahr (Näherung).
    if (bezug < REFERENZALTER) return monatsrente * (1 - 0.068 * (REFERENZALTER - bezug));
    if (bezug > REFERENZALTER) return monatsrente * (1 + 0.052 * (bezug - REFERENZALTER));
    return monatsrente;
  }

  function pkBeitrag(lohn) {
    const koordiniert = Math.min(90720, Math.max(0, (Number(lohn) || 0) - 26460));
    return koordiniert * 0.125;
  }

  function wachsen(start, beitrag, zins, jahre) {
    let v = start;
    for (let i = 0; i < jahre; i++) v = v * (1 + zins) + beitrag;
    return v;
  }

  function haushaltWerte() {
    const personen = [
      { lohn: state.lohn, pk: state.pk, s3a: state.s3a, geburtsjahr: state.geburtsjahr },
    ];
    if (state.zivilstand === "paar") {
      personen.push({
        lohn: state.p2.lohn,
        pk: state.p2.pk,
        s3a: state.p2.s3a,
        geburtsjahr: state.p2.geburtsjahr,
      });
    }
    return personen;
  }

  function ahvBasisMonat() {
    if (state.ahvModus === "kennen" && state.ahvMonat > 0) {
      return state.zivilstand === "paar"
        ? state.ahvMonat + ahvSchaetzung(state.p2.lohn, false)
        : state.ahvMonat;
    }
    return ahvSchaetzung(state.lohn, state.zivilstand === "paar");
  }

  function toepfeBeiRuecktritt(ruecktritt) {
    const personen = haushaltWerte();
    const alterJetzt = Math.min(...personen.map((p) => alterVon(p.geburtsjahr)));
    const jahreBis = Math.max(0, ruecktritt - alterJetzt);
    let pk = 0;
    let s3a = 0;
    for (const p of personen) {
      const jahreP = Math.max(0, ruecktritt - alterVon(p.geburtsjahr));
      pk += wachsen(p.pk, pkBeitrag(p.lohn), PK_ZINS_REAL, jahreP);
      const zahlt3a = p.s3a > 0 ? Math.min(S3A_MAX, Math.max(3000, p.lohn * 0.05)) : 0;
      s3a += wachsen(p.s3a, zahlt3a, RENDITE_REAL, jahreP);
    }
    const frei = wachsen(state.vermoegen, 0, RENDITE_REAL, jahreBis);
    const faktorKrise = szenario.krise ? 0.7 : 1;
    return {
      alterJetzt,
      pk,
      freiBeiRuecktritt: (frei + s3a) * faktorKrise,
      eigentumNetto: state.eigentum ? Math.max(0, state.verkehrswert - state.hypothek) : 0,
    };
  }

  /**
   * Jahr-für-Jahr in heutigen Franken. Bewusst grob, nur für den Prototyp.
   */
  function simulieren(ruecktritt) {
    const toepfe = toepfeBeiRuecktritt(ruecktritt);
    const ausgaben = state.ausgaben * szenario.faktorAusgaben;
    const steuerSatz = szenario.wegzug === "pt" ? STEUER_PT : STEUER_CH;
    const pkRenteJahr = toepfe.pk * UWS;
    const ahvJahr = ahvMonatEffektiv(ruecktritt, ahvBasisMonat()) * 12;
    const einkommen = pkRenteJahr + ahvJahr;
    const steuer = Math.max(0, einkommen * steuerSatz);
    const bedarf = ausgaben + steuer;

    const verlauf = [];
    let frei = toepfe.freiBeiRuecktritt;
    let endetBei = null;

    for (let alter = ruecktritt; alter <= PLANUNGSALTER; alter++) {
      const luecke = bedarf - einkommen;
      frei -= luecke;
      if (frei > 0) frei *= 1 + RENDITE_REAL * 0.85;
      if (frei < 0 && toepfe.eigentumNetto + frei >= 0) {
        // Wohneigentum dient im Prototyp nur als letzter Puffer, ohne Verkauf darzustellen.
        frei = 0;
      }
      if (frei < 0) {
        endetBei = alter;
        verlauf.push({ alter, frei, einkommen, bedarf });
        break;
      }
      verlauf.push({
        alter,
        frei: frei + (state.eigentum && alter === PLANUNGSALTER ? toepfe.eigentumNetto : 0),
        einkommen,
        bedarf,
      });
    }

    const letzte = verlauf[verlauf.length - 1];
    const ok = endetBei === null;
    return {
      ok,
      endetBei,
      verlauf,
      freiBeiRuecktritt: toepfe.freiBeiRuecktritt,
      pkRenteJahr,
      ahvJahr,
      einkommen,
      ausgaben,
      steuerSatz,
      eigentumNetto: toepfe.eigentumNetto,
      freiEnde: ok && letzte ? letzte.frei : 0,
      alterJetzt: toepfe.alterJetzt,
    };
  }

  function findeFruehestes() {
    let gefunden = null;
    let beiWunsch = null;
    for (let alter = 58; alter <= 70; alter++) {
      const s = simulieren(alter);
      if (s.ok && gefunden === null) gefunden = { alter, sim: s };
      if (alter === state.wunschalter) beiWunsch = s;
    }
    if (!beiWunsch) beiWunsch = simulieren(state.wunschalter);
    return { gefunden, beiWunsch };
  }

  function lesenFormulare() {
    state.zivilstand = document.querySelector('input[name="zivilstand"]:checked')?.value || "allein";
    state.geburtsjahr = Number($("geburtsjahr").value) || BEISPIEL.geburtsjahr;
    state.geschlecht = document.querySelector('input[name="geschlecht"]:checked')?.value || "m";
    state.lohn = parseBetrag($("lohn").value);
    state.wunschalter = Number($("wunschalter").value) || 65;
    state.ahvModus = document.querySelector('input[name="ahv-modus"]:checked')?.value || "schaetzen";
    state.ahvMonat = parseBetrag($("ahv").value);
    state.pk = parseBetrag($("pk").value);
    state.s3a = parseBetrag($("s3a").value);
    state.vermoegen = parseBetrag($("vermoegen").value);
    state.ausgaben = parseBetrag($("ausgaben").value);
    state.kanton = $("kanton").value;
    state.eigentum = $("eigentum").checked;
    state.verkehrswert = parseBetrag($("verkehrswert").value);
    state.hypothek = parseBetrag($("hypothek").value);
    state.p2.geburtsjahr = Number($("p2-geburtsjahr").value) || BEISPIEL.p2.geburtsjahr;
    state.p2.lohn = parseBetrag($("p2-lohn").value);
    state.p2.pk = parseBetrag($("p2-pk").value);
    state.p2.s3a = parseBetrag($("p2-s3a").value);
    szenario.faktorAusgaben = (Number($("faktor-ausgaben").value) || 100) / 100;
    szenario.wegzug = document.querySelector('input[name="wegzug"]:checked')?.value || "ch";
    szenario.krise = $("krise").checked;
  }

  function schreibenFormulare() {
    const setRadio = (name, wert) => {
      document.querySelectorAll('input[name="' + name + '"]').forEach((el) => {
        el.checked = el.value === wert;
      });
    };
    setRadio("zivilstand", state.zivilstand);
    $("geburtsjahr").value = String(state.geburtsjahr);
    setRadio("geschlecht", state.geschlecht);
    betragAnzeigen($("lohn"), state.lohn);
    $("wunschalter").value = String(state.wunschalter);
    setRadio("ahv-modus", state.ahvModus);
    betragAnzeigen($("ahv"), state.ahvMonat || ahvSchaetzung(state.lohn, false));
    betragAnzeigen($("pk"), state.pk);
    betragAnzeigen($("s3a"), state.s3a);
    betragAnzeigen($("vermoegen"), state.vermoegen);
    betragAnzeigen($("ausgaben"), state.ausgaben);
    $("kanton").value = state.kanton;
    $("eigentum").checked = state.eigentum;
    betragAnzeigen($("verkehrswert"), state.verkehrswert);
    betragAnzeigen($("hypothek"), state.hypothek);
    $("p2-geburtsjahr").value = String(state.p2.geburtsjahr);
    betragAnzeigen($("p2-lohn"), state.p2.lohn);
    betragAnzeigen($("p2-pk"), state.p2.pk);
    betragAnzeigen($("p2-s3a"), state.p2.s3a);
    $("faktor-ausgaben").value = String(Math.round(szenario.faktorAusgaben * 100));
    setRadio("wegzug", szenario.wegzug);
    $("krise").checked = szenario.krise;
  }

  function aktualisiereHinweise() {
    const a = alterVon(state.geburtsjahr);
    text($("alter-hinweis"), "Im Beispieljahr " + JAHR_HEUTE + " ist das " + a + " Jahre. AHV-Referenzalter im Prototyp: " + REFERENZALTER + ".");
    const mon = state.ahvModus === "kennen" && state.ahvMonat > 0 ? state.ahvMonat : ahvSchaetzung(state.lohn, false);
    text(
      $("ahv-schaetzung"),
      state.ahvModus === "schaetzen"
        ? "Geschätzte AHV-Rente: " + fmtChf(mon) + " pro Monat (Näherung, Beitragslücken nicht geprüft)."
        : "Sie können den Betrag aus dem letzten AHV-Auszug eintragen.",
    );
    $("ahv-feld").hidden = state.ahvModus !== "kennen";
    $("eigentum-felder").hidden = !state.eigentum;
    const monat = Math.round(state.ausgaben / 12);
    text($("ausgaben-hilfe"), "Das sind etwa " + fmtChf(monat) + " pro Monat, ohne Steuern. Der Prototyp rechnet die Steuern grob dazu.");
    const f = Math.round(szenario.faktorAusgaben * 100);
    text($("faktor-ausgaben-wert"), f === 100 ? "wie eingegeben" : f + " %");
  }

  function zeichneChart(sim, ruecktritt) {
    const canvas = $("chart");
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || 640;
    const cssH = 280;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const pad = { l: 48, r: 16, t: 28, b: 32 };
    const alterJetzt = alterVon(state.geburtsjahr);
    const punkte = [];
    // Vor dem Rücktritt: freies Vermögen wachsend, 3a noch gesperrt – wir zeigen das verfügbare plus 3a als Ausblick.
    for (let alter = alterJetzt; alter < ruecktritt; alter++) {
      const j = alter - alterJetzt;
      const frei = wachsen(state.vermoegen, 0, RENDITE_REAL, j);
      punkte.push({ alter, frei });
    }
    for (const z of sim.verlauf) punkte.push({ alter: z.alter, frei: Math.max(z.frei, 0) });
    if (punkte.length < 2) return;

    const xs = punkte.map((p) => p.alter);
    const ys = punkte.map((p) => p.frei);
    const x0 = xs[0];
    const x1 = xs[xs.length - 1];
    const yMax = Math.max(1, ...ys) * 1.08;
    const xPos = (x) => pad.l + ((x - x0) / Math.max(1, x1 - x0)) * (cssW - pad.l - pad.r);
    const yPos = (y) => pad.t + (1 - y / yMax) * (cssH - pad.t - pad.b);

    const styles = getComputedStyle(document.documentElement);
    const achse = styles.getPropertyValue("--leise").trim() || "#5b6a73";
    const linie = styles.getPropertyValue("--linie").trim() || "#e4d8cb";
    const teal = "#1c5568";
    const sunset = "#e25a2a";

    ctx.strokeStyle = linie;
    ctx.lineWidth = 1;
    ctx.font = "11px " + (styles.fontFamily || "system-ui");
    ctx.fillStyle = achse;
    const gitternetz = [0, 0.25, 0.5, 0.75, 1];
    for (const g of gitternetz) {
      const y = yPos(yMax * g);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(cssW - pad.r, y);
      ctx.stroke();
      const label = fmtChf((yMax * g) / (yMax >= 1e6 ? 1 : 1), false);
      const kurz =
        yMax * g >= 1e6
          ? (yMax * g / 1e6).toFixed(1).replace(".0", "") + " Mio."
          : Math.round((yMax * g) / 1000) + " Tsd.";
      ctx.fillText(g === 0 ? "0" : kurz, 4, y + 4);
    }

    const ticks = [x0, ruecktritt, PLANUNGSALTER].filter((v, i, a) => a.indexOf(v) === i);
    for (const t of ticks) {
      const label = String(t);
      let tx = xPos(t) - ctx.measureText(label).width / 2;
      tx = Math.max(pad.l - 4, Math.min(tx, cssW - pad.r - ctx.measureText(label).width));
      ctx.fillText(label, tx, cssH - 10);
    }

    // Fläche
    ctx.beginPath();
    ctx.moveTo(xPos(punkte[0].alter), yPos(0));
    for (const p of punkte) ctx.lineTo(xPos(p.alter), yPos(Math.max(0, p.frei)));
    ctx.lineTo(xPos(punkte[punkte.length - 1].alter), yPos(0));
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.t, 0, cssH - pad.b);
    grad.addColorStop(0, "rgba(28, 85, 104, 0.35)");
    grad.addColorStop(1, "rgba(226, 90, 42, 0.08)");
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    punkte.forEach((p, i) => {
      const x = xPos(p.alter);
      const y = yPos(Math.max(0, p.frei));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = teal;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Rücktrittslinie
    const xr = xPos(ruecktritt);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = sunset;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xr, pad.t);
    ctx.lineTo(xr, cssH - pad.b);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = sunset;
    ctx.fillText("Ruhestand " + ruecktritt, Math.min(xr + 4, cssW - 90), pad.t + 12);
  }

  function leeren(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  function p(textWert) {
    const el = document.createElement("p");
    el.textContent = textWert;
    return el;
  }

  function zeile(links, rechts) {
    const row = document.createElement("div");
    row.className = "zeile";
    const a = document.createElement("span");
    const b = document.createElement("span");
    a.textContent = links;
    b.textContent = rechts;
    row.appendChild(a);
    row.appendChild(b);
    return row;
  }

  function renderErgebnis() {
    const { gefunden, beiWunsch } = findeFruehestes();
    const kern = $("kern");
    kern.classList.remove("kern--knapp");

    if (gefunden) {
      const frueher = gefunden.alter < state.wunschalter;
      text($("kern-label"), "Frühester Ruhestand");
      text($("kern-zahl"), String(gefunden.alter));
      const satz = frueher
        ? "Mit " + gefunden.alter + " Jahren reicht das Beispielvermögen voraussichtlich bis " + PLANUNGSALTER + ". Ihr Wunschalter ist " + state.wunschalter + "."
        : gefunden.alter === state.wunschalter
          ? "Mit Ihrem Wunschalter " + state.wunschalter + " reicht das Geld in dieser Beispielrechnung bis " + PLANUNGSALTER + "."
          : "Erst ab " + gefunden.alter + " reicht das Geld bis " + PLANUNGSALTER + " – später als Ihr Wunschalter " + state.wunschalter + ".";
      text($("kern-satz"), satz);
    } else {
      kern.classList.add("kern--knapp");
      text($("kern-label"), "So reicht es noch nicht");
      text($("kern-zahl"), "knapp");
      text(
        $("kern-satz"),
        "Selbst mit einem Rücktritt mit 70 reicht das Vermögen in dieser Beispielrechnung nicht bis " + PLANUNGSALTER + ". Senken Sie die Ausgaben oder prüfen Sie die Annahmen.",
      );
    }

    const sim = gefunden ? gefunden.sim : beiWunsch;
    const ruecktritt = gefunden ? gefunden.alter : state.wunschalter;
    const kacheln = $("kacheln");
    leeren(kacheln);
    const tiles = [
      ["Einkommen im Ruhestand", fmtChf(sim.einkommen) + " / Jahr"],
      ["Davon AHV + PK-Rente", fmtChf(sim.ahvJahr) + " + " + fmtChf(sim.pkRenteJahr)],
      [
        gefunden && gefunden.sim.ok ? "Vermögen mit " + PLANUNGSALTER : "Reicht bis",
        gefunden && gefunden.sim.ok ? fmtChf(sim.freiEnde) : sim.endetBei ? "Alter " + sim.endetBei : "nicht bis " + PLANUNGSALTER,
      ],
    ];
    for (const [dt, dd] of tiles) {
      const wrap = document.createElement("div");
      wrap.className = "kachel";
      const t = document.createElement("dt");
      const d = document.createElement("dd");
      t.textContent = dt;
      d.textContent = dd;
      wrap.appendChild(t);
      wrap.appendChild(d);
      kacheln.appendChild(wrap);
    }

    zeichneChart(sim, ruecktritt);
    text(
      $("chart-legende"),
      "Orangene Linie: gewählter bzw. frühester Ruhestand. Fläche: Vermögen in heutigen Franken. Planungshorizont im Prototyp: " + PLANUNGSALTER + " Jahre.",
    );

    const eink = $("detail-einkommen");
    leeren(eink);
    eink.appendChild(zeile("AHV-Rente (Jahr, nach evtl. Kürzung/Zuschlag)", fmtChf(sim.ahvJahr)));
    eink.appendChild(zeile("PK-Rente (Umwandlungssatz " + (UWS * 100).toFixed(1).replace(".", ",") + " %)", fmtChf(sim.pkRenteJahr)));
    eink.appendChild(zeile("Freies Vermögen inkl. 3a bei Rücktritt", fmtChf(sim.freiBeiRuecktritt)));
    if (state.eigentum) eink.appendChild(zeile("Wohneigentum netto (Puffer, zuletzt)", fmtChf(sim.eigentumNetto)));
    eink.appendChild(zeile("Lebenshaltung inkl. Szenario", fmtChf(sim.ausgaben)));
    eink.appendChild(zeile("Steuerannahme", Math.round(sim.steuerSatz * 100) + " % auf AHV- und PK-Rente"));
    eink.appendChild(zeile("Monatlich ungefähr zur Verfügung", fmtChf(sim.einkommen / 12) + " plus Entnahme"));

    const ann = $("detail-annahmen");
    leeren(ann);
    ann.appendChild(
      p(
        "Alles in heutigen Franken. Nominale Börsenrendite " +
          Math.round(RENDITE_NOMINAL * 100) +
          " %, Teuerung " +
          Math.round(INFLATION * 100) +
          " %, also rund " +
          (RENDITE_REAL * 100).toFixed(1).replace(".", ",") +
          " % real. Anlagekosten sind hier nicht separat abgezogen. PK-Zins 1,25 % nominal, Umwandlungssatz " +
          (UWS * 100).toFixed(1).replace(".", ",") +
          " % auf das ganze Guthaben (Näherung, nicht der gesetzliche Mindestsatz und nicht Ihr Kassenreglement).",
      ),
    );
    ann.appendChild(
      p(
        "Bis zum Rücktritt wächst die Säule 3a weiter, wenn bereits ein Guthaben da ist, mit einer Einzahlung bis zum jährlichen Maximum im Prototyp. Das freie Vermögen wird ohne zusätzliche Sparrate fortgeschrieben. Der Planungshorizont ist " +
          PLANUNGSALTER +
          " Jahre (in der heutigen App standardmässig 120). Kanton " +
          ($("kanton").selectedOptions[0] ? $("kanton").selectedOptions[0].textContent : state.kanton) +
          " beeinflusst in diesem Prototyp die Steuer nur über einen pauschalen Satz.",
      ),
    );
    if (szenario.wegzug === "pt") {
      ann.appendChild(p("Szenario Wegzug Portugal: niedrigere Steuerannahme (" + Math.round(STEUER_PT * 100) + " %). Kein echtes Länder- oder DBA-Modell."));
    }
    if (szenario.krise) {
      ann.appendChild(p("Szenario Krise: das freie Vermögen und die 3a werden zum Rücktritt um 30 % gekürzt. Keine historischen Pfade."));
    }
    ann.appendChild(p("Diese Rechnung gehört nur zum Prototyp. Die fertige App behält ihren geprüften Rechenkern."));
  }

  function setSchirm(name, ohneHash) {
    const erlaubt = new Set(["start", ...schritteAktuell(), "ergebnis"]);
    if (!erlaubt.has(name)) name = "wer";
    schirm = name;
    if (!ohneHash) {
      const neu = "#" + schirm;
      if (location.hash !== neu) history.replaceState(null, "", neu);
    }
    document.querySelectorAll(".schirm").forEach((el) => {
      el.hidden = el.dataset.schirm !== schirm;
    });

    const liste = schritteAktuell();
    const imFluss = liste.indexOf(schirm);
    const aufStart = schirm === "start";
    const aufEnde = schirm === "ergebnis";

    $("fortschritt").hidden = aufStart;
    if (!aufStart) {
      const nr = aufEnde ? liste.length : imFluss + 1;
      text($("fortschritt-text"), aufEnde ? "Ergebnis" : "Schritt " + nr + " von " + liste.length);
      $("fortschritt-fuellung").style.width = (100 * (aufEnde ? 1 : nr / liste.length)).toFixed(1) + "%";
      const ol = $("punkte");
      leeren(ol);
      liste.forEach((s, i) => {
        const li = document.createElement("li");
        if (i < imFluss || aufEnde) li.className = "erledigt";
        if (s === schirm) li.className = "aktiv";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.title = "Zu Schritt " + (i + 1);
        btn.addEventListener("click", () => {
          lesenFormulare();
          setSchirm(s);
        });
        const dot = document.createElement("span");
        btn.appendChild(dot);
        li.appendChild(btn);
        ol.appendChild(li);
      });
    }

    text($("kopf-sub"), aufStart ? "Redesign-Vorschlag" : aufEnde ? "Beispielergebnis" : "Beispieldaten, frei änderbar");

    const zurueck = $("btn-zurueck");
    const weiter = $("btn-weiter");
    zurueck.hidden = aufStart;
    if (aufStart) {
      weiter.textContent = "Mit dem Beispiel starten";
    } else if (aufEnde) {
      weiter.textContent = "Von vorn";
    } else if (imFluss === liste.length - 1) {
      weiter.textContent = "Ergebnis zeigen";
    } else {
      weiter.textContent = "Weiter";
    }

    if (aufEnde) renderErgebnis();
    aktualisiereHinweise();
    window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function weiter() {
    lesenFormulare();
    if (schirm === "start") {
      setSchirm("wer");
      return;
    }
    if (schirm === "ergebnis") {
      setSchirm("start");
      return;
    }
    const liste = schritteAktuell();
    const i = liste.indexOf(schirm);
    if (i === liste.length - 1) setSchirm("ergebnis");
    else setSchirm(liste[i + 1]);
  }

  function zurueck() {
    lesenFormulare();
    if (schirm === "ergebnis") {
      setSchirm("alltag");
      return;
    }
    const liste = ["start", ...schritteAktuell()];
    const i = liste.indexOf(schirm);
    if (i > 0) setSchirm(liste[i - 1]);
  }

  function bindBetrag(id, setter) {
    const el = $(id);
    el.addEventListener("focus", () => {
      const n = parseBetrag(el.value);
      el.value = n ? String(Math.round(n)) : "";
    });
    el.addEventListener("blur", () => {
      const n = parseBetrag(el.value);
      setter(n);
      betragAnzeigen(el, n);
      aktualisiereHinweise();
      if (schirm === "ergebnis") renderErgebnis();
    });
  }

  function init() {
    schreibenFormulare();
    aktualisiereHinweise();

    $("btn-weiter").addEventListener("click", weiter);
    $("btn-zurueck").addEventListener("click", zurueck);

    document.querySelectorAll('input[name="zivilstand"]').forEach((el) =>
      el.addEventListener("change", () => {
        lesenFormulare();
        aktualisiereHinweise();
      }),
    );
    document.querySelectorAll('input[name="ahv-modus"]').forEach((el) =>
      el.addEventListener("change", () => {
        lesenFormulare();
        aktualisiereHinweise();
      }),
    );
    $("eigentum").addEventListener("change", () => {
      lesenFormulare();
      aktualisiereHinweise();
    });
    $("geburtsjahr").addEventListener("input", () => {
      state.geburtsjahr = Number($("geburtsjahr").value) || BEISPIEL.geburtsjahr;
      aktualisiereHinweise();
    });
    $("lohn").addEventListener("input", () => {
      /* Anzeige der Schätzung erst beim Blur, damit das Tippen ruhig bleibt */
    });

    bindBetrag("lohn", (n) => { state.lohn = n; });
    bindBetrag("ahv", (n) => { state.ahvMonat = n; });
    bindBetrag("pk", (n) => { state.pk = n; });
    bindBetrag("s3a", (n) => { state.s3a = n; });
    bindBetrag("vermoegen", (n) => { state.vermoegen = n; });
    bindBetrag("ausgaben", (n) => { state.ausgaben = n; });
    bindBetrag("verkehrswert", (n) => { state.verkehrswert = n; });
    bindBetrag("hypothek", (n) => { state.hypothek = n; });
    bindBetrag("p2-lohn", (n) => { state.p2.lohn = n; });
    bindBetrag("p2-pk", (n) => { state.p2.pk = n; });
    bindBetrag("p2-s3a", (n) => { state.p2.s3a = n; });

    $("faktor-ausgaben").addEventListener("input", () => {
      lesenFormulare();
      aktualisiereHinweise();
      renderErgebnis();
    });
    document.querySelectorAll('input[name="wegzug"]').forEach((el) =>
      el.addEventListener("change", () => {
        lesenFormulare();
        renderErgebnis();
      }),
    );
    $("krise").addEventListener("change", () => {
      lesenFormulare();
      renderErgebnis();
    });

    window.addEventListener("resize", () => {
      if (schirm === "ergebnis") renderErgebnis();
    });

    window.addEventListener("hashchange", () => {
      const ziel = location.hash.replace(/^#/, "");
      const erlaubt = new Set(["start", ...schritteAktuell(), "ergebnis"]);
      if (ziel && erlaubt.has(ziel) && ziel !== schirm) {
        lesenFormulare();
        setSchirm(ziel, true);
      }
    });

    const startHash = location.hash.replace(/^#/, "");
    const erlaubtStart = new Set(["start", "wer", "partner", "arbeit", "vorsorge", "alltag", "ergebnis"]);
    setSchirm(erlaubtStart.has(startHash) ? startHash : "start", true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
