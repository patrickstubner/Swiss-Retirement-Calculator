#!/usr/bin/env python3
"""
Erzeugt data/krisen-historisch.json und data/krisen-haeufigkeit.json.

Quellen (Details, Lizenzen und Stand: docs/krisen.md, docs/quellen.md Abschnitt 13):
- Jordà-Schularick-Taylor Macrohistory Database, Release 6 (JST R6), https://www.macrohistory.net/database/
  Lizenz CC BY-NC-SA 4.0. Datei JSTdatasetR6.xlsx (lokal herunterladen, Pfad als 1. Argument).
- SNB-Datenportal (nicht kommerzielle Nutzung mit Quellenangabe, https://www.snb.ch/de/srv/disclaimer_copyright):
  capchstocki (SPI Gesamtindex, Jahresende), rendoblim (Renditen Eidg. Obligationen, Dezember),
  zimoma (SARON, Monatsmittel). Nur für die Verlängerung Schweiz 2021–2024.
- BFS Landesindex der Konsumentenpreise, durchschnittliche Jahresteuerung 2021–2024 (Medienmitteilungen, siehe unten).

Aufruf: python scripts/krisen-daten.py /pfad/JSTdatasetR6.xlsx [snb_spi.csv snb_rend.csv snb_zimoma.csv]
Ohne SNB-Dateien werden sie über die öffentliche SNB-API geladen.
"""
import csv
import io
import json
import math
import sys
import urllib.request

import pandas as pd

STAND = '2026-09-27'
LAENDER_REIHEN = ['CHE', 'USA', 'JPN']
JAHR_BIS = 2020  # JST R6 endet 2020

# BFS: durchschnittliche Jahresteuerung (Veränderung Jahresmittel LIK), amtlich
BFS_TEUERUNG = {
    2021: (0.006, 'https://www.bfs.admin.ch/news/de/2022-0003'),
    2022: (0.028, 'https://www.bfs.admin.ch/news/de/2023-0009'),
    2023: (0.021, 'https://www.bfs.admin.ch/asset/de/30225916'),
    2024: (0.011, 'https://www.bfs.admin.ch/news/de/2025-0003'),
}


def lade_csv(pfad_oder_cube):
    if pfad_oder_cube.endswith('.csv'):
        return open(pfad_oder_cube, encoding='utf-8').read()
    url = f'https://data.snb.ch/api/cube/{pfad_oder_cube}/data/csv/de'
    return urllib.request.urlopen(url, timeout=60).read().decode('utf-8')


def snb_zeilen(text):
    for r in csv.reader(io.StringIO(text), delimiter=';'):
        if len(r) == 3 and r[2].strip() and r[0][:1].isdigit():
            yield r[0].strip(), r[1].strip(), float(r[2].strip())


def bond_tr(y_vor, y9):
    """Näherung: 10-jährige Anleihe, Coupon = Rendite Vorjahresende, bewertet mit 9-Jahres-Rendite."""
    c = y_vor
    preis = sum(c / (1 + y9) ** k for k in range(1, 10)) + 1 / (1 + y9) ** 9
    return c + preis - 1


def verlaengerung_ch(spi_txt, rend_txt, zimo_txt):
    spi = {}
    for datum, dim, wert in snb_zeilen(spi_txt):
        # capchstocki: Tageswerte; Jahresende = letzter Handelstag des Jahres, SPI Gesamtindex (GDR)
        if dim == 'GDR':
            spi[int(datum[:4])] = wert  # Datei ist chronologisch sortiert
    rend = {(d, k): v / 100 for d, k, v in snb_zeilen(rend_txt) if d.endswith('-12')}
    saron = {}
    for d, k, v in snb_zeilen(zimo_txt):
        if k == 'SARON':
            saron.setdefault(d[:4], []).append(v / 100)
    return spi, rend, saron


