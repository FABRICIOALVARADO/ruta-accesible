from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import Field, StringConstraints, field_validator, model_validator

from .models import Input

Lat = Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)]
Lng = Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=120)]
Notes = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
PositiveId = Annotated[int, Field(gt=0)]
Crossing = Literal["ramp", "level", "step", "unknown"]


class MapPoint(Input):
    lat: Lat
    lng: Lng


class PreferenceInput(Input):
    avoid_stairs: bool = True
    avoid_rough: bool = False
    verified_only: bool = False
    max_slope: Annotated[float, Field(ge=1, le=100)] | None = None
    min_width: Annotated[int, Field(ge=20, le=1000, strict=True)] | None = None


class CompareInput(Input):
    origin: MapPoint
    destination: MapPoint
    preferences: PreferenceInput = Field(default_factory=PreferenceInput)
    demonstration: bool = False


class JunctionInput(MapPoint):
    name: Text


class SegmentInput(Input):
    name: Text
    start_id: PositiveId
    end_id: PositiveId

    @model_validator(mode="after")
    def distinct_junctions(self):
        if self.start_id == self.end_id:
            raise ValueError("Elige dos puntos distintos.")
        return self


class CheckInput(Input):
    stairs: bool | None = None
    crossing: Crossing = "unknown"
    surface: Literal["even", "rough", "unknown"] = "unknown"
    slope_percent: Annotated[float, Field(ge=0, le=100)] | None = None
    width_cm: Annotated[int, Field(ge=20, le=1000, strict=True)] | None = None
    notes: Notes = ""
    verified: bool = False

    @model_validator(mode="after")
    def needs_measurements(self):
        if self.verified and (
            self.stairs is None or self.crossing == "unknown" or self.surface == "unknown"
            or self.slope_percent is None or self.width_cm is None
        ):
            raise ValueError("Completa todas las mediciones antes de verificar el tramo.")
        return self


class MapEffectInput(Input):
    effect: Literal["hidden", "warning", "closed"]


class EntranceInput(Input):
    steps: Annotated[int, Field(ge=0, le=99, strict=True)] | None = None
    door_cm: Annotated[int, Field(ge=20, le=1000, strict=True)] | None = None
    toilet: Literal["yes", "no", "unknown"] = "unknown"
    entrance: Crossing = "unknown"
    photo_url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None
    notes: Notes = ""
    verified: bool = False

    @field_validator("photo_url")
    @classmethod
    def https_image(cls, value):
        if not value:
            return None
        parsed = urlsplit(value)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username is not None or any(c.isspace() for c in value):
            raise ValueError("Usa una dirección HTTPS pública para la imagen.")
        return value

    @model_validator(mode="after")
    def complete_survey(self):
        if self.verified and (self.steps is None or self.door_cm is None or self.toilet == "unknown" or self.entrance == "unknown"):
            raise ValueError("Completa las mediciones de la entrada antes de marcarla como verificada.")
        return self


class WalkInput(SegmentInput):
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=8, max_length=500)]
