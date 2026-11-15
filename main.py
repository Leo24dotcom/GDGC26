import base64
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Union, Any, List, Literal, get_args
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from gemini_service import analyze, CalorieRange, FoodCategory, Listing
from db import (
    save_listing,
    save_donor_listing,
    get_available_listings,
    get_claimed_listings,
    get_picked_up_listings,
    get_meals_rescued,
    claim_listing,
    cancel_pickup_listing,
    pickup_listing,
)

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent

# Homepage and public asset routes
@app.get("/")
def serve_homepage():
    return FileResponse(BASE_DIR / "FreshLoop.html")

@app.get("/FreshLoop.html")
def serve_homepage_html():
    return FileResponse(BASE_DIR / "FreshLoop.html")

@app.get("/FreshLoop.css")
def serve_css():
    return FileResponse(BASE_DIR / "FreshLoop.css", media_type="text/css")

@app.get("/FreshLoop2.css")
def serve_css2():
    return FileResponse(BASE_DIR / "FreshLoop.css", media_type="text/css")

@app.get("/FreshLoop.js")
def serve_js():
    return FileResponse(BASE_DIR / "FreshLoop.js", media_type="application/javascript")

@app.get("/FreshLoop2.js")
def serve_js2():
    return FileResponse(BASE_DIR / "FreshLoop.js", media_type="application/javascript")


# Existing FastAPI routes
VegetarianStatus = Literal["unknown", "yes", "no"]
LABEL_TEXT_LIMITS = {"ingredients_text": 4000, "allergen_statement": 2000}


def clean_label_text(value: str | None, limit: int) -> str | None:
    text = value.strip() if value else ""
    return text if 0 < len(text) <= limit else None


class NewListing(BaseModel):
    listing: Listing        # the (possibly edited) Gemini result
    donor_name: str
    lat: float
    lng: float

@app.post("/listings")
def create_listing(body: dict):
    # 1. Compatibility with legacy Gemini NewListing format
    if "listing" in body and "donor_name" in body:
        try:
            new_listing = NewListing(**body)
            listing_id = save_listing(new_listing.listing, new_listing.donor_name, new_listing.lat, new_listing.lng)
            return {"id": listing_id}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    # 2. Donor form fields validation
    title = body.get("title")
    if not title or not isinstance(title, str) or not title.strip():
        raise HTTPException(status_code=400, detail="Title is required and must not be empty.")

    raw_servings = body.get("servings")
    if raw_servings is None:
        raw_servings = body.get("serving_count")
    if raw_servings is None:
        raw_servings = body.get("serv")

    servings = None
    if raw_servings is not None and not isinstance(raw_servings, bool):
        if isinstance(raw_servings, int) and raw_servings > 0:
            servings = raw_servings
        elif isinstance(raw_servings, float) and raw_servings.is_integer() and raw_servings > 0:
            servings = int(raw_servings)
        elif isinstance(raw_servings, str) and raw_servings.strip().isdigit():
            n = int(raw_servings.strip())
            if n > 0:
                servings = n

    if servings is None:
        raise HTTPException(status_code=400, detail="Serving count is required and must be a positive whole number.")

    pickup_address = body.get("pickup_address") or body.get("pickupAddress") or body.get("addr") or body.get("address")
    if not pickup_address or not isinstance(pickup_address, str) or not pickup_address.strip():
        raise HTTPException(status_code=400, detail="Pickup address is required and must not be empty.")

    pickup_deadline = body.get("pickup_deadline") or body.get("pickupDeadline") or body.get("deadline")
    if not pickup_deadline or not isinstance(pickup_deadline, str) or not pickup_deadline.strip():
        raise HTTPException(status_code=400, detail="Pickup deadline is required and must not be empty.")

    food_category = body.get("food_category")
    if food_category is not None and food_category not in get_args(FoodCategory):
        raise HTTPException(status_code=400, detail="Choose a valid food category.")

    vegetarian = body.get("vegetarian", "unknown")
    if vegetarian not in get_args(VegetarianStatus):
        raise HTTPException(status_code=400, detail="Choose Unknown, Yes, or No for Vegetarian.")

    calories = body.get("calories_per_serving")
    if calories is not None:
        try:
            calorie_range = CalorieRange.model_validate(calories)
            if not calorie_range.is_valid():
                raise ValueError("Invalid calorie range")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Enter a valid calorie range with a minimum no greater than the maximum.",
            )
        calories = calorie_range.model_dump()

    donor_data = {
        "calories_per_serving": calories,
        "food_category": food_category,
        "vegetarian": vegetarian,
        "title": title.strip(),
        "servings": servings,
        "pickupAddress": pickup_address.strip(),
        "pickup_address": pickup_address.strip(),
        "pickupDeadline": pickup_deadline.strip(),
        "pickup_deadline": pickup_deadline.strip(),
        "deadline": pickup_deadline.strip(),
        "status": "available",
        "donor_name": body.get("donor_name") or "You",
        "desc": (body.get("desc") or body.get("description") or "").strip(),
    }
    for field, limit in LABEL_TEXT_LIMITS.items():
        value = body.get(field)
        if value is not None and (not isinstance(value, str) or len(value.strip()) > limit):
            raise HTTPException(
                status_code=400,
                detail=f"{field.replace('_', ' ').capitalize()} must be text of at most {limit} characters.",
            )
        donor_data[field] = clean_label_text(value, limit)

    if body.get("dietary_tags"):
        donor_data["dietary_tags"] = body["dietary_tags"]
    elif body.get("diet"):
        donor_data["dietary_tags"] = [body["diet"]]

    if body.get("img"):
        donor_data["img"] = body["img"]
    elif body.get("image"):
        donor_data["img"] = body["image"]

    try:
        listing_id = save_donor_listing(donor_data)
        return {"id": listing_id, "ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save listing: {str(e)}")

