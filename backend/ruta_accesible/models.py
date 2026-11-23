from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
Address = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=1500)]
Email = Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=160,
                                         pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]
CatalogId = Annotated[str, StringConstraints(min_length=1, max_length=40, pattern=r"^[a-z-]+$")]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Credentials(Input):
    email: Email
    password: Password

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.casefold()


class Registration(Credentials):
    name: Name


class Profile(Input):
    name: Name


class ReviewInput(Input):
    rating: Annotated[int, Field(ge=1, le=5, strict=True)]
    comment: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=1000)]


class ReportInput(Input):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=120)]
    description: Description
    type_id: CatalogId
    place_id: Annotated[int, Field(gt=0)] | None = None
    location: Address | None = None
    lat: Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)] | None = None
    lng: Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)] | None = None

    @model_validator(mode="after")
    def require_location(self):
        if self.place_id is None and self.location is None:
            raise ValueError("Selecciona un lugar o escribe una ubicación.")
        if (self.lat is None) != (self.lng is None):
            raise ValueError("Marca las dos coordenadas de la barrera.")
        return self


class ReportStatusInput(Input):
    status_id: Literal["reviewing", "resolved"]


class SavedRouteInput(Input):
    name: Title
    origin: Address
    destination: Address
    mode_id: CatalogId

    @model_validator(mode="after")
    def different_points(self):
        if self.origin.casefold() == self.destination.casefold():
            raise ValueError("El origen y el destino deben ser diferentes.")
        return self


class PlaceInput(Input):
    name: Title
    category_id: CatalogId
    district_id: CatalogId
    address: Address
    description: Description
    lat: Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)]
    lng: Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)]
    image: Literal["plaza", "park", "hill", "shop", "health", "culture", "cafe"] = "plaza"
    facilities: Annotated[set[CatalogId], Field(max_length=4)] = Field(default_factory=set)
    is_demo: bool = True
    verified: bool = False

    @model_validator(mode="after")
    def valid_verification(self):
        if self.is_demo and self.verified:
            raise ValueError("Para verificar la ficha, primero retira la marca de demostración.")
        return self
