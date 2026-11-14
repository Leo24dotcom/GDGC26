import os
import time
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

# 1. Client with a timeout (REPLACES your old client = ... line)
client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"],
    http_options=types.HttpOptions(timeout=30000),  # 30 seconds, in ms
)

# 2. Load the image
with open("photo.jpg", "rb") as f:
    image_bytes = f.read()

# 3. The two print lines go here, right before the call
print("image bytes:", len(image_bytes))
print("calling Gemini...")

start = time.time()
resp = client.models.generate_content(
    model=MODEL,
    contents=[types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"), PROMPT],
    config=types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=Listing,
        temperature=0.2,
        max_output_tokens=4096,
        thinking_config=types.ThinkingConfig(thinking_level="low"),
    ),
)
print(f"Took {time.time() - start:.1f}s\n")

print(resp.parsed.model_dump_json(indent=2) if resp.parsed else f"Parse failed. Raw: {resp.text}")