@app.get("/listings")
def list_listings(status: Optional[str] = None):
    if status == "claimed":
        return get_claimed_listings()
    elif status == "picked_up":
        return get_picked_up_listings()
    return get_available_listings()

@app.get("/listings/claimed")
def list_claimed_listings():
    return get_claimed_listings()

@app.get("/listings/picked_up")
def list_picked_up_listings():
    return get_picked_up_listings()

@app.get("/meals")
def get_meals():
    return {"meals_rescued": get_meals_rescued()}

# ---------------------------------------------------------------------------
# POST /listings/draft — analyse a photo with Gemini and return a prefill
# draft with food details and readable package label text. Returns null
# fields instead so the form stays fully usable.
# ---------------------------------------------------------------------------
class DraftRequest(BaseModel):
    image: str          # data-URL or raw base64; mime detected from header
    mime_type: Optional[str] = "image/jpeg"

class DraftResponse(BaseModel):
    title: Optional[str] = None
    servings: Optional[int] = None
    food_category: Optional[FoodCategory] = None
    calories_per_serving: Optional[CalorieRange] = None
    ingredients_text: Optional[str] = None
    allergen_statement: Optional[str] = None
    source: str         # "gemini" | "error"
    error: Optional[str] = None

@app.post("/listings/draft", response_model=DraftResponse)
def create_draft(body: DraftRequest):
    """
    Calls Gemini vision to suggest food details and transcribe readable label text.
    Gemini failures return an empty draft.
    """
    try:
        raw = body.image
        # Strip data-URL header if present (data:image/jpeg;base64,...)
        if raw.startswith("data:"):
            header, _, raw = raw.partition(",")
            # Extract mime from header when not explicitly provided
            if body.mime_type == "image/jpeg" and ";" in header:
                mime_part = header.split(";")[0].split(":")[1]
                if mime_part:
                    body.mime_type = mime_part

        image_bytes = base64.b64decode(raw)
        listing = analyze(image_bytes, body.mime_type)

        # Build a human-readable title from the items list
        title: Optional[str] = None
        if listing.items:
            names = [item.name for item in listing.items if item.name]
            if len(names) == 1:
                title = names[0]
            elif len(names) == 2:
                title = " & ".join(names)
            elif len(names) > 2:
                title = ", ".join(names[:2]) + f" & {len(names) - 2} more"

        servings: Optional[int] = int(listing.est_servings) if listing.est_servings and listing.est_servings > 0 else None

        calories = listing.calories_per_serving
        return DraftResponse(
            title=title,
            servings=servings,
            food_category=listing.food_category,
            calories_per_serving=calories if servings and calories and calories.is_valid() else None,
            ingredients_text=clean_label_text(listing.ingredients_text, LABEL_TEXT_LIMITS["ingredients_text"]),
            allergen_statement=clean_label_text(listing.allergen_statement, LABEL_TEXT_LIMITS["allergen_statement"]),
            source="gemini",
        )

    except Exception as exc:
        logging.warning("Gemini draft failed: %s", exc)
        return DraftResponse(title=None, servings=None, source="error", error=str(exc)[:200])

@app.post("/listings/{listing_id}/claim")
async def claim(listing_id: str, request: Request, receiver_name: Optional[str] = None):
    name = receiver_name
    if not name:
        try:
            body = await request.json()
            if isinstance(body, dict):
                name = body.get("receiver_name") or body.get("receiverName")
        except Exception:
            pass
    if not name:
        name = "Neighbor"

    res = claim_listing(listing_id, name)
    if res == 404:
        raise HTTPException(status_code=404, detail="Listing not found")
    if res == 409:
        raise HTTPException(status_code=409, detail="This listing was already claimed or is no longer available")
    return {"ok": True}

class CancelPickupRequest(BaseModel):
    claimed_at: datetime | None


@app.post("/listings/{listing_id}/cancel-pickup")
def cancel_pickup(listing_id: str, body: CancelPickupRequest):
    result = cancel_pickup_listing(listing_id, body.claimed_at)
    if result == 404:
        raise HTTPException(status_code=404, detail="Listing not found")
    if result == 409:
        raise HTTPException(status_code=409, detail="This pickup is no longer active or the claim has changed")
    return {"ok": True}


@app.post("/listings/{listing_id}/pickup")
def pickup(listing_id: str):
    res = pickup_listing(listing_id)
    if res == 404:
        raise HTTPException(status_code=404, detail="Listing not found")
    if res == 409:
        raise HTTPException(status_code=409, detail="Listing is already picked up or was never claimed")
    return {"ok": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
