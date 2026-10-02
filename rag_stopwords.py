"""
Stopword lists for the "stopwords" and "translate" retrieval modes in rag.py.

Source
------
NLTK Stopwords Corpus (nltk_data/corpora/stopwords, files "english" and
"hungarian"), downloaded from
https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/stopwords.zip
on 2026-10-02. NLTK states the lists were obtained from the Snowball project's
stopword files (http://snowball.tartarus.org/, also shipped with PostgreSQL:
src/backend/snowball/stopwords/).

  Bird, S., Klein, E. & Loper, E. (2009). Natural Language Processing with
  Python. O'Reilly. (NLTK)
  Porter, M. F. (2001). Snowball: A language for stemming algorithms.
  http://snowball.tartarus.org/texts/introduction.html

Changes from the source (nothing else was added or removed)
-----------------------------------------------------------
* Hungarian: the original file uses the Latin-1 look-alikes "õ" and "û" instead
  of the Hungarian letters "ő" and "ű" (a known encoding defect of that list);
  7 entries were corrected so they match real Hungarian text.
* Both lists are passed through rag._tokenize() before use, so entries such as
  "don't" become the tokens "don" and "t", exactly as the indexer splits text.

English: 198 words. Hungarian: 199 words.
"""

ENGLISH = """
    a about above after again against ain all am an and any are aren aren't as at be
    because been before being below between both but by can couldn couldn't d did didn
    didn't do does doesn doesn't doing don don't down during each few for from further
    had hadn hadn't has hasn hasn't have haven haven't having he he'd he'll her here
    hers herself he's him himself his how i i'd if i'll i'm in into is isn isn't it it'd
    it'll it's its itself i've just ll m ma me mightn mightn't more most mustn mustn't
    my myself needn needn't no nor not now o of off on once only or other our ours
    ourselves out over own re s same shan shan't she she'd she'll she's should shouldn
    shouldn't should've so some such t than that that'll the their theirs them
    themselves then there these they they'd they'll they're they've this those through
    to too under until up ve very was wasn wasn't we we'd we'll we're were weren weren't
    we've what when where which while who whom why will with won won't wouldn wouldn't y
    you you'd you'll your you're yours yourself yourselves you've
""".split()

HUNGARIAN = """
    a ahogy ahol aki akik akkor alatt által általában amely amelyek amelyekben amelyeket
    amelyet amelynek ami amit amolyan amíg amikor át abban ahhoz annak arra arról az
    azok azon azt azzal azért aztán azután azonban bár be belül benne cikk cikkek
    cikkeket csak de e eddig egész egy egyes egyetlen egyéb egyik egyre ekkor el elég
    ellen elő először előtt első én éppen ebben ehhez emilyen ennek erre ez ezt ezek
    ezen ezzel ezért és fel felé hanem hiszen hogy hogyan igen így illetve ill. ill
    ilyen ilyenkor ison ismét itt jó jól jobban kell kellett keresztül keressünk ki
    kívül között közül legalább lehet lehetett legyen lenne lenni lesz lett maga magát
    majd majd már más másik meg még mellett mert mely melyek mi mit míg miért milyen
    mikor minden mindent mindenki mindig mint mintha mivel most nagy nagyobb nagyon ne
    néha nekem neki nem néhány nélkül nincs olyan ott össze ő ők őket pedig persze rá s
    saját sem semmi sok sokat sokkal számára szemben szerint szinte talán tehát teljes
    tovább továbbá több úgy ugyanis új újabb újra után utána utolsó vagy vagyis valaki
    valami valamint való vagyok van vannak volt voltam voltak voltunk vissza vele
    viszont volna
""".split()
