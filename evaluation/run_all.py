"""
run_all.py — run the full thesis comparison and write one comparison table.

Full run (needs Groq keys, like the app):
    python evaluation/run_all.py
      1. baseline  + openai/gpt-oss-20b
      2. stopwords + openai/gpt-oss-20b
      3. translate + openai/gpt-oss-20b
      4. best of 1–3 + openai/gpt-oss-120b
    -> evaluation/results/comparison.md

Retrieval only (no API calls):
    python evaluation/run_all.py --retrieval-only
      baseline, stopwords, translate (translate uses the reference translations
      in questions.json, i.e. a perfect translator)
    -> evaluation/results/comparison_retrieval-only.md

Prompt experiment (needs Groq keys):
    python evaluation/run_all.py --prompt-experiment
      translate + openai/gpt-oss-20b with PROMPT_MODE=default, then =strict
    -> evaluation/results/comparison_prompt.md

Each configuration runs evaluate.py in its own process, so the BM25 index and
caches start fresh every time. The "best" retrieval mode is the one with the
highest overall answer accuracy on gpt-oss-20b (ties: Hit@3, then MRR).
"""

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
EVALUATE = os.path.join(HERE, "evaluate.py")
MODES = ("baseline", "stopwords", "translate")
GROUPS = ("Overall", "English", "Hungarian")


def run_config(retrieval, model, args, index, total, prompt="default"):
    label = f"{retrieval} + {model or 'no LLM'}" + (f" + prompt={prompt}" if prompt != "default" or args.prompt_experiment else "")
    print(f"\n{'═' * 70}\n[{index}/{total}] {label}\n{'═' * 70}", flush=True)
    metrics_path = os.path.join(args.out_dir, f".metrics_tmp_{index}.json")
    cmd = [sys.executable, EVALUATE, "--retrieval", retrieval, "--prompt", prompt, "--out-dir", args.out_dir,
           "--metrics-out", metrics_path, "--delay", str(args.delay)]
    if model:
        cmd += ["--model", model]
    if args.retrieval_only:
        cmd += ["--retrieval-only"]
    if args.limit:
        cmd += ["--limit", str(args.limit)]
    code = subprocess.call(cmd)
    if code not in (0, 2):  # 2 = evaluate.py stopped early but wrote its results
        sys.exit(f"\nevaluate.py failed for '{label}' (exit code {code}); stopping run_all.")
    with open(metrics_path, encoding="utf-8") as f:
        result = json.load(f)
    os.remove(metrics_path)
    result["label"] = label
    return result


def best_mode(results):
    usable = [r for r in results if not r["aborted"] and r["errors"] < r["questions"]]
    if not usable:
        sys.exit("\nAll gpt-oss-20b runs failed; not running the gpt-oss-120b configuration.")

    def key(r):
        g = r["groups"]["Overall"]
        return tuple(-1 if g[m] is None else g[m] for m in ("answer_accuracy", "hit_at_3", "mrr"))
    return max(usable, key=key)


def _pct(v):
    return "–" if v is None else f"{v * 100:.1f}%"


def write_comparison(results, path, retrieval_only, note, title="retrieval and model comparison"):
    cols = ["Run", "Retrieval", "Prompt", "Model", "Group", "N (ans/unans)", "Hit@3", "MRR", "Answer accuracy",
            "Key-fact coverage", "Abstention accuracy", "False abstention", "Median latency (s)"]
    lines = ["| " + " | ".join(cols) + " |", "|" + "|".join("---" for _ in cols) + "|"]
    for group in GROUPS:
        for i, r in enumerate(results, 1):
            g = r["groups"].get(group)
            if not g:
                continue
            row = [str(i), r["retrieval_desc"], "–" if r["retrieval_only"] else r.get("prompt", "default"),
                   "–" if r["retrieval_only"] else r["model"], group,
                   f"{g['n_answerable']}/{g['n_unanswerable']}", _pct(g["hit_at_3"]),
                   "–" if g["mrr"] is None else f"{g['mrr']:.3f}", _pct(g["answer_accuracy"]),
                   _pct(g["key_fact_coverage"]), _pct(g["abstention_accuracy"]), _pct(g["false_abstention"]),
                   "–" if g["latency_median"] is None else f"{g['latency_median']:.2f}"]
            lines.append("| " + " | ".join(row) + " |")

    runs = []
    for i, r in enumerate(results, 1):
        status = f"stopped early ({r['aborted']})" if r["aborted"] else f"{r['errors']} of {r['questions']} questions failed"
        runs.append(f"{i}. **{r['label']}** — {status}; details: `{os.path.basename(r['summary'])}`, "
                    f"`{os.path.basename(r['csv'])}`")

    markdown = "\n".join(lines)
    doc = [
        f"# UniAdvisor AI — {title}" + (" (retrieval only)" if retrieval_only else ""),
        "",
        f"Generated {datetime.now():%Y-%m-%d %H:%M}. BM25 parameters identical in every run "
        "(k1=1.5, b=0.75, top-3 chunks).",
        "",
        markdown,
        "",
        "## Runs",
        "",
        *runs,
        "",
    ]
    if note:
        doc += [note, ""]
    doc += [
        "## Notes",
        "",
        "- Hit@3 / MRR: was the chunk containing the gold source passage among the 3 retrieved.",
        "- Answer accuracy: every required key fact appears in the answer; key-fact coverage gives partial credit.",
        "- Abstention accuracy: unanswerable questions where the system said it didn't know; "
        "false abstention: answerable questions where it refused and gave no key fact.",
        "- Answer accuracy and abstention are automatic heuristics; check them against the manual_correct "
        "column you fill in in each results CSV.",
    ]
    if retrieval_only:
        doc.append("- Retrieval-only runs make no LLM calls, so answer metrics and latency (which here is "
                   "retrieval time only) are not comparable with full runs.")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(doc) + "\n")
    return markdown


