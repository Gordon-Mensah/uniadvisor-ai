"""
evaluate.py — UniAdvisor AI evaluation framework
────────────────────────────────────────────────
Runs every question in questions.json through rag.get_answer() and measures:

  * Retrieval hit rate (Hit@k) and MRR — was the chunk containing the gold
    source passage among the chunks BM25 retrieved?
  * Answer correctness — does the answer contain every required key fact?
  * Abstention — for unanswerable questions, did the system say it doesn't know?
    For answerable questions, did it wrongly refuse (false abstention)?
  * Response time of get_answer() (retrieval + LLM call).

rag.py and main.py are not modified. The retrieved chunks are captured by
wrapping rag._bm25_search for the duration of the run.

Usage (from the repository root):
    python evaluation/evaluate.py                    # full run (needs Groq keys, like the app)
    python evaluation/evaluate.py --retrieval-only   # no LLM calls; retrieval metrics only
    python evaluation/evaluate.py --validate         # only check questions.json against the KB
    python evaluation/evaluate.py --limit 5 --delay 2
    python evaluation/evaluate.py --model openai/gpt-oss-120b   # compare another Groq model
    python evaluation/evaluate.py --retrieval stopwords          # baseline | stopwords | translate
    python evaluation/evaluate.py --retrieval translate --prompt strict   # default | strict

Outputs (in evaluation/results/ by default), <run> = <retrieval>_<prompt>_<model>_<timestamp>:
    results_<run>.csv   one row per question (manual_correct is left empty for hand-marking)
    summary_<run>.md    the summary tables printed at the end
    metrics_<run>.json  the same numbers, machine-readable (used by run_all.py)

--retrieval-only with --retrieval translate uses the reference English translations
in questions.json ("question_en") instead of LLM translations, i.e. it measures V2
with a perfect translator (an upper bound), at no API cost.
"""

import argparse
import csv
import json
import os
import re
import statistics
import sys
import time
import unicodedata
from datetime import datetime
from types import SimpleNamespace

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)


# ═══════════════════════════════════════════════════════════════
# TEXT NORMALISATION + MATCHING
# ═══════════════════════════════════════════════════════════════

def normalize(text):
    """Lower-case, strip accents and quotes, unify number formats, collapse whitespace.

    "150,000" / "150 000" / "150.000" -> "150000", "Székesfehérvár" -> "szekesfehervar".
    """
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    text = re.sub(r"[\"'“”„‘’`´]", "", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"(?<=\d)[ ,. ](?=\d)", "", text)
    return text.strip()


def fact_present(fact, norm_answer):
    """Match a normalised fact in a normalised answer.

    Left word boundary always; right boundary only for facts ending in a digit,
    so "material" matches "materials" but "125" does not match "1250".
    """
    f = normalize(fact)
    if not f:
        return False
    pattern = r"(?<![a-z0-9])" + re.escape(f)
    if f[-1].isdigit():
        pattern += r"(?![0-9])"
    return re.search(pattern, norm_answer) is not None


ABSTAIN_PATTERNS = [
    # English
    r"not (?:\w+ )?(?:contained|mentioned|provided|available|included|specified|found|listed|stated)"
    r" (?:in|within) the (?:context|information|documents?|provided|available|given|knowledge)",
    r"(?:no|not have any|not have|dont have|don't have|do not have) (?:any )?(?:specific |relevant |further )?"
    r"(?:information|details|data)",
    r"\bi (?:dont|don't|do not) know\b",
    r"\b(?:unable|not able) to (?:find|provide|answer|give)",
    r"\bcan ?not (?:find|provide|answer|give)",
    r"\bcan't (?:find|provide|answer|give)",
    r"\bthere is no (?:mention|information|data)",
    r"\b(?:isnt|isn't|is not) (?:mentioned|specified|provided|available) ",
    r"\bthe context does not\b",
    r"\bno mention\b",
    # Hungarian (accents stripped by normalize)
    r"\bnem (?:talalhato|szerepel|tartalmaz|all rendelkezesre|ismert|derul ki|emlitik|talalok|talaltam)",
    r"\bnincs(?:enek)? (?:\w+ )?(?:informacio|adat|ra vonatkozo|erre vonatkozo|konkret)",
    r"\bnem tudok (?:valaszt|informaciot|pontos|valaszolni)",
    r"\bnem tudom\b",
    r"\bnem rendelkezem\b",
]
ABSTAIN_RE = re.compile("|".join(ABSTAIN_PATTERNS))


