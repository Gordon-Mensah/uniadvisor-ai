# Why the "deadlines" category scores 0%

The deadlines category has 4 questions: 3 answerable (Q08, Q09, Q10) and 1 unanswerable
(Q53, an individual exam date). Answer accuracy was 0% for the 3 answerable questions in
every configuration. This analysis was produced without any API calls by
`evaluation/deadlines_analysis.py`; the complete per-mode tables (top-3 chunks, scores,
per-term contributions, source pages) are in `deadlines_analysis_data.md`. Retrieval was
not changed.

## 1. The questions and their gold passages

| ID | Lang | Question | Gold passage (source page) |
|---|---|---|---|
| Q08 | en | When does the application period start and end? | "Our application period starts on 11 February and ends on 31 May each year." (`/en/application/application-period`) |
| Q09 | hu | Mikor kezdődik és mikor ér véget a jelentkezési időszak? | same as Q08 |
| Q10 | en | Can I start a bachelor program in February? | "Our English taught programs are launched in September each year. We do not have bachelor or master programs starting in February." (`/en/application/admission-faq`) |

## 2. The passages are in the knowledge base, but never reach the top 3

Both passages exist verbatim in `university_knowledge.txt`: Q08/Q09's is in chunk #31, and
Q10's is in chunk #15. The failure is in ranking, not in data collection.

| Question | Mode | Gold chunk rank | Gold score | 3rd-place score |
|---|---|---|---|---|
| Q08 | baseline | 88 | 6.34 | 15.57 |
| Q08 | stopwords | 53 | 6.28 | 11.20 |
| Q08 | translate | 53 | 6.28 | 11.20 |
| Q09 | baseline | 1843 | 0.07 | 4.84 |
| Q09 | stopwords | not matched | 0.00 | – |
| Q09 | translate | 53 | 6.28 | 11.20 |
| Q10 | baseline | 8 | 11.60 | 12.13 |
| Q10 | stopwords | 4 | 10.94 | 10.96 |
| Q10 | translate | 4 | 10.94 | 10.96 |

(Q09 translate uses the reference translation; with it, Q09 becomes the same query as Q08.)

## 3. Why BM25 ranks them low

**a) No stemming: "starts/ends" ≠ "start/end".** The tokenizer keeps words as written.
The Q08 query contains `start` and `end`, but the passage says `starts` and `ends`, so the
gold chunk matches only `application` and `period`. Those two are common words: `application`
occurs in 714 of 2,096 chunks (IDF 1.08), `period` in 237 (IDF 2.18). The rarest query
words (`start`, IDF 3.07; `end`, IDF 2.06) match only other chunks.

**b) Long PDFs win on generic words.** Every top-3 chunk for Q08, Q09 and Q10 comes from a
PDF, not from the short web page that answers the question:

| Question | Top-3 chunks come from |
|---|---|
| Q08 (all modes) | insurance *Product/Customer Information 2024* PDFs, *Subject registration in Neptun* guide, fee regulations |
| Q09 (baseline/stopwords) | *SCYP General terms and conditions* PDF (contains the Hungarian word `időszak`) |
| Q10 (all modes) | the BSc regulations PDF, three yearly versions (2023, 2024, 2025) |

These documents use "period", "start", "end", "bachelor" and "program" many times in a
procedural sense, which BM25 rewards through term frequency.

**c) The answering web page is diluted inside its chunk.** `rag.py` chunks the whole knowledge
base as one document into 400-word windows. The application-period page is only 81 words long,
so chunk #31 mixes it with four unrelated pages (a Christmas-party news item, diaspora scholarship
regulations, scholarship payment, the SCYP scholarship). Only about 20% of that chunk is about
the question.

**d) Near-duplicate PDFs crowd out the answer (Q10).** For Q10 with stopwords/translate, the
gold chunk is 4th by **0.02** points (10.94 vs 10.96). The three chunks above it are the
same BSc regulations in their 2023, 2024 and 2025 versions; their vocabulary overlaps by
72–83% (Jaccard similarity of their token sets). With only the current version indexed, the
gold chunk would most likely have ranked 2nd. (Removing documents also shifts the IDF values
slightly, so this was not re-measured.)

**e) Hungarian without translation (Q09 baseline/stopwords).** The Hungarian question shares no
content words with the English knowledge base. The only matches are `a`/`és` and `időszak`,
which occurs in the Hungarian SCYP terms PDF. The translate mode fixes the language problem,
but then hits the same ranking problems as Q08.

**f) Stopword removal helps but is not enough.** For Q08 it removes the noisy matches on
`when`, `does`, `the` and `and` and lifts the gold chunk from rank 88 to 53, which is still far
from the top 3, because cause (a) remains.

## 4. Crawl coverage (`found_urls.txt`)

- **The deadline pages were crawled.** `/en/application/application-period`,
  `/en/application/admission-faq`, `/en/prepare-for-your-stay/academic-calendar` and
  `/en/for-students/academic-calendar-2` (the calendar is stored twice) are all in
  `found_urls.txt` and in the knowledge base. The 0% is therefore a retrieval problem, not a
  missing-page problem.
- **The 200-page limit was reached** (`found_urls.txt` has exactly 200 URLs, equal to
  `MAX_PAGES`), so the crawl stopped with pages still queued. The crawler saved only visited
  URLs, not the remaining queue, so the number of discovered-but-unvisited pages cannot be
  reconstructed.
- **Pages known to exist but not crawled.** `scraper.py`'s hand-written list contains 6 `/en`
  pages absent from `found_urls.txt`: `/en/international`, `/en/research`, `/en/for-students`,
  `/en/for-students/student-services`, `/en/for-students/sport`, `/en/for-students/erasmus`.
  None is a deadline page by name, but `/en/for-students/erasmus` may contain exchange
  application deadlines.
- **One application-section page failed:** `/en/application/prepare-for-your-stay` was visited
  but not saved (5 of the 200 visited URLs failed).
- **Crawl budget.** 60 of the 200 pages (30%) were news-archive items (35) and tag listing
  pages under `/en/component/tags/` (25), which add little factual content. Excluding them
  would have freed budget for unvisited pages.

## 5. Conclusions for the thesis

1. The deadlines failure is a **ranking** failure (no stemming, long-document bias,
   near-duplicate documents, page dilution in fixed-size chunks), not a coverage failure:
   the answers were in the knowledge base.
2. Translation solves the language mismatch (Q09) but cannot fix ranking problems that also
   affect English questions.
3. Candidate improvements, not implemented: stemming or lemmatisation (e.g. Snowball for
   English/Hungarian); chunking per page instead of across the whole file; removing
   superseded versions of yearly documents; dense/hybrid retrieval to match "start" with
   "starts" and "application fee" with "registration fee"; excluding news/tag pages when
   re-crawling.
4. The category has only 3 answerable questions, so a 0% here is 3 failures. Report it
   as a qualitative finding, not a precise rate.