def main():
    p = argparse.ArgumentParser(description="Run all evaluation configurations and compare them.")
    p.add_argument("--retrieval-only", action="store_true",
                   help="Compare the three retrieval modes without any API calls")
    p.add_argument("--prompt-experiment", action="store_true",
                   help="Run translate + --model with prompt=default and prompt=strict "
                        "and write comparison_prompt.md (instead of the retrieval comparison)")
    p.add_argument("--model", default="openai/gpt-oss-20b", help="Model for the retrieval comparison")
    p.add_argument("--big-model", default="openai/gpt-oss-120b", help="Model for the best retrieval mode")
    p.add_argument("--delay", type=float, default=2.0, help="Seconds between questions (default 2)")
    p.add_argument("--pause", type=float, default=60.0,
                   help="Seconds to wait between configurations to let rate limits recover (default 60)")
    p.add_argument("--limit", type=int, default=None, help="Only the first N questions (for a quick trial)")
    p.add_argument("--out-dir", default=os.path.join(HERE, "results"))
    args = p.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)
    if args.retrieval_only and args.prompt_experiment:
        p.error("--prompt-experiment needs the LLM; it cannot be combined with --retrieval-only")
    if args.retrieval_only:
        args.delay, args.pause = 0.0, 0.0

    if args.prompt_experiment:
        results = []
        for i, prompt in enumerate(("default", "strict"), 1):
            results.append(run_config("translate", args.model, args, i, 2, prompt=prompt))
            if args.pause and i < 2:
                print(f"\nWaiting {args.pause:.0f}s before the next configuration (rate limits)...", flush=True)
                time.sleep(args.pause)
        note = ("Prompt experiment: identical retrieval (translate) and model; only the answer prompt differs. "
                "*default* is the production prompt; *strict* forbids answers not stated in the context and "
                "prescribes an explicit \"I don't know\" + office referral. Retrieval metrics (Hit@3, MRR) "
                "should be identical in both runs; any difference comes from the LLM translation step.")
        path = os.path.join(args.out_dir, "comparison_prompt.md")
        table = write_comparison(results, path, False, note, title="answer prompt comparison")
        print(f"\n{table}\n\nComparison written to {path}")
        return

    results, note = [], ""
    total = len(MODES) + (0 if args.retrieval_only else 1)
    for i, mode in enumerate(MODES, 1):
        results.append(run_config(mode, None if args.retrieval_only else args.model, args, i, total))
        if args.pause and i < total:
            print(f"\nWaiting {args.pause:.0f}s before the next configuration (rate limits)...", flush=True)
            time.sleep(args.pause)

    if not args.retrieval_only:
        best = best_mode(results)
        g = best["groups"]["Overall"]
        note = (f"Best retrieval mode on {args.model}: **{best['retrieval']}** "
                f"(answer accuracy {_pct(g['answer_accuracy'])}, Hit@3 {_pct(g['hit_at_3'])}); "
                f"run {total} repeats it with {args.big_model}.")
        print("\n" + note.replace("**", ""))
        results.append(run_config(best["retrieval"], args.big_model, args, total, total))

    name = "comparison_retrieval-only.md" if args.retrieval_only else "comparison.md"
    path = os.path.join(args.out_dir, name)
    table = write_comparison(results, path, args.retrieval_only, note)
    print(f"\n{table}\n\nComparison written to {path}")


if __name__ == "__main__":
    main()
