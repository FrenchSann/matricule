"""Convertit le PDF « Programme hybride 58 semaines » en données JSON pour l'app.

Usage : python scripts/parse-programme.py <chemin du PDF>
Écrit src/data/programme.json. Nécessite pypdf (pip install pypdf).
"""
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

DAYS = {'LUNDI': 0, 'MARDI': 1, 'MERCREDI': 2, 'JEUDI': 3, 'VENDREDI': 4, 'SAMEDI': 5, 'DIMANCHE': 6}
FIRST_WEEK_PAGE = 13  # index 0 de la page « S01 1 sur 2 »
SWIM_LABELS = {'Échauffement', 'Technique', 'Bloc principal', 'Régularité', 'Retour au calme', 'Bloc facile', 'Préparation', 'Repère'}


def minutes(text: str) -> int:
    """« 10 h 01 » → 601"""
    m = re.match(r'(\d+) h (\d+)', text)
    return int(m.group(1)) * 60 + int(m.group(2))


def join(lines):
    return re.sub(r'\s+', ' ', ' '.join(lines)).strip()


def parse_work(name: str, work: str):
    ex = {'name': name, 'sets': 1, 'unit': 'reps'}
    if m := re.match(r'^(\d+) × (\d+)-(\d+)(.*)$', work):
        ex.update(sets=int(m.group(1)), repsMin=int(m.group(2)), reps=int(m.group(3)))
        rest = m.group(4).strip()
        if rest == '/ jambe':
            ex['perSide'] = 'par jambe'
        elif rest == '/ côté':
            ex['perSide'] = 'par côté'
        elif rest:
            ex['note'] = rest
    elif m := re.match(r'^(\d+) × (\d+) (m|s), (.*)$', work):
        ex.update(sets=int(m.group(1)), reps=int(m.group(2)), unit=m.group(3), note=m.group(4))
    elif m := re.match(r'^1 série propre de référence \+ 1 × (\d+)-(\d+) facile$', work):
        ex.update(sets=2, repsMin=int(m.group(1)), reps=int(m.group(2)), bilan=True,
                  note='Série 1 : référence propre, arrêt avant la première répétition dégradée. Série 2 facile.')
    else:
        raise ValueError(f'Travail non reconnu : {name} / {work}')
    return ex


def parse_gym(lines):
    header = []
    i = 3  # après les 3 lignes d'en-tête de page
    while not lines[i].startswith(('LUNDI', 'MERCREDI', 'VENDREDI')):
        header.append(lines[i])
        i += 1
    head = join(header)
    m = re.search(r'Semaine \d+ · Musculation (.+?) / (.+?) · RIR ([\d-]+)', head)
    block, kind, rir = m.group(1), m.group(2), m.group(3)

    sessions, footer = [], []
    current = None
    while i < len(lines):
        line = lines[i]
        if hm := re.match(r'^(LUNDI|MERCREDI|VENDREDI) (\d+) H(?: (\d+))? / ([ABC]) - (.+?) / ~(\d+) MIN$', line):
            day, h, mm, slot, label, dur = hm.groups()
            current = {
                'slot': slot,
                'day': DAYS[day],
                'time': f'{h} h {mm}' if mm else f'{h} h',
                'title': f'Salle {slot}, {label.lower()}',
                'durationMin': int(dur),
                'exercises': [],
            }
            sessions.append(current)
            i += 4  # en-têtes Exercice / Travail / Repos
            continue
        if current is not None and i + 2 < len(lines) and re.match(r'^(\d+ ×|1 série)', lines[i + 1]):
            name, work, rest = line, lines[i + 1], lines[i + 2]
            step = 3
            if i + 3 < len(lines) and lines[i + 3] == 'côtés':
                rest += ' côtés'
                step = 4
            if name == 'Curl + extension triceps':
                # Supersérie : deux exercices suivis séparément pour les charges.
                for sub in ('Curl biceps', 'Extension triceps'):
                    ex = parse_work(sub, work)
                    ex.pop('note', None)
                    ex.update(rest=rest, note='En supersérie avec ' + ('l’extension triceps' if sub == 'Curl biceps' else 'le curl'))
                    current['exercises'].append(ex)
            else:
                if name.startswith('Tractions : bilan'):
                    name = 'Tractions pronation / assistées'
                ex = parse_work(name, work)
                ex['rest'] = rest
                current['exercises'].append(ex)
            i += step
            continue
        if current is not None and current['exercises']:
            footer.append(line)
        i += 1
    return block, kind, rir, sessions, join(footer)


