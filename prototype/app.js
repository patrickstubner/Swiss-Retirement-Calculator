/**
 * Klickbarer Redesign-Prototyp für den Schweizer Ruhestandsrechner.
 * Vereinfachte Beispielrechnung, nicht der echte Rechenkern.
 * Keine Speicherung, kein Netz, keine Fremdskripte.
 */
(function () {
  "use strict";

  const JAHR_HEUTE = 2026;
  const AHV_MAX_MONAT = 2520;
  const AHV_MIN_MONAT = 1260;
  const REFERENZALTER = 65;
  const UWS_STANDARD = 0.055;
  const S3A_MAX = 7258;
  const STEUER_CH = 0.14;
  const STEUER_PT = 0.05;
  const PLANUNGSALTER_STANDARD = 120;

  const BEISPIEL = {
    zivilstand: "allein",
    geburtsjahr: 1976,
    geschlecht: "m",
    lohn: 120000,
    wunschalter: 65,
    pk: 450000,
    s3a: 80000,
    vermoegen: 200000,
    ausgaben: 72000,
    kanton: "ZH",
    p2: { geburtsjahr: 1978, lohn: 80000, pk: 280000, s3a: 50000 },
    ausgabenPaar: 96000,
  };

  const STANDARD = {
    ahvModus: "schaetzen",
    ahvMonat: 0,
    inChSeit: null,
    uws: UWS_STANDARD,
    pkBeitrag: null,
    kapitalanteil: 0,
    planungsalter: PLANUNGSALTER_STANDARD,
    renditeNominal: 0.07,
    inflation: 0.02,
    kosten: 0.002,
    renditeBargeld: 0.005,
    faktorAb75: 1,
    faktorAb85: 1,
    eigentum: false,
    verkehrswert: 900000,
    hypothek: 400000,
    wegzug: "ch",
  };

  function neuerStand() {
    return {
      ...structuredClone(BEISPIEL),
      ...structuredClone(STANDARD),
    };
  }

  const state = neuerStand();
  const szenario = { faktorAusgaben: 1, krise: false };
  let schirm = "start";
  let hatteErgebnis = false;

  const SCHIRME = [
    "start",
    "eckdaten",
    "ergebnis",
    "ahv",
    "pk",
    "annahmen",
    "ausgabenfein",
    "eigentum",
    "wegzug",
  ];

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

  function fmtPct(n, nachkomma) {
    const z = Number(n) || 0;
    const s = (z * 100).toFixed(nachkomma == null ? 1 : nachkomma).replace(".", ",");
    return s.replace(/,0$/, "") + " %";
  }

  function parseBetrag(roh) {
    const t = String(roh || "")
      .replace(/[’'`´]/g, "")
      .replace(/\s/g, "")
      .replace(/,/g, ".");
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function parseProzent(roh) {
    const t = String(roh || "").replace(/\s/g, "").replace("%", "").replace(/,/g, ".");
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? Math.max(0, n) / 100 : 0;
  }

  function betragAnzeigen(el, wert) {
    if (el) el.value = fmtChf(wert, false);
  }

  function pctAnzeigen(el, bruch, nachkomma) {
    if (!el) return;
    const z = (Number(bruch) || 0) * 100;
    el.value = z.toFixed(nachkomma == null ? 1 : nachkomma).replace(".", ",").replace(/,0$/, "");
  }

  function alterVon(jahr) {
    return Math.max(0, JAHR_HEUTE - (Number(jahr) || JAHR_HEUTE));
  }

  function renditeReal() {
    const nom = state.renditeNominal - state.kosten;
    return (1 + nom) / (1 + state.inflation) - 1;
  }

  function ahvSchaetzung(lohn) {
    const basis = Math.max(0, Number(lohn) || 0);
    const anteil = Math.min(1, basis / 102900);
    const roh = AHV_MIN_MONAT + (AHV_MAX_MONAT - AHV_MIN_MONAT) * anteil * 0.92;
    return Math.round(roh / 10) * 10;
  }

  function ahvMitLuecke(monat, geburtsjahr, inChSeit) {
    if (inChSeit == null || inChSeit <= geburtsjahr) return monat;
    const volleJahre = 44;
    const beitragsjahre = Math.max(0, Math.min(volleJahre, REFERENZALTER - alterVon(inChSeit)));
    // grob: Zuzug im Alter X, Jahre bis 65
    const startAlter = Math.max(0, inChSeit - geburtsjahr);
    const jahre = Math.max(0, Math.min(volleJahre, REFERENZALTER - startAlter));
    return monat * Math.min(1, jahre / volleJahre);
  }

  function ahvBasisMonat() {
    const eigen =
      state.ahvModus === "kennen" && state.ahvMonat > 0
        ? state.ahvMonat
        : ahvSchaetzung(state.lohn);
    const gekuerzt = ahvMitLuecke(eigen, state.geburtsjahr, state.inChSeit);
    if (state.zivilstand !== "paar") return gekuerzt;
    const partner = ahvMitLuecke(ahvSchaetzung(state.p2.lohn), state.p2.geburtsjahr, null);
    return Math.min(AHV_MAX_MONAT * 1.5, gekuerzt + partner);
  }

  function ahvMonatEffektiv(alterRuecktritt, monatsrente) {
    const bezug =
      alterRuecktritt < REFERENZALTER
        ? Math.max(alterRuecktritt, 63)
        : Math.min(70, Math.max(alterRuecktritt, REFERENZALTER));
    if (bezug < REFERENZALTER) return monatsrente * (1 - 0.068 * (REFERENZALTER - bezug));
    if (bezug > REFERENZALTER) return monatsrente * (1 + 0.052 * (bezug - REFERENZALTER));
    return monatsrente;
  }

  function pkBeitragGeschaetzt(lohn) {
    const koordiniert = Math.min(90720, Math.max(0, (Number(lohn) || 0) - 26460));
    return koordiniert * 0.125;
  }

  function pkBeitragEff(person) {
    if (person === "p2") return pkBeitragGeschaetzt(state.p2.lohn);
    return state.pkBeitrag == null ? pkBeitragGeschaetzt(state.lohn) : state.pkBeitrag;
  }

  function wachsen(start, beitrag, zins, jahre) {
    let v = start;
    for (let i = 0; i < jahre; i++) v = v * (1 + zins) + beitrag;
    return v;
  }

  function haushaltPersonen() {
    const liste = [
      { lohn: state.lohn, pk: state.pk, s3a: state.s3a, geburtsjahr: state.geburtsjahr, beitrag: pkBeitragEff("p1") },
    ];
    if (state.zivilstand === "paar") {
      liste.push({
        lohn: state.p2.lohn,
        pk: state.p2.pk,
        s3a: state.p2.s3a,
        geburtsjahr: state.p2.geburtsjahr,
        beitrag: pkBeitragEff("p2"),
      });
    }
    return liste;
  }

  function ausgabenImAlter(alter) {
    const basis = state.ausgaben * szenario.faktorAusgaben;
    if (alter >= 85) return basis * state.faktorAb85;
    if (alter >= 75) return basis * state.faktorAb75;
    return basis;
  }

  function toepfeBeiRuecktritt(ruecktritt) {
    const personen = haushaltPersonen();
    const alterJetzt = Math.min(...personen.map((p) => alterVon(p.geburtsjahr)));
    const jahreBis = Math.max(0, ruecktritt - alterJetzt);
    const real = renditeReal();
    const pkZinsReal = 1.0125 / (1 + state.inflation) - 1;
    let pk = 0;
    let s3a = 0;
    for (const p of personen) {
      const jahreP = Math.max(0, ruecktritt - alterVon(p.geburtsjahr));
      pk += wachsen(p.pk, p.beitrag, pkZinsReal, jahreP);
      const zahlt3a = p.s3a > 0 ? Math.min(S3A_MAX, Math.max(3000, p.lohn * 0.05)) : 0;
      s3a += wachsen(p.s3a, zahlt3a, real, jahreP);
    }
    const frei = wachsen(state.vermoegen, 0, real, jahreBis);
    const faktorKrise = szenario.krise ? 0.7 : 1;
    const kapital = pk * Math.min(1, Math.max(0, state.kapitalanteil));
    const pkRenteBasis = pk - kapital;
    return {
      alterJetzt,
      pk,
      pkRenteBasis,
      freiBeiRuecktritt: (frei + s3a + kapital) * faktorKrise,
      eigentumNetto: state.eigentum ? Math.max(0, state.verkehrswert - state.hypothek) : 0,
    };
  }

  function simulieren(ruecktritt) {
    const toepfe = toepfeBeiRuecktritt(ruecktritt);
    const steuerSatz = state.wegzug === "pt" ? STEUER_PT : STEUER_CH;
    const pkRenteJahr = toepfe.pkRenteBasis * state.uws;
    const ahvJahr = ahvMonatEffektiv(ruecktritt, ahvBasisMonat()) * 12;
    const einkommen = pkRenteJahr + ahvJahr;
    const horizon = state.planungsalter;
    const verlauf = [];
    let frei = toepfe.freiBeiRuecktritt;
    let reserve = toepfe.eigentumNetto;
    let endetBei = null;
    const real = renditeReal();

    for (let alter = ruecktritt; alter <= horizon; alter++) {
      const ausgaben = ausgabenImAlter(alter);
      const steuer = Math.max(0, einkommen * steuerSatz);
      const bedarf = ausgaben + steuer;
      frei -= bedarf - einkommen;
      if (frei > 0) frei *= 1 + real * 0.85;
      if (frei < 0 && reserve > 0) {
        const bedarfReserve = -frei;
        if (reserve >= bedarfReserve) {
          reserve -= bedarfReserve;
          frei = 0;
        } else {
          frei += reserve;
          reserve = 0;
        }
      }
      if (frei < 0) {
        endetBei = alter;
        verlauf.push({ alter, frei, einkommen, bedarf });
        break;
      }
      verlauf.push({
        alter,
        frei: frei + (alter === horizon ? reserve : 0),
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
      steuerSatz,
      eigentumNetto: toepfe.eigentumNetto,
      freiEnde: ok && letzte ? letzte.frei : 0,
      alterJetzt: toepfe.alterJetzt,
      horizon,
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

  function feinheiten() {
    const inChDefault = state.inChSeit == null || state.inChSeit === state.geburtsjahr;
    const ahvStd = state.ahvModus === "schaetzen" && inChDefault;
    const pkStd = Math.abs(state.uws - UWS_STANDARD) < 1e-9 && state.pkBeitrag == null && state.kapitalanteil === 0;
    const annStd =
      state.planungsalter === PLANUNGSALTER_STANDARD &&
      Math.abs(state.renditeNominal - STANDARD.renditeNominal) < 1e-9 &&
      Math.abs(state.inflation - STANDARD.inflation) < 1e-9 &&
      Math.abs(state.kosten - STANDARD.kosten) < 1e-9 &&
      Math.abs(state.renditeBargeld - STANDARD.renditeBargeld) < 1e-9;
    const ausStd = state.faktorAb75 === 1 && state.faktorAb85 === 1;
    const eigStd = !state.eigentum;
    const wegStd = state.wegzug === "ch";
    return { ahvStd, pkStd, annStd, ausStd, eigStd, wegStd, inChDefault };
  }

  function anzahlStatus() {
    const f = feinheiten();
    const standard = [f.ahvStd, f.pkStd, f.annStd, f.ausStd].filter(Boolean).length;
    const angepasst = 4 - standard;
    const moduleAktiv = (!f.eigStd ? 1 : 0) + (!f.wegStd ? 1 : 0);
    return { standard, angepasst, moduleAktiv, total: 4 };
  }

  function lesenFormulare() {
    const ziv = document.querySelector('input[name="zivilstand"]:checked');
    if (ziv) state.zivilstand = ziv.value;
    if ($("geburtsjahr") && $("geburtsjahr").value) state.geburtsjahr = Number($("geburtsjahr").value) || BEISPIEL.geburtsjahr;
    const g = document.querySelector('input[name="geschlecht"]:checked');
    if (g) state.geschlecht = g.value;
    if ($("lohn")) state.lohn = parseBetrag($("lohn").value);
    if ($("wunschalter") && $("wunschalter").value) state.wunschalter = Number($("wunschalter").value) || 65;
    const am = document.querySelector('input[name="ahv-modus"]:checked');
    if (am) state.ahvModus = am.value;
    if ($("ahv")) state.ahvMonat = parseBetrag($("ahv").value);
    if ($("pk")) state.pk = parseBetrag($("pk").value);
    if ($("s3a")) state.s3a = parseBetrag($("s3a").value);
    if ($("vermoegen")) state.vermoegen = parseBetrag($("vermoegen").value);
    if ($("ausgaben")) state.ausgaben = parseBetrag($("ausgaben").value);
    if ($("kanton")) state.kanton = $("kanton").value;
    if ($("p2-geburtsjahr") && $("p2-geburtsjahr").value) state.p2.geburtsjahr = Number($("p2-geburtsjahr").value) || BEISPIEL.p2.geburtsjahr;
    if ($("p2-lohn")) state.p2.lohn = parseBetrag($("p2-lohn").value);
    if ($("p2-pk")) state.p2.pk = parseBetrag($("p2-pk").value);
    if ($("p2-s3a")) state.p2.s3a = parseBetrag($("p2-s3a").value);
    if ($("eigentum")) state.eigentum = $("eigentum").checked;
    if ($("verkehrswert")) state.verkehrswert = parseBetrag($("verkehrswert").value);
    if ($("hypothek")) state.hypothek = parseBetrag($("hypothek").value);
    const wg = document.querySelector('input[name="wegzug"]:checked');
    if (wg) state.wegzug = wg.value;
    if ($("in-ch-seit") && $("in-ch-seit").value) {
      const j = Number($("in-ch-seit").value);
      state.inChSeit = !j || j === state.geburtsjahr ? null : j;
    }
    if ($("uws") && $("uws").value !== "") state.uws = parseProzent($("uws").value);
    if ($("pk-beitrag")) {
      const n = parseBetrag($("pk-beitrag").value);
      const auto = pkBeitragGeschaetzt(state.lohn);
      state.pkBeitrag = Math.abs(n - auto) < 1 ? null : n;
    }
    if ($("kapitalanteil") && $("kapitalanteil").value !== "") {
      state.kapitalanteil = Math.min(1, Math.max(0, (Number($("kapitalanteil").value) || 0) / 100));
    }
    if ($("planungsalter") && $("planungsalter").value) {
      state.planungsalter = Math.min(120, Math.max(80, Number($("planungsalter").value) || PLANUNGSALTER_STANDARD));
    }
    if ($("rendite") && $("rendite").value !== "") state.renditeNominal = parseProzent($("rendite").value);
    if ($("inflation") && $("inflation").value !== "") state.inflation = parseProzent($("inflation").value);
    if ($("kosten") && $("kosten").value !== "") state.kosten = parseProzent($("kosten").value);
    if ($("zins-bargeld") && $("zins-bargeld").value !== "") state.renditeBargeld = parseProzent($("zins-bargeld").value);
    if ($("faktor-75") && $("faktor-75").value !== "") state.faktorAb75 = (Number($("faktor-75").value) || 100) / 100;
    if ($("faktor-85") && $("faktor-85").value !== "") state.faktorAb85 = (Number($("faktor-85").value) || 100) / 100;
    if ($("faktor-ausgaben")) szenario.faktorAusgaben = (Number($("faktor-ausgaben").value) || 100) / 100;
    if ($("krise")) szenario.krise = $("krise").checked;
  }

  function setRadio(name, wert) {
    document.querySelectorAll('input[name="' + name + '"]').forEach((el) => {
      el.checked = el.value === wert;
    });
  }

  function schreibenFormulare() {
    setRadio("zivilstand", state.zivilstand);
    $("geburtsjahr").value = String(state.geburtsjahr);
    setRadio("geschlecht", state.geschlecht);
    betragAnzeigen($("lohn"), state.lohn);
    $("wunschalter").value = String(state.wunschalter);
    setRadio("ahv-modus", state.ahvModus);
    betragAnzeigen($("ahv"), state.ahvMonat || ahvSchaetzung(state.lohn));
    betragAnzeigen($("pk"), state.pk);
    betragAnzeigen($("s3a"), state.s3a);
    betragAnzeigen($("vermoegen"), state.vermoegen);
    betragAnzeigen($("ausgaben"), state.ausgaben);
    $("kanton").value = state.kanton;
    $("p2-geburtsjahr").value = String(state.p2.geburtsjahr);
    betragAnzeigen($("p2-lohn"), state.p2.lohn);
    betragAnzeigen($("p2-pk"), state.p2.pk);
    betragAnzeigen($("p2-s3a"), state.p2.s3a);
    $("eigentum").checked = state.eigentum;
    betragAnzeigen($("verkehrswert"), state.verkehrswert);
    betragAnzeigen($("hypothek"), state.hypothek);
    setRadio("wegzug", state.wegzug);
    $("in-ch-seit").value = String(state.inChSeit || state.geburtsjahr);
    pctAnzeigen($("uws"), state.uws, 1);
    betragAnzeigen($("pk-beitrag"), pkBeitragEff("p1"));
    $("kapitalanteil").value = String(Math.round(state.kapitalanteil * 100));
    $("planungsalter").value = String(state.planungsalter);
    pctAnzeigen($("rendite"), state.renditeNominal, 1);
    pctAnzeigen($("inflation"), state.inflation, 1);
    pctAnzeigen($("kosten"), state.kosten, 1);
    pctAnzeigen($("zins-bargeld"), state.renditeBargeld, 1);
    $("faktor-75").value = String(Math.round(state.faktorAb75 * 100));
    $("faktor-85").value = String(Math.round(state.faktorAb85 * 100));
    $("faktor-ausgaben").value = String(Math.round(szenario.faktorAusgaben * 100));
    $("krise").checked = szenario.krise;
  }

  function aktualisiereHinweise() {
    const a = alterVon(state.geburtsjahr);
    text($("alter-hinweis"), "Im Beispieljahr " + JAHR_HEUTE + " ist das " + a + " Jahre.");
    const mon = state.ahvModus === "kennen" && state.ahvMonat > 0 ? state.ahvMonat : ahvSchaetzung(state.lohn);
    text(
      $("ahv-schaetzung"),
      state.ahvModus === "schaetzen"
        ? "Geschätzte AHV-Rente: " + fmtChf(mon) + " pro Monat (Näherung, Beitragslücken nicht geprüft)."
        : "Sie können den Betrag aus dem letzten AHV-Auszug eintragen.",
    );
    if ($("ahv-feld")) $("ahv-feld").hidden = state.ahvModus !== "kennen";
    if ($("eigentum-felder")) $("eigentum-felder").hidden = !state.eigentum;
    if ($("partner-block")) $("partner-block").hidden = state.zivilstand !== "paar";
    const monat = Math.round(state.ausgaben / 12);
    text($("ausgaben-hilfe"), "Das sind etwa " + fmtChf(monat) + " pro Monat, ohne Steuern. Der Prototyp rechnet die Steuern grob dazu.");
    const f = Math.round(szenario.faktorAusgaben * 100);
    text($("faktor-ausgaben-wert"), f === 100 ? "wie eingegeben" : f + " %");
    text($("pk-beitrag-hilfe"), "Standard ist die Schätzung aus dem Lohn, derzeit " + fmtChf(pkBeitragGeschaetzt(state.lohn)) + " pro Jahr.");
    text($("rendite-real-hinweis"), "Reale Nettorendite derzeit rund " + fmtPct(renditeReal(), 1) + " pro Jahr.");
    const fnt = feinheiten();
    setPill("ahv-status", fnt.ahvStd);
    setPill("pk-status", fnt.pkStd);
    setPill("annahmen-status", fnt.annStd);
    setPill("ausgabenfein-status", fnt.ausStd);
  }

  function setPill(id, istStandard) {
    const el = $(id);
    if (!el) return;
    el.textContent = istStandard ? "Noch Standardwert" : "Angepasst";
    el.classList.toggle("status-pill--angepasst", !istStandard);
  }

  function leeren(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  function el(tag, klasse, inhalt) {
    const n = document.createElement(tag);
    if (klasse) n.className = klasse;
    if (inhalt != null) n.textContent = inhalt;
    return n;
  }

  function zeile(links, rechts) {
    const row = el("div", "zeile");
    row.appendChild(el("span", "", links));
    row.appendChild(el("span", "", rechts));
    return row;
  }

  function eckZeile(links, rechts) {
    const row = el("div", "eck-zeile");
    row.appendChild(el("span", "", links));
    row.appendChild(el("span", "", rechts));
    return row;
  }

  function reihe(titel, wert, badgeText, badgeKlasse, ziel) {
    const btn = el("button", "reihe");
    btn.type = "button";
    btn.appendChild(el("span", "reihe__titel", titel));
    btn.appendChild(el("span", "reihe__wert", wert));
    const badge = el("span", "badge" + (badgeKlasse ? " " + badgeKlasse : ""), badgeText);
    btn.appendChild(badge);
    btn.addEventListener("click", () => {
      lesenFormulare();
      setSchirm(ziel);
    });
    return btn;
  }

  function zeichneChart(sim, ruecktritt) {
    const canvas = $("chart");
    if (!canvas || !canvas.getContext) return;
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
    const real = renditeReal();
    const punkte = [];
    for (let alter = alterJetzt; alter < ruecktritt; alter++) {
      const j = alter - alterJetzt;
      punkte.push({ alter, frei: wachsen(state.vermoegen, 0, real, j) });
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
    for (const g of [0, 0.25, 0.5, 0.75, 1]) {
      const y = yPos(yMax * g);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(cssW - pad.r, y);
      ctx.stroke();
      const kurz =
        g === 0 ? "0" : yMax * g >= 1e6 ? (yMax * g / 1e6).toFixed(1).replace(".0", "") + " Mio." : Math.round((yMax * g) / 1000) + " Tsd.";
      ctx.fillText(kurz, 4, y + 4);
    }

    const ticks = [x0, ruecktritt, sim.horizon].filter((v, i, a) => a.indexOf(v) === i);
    for (const t of ticks) {
      const label = String(t);
      let tx = xPos(t) - ctx.measureText(label).width / 2;
      tx = Math.max(pad.l - 4, Math.min(tx, cssW - pad.r - ctx.measureText(label).width));
      ctx.fillText(label, tx, cssH - 10);
    }

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
    ctx.fillText("Ruhestand " + ruecktritt, Math.min(xr + 4, cssW - 100), pad.t + 12);
  }

  function renderErgebnis() {
    const { gefunden, beiWunsch } = findeFruehestes();
    const kern = $("kern");
    kern.classList.remove("kern--knapp");
    const horizon = state.planungsalter;

    if (gefunden) {
      const frueher = gefunden.alter < state.wunschalter;
      text($("kern-label"), "Frühester Ruhestand");
      text($("kern-zahl"), String(gefunden.alter));
      const satz = frueher
        ? "Mit " + gefunden.alter + " Jahren reicht das Beispielvermögen voraussichtlich bis " + horizon + ". Ihr Wunschalter ist " + state.wunschalter + "."
        : gefunden.alter === state.wunschalter
          ? "Mit Ihrem Wunschalter " + state.wunschalter + " reicht das Geld in dieser Beispielrechnung bis " + horizon + "."
          : "Erst ab " + gefunden.alter + " reicht das Geld bis " + horizon + " – später als Ihr Wunschalter " + state.wunschalter + ".";
      text($("kern-satz"), satz);
    } else {
      kern.classList.add("kern--knapp");
      text($("kern-label"), "So reicht es noch nicht");
      text($("kern-zahl"), "knapp");
      text(
        $("kern-satz"),
        "Selbst mit einem Rücktritt mit 70 reicht das Vermögen in dieser Beispielrechnung nicht bis " + horizon + ". Senken Sie die Ausgaben oder prüfen Sie die Annahmen.",
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
        gefunden && gefunden.sim.ok ? "Vermögen mit " + horizon : "Reicht bis",
        gefunden && gefunden.sim.ok ? fmtChf(sim.freiEnde) : sim.endetBei ? "Alter " + sim.endetBei : "nicht bis " + horizon,
      ],
    ];
    for (const [dt, dd] of tiles) {
      const wrap = el("div", "kachel");
      wrap.appendChild(el("dt", "", dt));
      wrap.appendChild(el("dd", "", dd));
      kacheln.appendChild(wrap);
    }

    zeichneChart(sim, ruecktritt);
    text(
      $("chart-legende"),
      "Orangene Linie: frühester oder gewünschter Ruhestand. Fläche: Vermögen in heutigen Franken. Planungshorizont: " + horizon + " Jahre.",
    );

    const st = anzahlStatus();
    const f = feinheiten();
    if (st.angepasst === 0 && st.moduleAktiv === 0) {
      text(
        $("schaetz-banner"),
        "Grobe Schätzung: Sie beruht auf den Eckdaten und auf Standardwerten (unter anderem Planungshorizont " + horizon + ", geschätzte AHV, Rendite 7 %). Sie können einzelne Werte verfeinern – müssen aber nicht.",
      );
    } else {
      text(
        $("schaetz-banner"),
        "Feinere Schätzung: " +
          st.angepasst +
          (st.angepasst === 1 ? " Vertiefung ist" : " Vertiefungen sind") +
          " angepasst" +
          (st.moduleAktiv ? ", plus " + st.moduleAktiv + (st.moduleAktiv === 1 ? " optionales Modul" : " optionale Module") : "") +
          ". Die übrigen Werte sind weiterhin Standard.",
      );
    }
    text($("status-zeile"), st.standard + " von " + st.total + " Vertiefungen noch auf Standard" + (st.moduleAktiv ? " · " + st.moduleAktiv + " Modul aktiv" : "") + ".");

    const eck = $("eck-liste");
    leeren(eck);
    eck.appendChild(eckZeile("Haushalt", state.zivilstand === "paar" ? "Ehepaar" : "Einzelperson"));
    eck.appendChild(eckZeile("Jahrgang", String(state.geburtsjahr) + " (" + alterVon(state.geburtsjahr) + " Jahre)"));
    eck.appendChild(eckZeile("Bruttolohn", fmtChf(state.lohn) + " / Jahr"));
    eck.appendChild(eckZeile("Wunschalter", state.wunschalter + " Jahre"));
    eck.appendChild(eckZeile("Pensionskasse / 3a / frei", fmtChf(state.pk) + " · " + fmtChf(state.s3a) + " · " + fmtChf(state.vermoegen)));
    eck.appendChild(eckZeile("Lebenshaltung", fmtChf(state.ausgaben) + " / Jahr"));
    const kantonName = $("kanton") && $("kanton").selectedOptions[0] ? $("kanton").selectedOptions[0].textContent : state.kanton;
    eck.appendChild(eckZeile("Wohnkanton", kantonName));

    const fein = $("fein-liste");
    leeren(fein);
    const ahvWert =
      (state.ahvModus === "kennen" && state.ahvMonat > 0 ? state.ahvMonat : ahvSchaetzung(state.lohn));
    fein.appendChild(reihe("AHV-Rente", fmtChf(ahvWert) + " / Mt.", f.ahvStd ? "Standard" : "Angepasst", f.ahvStd ? "" : "badge--angepasst", "ahv"));
    fein.appendChild(reihe("Pensionskasse im Detail", "UWS " + fmtPct(state.uws, 1), f.pkStd ? "Standard" : "Angepasst", f.pkStd ? "" : "badge--angepasst", "pk"));
    fein.appendChild(reihe("Annahmen und Horizont", "bis " + state.planungsalter + " · " + fmtPct(state.renditeNominal, 0) + " Rendite", f.annStd ? "Standard" : "Angepasst", f.annStd ? "" : "badge--angepasst", "annahmen"));
    fein.appendChild(reihe("Ausgaben im Alter", Math.round(state.faktorAb75 * 100) + " % / " + Math.round(state.faktorAb85 * 100) + " %", f.ausStd ? "Standard" : "Angepasst", f.ausStd ? "" : "badge--angepasst", "ausgabenfein"));

    const mods = $("modul-liste");
    leeren(mods);
    const eigText = state.eigentum ? "Netto " + fmtChf(Math.max(0, state.verkehrswert - state.hypothek)) : "Nicht erfasst";
    mods.appendChild(reihe("Wohneigentum", eigText, state.eigentum ? "Aktiv" : "Optional", state.eigentum ? "badge--angepasst" : "badge--optional", "eigentum"));
    const wegText = state.wegzug === "pt" ? "Wegzug nach Portugal" : "In der Schweiz";
    mods.appendChild(reihe("Wegzug", wegText, state.wegzug === "pt" ? "Aktiv" : "Optional", state.wegzug === "pt" ? "badge--angepasst" : "badge--optional", "wegzug"));

    const eink = $("detail-einkommen");
    leeren(eink);
    eink.appendChild(zeile("AHV-Rente (Jahr, nach evtl. Kürzung)", fmtChf(sim.ahvJahr)));
    eink.appendChild(zeile("PK-Rente (Umwandlungssatz " + fmtPct(state.uws, 1) + ")", fmtChf(sim.pkRenteJahr)));
    eink.appendChild(zeile("Freies Vermögen inkl. 3a bei Rücktritt", fmtChf(sim.freiBeiRuecktritt)));
    if (state.eigentum) eink.appendChild(zeile("Wohneigentum netto (Puffer, zuletzt)", fmtChf(sim.eigentumNetto)));
    eink.appendChild(zeile("Lebenshaltung im ersten Ruhestandsjahr inkl. Szenario", fmtChf(ausgabenImAlter(ruecktritt))));
    eink.appendChild(zeile("Steuerannahme", Math.round(sim.steuerSatz * 100) + " % auf AHV- und PK-Rente"));

    const ann = $("detail-annahmen");
    leeren(ann);
    ann.appendChild(
      el(
        "p",
        "",
        "Alles in heutigen Franken. Nominale Börsenrendite " +
          fmtPct(state.renditeNominal, 1) +
          ", Teuerung " +
          fmtPct(state.inflation, 1) +
          ", Kosten " +
          fmtPct(state.kosten, 1) +
          ", reale Nettorendite rund " +
          fmtPct(renditeReal(), 1) +
          ". PK-Zins 1,25 % nominal. Der Planungshorizont ist " +
          horizon +
          " Jahre.",
      ),
    );
    if (state.wegzug === "pt") {
      ann.appendChild(el("p", "", "Modul Wegzug Portugal: niedrigere Steuerannahme (" + Math.round(STEUER_PT * 100) + " %). Kein echtes Länder- oder DBA-Modell."));
    }
    if (szenario.krise) {
      ann.appendChild(el("p", "", "Szenario Krise: das freie Vermögen und die 3a werden zum Rücktritt um 30 % gekürzt. Keine historischen Pfade."));
    }
    ann.appendChild(el("p", "", "Diese Rechnung gehört nur zum Prototyp. Die fertige App behält ihren geprüften Rechenkern."));
  }

  function updateLeiste() {
    const zurueck = $("btn-zurueck");
    const weiter = $("btn-weiter");
    zurueck.hidden = false;
    if (schirm === "start") {
      zurueck.textContent = "Eckdaten zuerst ansehen";
      weiter.textContent = "Beispielergebnis anzeigen";
    } else if (schirm === "eckdaten") {
      zurueck.textContent = hatteErgebnis ? "Zurück zum Ergebnis" : "Zurück";
      weiter.textContent = hatteErgebnis ? "Ergebnis aktualisieren" : "Ergebnis anzeigen";
    } else if (schirm === "ergebnis") {
      zurueck.textContent = "Zur Startseite";
      weiter.textContent = "Eckdaten ändern";
    } else {
      zurueck.hidden = true;
      weiter.textContent = "Zurück zum Ergebnis";
    }
  }

  function setSchirm(name, ohneHash) {
    if (SCHIRME.indexOf(name) < 0) name = "start";
    schirm = name;
    if (name === "ergebnis") hatteErgebnis = true;
    document.querySelectorAll(".schirm").forEach((node) => {
      node.hidden = node.dataset.schirm !== schirm;
    });
    if (!ohneHash) {
      const neu = "#" + schirm;
      if (location.hash !== neu) history.replaceState(null, "", neu);
    }
    const unter = {
      start: "Redesign-Vorschlag",
      eckdaten: "Eckdaten, frei änderbar",
      ergebnis: "Beispielergebnis",
      ahv: "Verfeinerung AHV",
      pk: "Verfeinerung Pensionskasse",
      annahmen: "Verfeinerung Annahmen",
      ausgabenfein: "Verfeinerung Ausgaben",
      eigentum: "Optionales Modul",
      wegzug: "Optionales Modul",
    };
    text($("kopf-sub"), unter[schirm] || "Redesign-Vorschlag");
    updateLeiste();
    schreibenFormulare();
    aktualisiereHinweise();
    if (schirm === "ergebnis") renderErgebnis();
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  function aufStartZuruecksetzen() {
    const frisch = neuerStand();
    Object.keys(frisch).forEach((k) => {
      state[k] = frisch[k];
    });
    szenario.faktorAusgaben = 1;
    szenario.krise = false;
    hatteErgebnis = false;
    schreibenFormulare();
  }

  function weiter() {
    lesenFormulare();
    if (schirm === "start") {
      setSchirm("ergebnis");
      return;
    }
    if (schirm === "eckdaten") {
      setSchirm("ergebnis");
      return;
    }
    if (schirm === "ergebnis") {
      setSchirm("eckdaten");
      return;
    }
    setSchirm("ergebnis");
  }

  function zurueck() {
    lesenFormulare();
    if (schirm === "start") {
      setSchirm("eckdaten");
      return;
    }
    if (schirm === "eckdaten") {
      setSchirm(hatteErgebnis ? "ergebnis" : "start");
      return;
    }
    if (schirm === "ergebnis") {
      setSchirm("start");
      return;
    }
    setSchirm("ergebnis");
  }

  function bindBetrag(id, setter) {
    const node = $(id);
    if (!node) return;
    node.addEventListener("focus", () => {
      const n = parseBetrag(node.value);
      node.value = n ? String(Math.round(n)) : "";
      node.select();
    });
    node.addEventListener("blur", () => {
      const n = parseBetrag(node.value);
      setter(n);
      betragAnzeigen(node, n);
      aktualisiereHinweise();
      if (schirm === "ergebnis") renderErgebnis();
    });
  }

  function bindBlur(id, fn) {
    const node = $(id);
    if (!node) return;
    node.addEventListener("change", fn);
    node.addEventListener("blur", fn);
  }

  function nachAenderung() {
    lesenFormulare();
    aktualisiereHinweise();
    if (schirm === "ergebnis") renderErgebnis();
  }

  function init() {
    schreibenFormulare();
    aktualisiereHinweise();

    $("btn-weiter").addEventListener("click", weiter);
    $("btn-zurueck").addEventListener("click", zurueck);
    $("btn-eckdaten-oben").addEventListener("click", () => {
      lesenFormulare();
      setSchirm("eckdaten");
    });

    document.querySelectorAll('input[name="zivilstand"]').forEach((node) =>
      node.addEventListener("change", () => {
        const vorher = state.zivilstand;
        lesenFormulare();
        if (vorher === "allein" && state.zivilstand === "paar" && state.ausgaben === BEISPIEL.ausgaben) {
          state.ausgaben = BEISPIEL.ausgabenPaar;
          betragAnzeigen($("ausgaben"), state.ausgaben);
        }
        if (vorher === "paar" && state.zivilstand === "allein" && state.ausgaben === BEISPIEL.ausgabenPaar) {
          state.ausgaben = BEISPIEL.ausgaben;
          betragAnzeigen($("ausgaben"), state.ausgaben);
        }
        aktualisiereHinweise();
      }),
    );
    document.querySelectorAll('input[name="ahv-modus"]').forEach((node) => node.addEventListener("change", nachAenderung));
    document.querySelectorAll('input[name="wegzug"]').forEach((node) => node.addEventListener("change", nachAenderung));
    $("eigentum").addEventListener("change", nachAenderung);
    $("geburtsjahr").addEventListener("input", () => {
      state.geburtsjahr = Number($("geburtsjahr").value) || BEISPIEL.geburtsjahr;
      aktualisiereHinweise();
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

    bindBlur("uws", nachAenderung);
    bindBlur("pk-beitrag", nachAenderung);
    bindBlur("kapitalanteil", nachAenderung);
    bindBlur("planungsalter", nachAenderung);
    bindBlur("rendite", nachAenderung);
    bindBlur("inflation", nachAenderung);
    bindBlur("kosten", nachAenderung);
    bindBlur("zins-bargeld", nachAenderung);
    bindBlur("faktor-75", nachAenderung);
    bindBlur("faktor-85", nachAenderung);
    bindBlur("in-ch-seit", nachAenderung);
    bindBlur("wunschalter", nachAenderung);
    bindBlur("kanton", nachAenderung);

    $("faktor-ausgaben").addEventListener("input", () => {
      lesenFormulare();
      aktualisiereHinweise();
      if (schirm === "ergebnis") renderErgebnis();
    });
    $("krise").addEventListener("change", () => {
      lesenFormulare();
      if (schirm === "ergebnis") renderErgebnis();
    });

    $("btn-ahv-reset").addEventListener("click", () => {
      state.ahvModus = STANDARD.ahvModus;
      state.ahvMonat = STANDARD.ahvMonat;
      state.inChSeit = STANDARD.inChSeit;
      schreibenFormulare();
      aktualisiereHinweise();
    });
    $("btn-pk-reset").addEventListener("click", () => {
      state.uws = STANDARD.uws;
      state.pkBeitrag = STANDARD.pkBeitrag;
      state.kapitalanteil = STANDARD.kapitalanteil;
      schreibenFormulare();
      aktualisiereHinweise();
    });
    $("btn-annahmen-reset").addEventListener("click", () => {
      state.planungsalter = STANDARD.planungsalter;
      state.renditeNominal = STANDARD.renditeNominal;
      state.inflation = STANDARD.inflation;
      state.kosten = STANDARD.kosten;
      state.renditeBargeld = STANDARD.renditeBargeld;
      schreibenFormulare();
      aktualisiereHinweise();
    });
    $("btn-ausgabenfein-reset").addEventListener("click", () => {
      state.faktorAb75 = STANDARD.faktorAb75;
      state.faktorAb85 = STANDARD.faktorAb85;
      schreibenFormulare();
      aktualisiereHinweise();
    });
    $("btn-eigentum-reset").addEventListener("click", () => {
      state.eigentum = false;
      state.verkehrswert = STANDARD.verkehrswert;
      state.hypothek = STANDARD.hypothek;
      schreibenFormulare();
      aktualisiereHinweise();
    });
    $("btn-wegzug-reset").addEventListener("click", () => {
      state.wegzug = "ch";
      schreibenFormulare();
      aktualisiereHinweise();
    });

    window.addEventListener("resize", () => {
      if (schirm === "ergebnis") renderErgebnis();
    });
    window.addEventListener("hashchange", () => {
      const ziel = location.hash.replace(/^#/, "");
      if (ziel && SCHIRME.indexOf(ziel) >= 0 && ziel !== schirm) {
        lesenFormulare();
        if (ziel === "ergebnis") hatteErgebnis = true;
        setSchirm(ziel, true);
      }
    });

    const startHash = location.hash.replace(/^#/, "");
    if (startHash && SCHIRME.indexOf(startHash) >= 0) {
      if (startHash === "ergebnis" || ["ahv", "pk", "annahmen", "ausgabenfein", "eigentum", "wegzug", "eckdaten"].indexOf(startHash) >= 0) {
        if (startHash !== "eckdaten" || location.search.indexOf("fresh") < 0) hatteErgebnis = startHash !== "start";
      }
      if (startHash !== "start" && startHash !== "eckdaten") hatteErgebnis = true;
      setSchirm(startHash, true);
    } else {
      setSchirm("start", true);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