def main():
    jst_pfad = sys.argv[1]
    d = pd.read_excel(jst_pfad, sheet_name=0)
    d = d.sort_values(['iso', 'year'])
    d['infl'] = d.groupby('iso').cpi.pct_change()
    d['hp'] = d.groupby('iso').hpnom.pct_change()

    def f(x):
        return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(float(x), 5)

    reihen = {}
    for iso in LAENDER_REIHEN:
        c = d[d.iso == iso].set_index('year')
        zeilen = []
        for jahr, r in c.iterrows():
            if jahr < 1871 or jahr > JAHR_BIS:
                continue
            zeilen.append([int(jahr), f(r.eq_tr), f(r.bond_tr), f(r.bill_rate), f(r.infl), f(r.hp)])
        reihen[iso] = zeilen

    # Verlängerung Schweiz 2021–2024 (SNB + BFS). Werte fest hinterlegt und mit den Rohdaten geprüft.
    if len(sys.argv) >= 5:
        spi_ende, rend, saron = verlaengerung_ch(lade_csv(sys.argv[2]), lade_csv(sys.argv[3]), lade_csv(sys.argv[4]))
    else:
        spi_ende, rend, saron = verlaengerung_ch(lade_csv('capchstocki'), lade_csv('rendoblim'), lade_csv('zimoma'))
    # Plausibilität: SPI-Jahresrenditen 2016–2020 gegen JST (gleiche Quelle SIX/SPI)
    che = d[d.iso == 'CHE'].set_index('year')
    for jahr in range(2016, 2021):
        diff = spi_ende[jahr] / spi_ende[jahr - 1] - 1 - float(che.loc[jahr].eq_tr)
        print(f'Kontrolle SPI vs. JST {jahr}: Differenz {diff:+.4f}')
    for jahr in range(2021, 2025):
        eq = spi_ende[jahr] / spi_ende[jahr - 1] - 1
        b = bond_tr(rend[(f'{jahr - 1}-12', '10J')], rend[(f'{jahr}-12', '9J')])
        bill = sum(saron[str(jahr)]) / len(saron[str(jahr)])
        reihen['CHE'].append([jahr, round(eq, 5), round(b, 5), round(bill, 5), BFS_TEUERUNG[jahr][0], None])

    daten = {
        'stand': STAND,
        'spalten': ['jahr', 'aktienTR', 'obligationenTR', 'geldmarkt', 'teuerung', 'immobilienpreise'],
        'einheit': 'Anteile (0.05 = 5 %), nominal in Landeswährung, Kalenderjahr',
        'quellen': {
            'jst': {
                'name': 'Jordà-Schularick-Taylor Macrohistory Database, Release 6',
                'url': 'https://www.macrohistory.net/database/',
                'lizenz': 'CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/)',
                'zitat': 'Jordà, Schularick, Taylor (2017): Macrofinancial History and the New Business Cycle Facts. '
                'NBER Macroeconomics Annual 2016, 31. Jordà, Knoll, Kuvshinov, Schularick, Taylor (2019): '
                'The Rate of Return on Everything, 1870–2015. QJE 134(3).',
                'variablen': 'eq_tr, bond_tr, bill_rate, cpi (Teuerung = Veränderung), hpnom (Veränderung)',
                'jahre': '1871–2020',
            },
            'snb': {
                'name': 'SNB-Datenportal: capchstocki (SPI Gesamtindex, Jahresende), rendoblim (Kassazinssätze '
                'Eidg. Obligationen 9 und 10 Jahre, Dezember), zimoma (SARON, Jahresmittel der Monatswerte)',
                'url': 'https://data.snb.ch',
                'lizenz': 'Nicht kommerzielle Nutzung mit Quellenangabe (https://www.snb.ch/de/srv/disclaimer_copyright). '
                'Der SPI ist ein Index der SIX Swiss Exchange; verwendet werden nur 4 daraus abgeleitete Jahresrenditen.',
                'jahre': 'Schweiz 2021–2024',
                'methode_obligationen': 'Näherung: 10-jährige Anleihe zum Coupon der Vorjahresrendite, am Jahresende '
                'mit der 9-Jahres-Rendite bewertet (wie Kursänderung + Coupon).',
            },
            'bfs': {
                'name': 'BFS Landesindex der Konsumentenpreise, durchschnittliche Jahresteuerung',
                'urls': {str(k): v[1] for k, v in BFS_TEUERUNG.items()},
                'lizenz': 'Freie Nutzung, Quellenangabe ist Pflicht (OPEN BY, https://www.bfs.admin.ch/bfs/en/home/fso/swiss-federal-statistical-office/terms-of-use.html)',
                'jahre': 'Schweiz 2021–2024',
            },
        },
        'reihen': reihen,
    }
    with open('data/krisen-historisch.json', 'w', encoding='utf-8') as fh:
        json.dump(daten, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write('\n')

    # ---------- Krisenhäufigkeit ----------
    def episoden(jahre, renditen, schwelle):
        """Peak-to-Trough-Rückgänge ≥ schwelle auf einem Jahres-Indexpfad (lückenlose Segmente)."""
        eps = []
        idx, peak, peak_jahr, tief, in_ep, gezaehlt = 1.0, 1.0, None, 1.0, False, False
        vorher = None
        for j, r in zip(jahre, renditen):
            if r is None:
                idx, peak, peak_jahr, tief, in_ep, gezaehlt, vorher = 1.0, 1.0, None, 1.0, False, False, None
                continue
            if vorher is None:
                peak_jahr = j - 1
            vorher = j
            idx *= 1 + r
            if idx >= peak:
                if gezaehlt:
                    eps[-1]['erholt'] = j
                peak, peak_jahr, tief, gezaehlt = idx, j, idx, False
                continue
            tief = min(tief, idx)
            if not gezaehlt and idx / peak - 1 <= -schwelle:
                eps.append({'hoch': peak_jahr, 'start': peak_jahr + 1, 'tief': j, 'rueckgang': None, 'erholt': None})
                gezaehlt = True
            if gezaehlt:
                if idx <= tief:
                    eps[-1]['tief'] = j
                eps[-1]['rueckgang'] = round(tief / peak - 1, 3)
        return eps

    def reale_rendite(c, jahre):
        out = []
        for j in jahre:
            if j not in c.index:
                out.append(None)
                continue
            r = c.loc[j]
            if pd.isna(r.eq_tr) or pd.isna(r.infl):
                out.append(None)
            else:
                out.append((1 + r.eq_tr) / (1 + r.infl) - 1)
        return out

    def zaehle(c, von, bis):
        jahre = list(range(von, bis + 1))
        real = reale_rendite(c, jahre)
        nom = [None if j not in c.index or pd.isna(c.loc[j].eq_tr) else float(c.loc[j].eq_tr) for j in jahre]
        n_jahre = sum(1 for x in real if x is not None)
        res = {'jahreMitDaten': n_jahre}
        for name, reihe, s in [('real20', real, 0.2), ('real30', real, 0.3), ('nominal20', nom, 0.2)]:
            eps = [e for e in episoden(jahre, reihe, s) if von <= e['start'] <= bis]
            res[name] = {
                'anzahl': len(eps),
                'proDekade': round(len(eps) / n_jahre * 10, 2) if n_jahre else None,
                'episoden': eps,
            }
        bank = c.loc[von:bis, 'crisisJST'].dropna()
        starts = [int(j) for j, v in bank.items() if v == 1]
        res['banken'] = {
            'anzahl': len(starts),
            'jahre': starts,
            'jahreMitDaten': len(bank),
            'proDekade': round(len(starts) / len(bank) * 10, 2) if len(bank) else None,
        }
        return res

    zeitraeume = [(1871, 2020), (1950, 2020)]
    haeuf = {'stand': STAND, 'quelle': 'JST R6 (eq_tr, cpi, crisisJST), eigene Auszählung mit scripts/krisen-daten.py',
             'definitionen': {
                 'real20': 'Realer Aktien-Gesamtertragsindex (Dividenden reinvestiert, mit Teuerung bereinigt, '
                 'Jahresendwerte) fällt um mindestens 20 % unter den letzten Höchststand; eine Episode endet mit '
                 'einem neuen Höchststand. Gezählt wird das Beginnjahr (Jahr nach dem Höchststand).',
                 'real30': 'Wie real20, Schwelle 30 %.',
                 'nominal20': 'Wie real20, aber nominal (ohne Teuerung) – Annäherung an «Bärenmarkt» mit Jahresdaten.',
                 'banken': 'Beginn einer systemischen Bankenkrise nach JST (Variable crisisJST = 1).',
                 'hinweis': 'Jahresdaten: kurze Einbrüche innerhalb eines Jahres (z.B. Oktober 1987, März 2020) '
                 'sind nicht oder nur abgeschwächt sichtbar. Die Zahlen sind deshalb eher Untergrenzen.',
             },
             'laender': {}, 'welt': {}}
    for iso in sorted(d.iso.unique()):
        c = d[d.iso == iso].set_index('year')
        haeuf['laender'][iso] = {f'{v}-{b}': zaehle(c, v, b) for v, b in zeitraeume}
        if iso not in LAENDER_REIHEN:  # Episoden nur für CHE/USA/JPN ausweisen (Dateigrösse)
            for z in haeuf['laender'][iso].values():
                for name in ['real20', 'real30', 'nominal20']:
                    z[name].pop('episoden')

    # Welt: (a) Durchschnitt über 18 Länder, (b) gleichgewichteter Welt-Index (Durchschnitt der realen Landesrenditen)
    for v, b in zeitraeume:
        key = f'{v}-{b}'
        mittel = {}
        for name in ['real20', 'real30', 'nominal20', 'banken']:
            werte = [haeuf['laender'][i][key][name]['proDekade'] for i in haeuf['laender']
                     if haeuf['laender'][i][key][name]['proDekade'] is not None]
            mittel[name] = round(sum(werte) / len(werte), 2)
        jahre = list(range(v, b + 1))
        glob = []
        for j in jahre:
            xs = []
            for iso in haeuf['laender']:
                c = d[(d.iso == iso) & (d.year == j)]
                if len(c) and not pd.isna(c.iloc[0].eq_tr) and not pd.isna(c.iloc[0].infl):
                    xs.append((1 + c.iloc[0].eq_tr) / (1 + c.iloc[0].infl) - 1)
            glob.append(sum(xs) / len(xs) if len(xs) >= 10 else None)
        n = sum(1 for x in glob if x is not None)
        gi = {}
        for name, s in [('real20', 0.2), ('real30', 0.3)]:
            eps = [e for e in episoden(jahre, glob, s) if v <= e['start'] <= b]
            gi[name] = {'anzahl': len(eps), 'proDekade': round(len(eps) / n * 10, 2), 'episoden': eps}
        # Jahre mit Beginn einer Bankenkrise in mind. 3 der 18 Länder (globale Wellen)
        bank = d[(d.year >= v) & (d.year <= b)].groupby('year').crisisJST.sum()
        wellen = [int(j) for j, s in bank.items() if s >= 3]
        haeuf['welt'][key] = {
            'mittelLaender': mittel,
            'weltIndexGleichgewichtet': {'jahreMitDaten': n, **gi},
            'bankenWellen': {'definition': 'Jahre, in denen in mindestens 3 der 18 JST-Länder eine Bankenkrise beginnt',
                             'jahre': wellen, 'proDekade': round(len(wellen) / (b - v + 1) * 10, 2)},
        }
    with open('data/krisen-haeufigkeit.json', 'w', encoding='utf-8') as fh:
        json.dump(haeuf, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write('\n')


if __name__ == '__main__':
    main()