def section(lines, start_pattern, stop_patterns):
    out, on = [], False
    for line in lines:
        if re.match(start_pattern, line):
            on = True
            out.append(line)
            continue
        if on and any(re.match(p, line) for p in stop_patterns):
            break
        if on:
            out.append(line)
    return out


def parse_endurance(lines):
    body = lines[3:]
    total_line = join(body[:3])
    total = re.search(r'Total estimé : (\d+ h \d+)', total_line).group(1)
    stops = [r'^(JEUDI|VENDREDI|SAMEDI|DIMANCHE) \d', r'^GRAPPLING, REPOS']

    thu = section(body, r'^JEUDI', stops)
    thu_dur = int(re.search(r'~(\d+) MIN', thu[0]).group(1))
    thu_text = join(thu[1:])
    thu_main = thu_text.split('EPS intense')[0].strip()

    fri = section(body, r'^VENDREDI', stops)
    fri_dur = int(re.search(r'/ (\d+) MIN', fri[0]).group(1))

    sat = section(body, r'^SAMEDI', stops)
    sm = re.search(r'/ (\d+) M / ~(\d+) MIN', sat[0])
    blocks, cur = [], None
    for line in sat[1:]:
        if line in ('Bloc', 'Contenu'):
            continue
        if line.startswith('Repos inclus'):
            break
        if line in SWIM_LABELS:
            cur = {'label': line, 'content': ''}
            blocks.append(cur)
        elif cur is not None:
            cur['content'] = join([cur['content'], line])

    sun = section(body, r'^DIMANCHE', stops)
    sun_dur = int(re.search(r'/ (\d+) MIN', sun[0]).group(1))
    sun_text = join(sun[1:])
    option = None
    if 'Option de remplacement' in sun_text:
        main, opt = sun_text.split('Option de remplacement :', 1)
        om = re.search(r'marche (\d+) min, sac ([^,]+?)(?: maximum)?, ou sans charge', opt)
        adj = re.search(r'Total hebdomadaire ajusté : (\d+ h \d+)', opt)
        option = {
            'durationMin': int(om.group(1)),
            'load': om.group(2).strip(),
            'text': join([opt.split('Total hebdomadaire')[0].strip()]),
            'adjustedTotalMin': minutes(adj.group(1)) if adj else None,
        }
        sun_text = main.strip()

    gr = section(body, r'^GRAPPLING, REPOS', [r'^À noter'])
    gr_text = join(gr[1:])
    consigne = gr_text.split('Contenu du grappling laissé à ton entraîneur.', 1)[-1].strip()
    fourth = None
    if 'Quatrième grappling possible' in consigne:
        fm = re.search(r'Total avec cette substitution : (\d+ h \d+)', consigne)
        fourth = {'totalMin': minutes(fm.group(1)) if fm else None}

    return {
        'totalMin': minutes(total),
        'run': {
            'thursday': {'time': '17 h 45', 'durationMin': thu_dur, 'text': thu_main},
            'friday': {'time': '19 h', 'durationMin': fri_dur, 'text': join(fri[1:])},
            'sunday': {'time': '10 h', 'durationMin': sun_dur, 'text': sun_text, 'option': option},
        },
        'swim': {'time': '10 h', 'distanceM': int(sm.group(1)), 'durationMin': int(sm.group(2)), 'blocks': blocks},
        'consigne': consigne,
        'fourthGrappling': fourth,
    }


def main(pdf_path: str):
    pages = [p.extract_text() or '' for p in PdfReader(pdf_path).pages]
    weeks = []
    for n in range(1, 59):
        gym_lines = pages[FIRST_WEEK_PAGE + 2 * (n - 1)].splitlines()
        end_lines = pages[FIRST_WEEK_PAGE + 2 * (n - 1) + 1].splitlines()
        title = gym_lines[0]
        dm = re.match(r'^S(\d+) / (\d\d)\.(\d\d)\.(\d{4}) - (\d\d)\.(\d\d)\.(\d{4})', title)
        assert int(dm.group(1)) == n, title
        block, kind, rir, gym, gym_note = parse_gym(gym_lines)
        assert len(gym) == 3, (n, len(gym))
        weeks.append({
            'n': n,
            'from': f'{dm.group(4)}-{dm.group(3)}-{dm.group(2)}',
            'block': block,
            'kind': kind,
            'rir': rir,
            'gym': gym,
            'gymNote': gym_note,
            **parse_endurance(end_lines),
        })
    out = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'programme.json'
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({'title': 'Programme hybride 58 semaines', 'weeks': weeks}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{len(weeks)} semaines écrites dans {out}')


if __name__ == '__main__':
    main(sys.argv[1])
