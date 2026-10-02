"""Cookbook PDF via Jinja2 + WeasyPrint."""

import os
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from .models import Recipe

HERE = Path(__file__).parent
BACKEND = HERE.parent
FONTS_DIR = BACKEND / "fonts"

_env = Environment(
    loader=FileSystemLoader(HERE / "templates"),
    autoescape=select_autoescape(["html"]),
)


def _windows_dll_dirs() -> list[str]:
    """Where WeasyPrint's native libraries (Pango, GLib, HarfBuzz) may live on Windows.

    Docker and Linux get them from the system and need none of this. On Windows,
    scripts/setup-pdf-windows.ps1 installs them privately into backend/.gtk.
    """
    candidates = [
        BACKEND / ".gtk" / "Library" / "bin",
        Path("C:/msys64/mingw64/bin"),
        Path("C:/msys64/ucrt64/bin"),
        Path("C:/Program Files/GTK3-Runtime Win64/bin"),
    ]
    if os.environ.get("CONDA_PREFIX"):
        candidates.append(Path(os.environ["CONDA_PREFIX"]) / "Library" / "bin")

    def has_gobject(folder: Path) -> bool:
        names = ("gobject-2.0-0.dll", "libgobject-2.0-0.dll")
        return any((folder / name).exists() for name in names)

    return [str(p) for p in candidates if has_gobject(p)]


def _prepare_native_libraries() -> None:
    if os.name != "nt" or os.environ.get("WEASYPRINT_DLL_DIRECTORIES"):
        return
    dirs = _windows_dll_dirs()
    if dirs:
        os.environ["WEASYPRINT_DLL_DIRECTORIES"] = os.pathsep.join(dirs)
        # The libraries load their own dependencies (glib, ffi, iconv...) via PATH.
        os.environ["PATH"] = os.pathsep.join([*dirs, os.environ.get("PATH", "")])


def _join_names(names: list[str]) -> str:
    if len(names) <= 2:
        return " and ".join(names)
    return f"{', '.join(names[:-1])} and {names[-1]}"


def _photo_uri(r: Recipe) -> str | None:
    if r.photo_path and Path(r.photo_path).exists():
        return Path(r.photo_path).resolve().as_uri()
    return None


def render_html(
    recipes: list[Recipe],
    title: str = "Salt & Story",
    dedication: str = "",
    single: bool = False,
    told_by: str | None = None,
) -> str:
    """told_by: None = the cooks' names, automatically; "" = no line; text = exactly that."""
    speakers = sorted({r.speaker_name for r in recipes if r.speaker_name})
    if told_by is None:
        subtitle = f"Recipes told by {_join_names(speakers)}" if speakers else ""
    else:
        subtitle = f"Recipes told by {told_by.strip()}" if told_by.strip() else ""
    return _env.get_template("book.html").render(
        recipes=recipes,
        photos={r.id: _photo_uri(r) for r in recipes},
        title=title,
        tagline="Because Every Recipe Has A Story",
        subtitle=subtitle,
        dedication=dedication,
        single=single,
        fonts_uri=FONTS_DIR.resolve().as_uri(),
    )


def render_pdf(recipes: list[Recipe], **kwargs) -> bytes:
    # Imported lazily: WeasyPrint needs native libraries, which tests may not have.
    _prepare_native_libraries()
    from weasyprint import HTML

    return HTML(string=render_html(recipes, **kwargs), base_url=str(HERE)).write_pdf()
