from datetime import datetime

from pydantic import BaseModel, Field, field_validator


def _clean_list(items: list[str]) -> list[str]:
    return [s.strip() for s in items if s and s.strip()]


class Ingredient(BaseModel):
    name: str
    quantity: str | None = None
    note: str | None = None

    @field_validator("name", "quantity", "note", mode="before")
    @classmethod
    def _numbers_to_text(cls, v: object) -> object:
        # Models sometimes return 1 instead of "1"; accept it rather than retrying.
        return str(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else v

    @field_validator("quantity", "note")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        return v.strip() or None if isinstance(v, str) else v


class RecipeDraft(BaseModel):
    """What the LLM returns and what users may edit."""

    title: str = Field(min_length=1, max_length=200)
    story: str = ""
    servings: str | None = None
    prep_time: str | None = None
    cook_time: str | None = None
    ingredients: list[Ingredient] = Field(default_factory=list)
    steps: list[str] = Field(default_factory=list)
    tips: list[str] = Field(default_factory=list)
    quote: str = ""

    @field_validator("servings", "prep_time", "cook_time", mode="before")
    @classmethod
    def _meta_to_text(cls, v: object) -> object:
        return str(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else v

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("title cannot be blank")
        return v

    @field_validator("steps", "tips")
    @classmethod
    def _lists(cls, v: list[str]) -> list[str]:
        return _clean_list(v)

    @field_validator("ingredients")
    @classmethod
    def _ingredients(cls, v: list[Ingredient]) -> list[Ingredient]:
        return [i for i in v if i.name and i.name.strip()]


class RecipeUpdate(RecipeDraft):
    speaker_name: str | None = None


class RecipeOut(RecipeUpdate):
    id: int
    created_at: datetime
    updated_at: datetime | None = None
    status: str
    error: str | None = None
    transcript: str = ""
    has_audio: bool = False
    narration_url: str | None = None
    photo_url: str | None = None
    favorite: bool = False


class TranscriptIn(BaseModel):
    transcript: str = Field(min_length=20)
    speaker_name: str | None = None


class ManualRecipeIn(RecipeUpdate):
    transcript: str = ""


class MemoOut(BaseModel):
    id: int
    status: str


class LLMStatus(BaseModel):
    model: str
    reachable: bool


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    picture: str
    used_today: int
    daily_limit: int


class AuthConfigOut(BaseModel):
    mode: str  # "google", "dev" or "closed"
    google_client_id: str
    daily_limit: int


class GoogleSignIn(BaseModel):
    credential: str = Field(min_length=20, max_length=5000)


class SessionOut(BaseModel):
    token: str
    user: UserOut


class FavoriteIn(BaseModel):
    favorite: bool


class StatusOut(BaseModel):
    transcription: bool
    narration: bool
    llm: LLMStatus
    max_upload_mb: int
    max_photo_mb: int