def is_abstention(answer):
    return bool(ABSTAIN_RE.search(normalize(answer)))


# ═══════════════════════════════════════════════════════════════
# KNOWLEDGE BASE LOADING
# ═══════════════════════════════════════════════════════════════

def load_knowledge_base(rag, kb_path, chunks_file):
    """Load the KB into rag's in-memory index without touching disk or Supabase."""
    rag.SUPABASE_AVAILABLE = False  # never write evaluation data to the production DB
    if chunks_file:
        with open(chunks_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        with rag._doc_lock:
            rag._doc_chunks[:] = [
                {"text": d["text"], "source": d["source"], "office": d.get("office", "general"),
                 "page": d.get("page"), "tokens": rag._tokenize(d["text"])}
                for d in data
            ]
        return f"{chunks_file} ({rag.doc_count()} chunks)"
    with open(kb_path, "r", encoding="utf-8") as f:
        rag.add_document(f.read(), source=os.path.basename(kb_path), office="general")
    return f"{kb_path} ({rag.doc_count()} chunks)"


def validate_questions(questions, kb_text):
    """Check that every gold passage appears verbatim (after normalisation) in the KB."""
    norm_kb = normalize(kb_text)
    problems = []
    ids = set()
    for q in questions:
        if q["id"] in ids:
            problems.append(f"{q['id']}: duplicate id")
        ids.add(q["id"])
        if q["answerable"]:
            if not q.get("source_passage") or not q.get("key_facts"):
                problems.append(f"{q['id']}: answerable question without source_passage/key_facts")
            elif normalize(q["source_passage"]) not in norm_kb:
                problems.append(f"{q['id']}: source_passage not found in knowledge base")
    return problems


# ═══════════════════════════════════════════════════════════════
# RUNNING THE QUESTIONS
# ═══════════════════════════════════════════════════════════════

class RetrievalRecorder:
    """Wraps rag._bm25_search so the chunks get_answer() actually used can be recorded."""

    def __init__(self, rag):
        self.rag = rag
        self.original = rag._bm25_search
        self.last = []
        self.query = ""

    def __enter__(self):
        def wrapped(query, office=None, k=3, mode=None):
            self.query = query
            self.last = self.original(query, office=office, k=k, mode=mode)
            return self.last
        self.rag._bm25_search = wrapped
        return self

    def __exit__(self, *exc):
        self.rag._bm25_search = self.original


class ServedModelRecorder:
    """Wraps GroqKeyRotator.chat to record which model Groq actually answered with."""

    def __init__(self):
        import groq_key_rotator
        self.cls = groq_key_rotator.GroqKeyRotator
        self.original = self.cls.chat
        self.last = ""

    def __enter__(self):
        recorder = self

        def wrapped(rotator_self, *args, **kwargs):
            response = recorder.original(rotator_self, *args, **kwargs)
            recorder.last = getattr(response, "model", "") or ""
            return response
        self.cls.chat = wrapped
        return self

    def __exit__(self, *exc):
        self.cls.chat = self.original


class _OfflineRotator:
    """Stand-in for the Groq rotator in --retrieval-only mode (no network calls)."""

    def chat(self, **kwargs):
        msg = SimpleNamespace(content="[retrieval-only run: no LLM answer generated]")
        return SimpleNamespace(choices=[SimpleNamespace(message=msg)])


def ask(rag, q, nationality, retries, backoff):
    """Call get_answer() with retries; return (answer, office, seconds, error)."""
    reply_lang = "hu" if q["language"] == "hu" else "en"
    last_error = ""
    for attempt in range(retries + 1):
        rag._answer_cache.clear()
        start = time.perf_counter()
        try:
            answer, _sources, office = rag.get_answer(
                q["question"], student_name="Evaluation", student_year="Year 1",
                student_major="General", student_nationality=nationality,
                office="auto", history=None, reply_lang=reply_lang,
            )
            return answer, office, time.perf_counter() - start, ""
        except Exception as e:  # rate limits, network errors
            if "No Groq API keys" in str(e):
                sys.exit(f"{e}\nSet the keys the app uses, or run with --retrieval-only.")
            last_error = f"{type(e).__name__}: {e}"
            if attempt < retries:
                time.sleep(backoff * (2 ** attempt))
    return "", "", None, last_error


def score(q, answer, chunks, retrieval_only):
    row = {}
    if q["answerable"]:
        gold = normalize(q["source_passage"])
        rank = next((i + 1 for i, c in enumerate(chunks) if gold in normalize(c["text"])), None)
        row["retrieval_hit"] = int(rank is not None)
        row["hit_rank"] = rank or ""
    else:
        row["retrieval_hit"] = ""
        row["hit_rank"] = ""

    if retrieval_only or not answer:
        row.update(key_fact_score="", answer_correct="", abstained="", false_abstention="", abstention_correct="")
        return row

    norm_answer = normalize(answer)
    abstained = is_abstention(answer)
    row["abstained"] = int(abstained)
    if q["answerable"]:
        groups = q["key_facts"]
        matched = sum(1 for alts in groups if any(fact_present(a, norm_answer) for a in alts))
        row["key_fact_score"] = round(matched / len(groups), 3)
        row["answer_correct"] = int(matched == len(groups))
        row["false_abstention"] = int(abstained and matched == 0)
        row["abstention_correct"] = ""
    else:
        row["key_fact_score"] = ""
        row["answer_correct"] = ""
        row["false_abstention"] = ""
        row["abstention_correct"] = int(abstained)
    return row


# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════

def _mean(values):
    values = [v for v in values if v != "" and v is not None]
    return statistics.mean(values) if values else None


def _pct(v):
    return "–" if v is None else f"{v * 100:.1f}%"


def _p95(values):
    values = sorted(values)
    if not values:
        return None
    idx = max(0, min(len(values) - 1, round(0.95 * len(values)) - 1))
    return values[idx]


def metrics(rows):
    """Numeric metrics for a group of rows (None where not applicable)."""
    ans = [r for r in rows if r["answerable"]]
    una = [r for r in rows if not r["answerable"]]
    times = [r["response_time_s"] for r in rows if r["response_time_s"] != ""]
    return {
        "n_answerable": len(ans),
        "n_unanswerable": len(una),
        "hit_at_3": _mean([r["retrieval_hit"] for r in ans]),
        "mrr": _mean([(1 / r["hit_rank"]) if r["hit_rank"] else 0 for r in ans]) if ans else None,
        "answer_accuracy": _mean([r["answer_correct"] for r in ans]),
        "key_fact_coverage": _mean([r["key_fact_score"] for r in ans]),
        "false_abstention": _mean([r["false_abstention"] for r in ans]),
        "abstention_accuracy": _mean([r["abstention_correct"] for r in una]),
        "latency_mean": statistics.mean(times) if times else None,
        "latency_median": statistics.median(times) if times else None,
        "latency_p95": _p95(times),
    }


def _secs(v):
    return "–" if v is None else f"{v:.2f}"


def summarize(rows, label):
    m = metrics(rows)
    return {
        "Group": label,
        "N (ans/unans)": f"{m['n_answerable']}/{m['n_unanswerable']}",
        "Hit@3": _pct(m["hit_at_3"]),
        "MRR": "–" if m["mrr"] is None else f"{m['mrr']:.3f}",
        "Answer accuracy": _pct(m["answer_accuracy"]),
        "Key-fact coverage": _pct(m["key_fact_coverage"]),
        "False abstention": _pct(m["false_abstention"]),
        "Abstention accuracy": _pct(m["abstention_accuracy"]),
        "Mean latency (s)": _secs(m["latency_mean"]),
        "Median (s)": _secs(m["latency_median"]),
        "P95 (s)": _secs(m["latency_p95"]),
    }


def markdown_table(dicts):
    headers = list(dicts[0].keys())
    lines = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    for d in dicts:
        lines.append("| " + " | ".join(str(d[h]) for h in headers) + " |")
    return "\n".join(lines)


def build_summary(rows, meta):
    overall = [summarize(rows, "Overall")]
    by_lang = [summarize([r for r in rows if r["language"] == lang], {"en": "English", "hu": "Hungarian"}.get(lang, lang))
               for lang in sorted({r["language"] for r in rows})]
    by_cat = [summarize([r for r in rows if r["category"] == c], c) for c in sorted({r["category"] for r in rows})]
    errors = sum(1 for r in rows if r["error"])

    parts = [
        "# UniAdvisor AI — evaluation summary",
        "",
        f"- Run: {meta['timestamp']}",
        f"- Mode: {meta['mode']}",
        f"- Model: {meta['model']}",
        f"- Retrieval: {meta['retrieval']} (BM25 k1=1.5, b=0.75, top-3)",
        f"- Prompt: {meta['prompt']}",
        f"- Knowledge base: {meta['kb']}",
        f"- Questions: {len(rows)} ({errors} failed with errors)",
    ] + ([f"- **Run stopped early:** {meta['aborted']}"] if meta.get("aborted") else []) + [
        "",
        "## Overall", "", markdown_table(overall), "",
        "## By language", "", markdown_table(by_lang), "",
        "## By category", "", markdown_table(by_cat), "",
        "## Metric definitions", "",
        "- **Hit@3**: share of answerable questions where a retrieved chunk contains the gold source passage.",
        "- **MRR**: mean reciprocal rank of the first chunk containing the gold passage (0 if not retrieved).",
        "- **Answer accuracy**: share of answerable questions whose answer contains every required key fact.",
        "- **Key-fact coverage**: mean share of required key facts present in the answer (partial credit).",
        "- **False abstention**: share of answerable questions where the system said it didn't know and gave no key fact.",
        "- **Abstention accuracy**: share of unanswerable questions where the system said it didn't know.",
        "- **Latency**: wall-clock time of one get_answer() call (retrieval + LLM).",
    ]
    return "\n".join(parts)


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

CSV_FIELDS = [
    "id", "language", "category", "answerable", "question", "expected_answer", "answer", "model",
    "detected_office", "response_time_s", "retrieval_hit", "hit_rank", "key_fact_score",
    "answer_correct", "abstained", "false_abstention", "abstention_correct",
    "search_query", "retrieved_chunks", "source_passage", "error", "manual_correct",
]


def main():
    p = argparse.ArgumentParser(description="Evaluate UniAdvisor AI's RAG pipeline.")
    p.add_argument("--questions", default=os.path.join(HERE, "questions.json"))
    p.add_argument("--kb", default=os.path.join(ROOT, "university_knowledge.txt"),
                   help="Plain-text knowledge base to index (default: university_knowledge.txt)")
    p.add_argument("--chunks-file", default=None,
                   help="Use an existing _chunks.json (e.g. uploaded_docs/_chunks.json) instead of --kb")
    p.add_argument("--out-dir", default=os.path.join(HERE, "results"))
    p.add_argument("--retrieval-only", action="store_true", help="Skip LLM calls; measure retrieval only")
    p.add_argument("--retrieval", choices=("baseline", "stopwords", "translate"), default="baseline",
                   help="Retrieval mode (sets RETRIEVAL_MODE for rag.py; default: baseline)")
    p.add_argument("--prompt", choices=("default", "strict"), default="default",
                   help="Answer prompt (sets PROMPT_MODE for rag.py; default: default)")
    p.add_argument("--metrics-out", default=None, help="Also write the metrics JSON to this path")
    p.add_argument("--model", default=None,
                   help="Groq model to evaluate (default: GROQ_MODEL env var, else openai/gpt-oss-20b), "
                        "e.g. openai/gpt-oss-120b")
    p.add_argument("--validate", action="store_true", help="Only validate questions.json against the KB")
    p.add_argument("--nationality", default="International",
                   help="student_nationality passed to get_answer (default: International)")
    p.add_argument("--limit", type=int, default=None, help="Only run the first N questions")
    p.add_argument("--delay", type=float, default=1.0, help="Seconds to wait between questions (rate limits)")
    p.add_argument("--retries", type=int, default=3)
    args = p.parse_args()

    with open(args.questions, "r", encoding="utf-8") as f:
        questions = json.load(f)

    with open(args.kb, "r", encoding="utf-8") as f:
        kb_text = f.read()
    problems = validate_questions(questions, kb_text)
    if problems:
        print("questions.json validation problems:")
        for prob in problems:
            print("  -", prob)
        if args.validate:
            sys.exit(1)
    n_ans = sum(q["answerable"] for q in questions)
    print(f"Loaded {len(questions)} questions ({n_ans} answerable, {len(questions) - n_ans} unanswerable)"
          + ("" if problems else "; all gold passages found in the knowledge base."))
    if args.validate:
        return

    if args.model:
        os.environ["GROQ_MODEL"] = args.model  # rag.py / groq_key_rotator read it on every call
    os.environ["RETRIEVAL_MODE"] = args.retrieval
    os.environ["PROMPT_MODE"] = args.prompt
    import groq_key_rotator
    import rag
    model_name = groq_key_rotator.current_model()
    retrieval_desc = args.retrieval
    if args.retrieval_only:
        rag.get_groq_rotator = lambda: _OfflineRotator()
        if args.retrieval == "translate":
            reference = {q["question"]: q["question_en"] for q in questions if q.get("question_en")}

            def reference_translation(question):
                if question not in reference:
                    raise KeyError(f"no question_en for: {question}")
                return reference[question]
            rag._translate_query = reference_translation
            retrieval_desc = "translate (reference translations from questions.json, no LLM)"
    kb_desc = load_knowledge_base(rag, args.kb, args.chunks_file)

    if args.limit:
        questions = questions[:args.limit]

    rows = []
    aborted = ""
    served_models = set()
    with RetrievalRecorder(rag) as recorder, ServedModelRecorder() as served:
        for i, q in enumerate(questions, 1):
            recorder.last = []
            recorder.query = ""
            served.last = ""
            answer, office, seconds, error = ask(rag, q, args.nationality, args.retries, backoff=args.delay or 1.0)
            chunks = recorder.last
            row = {
                "id": q["id"], "language": q["language"], "category": q["category"],
                "answerable": q["answerable"], "question": q["question"],
                "expected_answer": q.get("expected_answer") or "", "answer": answer,
                "model": served.last or ("" if args.retrieval_only else model_name),
                "detected_office": office,
                "response_time_s": "" if seconds is None else round(seconds, 3),
                "search_query": recorder.query,
                "retrieved_chunks": "\n\n---\n\n".join(
                    f"[{c['source']} | {c['office']}] {c['text']}" for c in chunks),
                "source_passage": q.get("source_passage") or "",
                "error": error, "manual_correct": "",
            }
            row.update(score(q, answer if not error else "", chunks, args.retrieval_only))
            rows.append(row)

            if served.last:
                served_models.add(served.last)
            status = f"ERROR: {error}" if error else (
                f"hit={row['retrieval_hit']}" if q["answerable"] else "unanswerable")
            if not args.retrieval_only and not error:
                status += (f" correct={row['answer_correct']}" if q["answerable"]
                           else f" abstained={row['abstained']}")
            timing = f" ({row['response_time_s']}s)" if row["response_time_s"] != "" else ""
            print(f"[{i:>2}/{len(questions)}] {q['id']} {status}{timing}")

            # Stop early if the first 3 questions all fail with the same error
            # (wrong model name, invalid key, ...) instead of burning through the rest.
            if i == 3 and all(r["error"] for r in rows) and len({r["error"] for r in rows}) == 1:
                aborted = f"the first 3 questions all failed with: {rows[0]['error']}"
                print(f"\nStopping early: {aborted}")
                break
            if args.delay and i < len(questions):
                time.sleep(args.delay)

    os.makedirs(args.out_dir, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_slug = "retrieval-only" if args.retrieval_only else re.sub(r"[^A-Za-z0-9._-]+", "-", model_name)
    run_name = f"{args.retrieval}_{args.prompt}_{model_slug}_{stamp}"
    csv_path = os.path.join(args.out_dir, f"results_{run_name}.csv")
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:  # utf-8-sig so Excel shows accents
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    meta = {"timestamp": stamp, "kb": kb_desc, "retrieval": retrieval_desc, "aborted": aborted,
            "prompt": "n/a (retrieval only)" if args.retrieval_only else args.prompt,
            "mode": "retrieval only (no LLM)" if args.retrieval_only else "full (retrieval + LLM)",
            "model": "n/a (retrieval only)" if args.retrieval_only else (
                model_name + (f" (served by Groq as: {', '.join(sorted(served_models))})"
                              if served_models and served_models != {model_name} else ""))}
    summary = build_summary(rows, meta)
    md_path = os.path.join(args.out_dir, f"summary_{run_name}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(summary + "\n")

    langs = {"en": "English", "hu": "Hungarian"}
    metrics_doc = {
        "run": run_name, "retrieval": args.retrieval, "retrieval_desc": retrieval_desc, "prompt": args.prompt,
        "model": meta["model"], "retrieval_only": args.retrieval_only, "aborted": aborted,
        "questions": len(rows), "errors": sum(1 for r in rows if r["error"]),
        "csv": csv_path, "summary": md_path,
        "groups": {"Overall": metrics(rows),
                   **{langs[l]: metrics([r for r in rows if r["language"] == l])
                      for l in ("en", "hu") if any(r["language"] == l for r in rows)}},
    }
    json_path = os.path.join(args.out_dir, f"metrics_{run_name}.json")
    for path in filter(None, (json_path, args.metrics_out)):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(metrics_doc, f, indent=2)

    print("\n" + summary)
    print(f"\nResults: {csv_path}\nSummary: {md_path}\nMetrics: {json_path}")
    if aborted:
        sys.exit(2)


if __name__ == "__main__":
    main()
