import os
import sys
import json
import time
import mimetypes
from datetime import datetime, timezone
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import List, Literal

load_dotenv()

MODEL = "gemini-3.5-flash-lite"
OUTPUT_FILE = "listings.json"


class FoodItem(BaseModel):
    name: str
    quantity: int
    unit: str
    category: Literal["prepared", "baked", "produce", "packaged", "other"]
    confidence: float


class Listing(BaseModel):
    items: List[FoodItem]
    est_servings: int
    allergens: List[str]
    dietary_tags: List[str]
    safe_hours: float
    storage_notes: str
    needs_human_check: bool


PROMPT = """You are a food-rescue assistant. Analyze the photo of surplus food.
List each distinct item, estimate quantity and servings, flag likely allergens,
and give a CONSERVATIVE safe-to-eat window in hours (never more than 48).
If anything is unclear, lower the confidence and set needs_human_check=true.
Do not guess brand names."""

client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"],
    http_options=types.HttpOptions(timeout=30000),  # 30 seconds, in ms
)


# ---------- File storage (temporary, replace with Firestore later) ----------

def load_listings() -> list:
    try:
        with open(OUTPUT_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _write_listings(records: list):
    with open(OUTPUT_FILE, "w") as f:
        json.dump(records, f, indent=2)


def save_result(listing: Listing) -> dict:
    """Appends a Listing (plus metadata) to listings.json and returns the record."""
    records = load_listings()
    record = listing.model_dump()
    record["id"] = max((r["id"] for r in records), default=0) + 1
    record["created_at"] = datetime.now(timezone.utc).isoformat()
    record["status"] = "available"
    records.append(record)
    _write_listings(records)
    return record


def update_status(listing_id: int, status: str, claimed_by: str | None = None) -> dict | None:
    records = load_listings()
    for r in records:
        if r["id"] == listing_id:
            r["status"] = status
            if claimed_by:
                r["claimed_by"] = claimed_by
            _write_listings(records)
            return r
    return None


# ---------- Gemini ----------

def analyze(image_bytes: bytes, mime_type: str = "image/jpeg", retries: int = 4) -> dict:
    """Takes image bytes, returns the saved listing record (a dict).
    Retries on busy/overloaded errors."""
    for attempt in range(retries):
        try:
            resp = client.models.generate_content(
                model=MODEL,
                contents=[types.Part.from_bytes(data=image_bytes, mime_type=mime_type), PROMPT],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=Listing,
                    temperature=0.2,
                    max_output_tokens=4096,
                    thinking_config=types.ThinkingConfig(thinking_level="low"),
                ),
            )
            if resp.parsed:
                return save_result(resp.parsed)
            print(f"Attempt {attempt + 1}: couldn't parse output. Raw: {resp.text}")
        except Exception as e:
            msg = str(e)
            print(f"Attempt {attempt + 1} failed: {msg[:100]}")
            if "404" in msg or "NOT_FOUND" in msg or "API key" in msg:
                raise  # retrying won't fix these
        time.sleep(2 ** attempt)  # waits 1s, 2s, 4s, 8s
    raise RuntimeError("Gemini failed after all retries")


# Test from the terminal: python gemini_service.py path/to/photo.jpg
if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "photo.jpg"
    mime = mimetypes.guess_type(path)[0] or "image/jpeg"
    with open(path, "rb") as f:
        image_bytes = f.read()

    print("image bytes:", len(image_bytes))
    start = time.time()
    result = analyze(image_bytes, mime)
    print(f"Took {time.time() - start:.1f}s\n")
    print(json.dumps(result, indent=2))