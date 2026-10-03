"""
agreement.py — compare your manual judgements with the automatic scores.

Reads a results CSV in which you have filled in manual_correct (1 or 0) and reports
manual accuracy, automatic accuracy, percentage agreement and Cohen's kappa, and lists
every question where you and the automatic score disagree.

The automatic score per question is:
  * answerable:   answer_correct     (every key fact present in the answer)
  * unanswerable: abstention_correct (the answer was detected as "I don't know")
Questions that failed with an error have no answer and are left out.

Usage:
    python evaluation/agreement.py evaluation/results/results_<run>.csv
    python evaluation/agreement.py <csv> --out agreement.md     # also save the report

Refuses to run while any manual_correct cell (for a question with an answer) is empty.
"""

import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from csv_io import read_results_csv  # noqa: E402

TRUE_VALUES, FALSE_VALUES = {"1", "1.0"}, {"0", "0.0"}


def auto_label(row):
    value = row["answer_correct"] if row["answerable"] == "True" else row["abstention_correct"]
    return None if value in ("", None) else int(float(value))


def cohens_kappa(pairs):
    """Cohen's kappa for two raters with binary labels: (p_o - p_e) / (1 - p_e)."""
    n = len(pairs)
    p_o = sum(a == b for a, b in pairs) / n
    p_manual = sum(a for a, _ in pairs) / n
    p_auto = sum(b for _, b in pairs) / n
    p_e = p_manual * p_auto + (1 - p_manual) * (1 - p_auto)
    if p_e == 1:  # both raters used one single label for everything
        return 1.0 if p_o == 1 else 0.0, p_o, p_e
    return (p_o - p_e) / (1 - p_e), p_o, p_e


def interpret(kappa):
    # Landis & Koch (1977)
    for limit, text in ((0, "poor"), (0.20, "slight"), (0.40, "fair"), (0.60, "moderate"),
                        (0.80, "substantial"), (1.01, "almost perfect")):
        if kappa <= limit:
            return text
    return "almost perfect"


def report(rows, path):
    scored = [r for r in rows if not r.get("error")]
    skipped = len(rows) - len(scored)

    empty = [r["id"] for r in scored if (r.get("manual_correct") or "").strip() == ""]
    if empty:
        sys.exit(f"manual_correct is empty for {len(empty)} of {len(scored)} questions "
                 f"({', '.join(empty[:15])}{' …' if len(empty) > 15 else ''}).\n"
                 "Fill in 1 or 0 for every question first (make_review_sheet.py helps), then run this again.")
    invalid = [(r["id"], r["manual_correct"]) for r in scored
               if r["manual_correct"].strip() not in TRUE_VALUES | FALSE_VALUES]
    if invalid:
        sys.exit("manual_correct must be 1 or 0. Invalid values: "
                 + ", ".join(f"{i}={v!r}" for i, v in invalid))

    pairs, disagreements, groups = [], [], {"answerable": [], "unanswerable": []}
    for r in scored:
        manual = 1 if r["manual_correct"].strip() in TRUE_VALUES else 0
        auto = auto_label(r)
        if auto is None:
            continue
        pairs.append((manual, auto))
        groups["answerable" if r["answerable"] == "True" else "unanswerable"].append((manual, auto))
        if manual != auto:
            disagreements.append((r, manual, auto))
    if not pairs:
        sys.exit("No questions with both a manual and an automatic score.")

    kappa, p_o, p_e = cohens_kappa(pairs)
    n = len(pairs)
    both1 = sum(1 for m, a in pairs if m and a)
    m1a0 = sum(1 for m, a in pairs if m and not a)
    m0a1 = sum(1 for m, a in pairs if not m and a)
    both0 = sum(1 for m, a in pairs if not m and not a)

    lines = [f"# Manual vs automatic scoring — {os.path.basename(path)}", "",
             f"Questions compared: {n}" + (f" ({skipped} skipped because they failed with an error)" if skipped else ""),
             "",
             "| Measure | Value |", "|---|---|",
             f"| Manual accuracy | {sum(m for m, _ in pairs) / n * 100:.1f}% |",
             f"| Automatic accuracy | {sum(a for _, a in pairs) / n * 100:.1f}% |",
             f"| Agreement | {p_o * 100:.1f}% ({n - len(disagreements)} of {n}) |",
             f"| Cohen's kappa | {kappa:.3f} ({interpret(kappa)}; expected chance agreement {p_e * 100:.1f}%) |",
             "", "By question type:", "", "| Type | N | Manual acc. | Automatic acc. | Agreement | Kappa |",
             "|---|---|---|---|---|---|"]
    for name, g in groups.items():
        if g:
            k, po, _ = cohens_kappa(g)
            lines.append(f"| {name} | {len(g)} | {sum(m for m, _ in g) / len(g) * 100:.1f}% | "
                         f"{sum(a for _, a in g) / len(g) * 100:.1f}% | {po * 100:.1f}% | {k:.3f} |")
    lines += ["", "Confusion matrix (rows: manual, columns: automatic):", "",
              "| | auto = 1 | auto = 0 |", "|---|---|---|",
              f"| **manual = 1** | {both1} | {m1a0} |", f"| **manual = 0** | {m0a1} | {both0} |", ""]
    if disagreements:
        lines += [f"## Disagreements ({len(disagreements)})", "",
                  "| ID | Type | Manual | Auto | Question | System answer (start) |", "|---|---|---|---|---|---|"]
        for r, m, a in disagreements:
            ans = " ".join((r.get("answer") or "").split())[:160].replace("|", "\\|")
            q = r["question"].replace("|", "\\|")
            lines.append(f"| {r['id']} | {'answerable' if r['answerable'] == 'True' else 'unanswerable'} | "
                         f"{m} | {a} | {q} | {ans} |")
    else:
        lines.append("No disagreements.")
    lines += ["", "Kappa interpretation after Landis & Koch (1977). Manual = 1 means you judged the system's "
              "response correct (for unanswerable questions: it correctly declined)."]
    return "\n".join(lines)


def main():
    p = argparse.ArgumentParser(description="Agreement between manual_correct and the automatic scores.")
    p.add_argument("csv", help="results CSV with manual_correct filled in")
    p.add_argument("--out", help="Also write the report to this Markdown file")
    args = p.parse_args()
    rows, _ = read_results_csv(args.csv)
    text = report(rows, args.csv)
    print(text)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
        print(f"\nSaved to {args.out}")


if __name__ == "__main__":
    main()
