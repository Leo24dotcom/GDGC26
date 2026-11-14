import os
import sys
import time
import mimetypes
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import List, Literal

load_dotenv()

MODEL = "gemini-3.5-flash-lite"

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

def analyze(image_bytes: bytes, mime_type: str = "image/jpeg", retries: int = 4) -> Listing:
    """Takes image bytes, returns a Listing. Retries on busy/overloaded errors."""
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
                return resp.parsed
            print(f"Attempt {attempt + 1}: couldn't parse output. Raw: {resp.text}")
        except Exception as e:
            msg = str(e)
            print(f"Attempt {attempt + 1} failed: {msg[:100]}")
            if "404" in msg or "NOT_FOUND" in msg or "API key" in msg:
                raise                      # retrying won't fix these
        time.sleep(2 ** attempt)           # waits 1s, 2s, 4s, 8s
    raise RuntimeError("Gemini failed after all retries")


# Test from the terminal: python gemini_service.py path/to/photo.jpg
if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "photo.jpg"
    mime = mimetypes.guess_type(path)[0] or "image/jpeg"
    with open(path, "rb") as f:
        image_bytes = f.read()

    print("image bytes:", len(image_bytes))
    start = time.time()
    listing = analyze(image_bytes, mime)
    print(f"Took {time.time() - start:.1f}s\n")
    print(listing.model_dump_json(indent=2))