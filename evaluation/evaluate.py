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

Outputs (in evaluation/results/ by default):
    results_<timestamp>.csv   one row per question
    summary_<timestamp>.md    the summary tables printed at the end
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

    def __enter__(self):
        def wrapped(query, office=None, k=3):
            self.last = self.original(query, office=office, k=k)
            return self.last
        self.rag._bm25_search = wrapped
        return self

    def __exit__(self, *exc):
        self.rag._bm25_search = self.original


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


def summarize(rows, label):
    ans = [r for r in rows if r["answerable"]]
    una = [r for r in rows if not r["answerable"]]
    times = [r["response_time_s"] for r in rows if r["response_time_s"] != ""]
    mrr = _mean([(1 / r["hit_rank"]) if r["hit_rank"] else 0 for r in ans]) if ans else None
    return {
        "Group": label,
        "N (ans/unans)": f"{len(ans)}/{len(una)}",
        "Hit@3": _pct(_mean([r["retrieval_hit"] for r in ans])),
        "MRR": "–" if mrr is None else f"{mrr:.3f}",
        "Answer accuracy": _pct(_mean([r["answer_correct"] for r in ans])),
        "Key-fact coverage": _pct(_mean([r["key_fact_score"] for r in ans])),
        "False abstention": _pct(_mean([r["false_abstention"] for r in ans])),
        "Abstention accuracy": _pct(_mean([r["abstention_correct"] for r in una])),
        "Mean latency (s)": "–" if not times else f"{statistics.mean(times):.2f}",
        "Median (s)": "–" if not times else f"{statistics.median(times):.2f}",
        "P95 (s)": "–" if not times else f"{_p95(times):.2f}",
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
        f"- Knowledge base: {meta['kb']}",
        f"- Questions: {len(rows)} ({errors} failed with errors)",
        f"- Retrieval: BM25, top-3 chunks (rag.py defaults)",
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
    "id", "language", "category", "answerable", "question", "expected_answer", "answer",
    "detected_office", "response_time_s", "retrieval_hit", "hit_rank", "key_fact_score",
    "answer_correct", "abstained", "false_abstention", "abstention_correct",
    "retrieved_chunks", "source_passage", "error", "manual_correct",
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

    import rag
    if args.retrieval_only:
        rag.get_groq_rotator = lambda: _OfflineRotator()
    kb_desc = load_knowledge_base(rag, args.kb, args.chunks_file)

    if args.limit:
        questions = questions[:args.limit]

    rows = []
    with RetrievalRecorder(rag) as recorder:
        for i, q in enumerate(questions, 1):
            recorder.last = []
            answer, office, seconds, error = ask(rag, q, args.nationality, args.retries, backoff=args.delay or 1.0)
            chunks = recorder.last
            row = {
                "id": q["id"], "language": q["language"], "category": q["category"],
                "answerable": q["answerable"], "question": q["question"],
                "expected_answer": q.get("expected_answer") or "", "answer": answer,
                "detected_office": office,
                "response_time_s": "" if seconds is None else round(seconds, 3),
                "retrieved_chunks": "\n\n---\n\n".join(
                    f"[{c['source']} | {c['office']}] {c['text']}" for c in chunks),
                "source_passage": q.get("source_passage") or "",
                "error": error, "manual_correct": "",
            }
            row.update(score(q, answer if not error else "", chunks, args.retrieval_only))
            rows.append(row)

            status = "ERROR" if error else (
                f"hit={row['retrieval_hit']}" if q["answerable"] else "unanswerable")
            if not args.retrieval_only and not error:
                status += (f" correct={row['answer_correct']}" if q["answerable"]
                           else f" abstained={row['abstained']}")
            print(f"[{i:>2}/{len(questions)}] {q['id']} {status} ({row['response_time_s']}s)")
            if args.delay and i < len(questions):
                time.sleep(args.delay)

    os.makedirs(args.out_dir, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = os.path.join(args.out_dir, f"results_{stamp}.csv")
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:  # utf-8-sig so Excel shows accents
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    meta = {"timestamp": stamp, "kb": kb_desc,
            "mode": "retrieval only (no LLM)" if args.retrieval_only else "full (retrieval + LLM)"}
    summary = build_summary(rows, meta)
    md_path = os.path.join(args.out_dir, f"summary_{stamp}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(summary + "\n")

    print("\n" + summary)
    print(f"\nResults: {csv_path}\nSummary: {md_path}")


if __name__ == "__main__":
    main()
