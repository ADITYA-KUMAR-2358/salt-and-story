"""Recipe photos: validate, fix orientation, strip metadata, resize, store as JPEG."""

import io

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_SIDE = 1600
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "MPO"}


class PhotoError(ValueError):
    pass


def process_photo(data: bytes) -> bytes:
    if not data:
        raise PhotoError("The photo file is empty.")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt = probe.format
            probe.verify()  # catches truncated or corrupt files
        if fmt not in ALLOWED_FORMATS:
            raise PhotoError("Use a JPEG, PNG or WebP photo.")
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)  # phone photos come in sideways otherwise
        img = img.convert("RGB")  # also drops EXIF, including GPS location
        img.thumbnail((MAX_SIDE, MAX_SIDE))
    except PhotoError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as e:
        raise PhotoError("That file is not a photo we can read. Use a JPEG, PNG or WebP.") from e
    out = io.BytesIO()
    img.save(out, "JPEG", quality=85, optimize=True, progressive=True)
    return out.getvalue()
