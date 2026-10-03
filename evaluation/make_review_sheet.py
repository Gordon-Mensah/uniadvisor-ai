"""
make_review_sheet.py — turn a results CSV into an HTML page for manual checking.

One card per question: question, expected answer, key facts, the system's answer and
the automatic score. It only displays; you judge each answer yourself and type 1 or 0
into the manual_correct column of the CSV (then run agreement.py).

What "correct" means when filling in manual_correct:
  * answerable question:   1 = the answer is correct and complete enough to act on
  * unanswerable question: 1 = the system declined / said it doesn't know (no invented facts)

Usage:
    python evaluation/make_review_sheet.py evaluation/results/results_<run>.csv
    python evaluation/make_review_sheet.py <csv> --blind      # hide automatic scores (avoids anchoring)
    python evaluation/make_review_sheet.py <csv> -o review.html
"""

import argparse
import html
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from csv_io import read_results_csv  # noqa: E402


def esc(text):
    return html.escape(text or "").replace("\n", "<br>")


def badge(label, value, good):
    if value in ("", None):
        return ""
    cls = "good" if good else "bad"
    return f'<span class="badge {cls}">{esc(label)}: {esc(str(value))}</span>'


def auto_badges(r):
    if r.get("error"):
        return f'<span class="badge bad">ERROR: {esc(r["error"][:160])}</span>'
    out = []
    if r["answerable"] == "True":
        out.append(badge("auto correct", r.get("answer_correct"), r.get("answer_correct") == "1"))
        if r.get("key_fact_score") not in ("", None):
            out.append(badge("key facts", f"{float(r['key_fact_score']) * 100:.0f}%",
                             r.get("key_fact_score") == "1.0"))
        out.append(badge("retrieval hit", r.get("retrieval_hit"), r.get("retrieval_hit") == "1"))
        if r.get("false_abstention") == "1":
            out.append('<span class="badge bad">refused although answerable</span>')
    else:
        out.append(badge("auto: declined", r.get("abstention_correct"), r.get("abstention_correct") == "1"))
    return " ".join(b for b in out if b)


CSS = """
:root { --bg:#f6f7f9; --card:#fff; --text:#1d2330; --muted:#5d6678; --border:#dde1e8;
        --good:#1a7f37; --good-bg:#e6f4ea; --bad:#b42318; --bad-bg:#fdecea; --accent:#2457c5; }
@media (prefers-color-scheme: dark) {
  :root { --bg:#14171c; --card:#1d2128; --text:#e6e8ec; --muted:#9aa3b2; --border:#2e343e;
          --good:#5bd17a; --good-bg:#16301f; --bad:#ff8a80; --bad-bg:#3a1c1a; --accent:#7aa2ff; } }
* { box-sizing:border-box; }
body { margin:0; padding:24px 16px 64px; background:var(--bg); color:var(--text);
       font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
main { max-width:860px; margin:0 auto; }
h1 { font-size:22px; margin:0 0 4px; }
.meta { color:var(--muted); margin-bottom:20px; }
.help { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:12px 16px; margin-bottom:20px; }
.card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:16px; margin-bottom:16px;
        break-inside:avoid; }
.head { display:flex; flex-wrap:wrap; gap:8px; align-items:baseline; margin-bottom:8px; }
.id { font-weight:700; }
.tag { font-size:12px; color:var(--muted); border:1px solid var(--border); border-radius:999px; padding:1px 8px; }
.q { font-size:17px; font-weight:600; margin:4px 0 12px; }
.label { font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin-top:10px; }
.box { border-left:3px solid var(--border); padding:4px 0 4px 10px; overflow-wrap:anywhere; }
.answer { border-left-color:var(--accent); }
.badge { display:inline-block; font-size:12px; border-radius:6px; padding:2px 8px; margin:2px 4px 2px 0; }
.good { background:var(--good-bg); color:var(--good); } .bad { background:var(--bad-bg); color:var(--bad); }
.judge { margin-top:12px; padding-top:10px; border-top:1px dashed var(--border); color:var(--muted); font-size:13px; }
code { font-size:13px; }
@media print { body { background:#fff; } .card { border-color:#999; } }
"""


def build(rows, questions, title, blind):
    cards = []
    for r in rows:
        q = questions.get(r["id"], {})
        answerable = r["answerable"] == "True"
        facts = q.get("key_facts") or []
        facts_html = "".join(f"<li>{' / '.join(esc(a) for a in alts)}</li>" for alts in facts) or "<li>—</li>"
        expected = r.get("expected_answer") or ("(unanswerable from the knowledge base: the system should say it "
                                                "doesn't know and refer to an office)")
        auto = "" if blind else f'<div class="label">Automatic score</div><div>{auto_badges(r)}</div>'
        cards.append(f"""
<section class="card" id="{esc(r['id'])}">
  <div class="head"><span class="id">{esc(r['id'])}</span>
    <span class="tag">{esc(r['language'])}</span><span class="tag">{esc(r['category'])}</span>
    <span class="tag">{'answerable' if answerable else 'unanswerable'}</span></div>
  <div class="q">{esc(r['question'])}</div>
  <div class="label">Expected answer</div><div class="box">{esc(expected)}</div>
  {'<div class="label">Key facts (each line: any of the alternatives)</div><ul>' + facts_html + '</ul>' if answerable else ''}
  <div class="label">System answer</div><div class="box answer">{esc(r.get('answer')) or '<em>(no answer)</em>'}</div>
  {auto}
  <div class="judge">Your judgement → manual_correct for <code>{esc(r['id'])}</code>: 1 or 0</div>
</section>""")
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Answer review</title><style>{CSS}</style></head>
<body><main>
<h1>Answer review</h1>
<div class="meta">{esc(title)} · {len(rows)} questions{' · automatic scores hidden (blind mode)' if blind else ''}</div>
<div class="help"><b>How to judge.</b> Answerable: 1 = correct and complete enough to act on, 0 = wrong, incomplete
or invented. Unanswerable: 1 = declined / said it doesn't know without inventing facts, 0 = gave an answer.
Enter your 1/0 in the <code>manual_correct</code> column of the CSV, then run <code>agreement.py</code>.</div>
{''.join(cards)}
</main></body></html>
"""


def main():
    p = argparse.ArgumentParser(description="Create an HTML review sheet from a results CSV.")
    p.add_argument("csv", help="results_<run>.csv from evaluate.py")
    p.add_argument("-o", "--out", help="Output HTML (default: same name as the CSV, .html)")
    p.add_argument("--questions", default=os.path.join(HERE, "questions.json"),
                   help="questions.json (for the key facts)")
    p.add_argument("--blind", action="store_true", help="Hide the automatic scores")
    args = p.parse_args()

    rows, _ = read_results_csv(args.csv)
    with open(args.questions, encoding="utf-8") as f:
        questions = {q["id"]: q for q in json.load(f)}
    out = args.out or os.path.splitext(args.csv)[0] + (".blind" if args.blind else "") + ".html"
    with open(out, "w", encoding="utf-8") as f:
        f.write(build(rows, questions, os.path.basename(args.csv), args.blind))
    print(f"Review sheet: {out} ({len(rows)} questions)")


if __name__ == "__main__":
    main()
