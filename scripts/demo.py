"""Run a sample transcript through the whole pipeline and write demo-book.pdf.

Needs a reachable LLM (see .env.example). No ElevenLabs key required.
Usage:  python scripts/demo.py [samples/nani-dal.txt]
"""

import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("DATA_DIR", tempfile.mkdtemp(prefix="salt-demo-"))

from app import llm, pdf  # noqa: E402
from app.models import Recipe  # noqa: E402
from app.pipeline import apply_draft  # noqa: E402


def main() -> None:
    paths = [Path(a) for a in sys.argv[1:]] or sorted((ROOT / "samples").glob("*.txt"))
    recipes = []
    for n, p in enumerate(paths, 1):
        transcript = p.read_text(encoding="utf8").split("\n\n", 1)[-1].strip()
        draft = llm.structure_recipe(transcript)
        r = Recipe(id=n, transcript=transcript, speaker_name="Demo cook", status="ready")
        apply_draft(r, draft)
        recipes.append(r)
        print(f"structured: {r.title}")
    out = ROOT / "demo-book.pdf"
    out.write_bytes(pdf.render_pdf(recipes, title="Salt & Story", dedication="the whole family"))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
