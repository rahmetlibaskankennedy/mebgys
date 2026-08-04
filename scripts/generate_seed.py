#!/usr/bin/env python3
"""
Statik JSON dosyalarından (categorytopics.json, sorular/*.json, cards/*.json,
exam-blueprint/*.json) Supabase için tek bir seed.sql üretir.

Kullanım:
    python3 scripts/generate_seed.py
Çıktı:
    supabase/seed.sql
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        return json.load(f)


def sql_str(v):
    """Postgres için güvenli metin literali (None -> NULL)."""
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def sql_json(v):
    return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"


def sql_int(v):
    return "NULL" if v is None else str(int(v))


def sql_array(items):
    if not items:
        return "'{}'"
    inner = ",".join('"' + str(i).replace('"', '\\"') + '"' for i in items)
    return "'{" + inner + "}'"


def sql_bool(v):
    return "true" if v else "false"


out = []
out.append("-- Bu dosya scripts/generate_seed.py tarafından otomatik üretildi.")
out.append("-- Elle düzenlemeyin; JSON kaynakları değiştiyse scripti tekrar çalıştırın.")
out.append("begin;")
out.append("")

# ============================================================================
# 1) categories + topics (categorytopics.json)
# ============================================================================
catalogue = load("categorytopics.json")

categories_rows = []
topics_rows = []  # (id, category_id, parent_id, type, title, doc_number, article_range, article_count, question_count, kadrolar, sort_order)
questionfile_to_topicid = {}  # sorular/xxx.json -> topics.id  (ilk eşleşme kazanır)

cat_sort = 0
for cat_id, cat in catalogue.items():
    cat_sort += 1
    categories_rows.append(
        (cat_id, cat.get("title"), cat.get("subtitle"), cat.get("icon"), cat.get("iconClass"), cat_sort)
    )

    def walk(node, category_id, parent_id, sort_counter):
        sort_counter[0] += 1
        sort_order = sort_counter[0]
        qfile = node.get("questionFile")
        topics_rows.append((
            node["id"], category_id, parent_id, node.get("type", "topic"), node["title"],
            node.get("documentNumber"), node.get("articleRange"), node.get("articleCount"),
            node.get("questionCount"), node.get("kadrolar", []), sort_order, qfile
        ))
        if qfile and qfile not in questionfile_to_topicid:
            questionfile_to_topicid[qfile] = node["id"]
        for child in node.get("children", []):
            walk(child, category_id, node["id"], sort_counter)

    topic_sort = [0]
    for topic in cat.get("topics", []):
        walk(topic, cat_id, None, topic_sort)

out.append("-- ---- categories ----")
out.append("insert into public.categories (id, title, subtitle, icon, icon_class, sort_order) values")
out.append(",\n".join(
    f"  ({sql_str(r[0])}, {sql_str(r[1])}, {sql_str(r[2])}, {sql_str(r[3])}, {sql_str(r[4])}, {r[5]})"
    for r in categories_rows
) + "\non conflict (id) do update set title=excluded.title, subtitle=excluded.subtitle, "
    "icon=excluded.icon, icon_class=excluded.icon_class, sort_order=excluded.sort_order;")
out.append("")

out.append("-- ---- topics (kategori ağacı) ----")
out.append("insert into public.topics (id, category_id, parent_id, type, title, document_number, "
            "article_range, article_count, question_count, kadrolar, sort_order, source_file) values")
out.append(",\n".join(
    f"  ({sql_str(r[0])}, {sql_str(r[1])}, {sql_str(r[2])}, {sql_str(r[3])}, {sql_str(r[4])}, "
    f"{sql_str(r[5])}, {sql_str(r[6])}, {sql_int(r[7])}, {sql_int(r[8])}, {sql_array(r[9])}, {r[10]}, {sql_str(r[11])})"
    for r in topics_rows
) + "\non conflict (id) do update set category_id=excluded.category_id, parent_id=excluded.parent_id, "
    "type=excluded.type, title=excluded.title, document_number=excluded.document_number, "
    "article_range=excluded.article_range, article_count=excluded.article_count, "
    "question_count=excluded.question_count, kadrolar=excluded.kadrolar, sort_order=excluded.sort_order, "
    "source_file=excluded.source_file;")
out.append("")

# ============================================================================
# 2) exam-blueprint/topics-taxonomy.json -> exam_topics (+ ek topics/card_decks)
# ============================================================================
taxonomy = load("exam-blueprint/topics-taxonomy.json")["topics"]

extra_topics_rows = []  # taxonomy'de olup categorytopics ağacında olmayan sorular/*.json kayıtları
card_decks_rows = []
card_questions_rows = []
exam_topics_rows = []

deck_sort = 0
for tkey, t in taxonomy.items():
    qfile = t["questionFile"]
    if qfile.startswith("cards/"):
        deck_id = os.path.splitext(os.path.basename(qfile))[0]
        if deck_id not in [d[0] for d in card_decks_rows]:
            deck_sort += 1
            card_decks_rows.append((deck_id, t.get("title"), deck_sort, qfile))
            deck_data = load(qfile)
            for i, q in enumerate(deck_data.get("questions", [])):
                card_questions_rows.append((
                    q["id"], deck_id, q["prompt"], q["options"], q["answerIndex"], i + 1
                ))
        exam_topics_rows.append((
            tkey, t["title"], t.get("category"), t.get("status", "demo"), "cards", None, deck_id
        ))
    else:
        linked_id = questionfile_to_topicid.get(qfile)
        if linked_id is None:
            # Bu sorular/*.json dosyası categorytopics.json ağacında yok;
            # taxonomy anahtarını topics tablosuna 'exam_topic' türünde ekle.
            linked_id = tkey
            if linked_id not in questionfile_to_topicid.values():
                extra_topics_rows.append((
                    tkey, t.get("category"), None, "exam_topic", t["title"],
                    None, None, None, None, [], 0, qfile
                ))
            questionfile_to_topicid[qfile] = linked_id
        exam_topics_rows.append((
            tkey, t["title"], t.get("category"), t.get("status", "demo"), "sorular", linked_id, None
        ))

if extra_topics_rows:
    out.append("-- ---- topics (sadece exam-blueprint taxonomy'de geçen ek konular) ----")
    out.append("insert into public.topics (id, category_id, parent_id, type, title, document_number, "
                "article_range, article_count, question_count, kadrolar, sort_order, source_file) values")
    out.append(",\n".join(
        f"  ({sql_str(r[0])}, {sql_str(r[1])}, {sql_str(r[2])}, {sql_str(r[3])}, {sql_str(r[4])}, "
        f"{sql_str(r[5])}, {sql_str(r[6])}, {sql_int(r[7])}, {sql_int(r[8])}, {sql_array(r[9])}, {r[10]}, {sql_str(r[11])})"
        for r in extra_topics_rows
    ) + "\non conflict (id) do nothing;")
    out.append("")

out.append("-- ---- card_decks (quiz: taxonomy demo konuları) ----")
out.append("insert into public.card_decks (id, title, deck_type, category_id, sort_order, source_file) values")
out.append(",\n".join(
    f"  ({sql_str(r[0])}, {sql_str(r[1])}, 'quiz', NULL, {r[2]}, {sql_str(r[3])})" for r in card_decks_rows
) + "\non conflict (id) do update set title=excluded.title, deck_type=excluded.deck_type, "
    "sort_order=excluded.sort_order, source_file=excluded.source_file;")
out.append("")

out.append("-- ---- card_questions ----")
out.append("insert into public.card_questions (id, deck_id, prompt, options, answer_index, sort_order) values")
out.append(",\n".join(
    f"  ({sql_str(r[0])}, {sql_str(r[1])}, {sql_str(r[2])}, {sql_json(r[3])}, {r[4]}, {r[5]})"
    for r in card_questions_rows
) + "\non conflict (id) do update set deck_id=excluded.deck_id, prompt=excluded.prompt, "
    "options=excluded.options, answer_index=excluded.answer_index, sort_order=excluded.sort_order;")
out.append("")

# ---- CARD_CATALOGUE (app.js) -> flashcard deste'leri (soru/cevap çevirme kartları) ----
# Bu katalog JSON dosyalarında değil, app.js içinde hardcoded; burada elle yansıtılıyor.
FLASHCARD_CATALOGUE = [
    ("anayasa", "T.C. Anayasası", "general-legislation", "cards/anayasa.json"),
    ("657-sayili-kanun", "657 Sayılı Devlet Memurları Kanunu", "general-legislation", "cards/657.json"),
    ("4483-sayili-kanun", "4483 Sayılı Memurlar ve Diğer Kamu Görevlilerinin Yargılanması Hakkında Kanun",
     "general-legislation", "cards/4483.json"),
    ("5442-sayili-kanun", "5442 Sayılı İl İdaresi Kanunu", "general-legislation", "cards/5442.json"),
    ("4982-sayili-kanun", "4982 Sayılı Bilgi Edinme Hakkı Kanunu", "general-legislation", "cards/4982.json"),
    ("3071-sayili-kanun", "3071 Sayılı Dilekçe Hakkının Kullanılmasına Dair Kanun",
     "general-legislation", "cards/3071.json"),
]

flashcard_deck_rows = []
flashcard_rows = []
for i, (deck_id, title, category_id, path) in enumerate(FLASHCARD_CATALOGUE):
    flashcard_deck_rows.append((deck_id, title, category_id, i + 1, path))
    data = load(path)
    for j, c in enumerate(data.get("cards", [])):
        flashcard_rows.append((deck_id, c["question"], c["answer"], j + 1))

out.append("-- ---- card_decks (flashcard: kanun kartları, app.js CARD_CATALOGUE) ----")
out.append("insert into public.card_decks (id, title, deck_type, category_id, sort_order, source_file) values")
out.append(",\n".join(
    f"  ({sql_str(r[0])}, {sql_str(r[1])}, 'flashcard', {sql_str(r[2])}, {r[3]}, {sql_str(r[4])})"
    for r in flashcard_deck_rows
) + "\non conflict (id) do update set title=excluded.title, deck_type=excluded.deck_type, "
    "category_id=excluded.category_id, sort_order=excluded.sort_order, source_file=excluded.source_file;")
out.append("")

out.append("-- ---- flashcards ----")
out.append("insert into public.flashcards (deck_id, question, answer, sort_order) values")
out.append(",\n".join(
    f"  ({sql_str(r[0])}, {sql_str(r[1])}, {sql_str(r[2])}, {r[3]})" for r in flashcard_rows
) + ";")
out.append("")

out.append("-- ---- exam_topics ----")
out.append("insert into public.exam_topics (topic_id, title, category_id, status, question_source, "
            "linked_topic_id, card_deck_id, sort_order) values")
out.append(",\n".join(
    f"  ({sql_str(r[0])}, {sql_str(r[1])}, {sql_str(r[2])}, {sql_str(r[3])}, {sql_str(r[4])}, "
    f"{sql_str(r[5])}, {sql_str(r[6])}, {i+1})"
    for i, r in enumerate(exam_topics_rows)
) + "\non conflict (topic_id) do update set title=excluded.title, category_id=excluded.category_id, "
    "status=excluded.status, question_source=excluded.question_source, "
    "linked_topic_id=excluded.linked_topic_id, card_deck_id=excluded.card_deck_id, "
    "sort_order=excluded.sort_order;")
out.append("")

# ============================================================================
# 3) sorular/*.json -> questions (questionfile_to_topicid eşlemesini kullanarak)
# ============================================================================
questions_rows = []
missing_files = []
for qfile, topic_id in questionfile_to_topicid.items():
    full = os.path.join(ROOT, qfile)
    if not os.path.exists(full):
        missing_files.append(qfile)
        continue
    data = load(qfile)
    for i, q in enumerate(data.get("questions", [])):
        questions_rows.append((q["id"], topic_id, q["prompt"], q["options"], q["answerIndex"], i + 1))

out.append("-- ---- questions (ana soru bankası) ----")
out.append("insert into public.questions (id, topic_id, prompt, options, answer_index, sort_order) values")
out.append(",\n".join(
    f"  ({sql_str(r[0])}, {sql_str(r[1])}, {sql_str(r[2])}, {sql_json(r[3])}, {r[4]}, {r[5]})"
    for r in questions_rows
) + "\non conflict (id) do update set topic_id=excluded.topic_id, prompt=excluded.prompt, "
    "options=excluded.options, answer_index=excluded.answer_index, sort_order=excluded.sort_order;")
out.append("")

# ============================================================================
# 4) exam-blueprint/exam-blueprint.json -> exam_kadrolar + exam_blueprint_items
# ============================================================================
blueprint = load("exam-blueprint/exam-blueprint.json")

kadro_rows = []
item_rows = []
for kadro, b in blueprint.items():
    kadro_rows.append((kadro, b["durationMinutes"]))
    for i, item in enumerate(b.get("topics", [])):
        item_rows.append((kadro, item["topicId"], item["count"], i + 1))

out.append("-- ---- exam_kadrolar ----")
out.append("insert into public.exam_kadrolar (kadro, duration_minutes) values")
out.append(",\n".join(f"  ({sql_str(r[0])}, {r[1]})" for r in kadro_rows) +
           "\non conflict (kadro) do update set duration_minutes=excluded.duration_minutes;")
out.append("")

out.append("-- ---- exam_blueprint_items ----")
out.append("insert into public.exam_blueprint_items (kadro, topic_id, question_count, sort_order) values")
out.append(",\n".join(
    f"  ({sql_str(r[0])}, {sql_str(r[1])}, {r[2]}, {r[3]})" for r in item_rows
) + "\non conflict (kadro, topic_id) do update set question_count=excluded.question_count, "
    "sort_order=excluded.sort_order;")
out.append("")

out.append("commit;")

seed_path = os.path.join(ROOT, "supabase", "seed.sql")
with open(seed_path, "w", encoding="utf-8") as f:
    f.write("\n".join(out) + "\n")

print(f"Yazıldı: {seed_path}")
print(f"  categories: {len(categories_rows)}")
print(f"  topics (ağaç): {len(topics_rows)}  + ek: {len(extra_topics_rows)}")
print(f"  questions: {len(questions_rows)}")
print(f"  card_decks (quiz): {len(card_decks_rows)}  card_questions: {len(card_questions_rows)}")
print(f"  card_decks (flashcard): {len(flashcard_deck_rows)}  flashcards: {len(flashcard_rows)}")
print(f"  exam_topics: {len(exam_topics_rows)}")
print(f"  exam_kadrolar: {len(kadro_rows)}  exam_blueprint_items: {len(item_rows)}")
if missing_files:
    print(f"\n  UYARI: {len(missing_files)} soru dosyası repoda yok, atlandı (topic satırı yine de eklendi, soru boş kalacak):")
    for m in missing_files:
        print(f"    - {m}")
